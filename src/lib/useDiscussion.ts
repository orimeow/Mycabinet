import { useState, useCallback, useRef, useEffect } from "react";
import { DiscussionMessage, AIProviderConfig, ROUNDS } from "@/lib/types";

interface RoundState {
  id: number;
  label: string;
  active: boolean;
  completed: boolean;
}

interface DiscussionState {
  rounds: RoundState[];
  messages: DiscussionMessage[];
  currentSpeaker: string | null;
  currentSpeakerColor: string | null;
  isRunning: boolean;
  error: string | null;
  question: string;
  loadingMember: string | null;
  retrying: { message: string; attempt: number } | null;
  discussionId: string | null;
  tokenUsage: { inputTokens: number; outputTokens: number } | null;
}

function initialRounds(): RoundState[] {
  return ROUNDS.map((r) => ({ ...r, active: false, completed: false }));
}

function initialState(): DiscussionState {
  return {
    rounds: initialRounds(),
    messages: [],
    currentSpeaker: null,
    currentSpeakerColor: null,
    isRunning: false,
    error: null,
    question: "",
    loadingMember: null,
    retrying: null,
    discussionId: null,
    tokenUsage: null,
  };
}

interface SSEParams {
  question?: string;
  message?: string;
  config: AIProviderConfig;
  userId: string;
  mode?: "debate" | "chat";
  selectedMemberIds?: string[];
  selectedMemberId?: string;
  discussionId?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  existingMessages?: DiscussionMessage[];
}

export function useDiscussion() {
  const [state, setState] = useState<DiscussionState>(initialState);
  const controllerRef = useRef<AbortController | null>(null);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<DiscussionMessage[]>([]);
  const discussionIdRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);
  useEffect(() => {
    discussionIdRef.current = state.discussionId;
  }, [state.discussionId]);

  const resetActivityTimeout = useCallback(() => {
    if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    activityTimerRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        error: "AI 响应超时，请检查 API Key 和模型配置后重试",
        isRunning: false,
        loadingMember: null,
        retrying: null,
      }));
    }, 120000);
  }, []);

  const clearActivityTimeout = useCallback(() => {
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
      activityTimerRef.current = null;
    }
  }, []);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    clearActivityTimeout();
  }, [clearActivityTimeout]);

  // Shared SSE stream processor
  const readStream = useCallback(
    async (
      params: SSEParams,
      onAbort?: () => void
    ) => {
      const controller = new AbortController();
      controllerRef.current = controller;

      // Add a 5-minute timeout so the stream never hangs indefinitely
      const timeoutTimer = setTimeout(() => {
        controller.abort();
      }, 5 * 60 * 1000);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      console.log("[readStream] Response status:", response.status, response.ok ? "OK" : "FAILED");

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} ${response.statusText}\n${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let eventCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue;
          eventCount++;
          const lines = eventBlock.split("\n");
          const eventTypeLine = lines.find((l) => l.startsWith("event: "));
          const dataLine = lines.find((l) => l.startsWith("data: "));
          if (!eventTypeLine || !dataLine) continue;
          const eventType = eventTypeLine.slice(7);
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(dataLine.slice(6));
          } catch (e) {
            continue;
          }

          setState((prev) => {
            const newState = { ...prev, messages: [...prev.messages] };

            // Store discussionId if server sends it — also update ref immediately
            // so subsequent sendMessage calls don't depend on async useEffect timing
            if (data.discussionId) {
              newState.discussionId = data.discussionId as string;
              discussionIdRef.current = data.discussionId as string;
            }

            if (newState.loadingMember && eventType !== "round_start" && eventType !== "discussion_started") {
              newState.loadingMember = null;
            }

            switch (eventType) {
              case "discussion_started": {
                newState.discussionId = data.discussionId as string;
                break;
              }
              case "round_start": {
                const round = data.round as number;
                if (round > 0) {
                  newState.rounds = prev.rounds.map((r) =>
                    r.id === round ? { ...r, active: true } : r
                  );
                }
                newState.retrying = null;
                break;
              }
              case "round_complete": {
                const round = data.round as number;
                if (round > 0) {
                  newState.rounds = prev.rounds.map((r) =>
                    r.id === round ? { ...r, active: false, completed: true } : r
                  );
                }
                break;
              }
              case "message_start": {
                const msgId = `msg-${data.round}-${data.speakerId}-${Date.now()}`;
                newState.messages.push({
                  id: msgId,
                  round: data.round as number,
                  speakerId: data.speakerId as string,
                  speakerName: data.speakerName as string | undefined,
                  speakerNameEn: data.speakerNameEn as string | undefined,
                  content: "",
                  timestamp: new Date().toISOString(),
                  challengeTarget: data.challengeTarget as string | undefined,
                  sender: data.sender as DiscussionMessage["sender"],
                });
                newState.currentSpeaker = data.speakerName as string;
                newState.currentSpeakerColor = data.color as string;
                newState.loadingMember = data.speakerName as string;
                newState.retrying = null;
                break;
              }
              case "message_delta": {
                newState.retrying = null;
                const delta = data.delta as string;
                const lastIdx = newState.messages.length - 1;
                if (lastIdx >= 0) {
                  const existing = newState.messages[lastIdx];
                  newState.messages[lastIdx] = {
                    ...existing,
                    content: existing.content + delta,
                  };
                }
                break;
              }
              case "message_complete": {
                const lastIdx = newState.messages.length - 1;
                if (lastIdx >= 0) {
                  const existing = newState.messages[lastIdx];
                  const serverMsg = data as Partial<DiscussionMessage>;
                  newState.messages[lastIdx] = {
                    ...existing,
                    content: serverMsg.content ?? existing.content,
                    id: serverMsg.id ?? existing.id,
                    challengeTarget: serverMsg.challengeTarget ?? existing.challengeTarget,
                    sender: (serverMsg.sender as DiscussionMessage["sender"]) ?? existing.sender,
                  };
                }
                newState.loadingMember = null;
                newState.retrying = null;
                break;
              }
              case "discussion_complete": {
                newState.isRunning = false;
                newState.loadingMember = null;
                newState.retrying = null;
                newState.rounds = prev.rounds.map((r) => ({
                  ...r,
                  active: false,
                  completed: true,
                }));
                break;
              }
              case "error": {
                newState.error = data.message as string;
                newState.isRunning = false;
                newState.loadingMember = null;
                newState.retrying = null;
                break;
              }
              case "retrying": {
                newState.retrying = {
                  message: data.message as string,
                  attempt: data.attempt as number,
                };
                if (data.speakerId) {
                  newState.loadingMember = (data.speakerName as string) ?? `成员 ${data.speakerId}`;
                }
                break;
              }
              case "usage_update": {
                const inputTokens = (data.inputTokens as number) ?? 0;
                const outputTokens = (data.outputTokens as number) ?? 0;
                if (!newState.tokenUsage) {
                  newState.tokenUsage = { inputTokens, outputTokens };
                } else {
                  newState.tokenUsage.inputTokens += inputTokens;
                  newState.tokenUsage.outputTokens += outputTokens;
                }
                break;
              }
            }

            return newState;
          });

          // Reset activity timeout on every event
          resetActivityTimeout();
        }
      }

      clearActivityTimeout();
      clearTimeout(timeoutTimer);

      // Ensure isRunning is set to false when stream ends
      setState((prev) => ({
        ...prev,
        isRunning: false,
        loadingMember: null,
        retrying: null,
      }));
    },
    [resetActivityTimeout, clearActivityTimeout]
  );

  const startDiscussion = useCallback(
    async (
      question: string,
      config: AIProviderConfig,
      userId: string,
      mode: "debate" | "chat",
      selectedMemberIds: string[],
      existingMessages?: DiscussionMessage[]
    ) => {
      abort();

      setState({
        rounds: mode === "chat" ? [] : initialRounds(),
        messages: existingMessages ?? [],
        currentSpeaker: null,
        currentSpeakerColor: null,
        isRunning: true,
        error: null,
        question,
        loadingMember: "正在连接 AI...",
        retrying: null,
        discussionId: null,
        tokenUsage: null,
      });

      clearActivityTimeout();

      // Chat mode with existing messages: just restore state, don't re-fetch
      if (mode === "chat" && existingMessages && existingMessages.length > 0) {
        setState((prev) => ({
          ...prev,
          isRunning: false,
          loadingMember: null,
        }));
        return;
      }

      try {
        await readStream({
          question,
          config,
          userId,
          mode,
          selectedMemberIds,
          existingMessages,
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState((prev) => ({
          ...prev,
          isRunning: false,
          loadingMember: null,
          retrying: null,
          error: (err as Error).message,
        }));
      }
    },
    [abort, clearActivityTimeout, readStream]
  );

  const sendMessage = useCallback(
    async (text: string, config: AIProviderConfig, userId: string, memberIds: string[]) => {
      if (memberIds.length === 0) return;

      // Add user message immediately
      const newUserMsg: DiscussionMessage = {
        id: `user-msg-${Date.now()}`,
        round: 0,
        speakerId: "user",
        speakerName: "我",
        content: text,
        timestamp: new Date().toISOString(),
        sender: "user",
      };

      setState((prev) => ({
        ...prev,
        isRunning: true,
        loadingMember: memberIds.length > 1 ? `${memberIds.length} 位成员正在回复...` : "正在等待回复...",
        messages: [...prev.messages, newUserMsg],
      }));

      clearActivityTimeout();

      // Build conversation history from CURRENT messages (including the one we just added)
      // Use messagesRef to avoid stale closure — state.messages in the dependency array
      // may be outdated if multiple sendMessage calls happen in quick succession.
      const currentMessages = [...messagesRef.current, newUserMsg];
      const conversationHistory = currentMessages
        .filter((m) => m.sender !== undefined)
        .map((m) => ({
          role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        }));

      // Call readStream for each member sequentially
      for (const memberId of memberIds) {
        try {
          await readStream({
            message: text,
            config,
            userId,
            mode: "chat",
            selectedMemberId: memberId,
            selectedMemberIds: memberIds,
            discussionId: discussionIdRef.current ?? undefined,
            conversationHistory,
          });
          if (controllerRef.current === null) break; // aborted
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          // Continue to next member on error
        }
      }
    },
    [clearActivityTimeout, readStream]
  );

  const terminateDiscussion = useCallback(async (userId?: string, discussionId?: string) => {
    if (userId && discussionId) {
      fetch("/api/discussions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: discussionId, userId, action: "terminate" }),
      }).catch(() => {});
    }
    abort();
    setState((prev) => ({
      ...prev,
      isRunning: false,
      loadingMember: null,
      retrying: null,
    }));
  }, [abort]);

  return { state, startDiscussion, sendMessage, terminateDiscussion, abort };
}
