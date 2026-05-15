"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Discussion } from "@/lib/types";
import { getUserId } from "@/lib/user";

const STATUS_LABELS: Record<string, string> = {
  running: "进行中",
  completed: "已完成",
  terminated: "已终止",
  failed: "失败",
  pending: "待开始",
};

const MODE_LABELS: Record<string, string> = {
  debate: "辩论",
  chat: "聊天",
};

const MODE_BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  debate: { bg: "rgba(139,92,246,0.1)", color: "#7c3aed" },
  chat: { bg: "rgba(6,182,212,0.1)", color: "#0891b2" },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  running: { bg: "rgba(234,179,8,0.1)", color: "#ca8a04" },
  completed: { bg: "rgba(34,197,94,0.1)", color: "#16a34a" },
  terminated: { bg: "rgba(107,114,128,0.1)", color: "#6b7280" },
  failed: { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
  pending: { bg: "rgba(107,114,128,0.1)", color: "#6b7280" },
};

export default function HistoryPage() {
  const router = useRouter();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = getUserId();
    fetch(`/api/discussions?userId=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        setDiscussions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleTerminate = async (id: string) => {
    const userId = getUserId();
    const res = await fetch("/api/discussions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, userId, action: "terminate" }),
    });
    if (res.ok) {
      setDiscussions((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, status: "terminated" as const, terminatedAt: new Date().toISOString() } : d
        )
      );
    }
  };

  const handleDelete = async (id: string) => {
    const userId = getUserId();
    await fetch("/api/discussions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, userId }),
    });
    setDiscussions((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-pink-200/40 to-orange-200/40 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-teal-200/30 to-cyan-200/30 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-7xl px-4 py-8 md:px-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">历史记录</h1>
          <p className="mt-2 text-sm text-gray-400">回顾过往的智囊团讨论记录</p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400">加载中...</div>
        ) : discussions.length === 0 ? (
          <div
            className="rounded-md border bg-white/80 py-20 text-center backdrop-blur-sm"
            style={{ borderColor: "rgba(0,0,0,0.06)" }}
          >
            <p className="text-lg text-gray-400">暂无讨论记录</p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 rounded-md bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#333]"
            >
              发起第一个讨论
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {discussions.map((d) => {
              const statusStyle = STATUS_COLORS[d.status] ?? STATUS_COLORS.pending;
              return (
                <div
                  key={d.id}
                  className="group rounded-md border bg-white/80 p-5 transition-all duration-200 hover:bg-white hover:shadow-sm cursor-pointer"
                  style={{ borderColor: "rgba(0,0,0,0.06)" }}
                  onClick={() => router.push(`/discussion/${d.id}`)}
                >
                  <h3
                    className="line-clamp-2 text-sm font-semibold transition-colors hover:text-gray-500"
                  >
                    {d.question}
                  </h3>

                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                    <span>
                      {new Date(d.createdAt).toLocaleString("zh-CN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {(() => {
                      const modeBadge = MODE_BADGE_COLORS[d.mode ?? "debate"];
                      return (
                        <span
                          className="rounded-full px-2 py-0.5 font-medium"
                          style={{ backgroundColor: modeBadge.bg, color: modeBadge.color }}
                        >
                          {MODE_LABELS[d.mode ?? "debate"]}
                        </span>
                      );
                    })()}
                    <span
                      className="rounded-full px-2 py-0.5"
                      style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                    >
                      {STATUS_LABELS[d.status] ?? d.status}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{d.messages.length} 条发言</span>
                    <div className="flex gap-1">
                      {/* View - always shown */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/discussion/${d.id}`);
                        }}
                        className="rounded-md px-2.5 py-1.5 text-xs text-gray-500 transition-all hover:bg-black/5"
                      >
                        查看
                      </button>
                      {/* Terminate - only for running */}
                      {d.status === "running" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTerminate(d.id);
                          }}
                          className="rounded-md px-2.5 py-1.5 text-xs text-red-500 transition-all hover:bg-red-50"
                        >
                          终止
                        </button>
                      )}
                      {/* Delete - always shown */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(d.id);
                        }}
                        className="rounded-md px-2.5 py-1.5 text-xs text-gray-400 transition-all hover:bg-red-50 hover:text-red-500"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
