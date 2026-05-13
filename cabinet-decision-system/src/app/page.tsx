"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cabinetMembers } from "@/data/personas";
import { AIProviderConfig } from "@/lib/types";
import { getUserId } from "@/lib/user";

const exampleQuestions = [
  "AI 是否会取代人类工作？我们该如何应对？",
  "面对气候变化，个人、企业和政府应该如何分工承担责任？",
  "全球化和逆全球化趋势下，发展中国家应该如何选择发展道路？",
];

export default function Home() {
  const router = useRouter();
  const [question, setQuestion] = useState("");

  useEffect(() => {
    getUserId(); // ensure device ID exists
  }, []);

  const handleSubmit = () => {
    if (!question.trim()) return;

    const config: AIProviderConfig = {
      provider: (localStorage.getItem("ai-provider") as AIProviderConfig["provider"]) || "openrouter",
      apiKey: localStorage.getItem("ai-api-key") || "",
      model: localStorage.getItem("ai-model") || "google/gemma-4-31b-it:free",
      baseUrl: localStorage.getItem("ai-base-url") || undefined,
    };

    if (config.provider !== "ollama" && !config.apiKey) {
      alert("请先在设置页面配置 API Key");
      router.push("/settings");
      return;
    }

    sessionStorage.setItem("pending-question", question);
    sessionStorage.setItem("pending-config", JSON.stringify(config));
    router.push(`/discussion/new`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Gradient mesh background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-pink-200/40 to-orange-200/40 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-teal-200/30 to-cyan-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-purple-200/20 to-pink-200/20 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-4xl px-6 pb-20 pt-10">
        {/* Question input */}
        <div className="rounded-md border bg-white/60 p-6 backdrop-blur-sm"
          style={{ borderColor: 'rgba(0,0,0,0.08)' }}
        >
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSubmit();
            }}
            placeholder="你想讨论什么问题？"
            className="w-full resize-none bg-transparent px-4 py-4 text-lg leading-relaxed
              placeholder:text-gray-500 focus:outline-none"
            rows={5}
            maxLength={2000}
          />
          <div className="mt-3 flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {exampleQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setQuestion(q)}
                  className="rounded-md px-3 py-1.5 text-xs text-gray-400 transition-all hover:bg-teal-50/60 hover:text-gray-600"
                >
                  {q}
                </button>
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!question.trim()}
              className="ml-4 shrink-0 rounded-md bg-[#1a1a1a] px-6 py-2.5 text-sm font-semibold text-white
                transition-all hover:bg-[#333] active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-100"
            >
              开始讨论 →
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="my-10 flex items-center gap-4">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
            参与讨论
          </span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Member avatars */}
        <div className="flex justify-center gap-10">
          {cabinetMembers.map((member) => (
            <div key={member.id} className="flex flex-col items-center gap-2">
              <div
                className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.03)',
                  borderColor: 'rgba(0,0,0,0.15)',
                }}
              >
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt={member.nameZh}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-gray-400">
                    {member.nameZh.charAt(0)}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-gray-700">{member.nameZh}</span>
              <span className="text-xs text-gray-400">{member.nameEn}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
