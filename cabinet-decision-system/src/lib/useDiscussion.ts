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
  loadingMember: string | null; // member waiting for response
}

export function useDiscussion() {
  const [state, setState] = useState<DiscussionState>({
    rounds: [
      { id: 1, label: "第一轮：开场陈述", active: false, completed: false },
      { id: 2, label: "第二轮：交叉辩论", active: false, completed: false },
      { id: 3, label: "第三轮：观点修正", active: false, completed: false },
      { id: 4, label: "主持人总结", active: false, completed: false },
    ],
    messages: [],
    currentSpeaker: null,
    currentSpeakerColor: null,
    isRunning: false,
    error: null,
    question: "",
    loadingMember: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const startDiscussion = useCallback(async (question: string, config: AIProviderConfig) => {
    // Abort any previous discussion
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      rounds: [
        { id: 1, label: "第一轮：开场陈述", active: false, completed: false },
        { id: 2, label: "第二轮：交叉辩论", active: false, completed: false },
        { id: 3, label: "第三轮：观点修正", active: false, completed: false },
        { id: 4, label: "主持人总结", active: false, completed: false },
      ],
      messages: [],
      currentSpeaker: null,
      currentSpeakerColor: null,
      isRunning: true,
      error: null,
      question,
      loadingMember: "正在连接 AI...",
    });

    try {
      console.log('[Discussion] Starting discussion with config:', config.provider, config.model);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 300000); // 5 min timeout

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, config }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      console.log('[Discussion] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} ${response.statusText}\n${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");
      console.log('[Discussion] Got reader, starting SSE stream');

      const decoder = new TextDecoder();
      let buffer = "";
      // Track partial message content for streaming
      let currentMsgContent = "";
      let eventCount = 0;
      const activityTimeout = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          error: "AI 响应超时，请检查 API Key 和模型配置后重试",
          isRunning: false,
          loadingMember: null,
        }));
        controller.abort();
      }, 120000); // 2 min no-activity timeout

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Reset activity timeout on each chunk
        clearTimeout(activityTimeout);

        buffer += decoder.decode(value, { stream: true });

        // Parse complete SSE events from buffer
        // Each event is: "event: TYPE\ndata: JSON\n\n"
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue;

          const lines = eventBlock.split("\n");
          const eventTypeLine = lines.find((l) => l.startsWith("event: "));
          const dataLine = lines.find((l) => l.startsWith("data: "));

          if (!eventTypeLine || !dataLine) continue;

          const eventType = eventTypeLine.slice(7);
          const data = JSON.parse(dataLine.slice(6));
          eventCount++;

          setState((prev) => {
            const newState = { ...prev, messages: [...prev.messages] };

            // Clear loading on first SSE event
            if (newState.loadingMember) {
              newState.loadingMember = null;
            }

            switch (eventType) {
              case "round_start": {
                const round = data.round as number;
                newState.rounds = prev.rounds.map((r) =>
                  r.id === round ? { ...r, active: true } : r
                );
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
                currentMsgContent = "";
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
                break;
              }
              case "message_delta": {
                // Clear loading when content starts streaming
                if (newState.loadingMember) {
                  newState.loadingMember = null;
                }
                const delta = data.delta as string;
                currentMsgContent += delta;
                const lastMsg = newState.messages[newState.messages.length - 1];
                if (lastMsg) {
                  lastMsg.content = currentMsgContent;
                }
                break;
              }
              case "message_complete": {
                // Always update the last message — it was created by the corresponding message_start
                const lastIdx = newState.messages.length - 1;
                if (lastIdx >= 0) {
                  const existing = newState.messages[lastIdx];
                  const serverMsg = data as Partial<DiscussionMessage>;
                  newState.messages[lastIdx] = {
                    ...existing,
                    content: serverMsg.content || currentMsgContent,
                    id: serverMsg.id || existing.id,
                    challengeTarget: serverMsg.challengeTarget || existing.challengeTarget,
                  };
                }
                currentMsgContent = "";
                break;
              }
              case "discussion_complete": {
                newState.isRunning = false;
                newState.loadingMember = null;
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
                break;
              }
            }

            return newState;
          });
        }
      }

      clearTimeout(activityTimeout);
      console.log('[Discussion] Stream finished, total events:', eventCount);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setState((prev) => ({
          ...prev,
          isRunning: false,
          loadingMember: null,
          error: prev.error || "连接超时，请检查网络和 API 配置",
        }));
        return;
      }
      setState((prev) => ({
        ...prev,
        isRunning: false,
        loadingMember: null,
        error: (err as Error).message,
      }));
    }
  }, []);

  return { state, startDiscussion };
}
