"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Discussion } from "@/lib/types";

export default function HistoryPage() {
  const router = useRouter();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/discussions")
      .then((res) => res.json())
      .then((data) => {
        setDiscussions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    await fetch("/api/discussions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
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
          <div className="rounded-3xl border bg-white/80 py-20 text-center backdrop-blur-sm"
            style={{ borderColor: 'rgba(0,0,0,0.06)' }}
          >
            <p className="text-lg text-gray-400">暂无讨论记录</p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 rounded-xl bg-[#1a1a1a] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#333]"
            >
              发起第一个讨论
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {discussions.map((d) => (
              <div
                key={d.id}
                className="group rounded-3xl border bg-white/80 p-5 transition-all duration-200 hover:bg-white hover:shadow-sm"
                style={{ borderColor: 'rgba(0,0,0,0.06)' }}
              >
                <h3 className="line-clamp-2 text-sm font-semibold">{d.question}</h3>

                <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                  <span>{new Date(d.createdAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <span
                    className="rounded-full px-2 py-0.5"
                    style={{
                      backgroundColor: d.status === "completed" ? "rgba(34,197,94,0.1)" : "rgba(0,0,0,0.04)",
                      color: d.status === "completed" ? "#16a34a" : "#6b7280",
                    }}
                  >
                    {d.status === "completed" ? "已完成" : "进行中"}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-gray-400">{d.messages.length} 条发言</span>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="rounded-lg px-2.5 py-1.5 text-xs text-gray-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
