"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Discussion, AIProviderConfig } from "@/lib/types";
import DiscussionView from "@/components/discussion/DiscussionView";
import { getUserId } from "@/lib/user";

export default function DiscussionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    const userId = getUserId();
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
      <div className="flex h-[calc(100vh-60px)] items-center justify-center">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!discussion) {
    return (
      <div className="flex h-[calc(100vh-60px)] flex-col items-center justify-center gap-3">
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

  // If running, show DiscussionView to resume
  if (isRunning) {
    return (
      <div>
        <DiscussionView
          question={discussion.question}
          config={{
            provider: discussion.provider as AIProviderConfig["provider"],
            model: "",
          }}
          userId={discussion.userId}
          existingMessages={discussion.messages}
          discussionId={discussion.id}
        />
      </div>
    );
  }

  // Completed, terminated, or failed — show read-only view
  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col">
      {/* Header */}
      <div
        className="border-b bg-white/60 px-6 py-4 backdrop-blur-sm"
        style={{ borderColor: "rgba(0,0,0,0.06)" }}
      >
        <h2 className="text-lg font-bold tracking-tight">{discussion.question}</h2>
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
          <span>{discussion.messages.length} 条发言</span>
          <StatusBadge status={discussion.status} />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => router.push("/history")}
            className="rounded-md px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-black/5"
          >
            返回历史
          </button>
          <button
            onClick={() => router.push("/")}
            className="rounded-md bg-[#1a1a1a] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#333]"
          >
            新讨论
          </button>
        </div>
      </div>

      {/* Messages - read-only */}
      <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
        {discussion.messages.map((msg) => (
          <MessageCard key={msg.id} message={msg} />
        ))}
      </div>

      {/* Error info */}
      {isFailed && discussion.error && (
        <div className="mx-6 mb-4 rounded-md border border-red-200/50 bg-red-50/50 p-3 text-xs text-red-600"
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

function MessageCard({ message }: { message: { id: string; round: number; speakerId: string; speakerName?: string; content: string } }) {
  const isModerator = message.speakerId === "moderator";
  return (
    <div
      className="rounded-md border bg-white/60 p-4 backdrop-blur-sm"
      style={{ borderColor: "rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-900">
          {isModerator ? "主持人" : message.speakerName || message.speakerId}
        </span>
        <span className="text-xs text-gray-400">第{message.round}轮</span>
      </div>
      <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
        {message.content}
      </div>
    </div>
  );
}
