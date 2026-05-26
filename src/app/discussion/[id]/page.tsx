"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Discussion, AIProviderConfig, CabinetMember } from "@/lib/types";
import DiscussionView from "@/components/discussion/DiscussionView";
import { getUserId } from "@/lib/user";
import { cabinetMembers as builtInMembers } from "@/data/personas";
import { loadCustomMembers } from "@/lib/members";
import ReactMarkdown from "react-markdown";
import Avatar from "@/components/common/Avatar";

export default function DiscussionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState(false);
  const [customMembers, setCustomMembers] = useState<CabinetMember[]>([]);

  const allMembers = [...builtInMembers, ...customMembers];

  useEffect(() => {
    const userId = getUserId();
    loadCustomMembers(userId).then(setCustomMembers);
    fetch(`/api/discussions?id=${id}&userId=${userId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setDiscussion(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleResume = useCallback(async () => {
    if (!discussion) return;
    setResuming(true);
    // Redirect to the existing discussion page to reconnect SSE
    router.push(`/discussion/resume?id=${discussion.id}`);
  }, [discussion, router]);

  const handleTerminate = useCallback(async () => {
    if (!discussion) return;
    const userId = getUserId();
    const res = await fetch("/api/discussions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: discussion.id, userId, action: "terminate" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setDiscussion(updated);
    }
  }, [discussion]);

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-56px)] items-center justify-center">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!discussion) {
    return (
      <div className="flex h-[calc(100dvh-56px)] flex-col items-center justify-center gap-3">
        <p className="text-sm text-gray-400">讨论不存在</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-md bg-[#1a1a1a] px-4 py-2 text-sm text-white"
        >
          返回首页
        </button>
      </div>
    );
  }

  const isRunning = discussion.status === "running";
  const isCompleted = discussion.status === "completed";
  const isTerminated = discussion.status === "terminated";
  const isFailed = discussion.status === "failed";

  // Always show read-only view — "继续" goes to /discussion/resume for SSE reconnect
  return (
    <div className="flex min-h-[calc(100dvh-56px)] flex-col">
      {/* Header */}
      <div
        className="border-b bg-white/60 px-4 py-3 backdrop-blur-sm md:px-6 md:py-4"
        style={{ borderColor: "rgba(0,0,0,0.06)" }}
      >
        <h2 className="text-base md:text-lg font-bold tracking-tight break-words">{discussion.question}</h2>
        <div className="mt-1 md:mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
          <span>{discussion.messages.length} 条发言</span>
          <StatusBadge status={discussion.status} />
        </div>
        <div className="mt-2 md:mt-3 flex flex-wrap gap-2">
          {isRunning && (
            <button
              onClick={handleResume}
              className="rounded-md bg-[#1a1a1a] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#333]"
            >
              继续讨论
            </button>
          )}
          <button
            onClick={() => router.push("/history")}
            className="rounded-md px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-black/5"
          >
            返回历史
          </button>
          {!isRunning && (
            <button
              onClick={() => router.push("/")}
              className="rounded-md bg-[#1a1a1a] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#333]"
            >
              新讨论
            </button>
          )}
        </div>
      </div>

      {/* Messages - read-only */}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4 md:px-6">
        {discussion.mode === "chat" ? (
          <ChatReadOnlyMessages messages={discussion.messages} allMembers={allMembers} />
        ) : (
          <DebateReadOnlyMessages messages={discussion.messages} allMembers={allMembers} />
        )}
      </div>

      {/* Error info */}
      {isFailed && discussion.error && (
        <div className="mx-3 md:mx-6 mb-4 rounded-md border border-red-200/50 bg-red-50/50 p-3 text-xs text-red-600"
          style={{ borderColor: "rgba(220,38,38,0.15)" }}
        >
          {discussion.error}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Discussion["status"] }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    running: { bg: "rgba(234,179,8,0.1)", color: "#ca8a04", label: "进行中" },
    completed: { bg: "rgba(34,197,94,0.1)", color: "#16a34a", label: "已完成" },
    terminated: { bg: "rgba(107,114,128,0.1)", color: "#6b7280", label: "已终止" },
    failed: { bg: "rgba(239,68,68,0.1)", color: "#ef4444", label: "失败" },
    pending: { bg: "rgba(107,114,128,0.1)", color: "#6b7280", label: "待开始" },
  };
  const s = styles[status] ?? styles.pending;
  return (
    <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function ChatReadOnlyMessages({ messages, allMembers }: { messages: Discussion["messages"]; allMembers: CabinetMember[] }) {
  return messages.map((msg) => {
    const isUser = msg.sender === "user";
    const member = allMembers.find((m) => m.id === msg.speakerId);
    const color = msg.speakerColor || member?.color || "#6b7280";
    const avatar = msg.speakerAvatar || member?.avatar;
    const name = msg.speakerName || member?.nameZh || msg.speakerId;
    if (isUser) {
      return (
        <div key={msg.id} className="flex justify-end">
          <div
            className="max-w-[90%] md:max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
            style={{ backgroundColor: "rgba(0,0,0,0.05)" }}
          >
            {msg.content}
          </div>
        </div>
      );
    }
    return (
      <div key={msg.id} className="flex gap-2.5">
        <Avatar src={avatar || undefined} name={name} color={color} size={32} />
        <div className="min-w-0 max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
          style={{ backgroundColor: "rgba(0,0,0,0.02)" }}
        >
          <span className="mb-1 block text-xs font-semibold" style={{ color }}>
            {name}
          </span>
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        </div>
      </div>
    );
  });
}

function DebateReadOnlyMessages({ messages, allMembers }: { messages: Discussion["messages"]; allMembers: CabinetMember[] }) {
  return messages.map((msg) => {
    const member = allMembers.find((m) => m.id === msg.speakerId);
    const color = msg.speakerId === "moderator" ? "#6b7280" : (msg.speakerColor || member?.color || "#6b7280");
    const avatar = msg.speakerId === "moderator" ? null : (msg.speakerAvatar || member?.avatar);
    const name = msg.speakerId === "moderator" ? "主持人" : (msg.speakerName || member?.nameZh || msg.speakerId);
    return (
      <div
        key={msg.id}
        className="rounded-md border bg-white/60 p-3 md:p-4 backdrop-blur-sm"
        style={{ borderColor: "rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <Avatar src={avatar || undefined} name={name} color={color} size={20} />
          <span className="text-xs font-semibold text-gray-900">
            {name}
          </span>
          {msg.round > 0 && (
            <span className="text-xs text-gray-400">第{msg.round}轮</span>
          )}
        </div>
        <div className="mt-2 text-sm leading-relaxed text-gray-700 markdown-content">
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        </div>
      </div>
    );
  });
}
