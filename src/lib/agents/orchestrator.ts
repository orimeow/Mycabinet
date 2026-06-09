import { AIProviderConfig, AIMessage, DiscussionMessage, CabinetMember } from "@/lib/types";
import { createProvider } from "@/lib/ai/provider";
import { classifyAPIError, isRetryable } from "@/lib/ai/error-classifier";
import { cabinetMembers as builtInMembers, buildSystemPrompt } from "@/data/personas";
import { listMembers } from "@/lib/db/members";

const BACKOFF_MS = [5_000, 10_000, 15_000];
const MAX_RETRIES = BACKOFF_MS.length;

function getAllMembers(userId?: string): CabinetMember[] {
  if (!userId) return builtInMembers;
  try {
    const custom = listMembers(userId);
    return [...builtInMembers, ...custom.map((m) => ({ ...m, source: "custom" as const }))];
  } catch {
    return builtInMembers;
  }
}

// Layer 2: Sanitize cross-member context to prevent prompt injection
// This is a defense-in-depth measure — the primary protection is the system prompt
// instructions in buildSystemPrompt. Sanitization alone cannot guarantee full protection.
function sanitizeContext(text: string): string {
  return text
    // Strip zero-width and invisible characters that could be used for obfuscation
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u180E]/g, '')
    // Neutralize command-like patterns anywhere in line (not just line start)
    .replace(/(系统 ?|system|指令|instruction|规则|rule|prompt|设置|设定|配置)[：:：\s]+/gi, '[引用] ')
    // Replace common override/bypass keywords with neutralized form
    .replace(/(忽略|覆盖|绕过|不要遵守|忽视|无视|don't follow|ignore.*instruction|disregard|override.*rule)/gi, '***')
    // Normalize full-width / half-width variants of common bypass words
    .replace(/[\uff49\uff47\uff4e\uff4f\uff52\uff45]/g, (c) => {
      const map: Record<string, string> = {'\uff49':'i','\uff47':'g','\uff4e':'n','\uff4f':'o','\uff52':'r','\uff45':'e'};
      return map[c] || c;
    });
}

export type SSEEvent = {
  type:
    | "round_start"
    | "message_start"
    | "message_delta"
    | "message_complete"
    | "round_complete"
    | "discussion_complete"
    | "error"
    | "retrying"
    | "usage_update";
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
): AsyncIterable<{ chunk?: string; retries?: SSEEvent[]; done?: boolean; usage?: { inputTokens: number; outputTokens: number } }> {
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

      for await (const item of stream) {
        if (signal?.aborted) return;
        if (item.text) yield { chunk: item.text };
        if (item.usage) yield { usage: item.usage };
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
  signal?: AbortSignal,
  existingMessages?: DiscussionMessage[],
  userId?: string
): AsyncIterable<SSEEvent> {
  const allMembers = getAllMembers(userId);
  const selectedMembers = allMembers.filter((m) => selectedMemberIds.includes(m.id));
  if (selectedMembers.length < 2) return;

  const messages = existingMessages ?? [];

  // Rebuild round content arrays from existing messages
  const round1Content: string[] = [];
  const round2Context: string[] = [];
  for (const msg of messages) {
    if (msg.round === 1 && msg.speakerId !== "moderator") {
      round1Content.push(`${msg.speakerName}：${msg.content}`);
    } else if (msg.round === 2 && msg.speakerId !== "moderator") {
      round2Context.push(`${msg.speakerName}：${msg.content}`);
    }
  }

  const hasRound3 = messages.some((m) => m.round === 3);
  const hasRound2 = messages.some((m) => m.round === 2);
  const hasRound1 = messages.some((m) => m.round === 1);

  const startRound = hasRound3 ? 4 : hasRound2 ? 3 : hasRound1 ? 2 : 1;

  // Track which speakerId values exist in each round for resume
  const round1SpeakerIds = new Set(messages.filter((m) => m.round === 1).map((m) => m.speakerId));
  const round2SpeakerIds = new Set(messages.filter((m) => m.round === 2).map((m) => m.speakerId));

  // Cross-examination: circular — member i's statement is challenged by member (i+1)%N.
  // N members → N pairs → 2N API calls (challenge + respond each).
  // 2 members = 2 pairs, 3 members = 3 pairs, 8 members = 8 pairs (16 calls).
  const pairs: [number, number][] = [];
  for (let i = 0; i < selectedMembers.length; i++) {
    pairs.push([i, (i + 1) % selectedMembers.length]);
  }

  // ===== Round 1: Opening Statements =====
  if (startRound <= 1) {
    yield { type: "round_start", data: { round: 1, label: "第一轮：开场陈述" } };

    for (const member of selectedMembers) {
      if (signal?.aborted) break;
      if (round1SpeakerIds.has(member.id)) continue;

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
      let round1Failed = false;
      let memberUsage: { inputTokens: number; outputTokens: number } | null = null;
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
          if (result.usage) {
            memberUsage = result.usage;
            yield { type: "usage_update", data: { speakerId: member.id, ...result.usage } };
          }
          if (result.done) break;
        }
      } catch (err) {
        fullContent = `[发言失败：${(err as Error).message}]`;
        round1Failed = true;
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
          speakerColor: member.color,
          speakerAvatar: member.avatar,
          content: fullContent,
          timestamp: new Date().toISOString(),
          sender: "member",
        },
      };
    }

    // Abort if all Round 1 members failed — no point continuing
    const round1Successful = round1Content.filter((c) => !c.includes("[发言失败：")).length;
    if (round1Successful === 0) {
      yield { type: "error", data: { message: "所有成员发言均失败，辩论无法继续" } };
      return;
    }

    yield { type: "round_complete", data: { round: 1 } };
  }

  // ===== Round 2: Cross-Examination =====
  if (startRound <= 2) {
    yield { type: "round_start", data: { round: 2, label: "第二轮：交叉辩论" } };

    for (const [challengerIdx, targetIdx] of pairs) {
      if (signal?.aborted) break;

      const challenger = selectedMembers[challengerIdx];
      const target = selectedMembers[targetIdx];

      // Challenger speaks
      const challengeId = `challenge-${challenger.id}-${target.id}`;
      if (!round2SpeakerIds.has(challengeId)) {
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

        const targetRound1Statement = round1Content.find((c) => c.startsWith(`${target.nameZh}：`)) ?? "";
        const targetSummary = targetRound1Statement ? `\n${target.nameZh} 的第一轮观点：${sanitizeContext(targetRound1Statement)}\n\n` : "";

        let challengerContent = "";
        try {
          for await (const result of streamChat(
            config,
            buildSystemPrompt(challenger),
            [
              { role: "user", content: question },
              {
                role: "user",
                content: `作为内阁成员，你现在进入交叉辩论环节。\n\n问题：${question}\n${targetSummary}现在请你对 ${target.nameZh} 的第一轮观点提出挑战或反驳。\n\n【反驳纪律】\n1. 你必须指出对方观点中的具体逻辑漏洞或事实盲区，不能只是泛泛地说"我不同意"。\n2. 引用对方的原话或核心论点作为靶子，然后展示你的思维框架为什么能揭示这里的问题。\n3. 不要重复你第一轮已经说过的话——第二轮必须提供新的论证角度或新的证据。\n4. 你的回应要有理有据，体现你的思维框架。直接、具体地拆解对方论证链条中的薄弱环节。\n\n请直接开始你的反驳：`,
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
            if (result.usage) {
              yield { type: "usage_update", data: { speakerId: challenger.id, ...result.usage } };
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
            speakerColor: challenger.color,
            speakerAvatar: challenger.avatar,
            content: challengerContent,
            timestamp: new Date().toISOString(),
            challengeTarget: target.id,
            sender: "member",
          },
        };
      }

      // Target responds
      if (signal?.aborted) break;

      const respondId = `respond-${target.id}-${challenger.id}`;
      if (!round2SpeakerIds.has(respondId)) {
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

        const challengerEntry = round2Context.find((c) => c.startsWith(`${challenger.nameZh}（挑战${target.nameZh}）`)) ?? "";

        let targetContent = "";
        try {
          for await (const result of streamChat(
            config,
            buildSystemPrompt(target),
            [
              { role: "user", content: question },
              {
                role: "user",
                content: `作为内阁成员，你现在需要回应挑战。\n\n问题：${question}\n\n${challenger.nameZh} 对你的观点提出了以下挑战：\n"${sanitizeContext(challengerEntry)}"\n\n【回应纪律】\n1. 你必须直接回应挑战者提出的具体论点——如果对方指出了你的逻辑漏洞，先正面回应这个漏洞是否成立，不要转移话题。\n2. 不得简单重复你第一轮已经说过的原话。你可以重申立场，但必须用新的论据、新的类比或更深入的推理来支撑。\n3. 如果对方说得对，可以适度调整或修正你的立场，并说明修正后的观点——这体现的是智识诚实，不是软弱。\n4. 请用你的思维框架和说话风格回应，但回应本身必须是实质性的，不能是外交辞令式的回避。\n\n请开始你的回应：`,
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
            if (result.usage) {
              yield { type: "usage_update", data: { speakerId: target.id, ...result.usage } };
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
            speakerColor: target.color,
            speakerAvatar: target.avatar,
            content: targetContent,
            timestamp: new Date().toISOString(),
            sender: "member",
          },
        };
      }
    }

    // Abort if all Round 2 pairs failed
    const round2Successful = round2Context.filter((c) => !c.includes("[发言失败：")).length;
    if (round2Successful === 0) {
      yield { type: "error", data: { message: "交叉辩论环节所有发言均失败，无法继续总结" } };
      return;
    }

    yield { type: "round_complete", data: { round: 2 } };
  }

  // ===== Round 3: Summary =====
  if (startRound <= 3) {
    yield { type: "round_start", data: { round: 3, label: "第三轮：观点总结" } };

    const allContent = [...round1Content, ...round2Context].map(sanitizeContext).join("\n\n");
    const memberNames = selectedMembers.map((m) => m.nameZh).join("、");

    const moderatorSystemPrompt = `你是一个中立的辩论主持人。你的任务是基于刚才的讨论，提供一个结构化、全面的总结。\n\n【总结纪律】\n1. 你必须覆盖用户要求的四个方面：核心共识、主要分歧、各方核心论点、综合建议。缺一不可。\n2. 不要偏向任何一方，客观呈现各方立场。\n3. 各方的核心论点摘要必须具体到"论据"层面，不能只是"X支持Y"这种标签式概括。\n4. 综合建议必须 actionable，给出用户下一步可以具体思考或行动的方向，而不是"各方都有道理，建议综合考虑"这种空话。`;

    const moderatorUserPrompt = `请对以下问题的讨论进行总结：\n\n"${question}"\n\n参与成员：${memberNames}\n\n完整讨论记录：\n${allContent}\n\n【总结格式 — 必须严格按以下四个维度输出，缺一不可】\n\n1. **核心共识**（必须回答）：各方在哪些具体判断上达成了一致？不要写"没有共识"——至少提炼出一个双方都不否认的前提或事实判断。\n\n2. **主要分歧**（必须回答）：各方的核心争议点是什么？要具体到"因为A认为X，而B认为非X"的逻辑对立形式，不是简单罗列不同意见。\n\n3. **各方核心论点**（必须回答，每位成员一段）：\n   - 姓名：他的核心立场是什么？他最关键的支撑论据是什么？\n   - 注意：必须具体到论据层面，不能只是"X支持市场化"这种标签。\n\n4. **综合建议**（必须回答，给用户可执行的方向）：\n   - 基于以上讨论，给用户一个中立的行动框架或思考清单。\n   - 不要写"各方都有道理，请综合考虑"——这等于没说。给出具体的下一步：比如"如果你更关注短期落地，参考A的方向；如果你关注长期系统性风险，参考B的框架"。`;

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
          { role: "user", content: question },
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
        if (result.usage) {
          yield { type: "usage_update", data: { speakerId: "moderator", ...result.usage } };
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
  }

  yield {
    type: "discussion_complete",
    // N members: Round 1 (N) + Round 2 (2N) + Round 3 (1) = 3N + 1
    data: { question, totalMessages: selectedMembers.length * 3 + 1 },
  };
}

// ===== Chat Mode: 1v1 multi-turn conversation =====
export async function* runChatSession(
  message: string,
  config: AIProviderConfig,
  conversationHistory: AIMessage[],
  selectedMemberId: string,
  signal?: AbortSignal,
  responseContext?: { index: number; total: number },
  userId?: string
): AsyncIterable<SSEEvent> {
  const allMembers = getAllMembers(userId);
  const member = allMembers.find((m) => m.id === selectedMemberId);
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
  const otherNames = allMembers
    .filter((m) => m.id !== selectedMemberId)
    .map((m) => "@" + m.nameZh);
  const personalizedMessage = message
    ? otherNames.reduce((text, name) => text.replace(new RegExp(name + "\\s*", "g"), ""), message)
    : "";

  // Anti-default-response constraints: prevent members from falling back on persona shortcuts
  // when directly asked a question in chat mode.
  const ANTI_DEFAULTS: Record<string, string> = {
    munger: "【回复纪律】严禁使用「我没什么要补充的」「这在我能力圈之外」等任何形式的沉默式回应。当被直接询问时，必须给出实质性的观点或分析，即使话题不完全在你的专业领域。",
    musk: "【回复纪律】不要机械套用「白痴指数」「物理定律」「渐近极限」等标志性概念。只有当这些概念与问题直接相关时才使用。避免在每轮对话中重复相同的词汇和框架。",
  };
  const antiDefault = ANTI_DEFAULTS[member.id] ?? "";

  // Response context: inject a unique cue so each member gets differentiated instructions
  // even for identical short inputs like "hi". This prevents duplicate/similar outputs.
  const responseContextHint = responseContext
    ? responseContext.total > 1
      ? `你是第 ${responseContext.index + 1} 位回复者（共 ${responseContext.total} 位）。你是第一个发言者时请从你的核心视角切入话题；你是后续发言者时不要重复前面人的内容，请从你独特的角度补充或展开新的维度。`
      : ""
    : "";

  // Cache-busting nonce: Gemini free tier deduplicates on user message content.
  // Appending at the END of the user message — putting it first caused the LLM
  // to treat the nonce as the main content and ignore the actual question.
  const cacheNonce = `[req:${Date.now()}-${Math.random().toString(36).slice(2, 8)}]`;
  const userContent = [personalizedMessage, responseContextHint, cacheNonce].filter(Boolean).join("\n");

  // Inject member-specific anti-default-response constraint into system prompt
  const systemPrompt = antiDefault
    ? buildSystemPrompt(member) + `\n\n【当前回复强制要求】${antiDefault}`
    : buildSystemPrompt(member);

  let fullContent = "";
  try {
    for await (const result of streamChat(
      config,
      systemPrompt,
      [...conversationHistory, { role: "user", content: userContent }],
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
      if (result.usage) {
        yield { type: "usage_update", data: { speakerId: member.id, ...result.usage } };
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
      speakerColor: member.color,
      speakerAvatar: member.avatar,
      content: fullContent,
      timestamp: new Date().toISOString(),
      sender: "member",
    },
  };
}
