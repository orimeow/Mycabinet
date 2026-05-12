"use client";

import { cabinetMembers } from "@/data/personas";
import { useState } from "react";

export default function MembersPage() {
  const [selectedId, setSelectedId] = useState(cabinetMembers[0].id);
  const selected = cabinetMembers.find((m) => m.id === selectedId)!;

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
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">内阁成员</h1>
          <p className="mt-2 text-sm text-gray-400">点击左侧成员查看完整人设文档</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Sidebar - member list */}
          <div className="md:col-span-3">
            <div className="space-y-2">
              {cabinetMembers.map((m) => {
                const active = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all duration-200"
                    style={{
                      backgroundColor: active ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.5)',
                      borderColor: active ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.04)',
                      borderWidth: 1,
                    }}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.nameZh.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{m.nameZh}</div>
                      <div className="truncate text-xs text-gray-400">{m.title.split('/')[0]}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail panel */}
          <div className="md:col-span-9">
            <div className="rounded-3xl border bg-white/80 p-8 backdrop-blur-sm"
              style={{ borderColor: 'rgba(0,0,0,0.06)' }}
            >
              {/* Header */}
              <div className="mb-8 flex items-start gap-4">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg"
                  style={{ backgroundColor: selected.color }}
                >
                  {selected.nameZh.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{selected.nameZh}</h2>
                  <p className="text-sm text-gray-400">{selected.nameEn}</p>
                  <p className="mt-1 text-xs text-gray-400">{selected.title}</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Biography */}
                <div className="md:col-span-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">生平</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{selected.persona.biography}</p>
                </div>

                {/* Core Values */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">核心价值观</h3>
                  <ul className="mt-3 space-y-2">
                    {selected.persona.coreValues.map((v, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: selected.color }}
                        />
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Decision Framework */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">决策框架</h3>
                  <ul className="mt-3 space-y-2">
                    {selected.persona.decisionFramework.map((v, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: selected.color }}
                        />
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Speaking Style */}
                <div className="md:col-span-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">说话风格</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{selected.persona.speakingStyle}</p>
                </div>

                {/* Biases */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">已知偏见</h3>
                  <ul className="mt-3 space-y-2">
                    {selected.persona.biases.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: selected.color }}
                        />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Catchphrases */}
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">名言</h3>
                  <ul className="mt-3 space-y-2">
                    {selected.persona.catchphrases.map((p, i) => (
                      <li key={i} className="text-sm italic leading-relaxed text-gray-600">
                        &ldquo;{p}&rdquo;
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Historical Views */}
                {Object.keys(selected.persona.historicalViews).length > 0 && (
                  <div className="md:col-span-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">历史观点</h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {Object.entries(selected.persona.historicalViews).map(([topic, view]) => (
                        <div
                          key={topic}
                          className="rounded-2xl p-4"
                          style={{ backgroundColor: `${selected.color}06` }}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: selected.color }}>
                            {topic}
                          </p>
                          <p className="text-sm leading-relaxed text-gray-600">{view}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
