"use client";

import { DiscussionMessage } from "@/lib/types";
import { useDiscussion } from "@/lib/useDiscussion";
import { cabinetMembers } from "@/data/personas";
import MessageBubble from "./MessageBubble";
import RoundDivider from "./RoundDivider";
import { AIProviderConfig } from "@/lib/types";
import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  question: string;
  config: AIProviderConfig;
  userId?: string;
  existingMessages?: DiscussionMessage[];
  discussionId?: string;
}

export default function DiscussionView({ question, config, userId, existingMessages, discussionId }: Props) {
  const { state, startDiscussion, terminateDiscussion: abortLocal } = useDiscussion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const started = useRef(false);

  const terminateDiscussion = useCallback(async () => {
    if (discussionId && userId) {
      fetch("/api/discussions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: discussionId, userId, action: "terminate" }),
      }).catch(() => {});
    }
    abortLocal();
  }, [discussionId, userId, abortLocal]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startDiscussion(question, config, userId ?? "", existingMessages);
    return () => {
      terminateDiscussion();
    };
  }, [question, config, userId, existingMessages, startDiscussion, terminateDiscussion]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  }, []);

  return (
    <div className="flex h-[calc(100vh-60px)]">
      {/* Sidebar */}
      <div className="hidden w-64 shrink-0 border-r border-gray-200/50 bg-white/40 p-5 backdrop-blur-sm lg:block"
        style={{ borderColor: 'rgba(0,0,0,0.06)' }}
      >
        <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-400">成员</h3>
        <div className="space-y-1.5">
          {cabinetMembers.map((m) => {
            const isActive = state.currentSpeaker === m.id && state.isRunning;
            return (
              <div
                key={m.id}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 transition-all duration-200 ${
                  isActive ? 'bg-black/5' : 'hover:bg-black/[0.03]'
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border transition-all ${
                    isActive ? 'scale-110 shadow-lg' : ''
                  }`}
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.03)',
                    borderColor: 'rgba(0,0,0,0.15)',
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
      </div>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="border-b bg-white/60 px-6 py-4 backdrop-blur-sm"
          style={{ borderColor: 'rgba(0,0,0,0.06)' }}
        >
          <h2 className="text-lg font-bold tracking-tight">{state.question || question}</h2>
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
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
                讨论进行中
              </span>
            )}
            {!state.isRunning && state.messages.length > 0 && (
              <span className="text-green-600">✓ 完成</span>
            )}
          </div>
          {/* Round progress */}
          <div className="mt-3 flex gap-1.5">
            {state.rounds.map((r) => (
              <RoundDivider
                key={r.id}
                label={r.label}
                active={r.active}
                completed={r.completed}
              />
            ))}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 space-y-2 overflow-y-auto px-6 py-4"
        >
          {/* Initial loading */}
          {state.loadingMember && state.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-5 flex gap-2">
                <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
              </div>
              <p className="text-sm text-gray-500">{state.loadingMember}</p>
              <p className="mt-1 text-xs text-gray-400">AI 模型正在连接中...</p>
            </div>
          )}

          {/* Messages by round */}
          {state.rounds.map((round) => {
            const roundMessages = state.messages.filter((m) => m.round === round.id);
            if (roundMessages.length === 0 && !round.active && !round.completed) return null;

            return (
              <div key={round.id}>
                <RoundDivider
                  label={round.label}
                  active={round.active}
                  completed={round.completed}
                />
                <div className="ml-5 space-y-2.5 border-l-2 pl-4"
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
            <div className="rounded-md border border-red-200/50 bg-red-50/50 p-4 text-sm text-red-600"
              style={{ borderColor: 'rgba(220,38,38,0.15)' }}
            >
              错误: {state.error}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="border-t bg-white/60 px-6 py-3 backdrop-blur-sm"
          style={{ borderColor: 'rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">
              {config.provider === "openrouter" ? "OpenRouter" : config.provider} · {config.model || "默认模型"}
              {discussionId && <span className="ml-2 text-gray-300">#{discussionId.slice(-6)}</span>}
            </div>
            <div className="flex items-center gap-2">
              {state.isRunning && (
                <button
                  onClick={terminateDiscussion}
                  className="rounded-lg px-3 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-50"
                >
                  终止讨论
                </button>
              )}
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className="rounded-lg px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-black/5"
              >
                {autoScroll ? "暂停滚动" : "恢复滚动"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
