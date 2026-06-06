"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cabinetMembers as builtInMembers } from "@/data/personas";
import { AIProviderConfig, CabinetMember } from "@/lib/types";
import { getUserId, getUserName, hasUserName, setUserName, checkApiConfig, isOnboardingComplete, markOnboardingComplete } from "@/lib/user";
import { loadCustomMembers } from "@/lib/members";
import MemberPicker from "@/components/common/MemberPicker";
import { useI18n } from "@/lib/i18n";
import { getMemberName, getMemberTitle } from "@/lib/members";


function getRandomQuestions(pool: string[], count: number, seed: number): string[] {
  let x = seed;
  const seededRandom = () => {
    x = (x * 1664525 + 1013904223) & 0xffffffff;
    return (x >>> 0) / 4294967296;
  };
  const shuffled = [...pool].sort(() => seededRandom() - 0.5);
  return shuffled.slice(0, count);
}

export default function Home() {
  const { t, locale } = useI18n();
  const router = useRouter();

  const debateQuestions = useMemo(
    () => Array.from({ length: 20 }, (_, i) => t(`home.debateQ.${i}`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );
  const chatQuestions = useMemo(
    () => Array.from({ length: 20 }, (_, i) => t(`home.chatQ.${i}`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );
  const [mode, setMode] = useState<"debate" | "chat">("debate");
  const [question, setQuestion] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showApiSetupModal, setShowApiSetupModal] = useState(false);
  const [customMembers, setCustomMembers] = useState<CabinetMember[]>([]);
  const [hasApiConfig, setHasApiConfig] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showOnboardingComplete, setShowOnboardingComplete] = useState(false);
  // SSR: show first 3 questions (deterministic). Client: randomize after mount.
  const [displayedQuestions, setDisplayedQuestions] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const didSelectInSession = useRef(false);
  const activeAtPos = useRef<number | null>(null);

  const allMembers = useMemo(
    () => [...builtInMembers, ...customMembers],
    [customMembers]
  );

  useEffect(() => {
    const uid = getUserId();
    loadCustomMembers(uid).then(setCustomMembers);
    // Randomize questions only on client
    setDisplayedQuestions(getRandomQuestions(debateQuestions, 3, Math.floor(Math.random() * 10000)));

    // Check API config
    const configOk = checkApiConfig();
    setHasApiConfig(configOk);

    // Show name modal first (if no name), then API modal (if no config)
    if (!hasUserName()) {
      setShowNameModal(true);
    } else if (!configOk) {
      setShowApiSetupModal(true);
    } else if (!isOnboardingComplete()) {
      // Both name and API are set, but onboarding not yet marked complete
      setShowOnboardingComplete(true);
    }

    // Listen for config changes from other tabs/pages
    const onStorage = () => {
      setHasApiConfig(checkApiConfig());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const pool = mode === "debate" ? debateQuestions : chatQuestions;
    setDisplayedQuestions(getRandomQuestions(pool, 3, Math.floor(Math.random() * 10000)));
  }, [mode, debateQuestions, chatQuestions]);

  // Track @ character in textarea
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const cursorPos = e.target.selectionStart ?? value.length;
      setQuestion(value);

      // Check if there's a fresh @ before cursor (not part of an email or completed @mention)
      const textBeforeCursor = value.slice(0, cursorPos);
      const lastAt = textBeforeCursor.lastIndexOf("@");
      if (lastAt !== -1) {
        // Ensure @ is not preceded by a word char (avoid triggering on emails like user@example)
        if (lastAt > 0 && /\w/.test(textBeforeCursor[lastAt - 1])) {
          setShowPicker(false);
          activeAtPos.current = null;
          return;
        }
        const afterAt = textBeforeCursor.slice(lastAt + 1);
        // Only show picker if @ is followed by 0-20 letters/Chinese chars (still being typed)
        if (/^[a-zA-Z一-龥]{0,20}$/.test(afterAt)) {
          activeAtPos.current = lastAt;
          setShowPicker(true);
          return;
        }
      }
      // Don't auto-close — let user keep the picker open to @ more members
    },
    []
  );

  const handleSelectMember = useCallback(
    (memberId: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const member = allMembers.find((m) => m.id === memberId);
      const displayName = member ? getMemberName(member, locale) : memberId;

      const value = textarea.value;
      const targetAt = activeAtPos.current;

      // Use the tracked @ position from handleInputChange
      // Only fall back to scanning if no position was tracked
      let pos: number;
      if (targetAt != null && targetAt < value.length && value[targetAt] === "@") {
        pos = targetAt;
      } else {
        pos = -1;
      }

      const newText =
        pos >= 0
          ? value.slice(0, pos) + "@" + displayName + " "
          : value + "@" + displayName + " ";

      didSelectInSession.current = true;
      setQuestion(newText);
      setSelectedIds((prev) => (prev.includes(memberId) ? prev : [...prev, memberId]));
      activeAtPos.current = null;

      const newCursorPos = pos >= 0 ? pos + displayName.length + 2 : value.length + displayName.length + 2;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [allMembers]
  );

  const handleClosePicker = useCallback(() => {
    // Remove orphan @ only if no member was selected in this session
    if (!didSelectInSession.current) {
      const textarea = textareaRef.current;
      if (textarea) {
        const value = textarea.value;
        const cursorPos = textarea.selectionStart ?? value.length;
        const beforeCursor = value.slice(0, cursorPos);
        const afterCursor = value.slice(cursorPos);
        if (beforeCursor.endsWith("@")) {
          setQuestion(value.slice(0, cursorPos - 1) + afterCursor);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(cursorPos - 1, cursorPos - 1);
          }, 0);
        }
      }
    }
    didSelectInSession.current = false;
    setShowPicker(false);
  }, []);

  const removeMember = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
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
      setShowApiSetupModal(true);
      return;
    }

    // Store question + mode + memberIds in sessionStorage for discussion/new page
    // DO NOT store API key — discussion/new reads config from localStorage directly
    sessionStorage.setItem("pending-question", question);
    sessionStorage.setItem("pending-config", JSON.stringify({ mode, selectedMemberIds: selectedIds }));
    router.push(`/discussion/new`);
  };

  const canSubmit = question.trim() && question.replace(/@[^\s]+/g, "").trim().length > 0 && selectedIds.length >= (mode === "debate" ? 2 : 1);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Gradient mesh background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-pink-200/40 to-orange-200/40 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-teal-200/30 to-cyan-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-purple-200/20 to-pink-200/20 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-4xl px-4 pb-20 pt-8 md:px-6 md:pt-10">
        {/* API config banner */}
        {!hasApiConfig && (
          <div
            className="mb-4 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
            style={{ backgroundColor: "#fffbeb", borderColor: "#fcd34d" }}
          >
            <svg className="h-5 w-5 flex-shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 17.25a5.25 5.25 0 100-10.5 5.25 5.25 0 000 10.5z" />
            </svg>
            <span className="flex-1 text-amber-800">
              {t("home.apiNotConfiguredBanner")}
            </span>
            <button
              onClick={() => router.push("/settings")}
              className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-amber-700"
            >
              {t("home.goToSettings")}
            </button>
          </div>
        )}

        {/* Mode toggle - capsule tab */}
        <div className="mb-6 flex justify-center">
          <div
            className="inline-flex rounded-full p-1"
            style={{ backgroundColor: "rgba(0,0,0,0.04)", borderColor: "rgba(0,0,0,0.06)" }}
          >
            <button
              onClick={() => setMode("debate")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${
                mode === "debate" ? "bg-[#1a1a1a] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t("home.debate")}
            </button>
            <button
              onClick={() => setMode("chat")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${
                mode === "chat" ? "bg-[#1a1a1a] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t("home.chat")}
            </button>
          </div>
        </div>

        {/* Question input card */}
        <div className="rounded-md border bg-white/60 backdrop-blur-sm"
          style={{ borderColor: 'rgba(0,0,0,0.08)' }}
        >
          <div className="px-3 pt-3 md:px-4">
            <textarea
              ref={textareaRef}
              id="question"
              value={question}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSubmit();
              }}
              placeholder={mode === "debate" ? t("home.inputPlaceholder") : t("home.inputPlaceholderChat")}
              className="w-full resize-none bg-transparent px-4 py-3 text-base leading-relaxed
                placeholder:text-gray-400 placeholder:font-normal focus:outline-none"
              rows={3}
              maxLength={2000}
            />
          </div>
          <div className="mt-2 flex items-center justify-between px-3 py-2 md:px-4">
            <span className="text-xs text-gray-400 md:hidden">
              {selectedIds.length > 0 ? t("home.selectedCount", { count: selectedIds.length }) : t("home.selectMembers")}
            </span>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || !hasApiConfig}
              title={!hasApiConfig ? t("home.configureApiTooltip") : ""}
              className="ml-auto shrink-0 rounded-md bg-[#1a1a1a] px-5 py-2 text-sm font-semibold text-white
                transition-all hover:bg-[#333] active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-40 md:px-6"
            >
              {!hasApiConfig ? t("home.configApiFirst") : mode === "debate" ? t("home.startDebate") : t("home.startChat")}
            </button>
          </div>
        </div>

        {/* Suggested questions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {displayedQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => {
                const prefix = selectedIds.length > 0
                  ? selectedIds.map((id) => {
                      const m = allMembers.find((c) => c.id === id);
                      return m ? "@" + getMemberName(m, locale) + " " : "";
                    }).join("")
                  : "";
                setQuestion(prefix + q);
              }}
              className="rounded-md px-3 py-1.5 text-left text-sm text-gray-500 transition-all hover:bg-white/50 hover:text-gray-700"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="my-10 flex items-center gap-4">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
            {t("home.membersSection")}
          </span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Member avatars */}
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 sm:gap-6 md:gap-10">
            {allMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => setSelectedIds((prev) => prev.includes(member.id) ? prev.filter((x) => x !== member.id) : [...prev, member.id])}
                className="group flex flex-col items-center gap-1.5"
              >
                <div
                  className="flex h-16 w-16 md:h-24 md:w-24 items-center justify-center overflow-hidden rounded-full border transition-all group-hover:scale-105"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.03)',
                    borderColor: 'rgba(0,0,0,0.15)',
                  }}
                >
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={getMemberName(member, locale)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-lg md:text-2xl font-bold text-gray-400">
                      {getMemberName(member, locale).charAt(0)}
                    </span>
                  )}
                </div>
                <span className="text-xs md:text-sm font-medium text-gray-700 text-center whitespace-nowrap">{getMemberName(member, locale)}</span>
                <span className="hidden md:block text-xs text-gray-400">{getMemberTitle(member, locale)}</span>
              </button>
            ))}
        </div>

        {/* Member Picker Overlay */}
        {showPicker && (
          <MemberPicker
            mode={mode}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            onClose={handleClosePicker}
            onConfirm={handleSubmit}
            onSelect={handleSelectMember}
            members={allMembers}
          />
        )}

        {/* Name setup modal */}
        {showNameModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowNameModal(false)}
          >
            <div
              className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-xl mx-4"
              style={{ borderColor: "rgba(0,0,0,0.06)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">{t("onboarding.welcome")}</h3>
              <p className="mt-2 text-sm text-gray-500">{t("onboarding.welcomeMessage")}</p>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nameInput.trim()) {
                    setUserName(nameInput.trim());
                    window.dispatchEvent(new CustomEvent("nickname-changed"));
                    setShowNameModal(false);
                    if (!hasApiConfig) setShowApiSetupModal(true);
                  }
                }}
                placeholder={t("header.nicknamePlaceholder")}
                maxLength={12}
                className="mt-4 w-full rounded-md border bg-white px-3 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-gray-300"
                style={{ borderColor: "rgba(0,0,0,0.08)" }}
                autoFocus
              />
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => {
                    if (nameInput.trim()) {
                      setUserName(nameInput.trim());
                      window.dispatchEvent(new CustomEvent("nickname-changed"));
                    }
                    setShowNameModal(false);
                    if (!hasApiConfig) setShowApiSetupModal(true);
                  }}
                  className="flex-1 rounded-md bg-[#1a1a1a] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333] active:scale-[0.98]"
                >
                  {t("onboarding.start")}
                </button>
                <button
                  onClick={() => { setShowNameModal(false); if (!hasApiConfig) setShowApiSetupModal(true); }}
                  className="flex-1 rounded-md border px-4 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50"
                  style={{ borderColor: "rgba(0,0,0,0.08)" }}
                >
                  {t("onboarding.skip")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* API Setup Modal */}
        {showApiSetupModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowApiSetupModal(false)}
          >
            <div
              className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-xl mx-4"
              style={{ borderColor: "rgba(0,0,0,0.06)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">{t("home.apiSetupTitle")}</h3>
              <p className="mt-2 text-sm text-gray-500">{t("home.apiSetupDescription")}</p>
              <div className="mt-4 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
                {t("home.apiSetupRecommendation")}
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => {
                    setShowApiSetupModal(false);
                    router.push("/settings");
                  }}
                  className="flex-1 rounded-md bg-[#1a1a1a] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333] active:scale-[0.98]"
                >
                  {t("home.goToConfigure")}
                </button>
                <button
                  onClick={() => setShowApiSetupModal(false)}
                  className="flex-1 rounded-md border px-4 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50"
                  style={{ borderColor: "rgba(0,0,0,0.08)" }}
                >
                  {t("home.browseFirst")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Onboarding complete modal */}
        {showOnboardingComplete && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => {
              setShowOnboardingComplete(false);
              markOnboardingComplete();
            }}
          >
            <div
              className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-xl mx-4 text-center"
              style={{ borderColor: "rgba(0,0,0,0.06)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">{t("onboarding.completeTitle")}</h3>
              <p className="mt-2 text-sm text-gray-500">{t("onboarding.completeMessage")}</p>
              <button
                onClick={() => {
                  setShowOnboardingComplete(false);
                  markOnboardingComplete();
                }}
                className="mt-5 w-full rounded-md bg-[#1a1a1a] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333] active:scale-[0.98]"
              >
                {t("onboarding.startUsing")}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
