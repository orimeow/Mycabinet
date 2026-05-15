import { AIProviderConfig, AIMessage, DiscussionMessage } from "@/lib/types";
import { createProvider } from "@/lib/ai/provider";
import { classifyAPIError, isRetryable } from "@/lib/ai/error-classifier";
import { cabinetMembers, buildSystemPrompt } from "@/data/personas";

const BACKOFF_MS = [5_000, 10_000, 15_000];
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
): AsyncIterable<{ chunk?: string; retries?: SSEEvent[]; done?: boolean }> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) return;

    if (attempt > 0) {
      const waitMs = BACKOFF_MS[attempt - 1] ?? 120_000;
      yield {
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

      for await (const chunk of stream) {
        if (signal?.aborted) return;
        yield { chunk };
      }
      yield { done: true };
      return;
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

// ===== Debate Mode: 3 rounds with selected members =====
export async function* runDiscussion(
  question: string,
  config: AIProviderConfig,
  selectedMemberIds: string[],
  signal?: AbortSignal
): AsyncIterable<SSEEvent> {
  const selectedMembers = cabinetMembers.filter((m) => selectedMemberIds.includes(m.id));
  if (selectedMembers.length < 2) return;

  const conversationHistory: AIMessage[] = [
    { role: "user" as const, content: question },
  ];

  const round1Content: string[] = [];

  // ===== Round 1: Opening Statements =====
  yield { type: "round_start", data: { round: 1, label: "第一轮：开场陈述" } };

  for (const member of selectedMembers) {
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

    const userPrompt = `作为内阁成员，请就以下问题发表你的初始观点：\n\n"${question}"\n\n请完全基于你自己的思维框架、价值观和决策逻辑独立发言，不要提及或复述其他成员的观点。请用你的身份特有的思维方式和说话风格来表达。`;

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
        if (result.retries) {
          for (const retry of result.retries) {
            yield retry;
          }
        }
        if (result.chunk) {
          fullContent += result.chunk;
          yield { type: "message_delta", data: { round: 1, speakerId: member.id, delta: result.chunk } };
        }
        if (result.done) break;
      }
    } catch (err) {
      fullContent = `[发言失败：${(err as Error).message}]`;
      yield {
        type: "error",
        data: { message: `${member.nameZh} 发言失败：${(err as Error).message}` },
      };
    }

    round1Content.push(`${member.nameZh}：${fullContent}`);

    yield {
      type: "message_complete",
      data: {
        id: `round1-${member.id}-${Date.now()}`,
        round: 1,
        speakerId: member.id,
        speakerName: member.nameZh,
        content: fullContent,
        timestamp: new Date().toISOString(),
        sender: "member",
      },
    };
  }

  yield { type: "round_complete", data: { round: 1 } };

  // ===== Round 2: Cross-Examination =====
  yield { type: "round_start", data: { round: 2, label: "第二轮：交叉辩论" } };

  const pairs: [number, number][] = [];
  for (let i = 0; i < selectedMembers.length; i++) {
    const targetIdx = (i + 1) % selectedMembers.length;
    pairs.push([i, targetIdx]);
  }
  // Reverse pairs
  for (let i = selectedMembers.length - 1; i >= 0; i--) {
    const challengerIdx = (i + 1) % selectedMembers.length;
    pairs.push([challengerIdx, i]);
  }

  const round2Context: string[] = [];

  for (const [challengerIdx, targetIdx] of pairs) {
    if (signal?.aborted) break;

    const challenger = selectedMembers[challengerIdx];
    const target = selectedMembers[targetIdx];

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

    // Get only the target member's Round 1 statement
    const targetRound1Statement = round1Content.find((c) => c.startsWith(`${target.nameZh}：`)) ?? "";
    const targetSummary = targetRound1Statement ? `\n${target.nameZh} 的第一轮观点：${targetRound1Statement}\n\n` : "";

    let challengerContent = "";
    try {
      for await (const result of streamChat(
        config,
        buildSystemPrompt(challenger),
        [
          ...conversationHistory,
          {
            role: "user",
            content: `作为内阁成员，你现在进入交叉辩论环节。\n\n问题：${question}\n${targetSummary}现在请你对 ${target.nameZh} 的第一轮观点提出挑战或反驳。\n注意：不要重复你第一轮已经说过的话，而是针对 ${target.nameZh} 的观点进行有针对性的反驳或质疑。\n你的回应要有理有据，体现你的思维框架。直接、具体地回应对方观点中的某个论点。\n\n请直接开始你的反驳：`,
          },
        ],
        4096,
        signal,
        challenger.id,
        challenger.nameZh
      )) {
        if (result.retries) {
          for (const retry of result.retries) {
            yield retry;
          }
        }
        if (result.chunk) {
          challengerContent += result.chunk;
          yield { type: "message_delta", data: { round: 2, speakerId: challenger.id, delta: result.chunk } };
        }
        if (result.done) break;
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
        speakerName: challenger.nameZh,
        content: challengerContent,
        timestamp: new Date().toISOString(),
        challengeTarget: target.id,
        sender: "member",
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
        if (result.retries) {
          for (const retry of result.retries) {
            yield retry;
          }
        }
        if (result.chunk) {
          targetContent += result.chunk;
          yield { type: "message_delta", data: { round: 2, speakerId: target.id, delta: result.chunk } };
        }
        if (result.done) break;
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
        speakerName: target.nameZh,
        content: targetContent,
        timestamp: new Date().toISOString(),
        sender: "member",
      },
    };
  }

  yield { type: "round_complete", data: { round: 2 } };

  // ===== Round 3: Summary =====
  yield { type: "round_start", data: { round: 3, label: "第三轮：观点总结" } };

  const allContent = [...round1Content, ...round2Context].join("\n\n");

  // Neutral moderator gives a single summary of the entire discussion
  const memberNames = selectedMembers.map((m) => m.nameZh).join("、");

  const moderatorSystemPrompt = `你是一个中立的辩论主持人。你的任务是基于刚才的讨论，提供一个客观、全面的总结。
请不要偏向任何一方，而是客观地梳理各方观点、分歧和共识，并给出综合建议。`;

  const moderatorUserPrompt = `请对以下问题的讨论进行总结：\n\n"${question}"\n\n参与成员：${memberNames}\n\n完整讨论记录：\n${allContent}\n\n请从以下四个方面进行总结：\n1. **核心共识**：各方达成的共识是什么\n2. **主要分歧**：各方的核心争议点\n3. **各方核心论点**：每位成员的核心立场和关键论证\n4. **综合建议**：基于讨论，给出中立的综合建议`;

  yield {
    type: "message_start",
    data: {
      round: 3,
      speakerId: "moderator",
      speakerName: "主持人",
      speakerNameEn: "Moderator",
      color: "#6b7280",
    },
  };

  let summaryContent = "";
  try {
    for await (const result of streamChat(
      config,
      moderatorSystemPrompt,
      [
        ...conversationHistory,
        { role: "user", content: moderatorUserPrompt },
      ],
      4096,
      signal,
      "moderator",
      "主持人"
    )) {
      if (result.retries) {
        for (const retry of result.retries) {
          yield retry;
        }
      }
      if (result.chunk) {
        summaryContent += result.chunk;
        yield { type: "message_delta", data: { round: 3, speakerId: "moderator", delta: result.chunk } };
      }
      if (result.done) break;
    }
  } catch (err) {
    summaryContent = `[总结失败：${(err as Error).message}]`;
    yield {
      type: "error",
      data: { message: `主持人总结失败：${(err as Error).message}` },
    };
  }

  yield {
    type: "message_complete",
    data: {
      id: `round3-moderator-summary-${Date.now()}`,
      round: 3,
      speakerId: "moderator",
      speakerName: "主持人",
      content: summaryContent,
      timestamp: new Date().toISOString(),
      sender: "member",
    },
  };

  yield { type: "round_complete", data: { round: 3 } };

  yield {
    type: "discussion_complete",
    data: { question, totalMessages: selectedMembers.length * 2 + pairs.length * 2 },
  };
}

// ===== Chat Mode: 1v1 multi-turn conversation =====
export async function* runChatSession(
  message: string,
  config: AIProviderConfig,
  conversationHistory: AIMessage[],
  selectedMemberId: string,
  signal?: AbortSignal
): AsyncIterable<SSEEvent> {
  const member = cabinetMembers.find((m) => m.id === selectedMemberId);
  if (!member) return;

  yield {
    type: "message_start",
    data: {
      round: 0,
      speakerId: member.id,
      speakerName: member.nameZh,
      speakerNameEn: member.nameEn,
      color: member.color,
    },
  };

  // Strip other @mentions and make prompt explicitly about this member
  const otherNames = cabinetMembers
    .filter((m) => m.id !== selectedMemberId)
    .map((m) => "@" + m.nameZh);
  const personalizedMessage = message
    ? otherNames.reduce((text, name) => text.replace(new RegExp(name + "\\s*", "g"), ""), message)
    : "";

  console.log(`[runChatSession] Member: ${member.nameZh}, message:`, personalizedMessage?.slice(0, 100));
  console.log(`[runChatSession] System prompt preview:`, `你是 ${member.nameZh}（${member.nameEn}），${member.title}`);

  let fullContent = "";
  try {
    for await (const result of streamChat(
      config,
      buildSystemPrompt(member),
      [...conversationHistory, { role: "user", content: personalizedMessage }],
      4096,
      signal,
      member.id,
      member.nameZh
    )) {
      if (result.retries) {
        for (const retry of result.retries) {
          yield retry;
        }
      }
      if (result.chunk) {
        fullContent += result.chunk;
        yield { type: "message_delta", data: { round: 0, speakerId: member.id, delta: result.chunk } };
      }
      if (result.done) break;
    }
  } catch (err) {
    fullContent = `[回复失败：${(err as Error).message}]`;
    yield {
      type: "error",
      data: { message: `${member.nameZh} 回复失败：${(err as Error).message}` },
    };
  }

  yield {
    type: "message_complete",
    data: {
      id: `chat-${member.id}-${Date.now()}`,
      round: 0,
      speakerId: member.id,
      speakerName: member.nameZh,
      content: fullContent,
      timestamp: new Date().toISOString(),
      sender: "member",
    },
  };
}
