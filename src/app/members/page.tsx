"use client";

import { cabinetMembers as builtInMembers } from "@/data/personas";
import type { CabinetMember } from "@/lib/types";
import { useState, useEffect, Suspense, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { loadCustomMembers, invalidateCache } from "@/lib/members";
import { getUserId } from "@/lib/user";
import Avatar from "@/components/common/Avatar";
import { useI18n } from "@/lib/i18n";

function DetailContent({ selected, mobile, onEdit, onDelete }: { selected: CabinetMember; mobile?: boolean; onEdit?: () => void; onDelete?: () => void }) {
  const { t } = useI18n();
  const isCustom = selected.source === "custom";
  return (
    <div className={mobile ? "rounded-md border bg-white/80 p-4 backdrop-blur-sm" : "rounded-md border bg-white/80 p-4 md:p-8 backdrop-blur-sm"}
      style={{ borderColor: 'rgba(0,0,0,0.06)' }}
    >
      {/* Header */}
      <div className={mobile ? "mb-5 flex items-start justify-between gap-3" : "mb-5 md:mb-8 flex items-start justify-between gap-3"}>
        <div className="flex items-start gap-3">
          <Avatar src={selected.avatar} name={selected.nameZh} color={selected.color} size={48} />
          <div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight">{selected.nameZh}</h2>
            <p className="text-sm text-gray-400">{selected.nameEn}</p>
            <p className="mt-0.5 text-xs text-gray-400">{selected.title}</p>
            {isCustom && (
              <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{t("members.source.custom")}</span>
            )}
          </div>
        </div>
        {isCustom && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={onEdit}
              className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-black/5"
            >
              {t("common.edit")}
            </button>
            <button
              onClick={onDelete}
              disabled={!onDelete}
              className="rounded-md px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-50 disabled:opacity-40"
            >
              {t("common.delete")}
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2">
        {/* Biography */}
        <div className="col-span-2">
          <h3 className="text-sm font-bold text-gray-900">{t("members.biography")}</h3>
          <p className="mt-2 text-xs leading-relaxed text-gray-600">{selected.persona.biography}</p>
        </div>

        {/* Core Values */}
        <div>
          <h3 className="text-sm font-bold text-gray-900">{t("members.coreValues")}</h3>
          <ul className="mt-2 space-y-1.5">
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
          <h3 className="text-sm font-bold text-gray-900">{t("members.decisionFramework")}</h3>
          <ul className="mt-2 space-y-1.5">
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
        <div className="col-span-2">
          <h3 className="text-sm font-bold text-gray-900">{t("members.speakingStyle")}</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{selected.persona.speakingStyle}</p>
        </div>

        {/* Biases */}
        <div>
          <h3 className="text-sm font-bold text-gray-900">{t("members.biases")}</h3>
          <ul className="mt-2 space-y-1.5">
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
          <h3 className="text-sm font-bold text-gray-900">{t("members.catchphrases")}</h3>
          <ul className="mt-2 space-y-1.5">
            {selected.persona.catchphrases.map((p, i) => (
              <li key={i} className="text-sm italic leading-relaxed text-gray-600">
                &ldquo;{p}&rdquo;
              </li>
            ))}
          </ul>
        </div>

        {/* Historical Views */}
        {Object.keys(selected.persona.historicalViews).length > 0 && (
          <div className="col-span-2">
            <h3 className="text-sm font-bold text-gray-900">{t("members.historicalViews")}</h3>
            <div className="mt-2 grid gap-3 grid-cols-1">
              {Object.entries(selected.persona.historicalViews).map(([topic, view]) => {
                const topicLabels: Record<string, string> = {
                  ai: t("members.topicLabel.ai"),
                  education: t("members.topicLabel.education"),
                  climate: t("members.topicLabel.climate"),
                  government: t("members.topicLabel.government"),
                  wealth: t("members.topicLabel.wealth"),
                };
                return (
                  <div
                    key={topic}
                    className="rounded-md p-3"
                    style={{ backgroundColor: `${selected.color}06` }}
                  >
                    <p className="text-sm font-semibold mb-1" style={{ color: selected.color }}>
                      {topicLabels[topic] || topic}
                    </p>
                    <p className="text-xs leading-relaxed text-gray-600">{view}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MembersPageContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(builtInMembers[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollThumb, setScrollThumb] = useState({ left: 0, width: 80 });
  const [customMembers, setCustomMembers] = useState<CabinetMember[]>([]);
  const [userId, setUserId] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const allMembers = [...builtInMembers, ...customMembers];

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ratio = el.clientWidth / el.scrollWidth;
    if (ratio >= 1) {
      setScrollThumb({ left: 0, width: 80 });
      return;
    }
    const scrollRatio = el.scrollLeft / (el.scrollWidth - el.clientWidth);
    const trackWidth = 80;
    const thumbWidth = ratio * trackWidth;
    const maxLeft = trackWidth - thumbWidth;
    setScrollThumb({
      left: scrollRatio * maxLeft,
      width: thumbWidth,
    });
  }, []);

  useEffect(() => {
    handleScroll();
    const uid = getUserId();
    setUserId(uid);
    // Always invalidate cache on mount to ensure fresh data
    invalidateCache();
    loadCustomMembers(uid).then(setCustomMembers);
  }, []);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id && allMembers.some((m) => m.id === id)) {
      setSelectedId(id);
    }
  }, [searchParams, allMembers.length]);

  const selected = allMembers.find((m) => m.id === selectedId) || builtInMembers[0];

  const handleDelete = async (memberId: string) => {
    if (!confirm(t("members.deleteConfirm", { name: "" }))) return;
    if (deletingId) return;
    setDeletingId(memberId);
    try {
      const res = await fetch(`/api/members?id=${memberId}&userId=${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "删除失败");
      }
      invalidateCache();
      setCustomMembers((prev) => prev.filter((m) => m.id !== memberId));
      if (selectedId === memberId) setSelectedId(builtInMembers[0].id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-pink-200/40 to-orange-200/40 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-teal-200/30 to-cyan-200/30 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        {/* Title */}
        <div className="mb-6 md:mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight md:text-4xl">{t("members.title")}</h1>
            <p className="mt-2 text-sm text-gray-400">{t("members.pageSubtitle")}</p>
          </div>
          <button
            onClick={() => router.push("/members/edit")}
            className="shrink-0 rounded-md bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#333] active:scale-[0.98]"
          >
            {t("members.createMember")}
          </button>
        </div>

        {/* Mobile: horizontal avatar tabs */}
        <div className="md:hidden mb-3">
          <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-hide" onScroll={handleScroll}>
            {allMembers.map((m) => {
              const active = m.id === selectedId;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className="flex flex-col items-center gap-1.5 shrink-0"
                >
                  <Avatar src={m.avatar} name={m.nameZh} color={m.color} size={56} className="transition-all" />
                  <span className={`text-xs whitespace-nowrap ${active ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
                    {m.nameZh}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Custom scroll indicator */}
          {scrollThumb.width < 80 && (
            <div className="mt-2 h-1 w-20 mx-auto rounded-full bg-black/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-black/15 transition-[transform,width] duration-75"
                style={{ width: `${scrollThumb.width}px`, transform: `translateX(${scrollThumb.left}px)` }}
              />
            </div>
          )}
        </div>

        {/* Mobile: detail panel */}
        <div className="md:hidden">
          <DetailContent
            selected={selected}
            mobile
            onEdit={() => router.push(`/members/edit?id=${selected.id}`)}
            onDelete={() => handleDelete(selected.id)}
          />
        </div>

        <div className="hidden md:grid md:grid-cols-12 gap-6">
          {/* Sidebar - member list (desktop only) */}
          <div className="hidden md:col-span-3 md:block">
            <div className="space-y-2">
              {allMembers.map((m) => {
                const active = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-left transition-all duration-200"
                    style={{
                      backgroundColor: active ? '#1a1a1a' : 'rgba(255,255,255,0.5)',
                      borderColor: active ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)',
                      borderWidth: 1,
                    }}
                  >
                    <Avatar src={m.avatar} name={m.nameZh} color={m.color} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-semibold ${active ? 'text-white' : ''}`}>{m.nameZh}</div>
                      <div className={`truncate text-xs ${active ? 'text-white/50' : 'text-gray-400'}`}>{m.title.split('/')[0]}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail panel */}
          <div className="md:col-span-9">
            <div className="rounded-md border bg-white/80 p-4 md:p-8 backdrop-blur-sm"
              style={{ borderColor: 'rgba(0,0,0,0.06)' }}
            >
              {/* Header */}
              <div className="mb-5 md:mb-8 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Avatar src={selected.avatar} name={selected.nameZh} color={selected.color} size={48} className="md:!h-16 md:!w-16" />
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight">{selected.nameZh}</h2>
                    <p className="text-sm text-gray-400">{selected.nameEn}</p>
                    <p className="mt-0.5 md:mt-1 text-xs text-gray-400">{selected.title}</p>
                    {selected.source === "custom" && (
                      <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{t("members.source.custom")}</span>
                    )}
                  </div>
                </div>
                {selected.source === "custom" && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => router.push(`/members/edit?id=${selected.id}`)}
                      className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-black/5"
                    >
                      {t("common.edit")}
                    </button>
                    <button
                      onClick={() => handleDelete(selected.id)}
                      disabled={deletingId === selected.id}
                      className="rounded-md px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-50 disabled:opacity-40"
                    >
                      {deletingId === selected.id ? t("members.deleting") : t("common.delete")}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:gap-6 md:grid-cols-2">
                {/* Biography */}
                <div className="md:col-span-2">
                  <h3 className="text-sm md:text-base font-bold text-gray-900">{t("members.biography")}</h3>
                  <p className="mt-2 text-xs md:text-sm leading-relaxed text-gray-600">{selected.persona.biography}</p>
                </div>

                {/* Core Values */}
                <div>
                  <h3 className="text-sm md:text-base font-bold text-gray-900">{t("members.coreValues")}</h3>
                  <ul className="mt-2 md:mt-3 space-y-1.5 md:space-y-2">
                    {selected.persona.coreValues.map((v, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs md:text-sm text-gray-600">
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
                  <h3 className="text-sm md:text-base font-bold text-gray-900">{t("members.decisionFramework")}</h3>
                  <ul className="mt-2 md:mt-3 space-y-1.5 md:space-y-2">
                    {selected.persona.decisionFramework.map((v, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs md:text-sm text-gray-600">
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
                  <h3 className="text-sm md:text-base font-bold text-gray-900">{t("members.speakingStyle")}</h3>
                  <p className="mt-2 text-xs md:text-sm leading-relaxed text-gray-600">{selected.persona.speakingStyle}</p>
                </div>

                {/* Biases */}
                <div>
                  <h3 className="text-sm md:text-base font-bold text-gray-900">{t("members.biases")}</h3>
                  <ul className="mt-2 md:mt-3 space-y-1.5 md:space-y-2">
                    {selected.persona.biases.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs md:text-sm text-gray-600">
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
                  <h3 className="text-sm md:text-base font-bold text-gray-900">{t("members.catchphrases")}</h3>
                  <ul className="mt-2 md:mt-3 space-y-1.5 md:space-y-2">
                    {selected.persona.catchphrases.map((p, i) => (
                      <li key={i} className="text-xs md:text-sm italic leading-relaxed text-gray-600">
                        &ldquo;{p}&rdquo;
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Historical Views */}
                {Object.keys(selected.persona.historicalViews).length > 0 && (
                  <div className="md:col-span-2">
                    <h3 className="text-sm md:text-base font-bold text-gray-900">{t("members.historicalViews")}</h3>
                    <div className="mt-2 md:mt-3 grid gap-3 md:grid-cols-2">
                      {Object.entries(selected.persona.historicalViews).map(([topic, view]) => {
                        const topicLabels: Record<string, string> = {
                          ai: t("members.topicLabel.ai"),
                          education: t("members.topicLabel.education"),
                          climate: t("members.topicLabel.climate"),
                          government: t("members.topicLabel.government"),
                          wealth: t("members.topicLabel.wealth"),
                        };
                        return (
                          <div
                            key={topic}
                            className="rounded-md p-3 md:p-4"
                            style={{ backgroundColor: `${selected.color}06` }}
                          >
                            <p className="text-sm font-semibold mb-1" style={{ color: selected.color }}>
                              {topicLabels[topic] || topic}
                            </p>
                            <p className="text-xs md:text-sm leading-relaxed text-gray-600">{view}</p>
                          </div>
                        );
                      })}
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

export default function MembersPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-sm text-gray-400">...</div>}>
      <MembersPageContent />
    </Suspense>
  );
}
