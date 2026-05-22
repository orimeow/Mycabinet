"use client";

import { DiscussionMessage } from "@/lib/types";
import { useDiscussion } from "@/lib/useDiscussion";
import { cabinetMembers } from "@/data/personas";
import MessageBubble from "./MessageBubble";
import RoundDivider from "./RoundDivider";
import { AIProviderConfig } from "@/lib/types";
import { useEffect, useRef, useState, useCallback } from "react";

const PLACEHOLDER_DESKTOP = "输入消息，@成员 定向提问，或留空让所有成员回复";
const PLACEHOLDER_MOBILE = "输入消息，@成员 定向提问";

// Module-level: survives across StrictMode double-mounts.
// Prevents StrictMode from triggering the same component's effect twice.
// Cleared on unmount so new discussions can start normally.
let discussionStarted = false;

interface Props {
  question: string;
  config: AIProviderConfig;
  userId?: string;
  existingMessages?: DiscussionMessage[];
  discussionId?: string;
  mode?: "debate" | "chat";
  selectedMemberIds?: string[];
}

interface MentionState {
  atPos: number;
  filter: string;
}

export default function DiscussionView({
  question,
  config,
  userId,
  existingMessages,
  discussionId: externalDiscussionId,
  mode = "debate",
  selectedMemberIds = [],
}: Props) {
  const { state, startDiscussion, sendMessage, terminateDiscussion: abortLocal } = useDiscussion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Chat mode input
  const [chatInput, setChatInput] = useState("");
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const [mentionNavIndex, setMentionNavIndex] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Members available for @mention — only participants
  const availableMembers = selectedMemberIds.length > 0
    ? cabinetMembers.filter((m) => selectedMemberIds.includes(m.id))
    : cabinetMembers;

  const terminateDiscussion = useCallback(async () => {
    if (externalDiscussionId && userId) {
      fetch("/api/discussions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: externalDiscussionId, userId, action: "terminate" }),
      }).catch(() => {});
    }
    abortLocal();
  }, [externalDiscussionId, userId, abortLocal]);

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // StrictMode double-mount: only the first mount should start the discussion.
    if (discussionStarted) {
      console.log("[DiscussionView] Already started by StrictMode sibling, skipping");
      return;
    }
    discussionStarted = true;

    console.log("[DiscussionView] Starting discussion. question=", question?.slice(0, 30));

    startDiscussion(question, config, userId ?? "", mode, selectedMemberIds, existingMessages);

    return () => {
      console.log("[DiscussionView] cleanup");
      discussionStarted = false;
    };
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages, autoScroll]);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClick = () => setShowExportMenu(false);
    setTimeout(() => document.addEventListener("click", handleClick), 0);
    return () => document.removeEventListener("click", handleClick);
  }, [showExportMenu]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  }, []);

  const handleSendChat = useCallback(() => {
    if (!chatInput.trim() || state.isRunning) return;
    closeMention();

    console.log("[handleSendChat] config:", JSON.stringify({ provider: config?.provider, hasApiKey: !!config?.apiKey, apiKeyLen: config?.apiKey?.length }));

    // Parse @ mentions from input
    const mentionRegex = /@([^\s]+)/g;
    const mentions = chatInput.match(mentionRegex);
    let targetIds: string[] = [];
    if (mentions && mentions.length > 0) {
      targetIds = mentions
        .map((m) => m.slice(1))
        .map((name) => {
          const member = cabinetMembers.find((c) => c.nameZh === name || c.nameEn === name);
          return member?.id ?? null;
        })
        .filter(Boolean) as string[];
    }
    // Default to all selected members if no valid @ mentions
    if (targetIds.length === 0) {
      targetIds = selectedMemberIds;
    }

    sendMessage(chatInput.trim(), config, userId ?? "", targetIds);
    setChatInput("");
  }, [chatInput, state.isRunning, selectedMemberIds, sendMessage, config, userId]);

  const handleSidebarMemberClick = useCallback((memberId: string) => {
    if (mode !== "chat" || state.isRunning || !chatInput.trim()) return;
    sendMessage(chatInput.trim(), config, userId ?? "", [memberId]);
    setChatInput("");
  }, [mode, state.isRunning, chatInput, sendMessage, config, userId]);

  // Filter sidebar members — only show participating members
  const sidebarMembers = selectedMemberIds.length > 0
    ? cabinetMembers.filter((m) => selectedMemberIds.includes(m.id))
    : cabinetMembers;

  // ===== @mention autocomplete =====
  const closeMention = useCallback(() => {
    setMentionState(null);
    setMentionNavIndex(0);
  }, []);

  const handleChatInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart ?? value.length;
    setChatInput(value);

    // Detect @mention trigger
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    if (lastAt !== -1 && (lastAt === 0 || /\s/.test(textBeforeCursor[lastAt - 1]))) {
      const afterAt = textBeforeCursor.slice(lastAt + 1);
      if (/^[a-zA-Z一-鿿]{0,20}$/.test(afterAt)) {
        setMentionState({ atPos: lastAt, filter: afterAt });
        setMentionNavIndex(0);
        return;
      }
    }
    closeMention();
  }, [closeMention]);

  const selectMention = useCallback((memberId: string) => {
    const member = cabinetMembers.find((m) => m.id === memberId);
    if (!member || !chatInputRef.current) return;

    const value = chatInput;
    const state = mentionState;
    if (!state) return;

    const newText = value.slice(0, state.atPos) + "@" + member.nameZh + " " + value.slice(state.atPos + state.filter.length + 1);
    const newCursorPos = state.atPos + member.nameZh.length + 2;
    setChatInput(newText);
    closeMention();

    setTimeout(() => {
      chatInputRef.current?.focus();
      chatInputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [mentionState, closeMention]);

  const handleMentionKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!mentionState) return;

    const filtered = availableMembers.filter((m) =>
      m.nameZh.includes(mentionState.filter) || m.nameEn.toLowerCase().includes(mentionState.filter.toLowerCase())
    );

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setMentionNavIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setMentionNavIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        if (!e.shiftKey) {
          e.preventDefault();
          if (filtered[mentionNavIndex]) {
            selectMention(filtered[mentionNavIndex].id);
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        closeMention();
        break;
    }
  }, [mentionState, mentionNavIndex, availableMembers, selectMention, closeMention]);

  // Filtered members for the dropdown
  const filteredMembers = mentionState
    ? availableMembers.filter((m) =>
        m.nameZh.includes(mentionState.filter) || m.nameEn.toLowerCase().includes(mentionState.filter.toLowerCase())
      )
    : [];

  const isDebate = mode === "debate";

  const exportAsMarkdown = useCallback(() => {
    const memberMap = new Map(cabinetMembers.map((m) => [m.id, m]));
    const lines: string[] = [];
    lines.push(`# 讨论：${state.question || question}`);
    lines.push("");
    lines.push(`**模式**：${isDebate ? "辩论" : "聊天"}`);
    const participantNames = sidebarMembers.map((m) => m.nameZh).join("、");
    lines.push(`**成员**：${participantNames}`);
    lines.push(`**时间**：${new Date().toLocaleString("zh-CN")}`);
    if (state.tokenUsage) {
      const total = state.tokenUsage.inputTokens + state.tokenUsage.outputTokens;
      lines.push(`**Token 消耗**：≈ ${total.toLocaleString()} tokens`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");

    if (isDebate) {
      for (const round of state.rounds) {
        const roundMessages = state.messages.filter((m) => m.round === round.id);
        if (roundMessages.length === 0) continue;
        lines.push(`## ${round.label}`);
        lines.push("");
        for (const msg of roundMessages) {
          const member = memberMap.get(msg.speakerId);
          const name = member?.nameZh || (msg.speakerId === "moderator" ? "主持人" : msg.speakerId);
          lines.push(`### ${name}`);
          if (msg.challengeTarget) {
            const target = memberMap.get(msg.challengeTarget)?.nameZh || msg.challengeTarget;
            lines.push(`> 挑战 ${target}`);
          }
          lines.push(msg.content);
          lines.push("");
        }
        lines.push("---");
        lines.push("");
      }
    } else {
      for (const msg of state.messages) {
        if (msg.sender === "user") {
          lines.push(`**用户**：${msg.content}`);
        } else {
          const member = memberMap.get(msg.speakerId);
          const name = member?.nameZh || msg.speakerId;
          lines.push(`**${name}**：${msg.content}`);
        }
        lines.push("");
      }
    }
    return lines.join("\n");
  }, [state, question, isDebate, sidebarMembers]);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`已复制${label}到剪贴板`);
    } catch {
      alert("复制失败，请手动复制");
    }
  }, []);

  return (
    <div className="relative flex h-[calc(100dvh-56px)]">
      {/* @mention dropdown */}
      {mentionState && filteredMembers.length > 0 && !state.isRunning && (
        <div
          className="absolute bottom-16 left-6 z-50 w-64 overflow-hidden rounded-lg border bg-white shadow-lg"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          <div className="max-h-48 overflow-y-auto py-1">
            {filteredMembers.map((m, i) => (
              <button
                key={m.id}
                onMouseDown={(e) => { e.preventDefault(); selectMention(m.id); }}
                onMouseEnter={() => setMentionNavIndex(i)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                  i === mentionNavIndex ? "bg-black/[0.04]" : "hover:bg-black/[0.02]"
                }`}
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border"
                  style={{ backgroundColor: "rgba(0,0,0,0.03)", borderColor: "rgba(0,0,0,0.15)" }}
                >
                  {m.avatar ? (
                    <img src={m.avatar} alt={m.nameZh} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-white" style={{ backgroundColor: m.color }}>
                      {m.nameZh.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-medium">{m.nameZh}</div>
                  <div className="truncate text-xs text-gray-400">{m.title}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sidebar - desktop */}
      <div
        className="hidden w-64 shrink-0 border-r border-gray-200/50 bg-white/40 p-5 backdrop-blur-sm lg:block"
        style={{ borderColor: "rgba(0,0,0,0.06)" }}
      >
        <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-400">
          {isDebate ? "参与成员" : "对话对象"}
        </h3>
        <SidebarMembers members={sidebarMembers} state={state} isDebate={isDebate} onMemberClick={handleSidebarMemberClick} chatInput={chatInput} />
      </div>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div
          className="flex items-start justify-between gap-2 border-b bg-white/60 px-3 py-3 backdrop-blur-sm md:px-6 md:py-4"
          style={{ borderColor: "rgba(0,0,0,0.06)" }}
        >
          <div className="min-w-0 flex-1">
            <h2 className="text-base md:text-lg font-bold tracking-tight break-words">{state.question || question}</h2>
            <div className="mt-1 md:mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <span>已发言 {state.messages.length} 条</span>
              {state.loadingMember && (
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" />
                  {state.loadingMember}
                </span>
              )}
              {state.isRunning && !state.loadingMember && (
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" />
                  {isDebate ? "讨论进行中" : "AI 正在回复..."}
                </span>
              )}
              {!state.isRunning && state.messages.length > 0 && (
                <span className="text-green-600">✓ 完成</span>
              )}
            </div>
            {isDebate && (
              <div className="mt-2 flex gap-1.5">
                {state.rounds.map((r) => (
                  <RoundDivider
                    key={r.id}
                    label={r.label}
                    active={r.active}
                    completed={r.completed}
                  />
                ))}
              </div>
            )}
          </div>
          {/* Mobile sidebar toggle */}
          <button
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-md md:hidden"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="查看成员"
          >
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        </div>

        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMobileSidebarOpen(false)}>
            <div className="absolute inset-0 bg-black/30" />
            <div
              className="absolute right-0 top-0 h-full w-72 border-l bg-white/95 p-4 backdrop-blur-sm"
              style={{ borderColor: "rgba(0,0,0,0.06)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  {isDebate ? "参与成员" : "对话对象"}
                </h3>
                <button onClick={() => setMobileSidebarOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <SidebarMembers members={sidebarMembers} state={state} isDebate={isDebate} onMemberClick={(id) => { handleSidebarMemberClick(id); setMobileSidebarOpen(false); }} chatInput={chatInput} />
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 space-y-2 overflow-y-auto px-3 py-4 md:px-6"
        >
          {state.isRunning &&
            !state.messages.some((m) => m.content.length > 0) && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-5 flex gap-2">
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
                </div>
                <p className="text-sm text-gray-500">{state.loadingMember || "正在连接 AI..."}</p>
                <p className="mt-1 text-xs text-gray-400">AI 模型正在连接中...</p>
              </div>
            )}

          {/* Chat mode: flat message list */}
          {!isDebate &&
            state.messages.map((msg, i) => {
              const isUser = msg.sender === "user";
              const isActive =
                !isUser &&
                state.currentSpeaker === msg.speakerId &&
                i === state.messages.length - 1;
              if (isUser) {
                return (
                  <div key={msg.id} className="flex flex-col items-end">
                    <div
                      className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                      style={{ backgroundColor: "rgba(0,0,0,0.05)" }}
                    >
                      {msg.content}
                    </div>
                    <span className="mt-0.5 text-[10px] text-gray-300">
                      {new Date(msg.timestamp).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              }
              return (
                <MessageBubble
                  key={msg.id || `${msg.round}-${msg.speakerId}-${i}`}
                  message={msg}
                  isActive={isActive}
                />
              );
            })}

          {/* Debate mode: messages by round */}
          {isDebate &&
            state.rounds.map((round) => {
              const roundMessages = state.messages.filter((m) => m.round === round.id);
              if (roundMessages.length === 0 && !round.active && !round.completed) return null;

              return (
                <div key={round.id}>
                  <RoundDivider
                    label={round.label}
                    active={round.active}
                    completed={round.completed}
                  />
                  <div
                    className="ml-5 space-y-2.5 border-l-2 pl-4"
                    style={{
                      borderColor: round.active
                        ? "rgba(0,0,0,0.08)"
                        : round.completed
                          ? "rgba(34,197,94,0.15)"
                          : "rgba(0,0,0,0.04)",
                    }}
                  >
                    {roundMessages.map((msg, i) => {
                      const isActive =
                        state.currentSpeaker === msg.speakerId &&
                        state.messages.indexOf(msg) === state.messages.length - 1;
                      return (
                        <MessageBubble
                          key={msg.id || `${msg.round}-${msg.speakerId}-${i}`}
                          message={msg}
                          isActive={isActive}
                        />
                      );
                    })}
                    {state.retrying && round.active && (
                      <div className="flex items-center gap-2 py-3 text-sm text-amber-600">
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                        {state.retrying.message}（第 {state.retrying.attempt} 次重试）
                      </div>
                    )}
                    {round.active && !roundMessages.some((m) => m.content === "") && !state.retrying && (
                      <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gray-300" />
                        等待发言...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          {state.error && (
            <div
              className="rounded-md border border-red-200/50 bg-red-50/50 p-4 text-sm text-red-600"
              style={{ borderColor: "rgba(220,38,38,0.15)" }}
            >
              错误: {state.error}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div
          className="relative border-t bg-white/60 px-3 py-2.5 backdrop-blur-sm md:px-6 md:py-3"
          style={{ borderColor: "rgba(0,0,0,0.06)" }}
        >
          {/* Chat mode: input box */}
          {!isDebate ? (
            <div className="flex items-end gap-2">
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={handleChatInputChange}
                onKeyDown={(e) => {
                  if (mentionState) {
                    handleMentionKeyDown(e);
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder={
                  state.isRunning
                    ? "AI 正在回复..."
                    : isMobile
                      ? "输入消息，@成员 提问"
                      : "输入消息，@成员 定向提问，或留空让所有成员回复"
                }
                disabled={state.isRunning}
                rows={1}
                className="flex-1 resize-none rounded-lg border bg-white px-4 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 disabled:bg-gray-50"
                style={{ borderColor: "rgba(0,0,0,0.08)" }}
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim() || state.isRunning}
                className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all active:scale-[0.98] ${
                  chatInput.trim() && !state.isRunning
                    ? "bg-[#1a1a1a] hover:bg-[#333]"
                    : "cursor-not-allowed bg-gray-300"
                }`}
              >
                发送
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
                <span className="hidden sm:inline">
                  {config.provider === "openrouter" ? "OpenRouter" : config.provider} ·{" "}
                  {config.model || "默认模型"}
                </span>
                {externalDiscussionId && (
                  <span className="text-gray-300">#{externalDiscussionId.slice(-6)}</span>
                )}
                {state.discussionId && !externalDiscussionId && (
                  <span className="text-gray-300">#{state.discussionId.slice(-6)}</span>
                )}
                {state.tokenUsage && (
                  <span className="text-gray-500">
                    ≈ {(state.tokenUsage.inputTokens + state.tokenUsage.outputTokens).toLocaleString()} tokens
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 md:gap-2">
                {!state.isRunning && state.messages.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowExportMenu((v) => !v)}
                      className="rounded-lg px-2.5 py-1.5 text-xs text-gray-500 transition-colors hover:bg-black/5 md:px-3"
                      title="导出讨论"
                    >
                      导出
                    </button>
                    {showExportMenu && (
                      <div
                        className="absolute bottom-full right-0 mb-1 w-36 overflow-hidden rounded-lg border bg-white shadow-lg"
                        style={{ borderColor: "rgba(0,0,0,0.08)" }}
                      >
                        <button
                          onClick={() => {
                            copyToClipboard(exportAsMarkdown(), "Markdown");
                            setShowExportMenu(false);
                          }}
                          className="flex w-full items-center px-3 py-2 text-left text-xs text-gray-600 transition-colors hover:bg-black/[0.04]"
                        >
                          复制为 Markdown
                        </button>
                        <button
                          onClick={() => {
                            copyToClipboard(JSON.stringify(state.messages, null, 2), "JSON");
                            setShowExportMenu(false);
                          }}
                          className="flex w-full items-center px-3 py-2 text-left text-xs text-gray-600 transition-colors hover:bg-black/[0.04]"
                        >
                          复制为 JSON
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {state.isRunning && (
                  <button
                    onClick={terminateDiscussion}
                    className="rounded-lg px-2.5 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-50 md:px-3"
                  >
                    终止
                  </button>
                )}
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className="rounded-lg px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:bg-black/5 md:px-3"
                >
                  {autoScroll ? "暂停" : "滚动"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Reusable sidebar members list
function SidebarMembers({
  members,
  state,
  isDebate,
  onMemberClick,
  chatInput,
}: {
  members: typeof cabinetMembers;
  state: ReturnType<typeof useDiscussion>["state"];
  isDebate: boolean;
  onMemberClick: (id: string) => void;
  chatInput: string;
}) {
  return (
    <div className="space-y-1.5">
      {members.map((m) => {
        const isActive = state.currentSpeaker === m.id && state.isRunning;
        return (
          <div
            key={m.id}
            onClick={() => !isDebate && onMemberClick(m.id)}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 transition-all duration-200 ${
              isActive ? "bg-black/5" : "hover:bg-black/[0.03]"
            } ${!isDebate && chatInput.trim() && !state.isRunning ? "cursor-pointer" : ""}`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border transition-all ${
                isActive ? "scale-110 shadow-lg" : ""
              }`}
              style={{
                backgroundColor: "rgba(0,0,0,0.03)",
                borderColor: "rgba(0,0,0,0.15)",
              }}
            >
              {m.avatar ? (
                <img src={m.avatar} alt={m.nameZh} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-white" style={{ backgroundColor: m.color }}>
                  {m.nameZh.charAt(0)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">{m.nameZh}</div>
              <div className="truncate text-xs text-gray-400">{m.title}</div>
            </div>
            {isActive && (
              <span className="ml-auto h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: m.color }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
