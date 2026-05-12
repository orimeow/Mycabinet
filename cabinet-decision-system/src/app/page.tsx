"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cabinetMembers } from "@/data/personas";
import MemberCard from "@/components/cabinet/MemberCard";
import { AIProviderConfig } from "@/lib/types";

const exampleQuestions = [
  "AI 是否会取代人类工作？我们该如何应对？",
  "面对气候变化，个人、企业和政府应该如何分工承担责任？",
  "全球化和逆全球化趋势下，发展中国家应该如何选择发展道路？",
];

export default function Home() {
  const router = useRouter();
  const [question, setQuestion] = useState("");

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

      <main className="relative mx-auto max-w-7xl px-4 pb-20 pt-8 md:px-8">
        {/* Cabinet members - Equal-sized grid */}
        <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {cabinetMembers.map((member) => (
            <div key={member.id}>
              <MemberCard member={member} />
            </div>
          ))}
        </div>

        {/* Question input + Examples */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Question card */}
          <div className="rounded-3xl border bg-white/80 p-6 backdrop-blur-sm lg:col-span-2"
            style={{ borderColor: 'rgba(0,0,0,0.06)' }}
          >
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
              提出你的问题
            </p>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="例如：AI 是否会取代人类工作？我们该如何应对？"
              className="h-32 w-full resize-none rounded-xl border bg-white/60 p-4 text-sm leading-relaxed
                placeholder:text-gray-300 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
              style={{ borderColor: 'rgba(0,0,0,0.06)' }}
              maxLength={2000}
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-400">{question.length} / 2000</span>
              <button
                onClick={handleSubmit}
                disabled={!question.trim()}
                className="rounded-xl bg-[#1a1a1a] px-6 py-3 text-sm font-semibold text-white
                  transition-all hover:bg-[#333] hover:scale-[1.02] active:scale-[0.98]
                  disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                开始讨论 →
              </button>
            </div>
          </div>

          {/* Examples card */}
          <div className="rounded-3xl bg-gradient-to-br from-pink-400 via-rose-400 to-orange-400 p-6 text-white">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/60">
              试试这些问题
            </p>
            <div className="space-y-2">
              {exampleQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setQuestion(q)}
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-left text-sm text-white/80
                    transition-all hover:bg-white/20 hover:text-white active:scale-[0.98]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
