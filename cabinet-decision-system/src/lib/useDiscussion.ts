import { useState, useCallback, useRef } from "react";
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
  };
}

export function useDiscussion() {
  const [state, setState] = useState<DiscussionState>(initialState);
  const controllerRef = useRef<AbortController | null>(null);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const processSSEEvent = useCallback(
    (eventType: string, data: Record<string, unknown>) => {
      setState((prev) => {
        const newState = { ...prev, messages: [...prev.messages] };

        if (newState.loadingMember && eventType !== "round_start") {
          newState.loadingMember = null;
        }

        switch (eventType) {
          case "round_start": {
            const round = data.round as number;
            newState.rounds = prev.rounds.map((r) =>
              r.id === round ? { ...r, active: true } : r
            );
            newState.retrying = null;
            break;
          }
          case "round_complete": {
            const round = data.round as number;
            newState.rounds = prev.rounds.map((r) =>
              r.id === round ? { ...r, active: false, completed: true } : r
            );
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
            });
            newState.currentSpeaker = data.speakerName as string;
            newState.currentSpeakerColor = data.color as string;
            newState.loadingMember = data.speakerName as string;
            newState.retrying = null;
            break;
          }
          case "message_delta": {
            if (newState.loadingMember) newState.loadingMember = null;
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
        }

        return newState;
      });

      // Reset activity timeout on every event
      resetActivityTimeout();
    },
    [resetActivityTimeout]
  );

  const parseAndProcessSSEBuffer = useCallback(
    (buffer: string) => {
      const events = buffer.split("\n\n");
      // Keep incomplete event in buffer
      const leftover = events.pop() || "";
      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue;
        const lines = eventBlock.split("\n");
        const eventTypeLine = lines.find((l) => l.startsWith("event: "));
        const dataLine = lines.find((l) => l.startsWith("data: "));
        if (!eventTypeLine || !dataLine) continue;
        const eventType = eventTypeLine.slice(7);
        const data = JSON.parse(dataLine.slice(6));
        processSSEEvent(eventType, data);
      }
      return leftover;
    },
    [processSSEEvent]
  );

  const startDiscussion = useCallback(
    async (question: string, config: AIProviderConfig, userId: string, existingMessages?: DiscussionMessage[]) => {
      // Abort any previous discussion
      abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setState({
        ...initialState(),
        question,
        isRunning: true,
        messages: existingMessages ?? [],
        loadingMember: "正在连接 AI...",
      });

      clearActivityTimeout();

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, config, userId }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error: ${response.status} ${response.statusText}\n${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          buffer = parseAndProcessSSEBuffer(buffer);
        }

        clearActivityTimeout();
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }
        setState((prev) => ({
          ...prev,
          isRunning: false,
          loadingMember: null,
          retrying: null,
          error: (err as Error).message,
        }));
      }
    },
    [abort, clearActivityTimeout, parseAndProcessSSEBuffer]
  );

  const terminateDiscussion = useCallback(async () => {
    abort();
    setState((prev) => ({
      ...prev,
      isRunning: false,
      loadingMember: null,
      retrying: null,
    }));
  }, [abort]);

  return { state, startDiscussion, terminateDiscussion, abort };
}
