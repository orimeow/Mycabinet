import { AIProviderConfig, AIMessage, DiscussionMessage } from "@/lib/types";
import { createProvider } from "@/lib/ai/provider";
import { classifyAPIError, isRetryable } from "@/lib/ai/error-classifier";
import { cabinetMembers, buildSystemPrompt } from "@/data/personas";

const BACKOFF_MS = [30_000, 60_000, 120_000];
const MAX_RETRIES = BACKOFF_MS.length;

export type SSEEvent = {
  type:
    | "round_start"
    | "message_start"
    | "message_delta"
    | "message_complete"
    | "round_complete"
    | "discussion_complete"
    | "error"
    | "retrying";
  data: Record<string, unknown>;
};

function getModelForProvider(config: AIProviderConfig): string {
  if (config.model) return config.model;
  switch (config.provider) {
    case "claude":
      return "claude-sonnet-4-20250514";
    case "openai":
      return "gpt-4o";
    case "openrouter":
      return "google/gemma-4-31b-it:free";
    case "ollama":
      return "llama3";
    case "gemini":
      return "gemini-2.0-flash";
    default:
      return "gemini-2.0-flash";
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        resolve();
      },
      { once: true }
    );
  });
}

async function* streamChat(
  config: AIProviderConfig,
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens = 4096,
  signal?: AbortSignal,
  speakerId?: string,
  speakerName?: string
): AsyncIterable<{ chunks: string[]; retries: SSEEvent[] }> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) return;

    if (attempt > 0) {
      const waitMs = BACKOFF_MS[attempt - 1] ?? 120_000;
      yield {
        chunks: [],
        retries: [
          {
            type: "retrying",
            data: {
              speakerId: speakerId ?? "",
              speakerName: speakerName ?? "",
              message: `请求被限流，${Math.round(waitMs / 1000)}s 后重试...`,
              attempt,
            },
          },
        ],
      };
      await sleep(waitMs, signal);
      if (signal?.aborted) return;
    }

    try {
      const provider = createProvider(config);
      const model = getModelForProvider(config);

      const stream = provider.chatCompletion({
        messages: [{ role: "system" as const, content: systemPrompt }, ...messages],
        model,
        temperature: 0.7,
        maxTokens,
        stream: true,
      });

      const chunks: string[] = [];
      for await (const chunk of stream) {
        if (signal?.aborted) return;
        chunks.push(chunk);
      }

      if (chunks.length > 0) {
        yield { chunks, retries: [] };
        return;
      }
    } catch (err) {
      lastError = err;
      const classified = classifyAPIError(err);

      if (!isRetryable(classified.type) || attempt >= MAX_RETRIES) {
        throw new Error(classified.message);
      }
    }
  }

  throw new Error((lastError as Error)?.message ?? "未知错误");
}

export async function* runDiscussion(
  question: string,
  config: AIProviderConfig,
  signal?: AbortSignal
): AsyncIterable<SSEEvent> {
  const conversationHistory: AIMessage[] = [
    { role: "user" as const, content: question },
  ];

  const round1Content: string[] = [];

  // ===== Round 1: Opening Statements =====
  yield { type: "round_start", data: { round: 1, label: "第一轮：开场陈述" } };

  for (const member of cabinetMembers) {
    if (signal?.aborted) break;

    yield {
      type: "message_start",
      data: {
        round: 1,
        speakerId: member.id,
        speakerName: member.nameZh,
        speakerNameEn: member.nameEn,
        color: member.color,
      },
    };

    const systemPrompt = buildSystemPrompt(member);
    const userPrompt = `作为内阁成员，请就以下问题发表你的初始观点：\n\n"${question}"\n\n请用你的身份特有的思维方式和说话风格来表达。`;

    let fullContent = "";
    try {
      for await (const result of streamChat(
        config,
        systemPrompt,
        [{ role: "user", content: userPrompt }],
        4096,
        signal,
        member.id,
        member.nameZh
      )) {
        for (const retry of result.retries) {
          yield retry;
        }
        for (const chunk of result.chunks) {
          fullContent += chunk;
          yield { type: "message_delta", data: { round: 1, speakerId: member.id, delta: chunk } };
        }
      }
    } catch (err) {
      fullContent = `[发言失败：${(err as Error).message}]`;
      yield {
        type: "error",
        data: { message: `${member.nameZh} 发言失败：${(err as Error).message}` },
      };
    }

    round1Content.push(`${member.nameZh}：${fullContent}`);

    const msg: DiscussionMessage = {
      id: `round1-${member.id}-${Date.now()}`,
      round: 1,
      speakerId: member.id,
      content: fullContent,
      timestamp: new Date().toISOString(),
    };

    yield { type: "message_complete", data: { ...msg } };
  }

  yield { type: "round_complete", data: { round: 1 } };

  // ===== Round 2: Cross-Examination =====
  yield { type: "round_start", data: { round: 2, label: "第二轮：交叉辩论" } };

  const memberCount = cabinetMembers.length;
  const pairs: [number, number][] = [];
  for (let i = 0; i < memberCount; i++) {
    const targetIdx = (i + 1) % memberCount;
    pairs.push([i, targetIdx]);
  }
  for (let i = memberCount - 1; i >= 0; i--) {
    const challengerIdx = (i + 1) % memberCount;
    pairs.push([challengerIdx, i]);
  }

  const round2Context: string[] = [];

  for (const [challengerIdx, targetIdx] of pairs) {
    if (signal?.aborted) break;

    const challenger = cabinetMembers[challengerIdx];
    const target = cabinetMembers[targetIdx];

    // Challenger speaks
    yield {
      type: "message_start",
      data: {
        round: 2,
        speakerId: challenger.id,
        speakerName: challenger.nameZh,
        speakerNameEn: challenger.nameEn,
        color: challenger.color,
        challengeTarget: target.id,
        challengeTargetName: target.nameZh,
      },
    };

    const othersSummary = round1Content.map((c) => `- ${c}`).join("\n");

    let challengerContent = "";
    try {
      for await (const result of streamChat(
        config,
        buildSystemPrompt(challenger),
        [
          ...conversationHistory,
          {
            role: "user",
            content: `作为内阁成员，你现在进入交叉辩论环节。\n\n问题：${question}\n\n其他成员的第一轮观点摘要：\n${othersSummary}\n\n现在请你对 ${target.nameZh} 的观点提出挑战或反驳。\n你的回应要有理有据，体现你的思维框架。直接、具体地回应对方观点中的某个论点。\n\n请直接开始你的反驳：`,
          },
        ],
        4096,
        signal,
        challenger.id,
        challenger.nameZh
      )) {
        for (const retry of result.retries) {
          yield retry;
        }
        for (const chunk of result.chunks) {
          challengerContent += chunk;
          yield { type: "message_delta", data: { round: 2, speakerId: challenger.id, delta: chunk } };
        }
      }
    } catch (err) {
      challengerContent = `[发言失败：${(err as Error).message}]`;
      yield {
        type: "error",
        data: { message: `${challenger.nameZh} 发言失败：${(err as Error).message}` },
      };
    }

    round2Context.push(`${challenger.nameZh}（挑战${target.nameZh}）：${challengerContent}`);

    yield {
      type: "message_complete",
      data: {
        id: `round2-challenge-${challenger.id}-${target.id}-${Date.now()}`,
        round: 2,
        speakerId: challenger.id,
        content: challengerContent,
        timestamp: new Date().toISOString(),
        challengeTarget: target.id,
      },
    };

    // Target responds
    if (signal?.aborted) break;

    yield {
      type: "message_start",
      data: {
        round: 2,
        speakerId: target.id,
        speakerName: target.nameZh,
        speakerNameEn: target.nameEn,
        color: target.color,
        respondTo: challenger.id,
        respondToName: challenger.nameZh,
      },
    };

    let targetContent = "";
    try {
      for await (const result of streamChat(
        config,
        buildSystemPrompt(target),
        [
          ...conversationHistory,
          {
            role: "user",
            content: `作为内阁成员，你现在需要回应挑战。\n\n问题：${question}\n\n${challenger.nameZh} 对你的观点提出了以下挑战：\n"${challengerContent}"\n\n请用你的思维框架和说话风格回应这个挑战。你可以坚持原有立场，也可以适度调整，但要有理有据。`,
          },
        ],
        4096,
        signal,
        target.id,
        target.nameZh
      )) {
        for (const retry of result.retries) {
          yield retry;
        }
        for (const chunk of result.chunks) {
          targetContent += chunk;
          yield { type: "message_delta", data: { round: 2, speakerId: target.id, delta: chunk } };
        }
      }
    } catch (err) {
      targetContent = `[发言失败：${(err as Error).message}]`;
      yield {
        type: "error",
        data: { message: `${target.nameZh} 回应失败：${(err as Error).message}` },
      };
    }

    round2Context.push(`${target.nameZh}（回应${challenger.nameZh}）：${targetContent}`);

    yield {
      type: "message_complete",
      data: {
        id: `round2-respond-${target.id}-${challenger.id}-${Date.now()}`,
        round: 2,
        speakerId: target.id,
        content: targetContent,
        timestamp: new Date().toISOString(),
      },
    };
  }

  yield { type: "round_complete", data: { round: 2 } };

  // ===== Round 3: Refined Positions =====
  yield { type: "round_start", data: { round: 3, label: "第三轮：观点修正" } };

  for (const member of cabinetMembers) {
    if (signal?.aborted) break;

    yield {
      type: "message_start",
      data: {
        round: 3,
        speakerId: member.id,
        speakerName: member.nameZh,
        speakerNameEn: member.nameEn,
        color: member.color,
      },
    };

    const allContext = [...round1Content, ...round2Context].map((c) => `- ${c}`).join("\n");

    let fullContent = "";
    try {
      for await (const result of streamChat(
        config,
        buildSystemPrompt(member),
        [
          ...conversationHistory,
          {
            role: "user",
            content: `作为内阁成员，请基于刚才的讨论，修正和深化你的观点。\n\n问题：${question}\n\n完整的讨论记录：\n${allContext}\n\n现在请输出你修正后的观点。你可以：\n1. 坚持但更有力地论证原有立场\n2. 适度调整原有立场\n3. 吸收其他成员的合理观点\n\n请明确说明你修正了什么，为什么。`,
          },
        ],
        4096,
        signal,
        member.id,
        member.nameZh
      )) {
        for (const retry of result.retries) {
          yield retry;
        }
        for (const chunk of result.chunks) {
          fullContent += chunk;
          yield { type: "message_delta", data: { round: 3, speakerId: member.id, delta: chunk } };
        }
      }
    } catch (err) {
      fullContent = `[发言失败：${(err as Error).message}]`;
      yield {
        type: "error",
        data: { message: `${member.nameZh} 发言失败：${(err as Error).message}` },
      };
    }

    yield {
      type: "message_complete",
      data: {
        id: `round3-${member.id}-${Date.now()}`,
        round: 3,
        speakerId: member.id,
        content: fullContent,
        timestamp: new Date().toISOString(),
      },
    };
  }

  yield { type: "round_complete", data: { round: 3 } };

  // ===== Final: Moderator Summary =====
  if (signal?.aborted) return;

  yield { type: "round_start", data: { round: 4, label: "主持人总结" } };

  yield {
    type: "message_start",
    data: { round: 4, speakerId: "moderator", speakerName: "主持人", color: "#6B7280" },
  };

  const allContent = [...round1Content, ...round2Context].join("\n\n");

  const moderatorSystem = `你是一个中立的会议主持人。你的职责是综合所有内阁成员的观点，给出总结。
你必须保持完全中立，不表达个人立场。

你的总结必须包含以下结构：
1. **讨论概览**：本次讨论的核心议题和整体氛围
2. **共识点**：各方都认同的部分（如果有）
3. **主要分歧**：各方观点分歧最大的地方
4. **各方核心论据摘要**：每位成员最核心的观点一句话总结
5. **建议决策框架**：给用户提供一个综合考虑的决策框架

请用中文回答。`;

  let summaryContent = "";
  try {
    for await (const result of streamChat(
      config,
      moderatorSystem,
      [
        {
          role: "user",
          content: `用户的问题是：${question}\n\n内阁讨论的完整记录：\n${allContent}\n\n请按照要求的结构进行总结。`,
        },
      ],
      4096,
      signal,
      "moderator",
      "主持人"
    )) {
      for (const retry of result.retries) {
        yield retry;
      }
      for (const chunk of result.chunks) {
        summaryContent += chunk;
        yield { type: "message_delta", data: { round: 4, speakerId: "moderator", delta: chunk } };
      }
    }
  } catch (err) {
    summaryContent = `[总结失败：${(err as Error).message}]`;
    yield { type: "error", data: { message: `主持人总结失败：${(err as Error).message}` } };
  }

  yield {
    type: "message_complete",
    data: {
      id: `summary-${Date.now()}`,
      round: 4,
      speakerId: "moderator",
      content: summaryContent,
      timestamp: new Date().toISOString(),
    },
  };

  yield {
    type: "discussion_complete",
    data: {
      question,
      totalMessages: cabinetMembers.length * 3 + pairs.length * 2 + 1,
    },
  };
}
