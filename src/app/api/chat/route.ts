import { runDiscussion, runChatSession } from "@/lib/agents/orchestrator";
import { saveDiscussion, getDiscussion } from "@/lib/db/database";
import { AIProviderConfig, AIMessage, Discussion, DiscussionMessage } from "@/lib/types";

interface ChatRequestBody {
  question?: string;
  message?: string;
  config: AIProviderConfig;
  userId: string;
  mode?: "debate" | "chat";
  selectedMemberIds?: string[];
  selectedMemberId?: string; // chat mode: current speaking member
  discussionId?: string;
  conversationHistory?: AIMessage[];
  existingMessages?: DiscussionMessage[];
}

export async function POST(req: Request) {
  const body = (await req.json()) as ChatRequestBody;
  const { config, userId, mode = "debate", selectedMemberIds = [], selectedMemberId } = body;

  if (!userId) {
    return new Response("Missing userId", { status: 400 });
  }

  const abortCtrl = new AbortController();
  req.signal.addEventListener("abort", () => {
    abortCtrl.abort();
  });

  const encoder = new TextEncoder();

  if (mode === "chat") {
    return handleChat(body, config, userId, abortCtrl, encoder, req.signal);
  }

  return handleDebate(body, config, userId, selectedMemberIds, abortCtrl, encoder, req.signal);
}

async function handleDebate(
  body: ChatRequestBody,
  config: AIProviderConfig,
  userId: string,
  selectedMemberIds: string[],
  abortCtrl: AbortController,
  encoder: TextEncoder,
  clientAbortSignal: AbortSignal
) {
  const { question, existingMessages, discussionId } = body;
  if (!question?.trim()) {
    return new Response("Missing question", { status: 400 });
  }

  if (selectedMemberIds.length < 2) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: "辩论模式至少需要选择2位成员" })}\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  // Compute resume state: which rounds are complete, what's the last completed speaker per round
  const resumeState = computeResumeState(existingMessages ?? []);

  // When resuming, try to find and reuse the existing discussion record
  let discussion: Discussion;
  let existingDiscussion: Discussion | null = null;
  if (discussionId) {
    existingDiscussion = getDiscussion(userId, discussionId);
  }
  if (!existingDiscussion) {
    // Fallback: find by status=running for this userId with matching question
    const { listDiscussions } = await import("@/lib/db/database");
    const allDiscussions = listDiscussions(userId, 100);
    existingDiscussion = allDiscussions.find(
      (d) => d.status === "running" && d.question === question && d.mode === "debate"
    ) ?? null;
  }

  if (existingDiscussion) {
    discussion = existingDiscussion;
    discussion.status = "running";
    saveDiscussion(discussion);
  } else {
    const newId = `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    discussion = {
      id: newId,
      question,
      userId,
      mode: "debate",
      selectedMemberIds,
      messages: [...(existingMessages ?? [])],
      status: "running",
      createdAt: new Date().toISOString(),
      provider: config.provider,
    };
    saveDiscussion(discussion);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send discussion ID immediately
        controller.enqueue(encoder.encode(`event: discussion_started\ndata: ${JSON.stringify({ discussionId: discussion.id })}\n\n`));

        // If resuming, mark completed rounds as active so UI shows correct state
        if (resumeState.startRound > 1) {
          for (let r = 1; r < resumeState.startRound; r++) {
            controller.enqueue(encoder.encode(`event: round_start\ndata: ${JSON.stringify({ round: r })}\n\n`));
            controller.enqueue(encoder.encode(`event: round_complete\ndata: ${JSON.stringify({ round: r })}\n\n`));
          }
        }

        for await (const event of runDiscussion(
          question,
          config,
          selectedMemberIds,
          abortCtrl.signal,
          resumeState.startRound,
          resumeState.lastSpeakerPerRound
        )) {
          if (event.type === "message_complete" && event.data) {
            const msg = event.data as Partial<DiscussionMessage>;
            discussion.messages.push(msg as DiscussionMessage);
            saveDiscussion(discussion);
          }
          if (event.type === "discussion_complete") {
            discussion.status = "completed";
            discussion.completedAt = new Date().toISOString();
            saveDiscussion(discussion);
          }
          if (event.type === "error" && event.data?.message) {
            const msg = String(event.data.message);
            if (!msg.includes("请稍后重试")) {
              discussion.status = "failed";
              discussion.error = msg;
              saveDiscussion(discussion);
            }
          }
          const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      } catch (err) {
        const errMsg = (err as Error).message;
        if (!clientAbortSignal.aborted) {
          discussion.status = "failed";
          discussion.error = errMsg;
          saveDiscussion(discussion);
          const errorEvent = `event: error\ndata: ${JSON.stringify({ message: errMsg })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * Compute resume state from existing messages.
 * Returns: startRound (1-4, where 4 means done) and lastSpeakerId per round.
 */
function computeResumeState(
  messages: DiscussionMessage[]
): { startRound: number; lastSpeakerPerRound: Record<number, string> } {
  const lastSpeakerPerRound: Record<number, string> = {};
  let maxRound = 0;

  for (const msg of messages) {
    if (msg.round > maxRound) maxRound = msg.round;
    lastSpeakerPerRound[msg.round] = msg.speakerId;
  }

  // Round 1: all members have round=1 messages → round 1 complete
  // Round 2: has messages with round=2 → round 2 complete (or in progress)
  // Round 3: has moderator message → round 3 complete

  const hasRound3 = messages.some((m) => m.round === 3);
  const hasRound2 = messages.some((m) => m.round === 2);
  const hasRound1 = messages.some((m) => m.round === 1);

  let startRound = 1;
  if (hasRound3) startRound = 4; // all done
  else if (hasRound2) startRound = 3; // start from summary
  else if (hasRound1) startRound = 2; // start from cross-exam

  return { startRound, lastSpeakerPerRound };
}

async function handleChat(
  body: ChatRequestBody,
  config: AIProviderConfig,
  userId: string,
  abortCtrl: AbortController,
  encoder: TextEncoder,
  clientAbortSignal: AbortSignal
) {
  const { message: messageFromClient, question, discussionId, conversationHistory = [] } = body;
  let { selectedMemberId } = body;
  const configFromClient = body.config;

  console.log(`[handleChat] discussionId=${discussionId || 'NULL'}, message=${messageFromClient?.slice(0, 50)}, question=${question?.slice(0, 50)}`);
  console.log(`[handleChat] config:`, { provider: configFromClient.provider, hasApiKey: !!configFromClient.apiKey, apiKeyLen: configFromClient.apiKey?.length, model: configFromClient.model });

  // For chat mode initial requests, use `question` as the message
  const message = messageFromClient ?? question ?? "";

  // If no discussionId, this is the first message — create a new discussion
  let discussion: Discussion;
  const isInitialRequest = !discussionId;

  if (discussionId) {
    const existing = getDiscussion(userId, discussionId);
    if (!existing) {
      return new Response("Discussion not found", { status: 404 });
    }
    discussion = existing;
    // For follow-up requests, validate that the client sent a valid API key
    if (!configFromClient.apiKey && configFromClient.provider !== "ollama") {
      return new Response(
        JSON.stringify({ error: "API Key 丢失，请刷新页面重新开始讨论" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    // For subsequent requests, use the stored selectedMemberIds if not provided
    if (!selectedMemberId && discussion.selectedMemberIds?.length === 1) {
      selectedMemberId = discussion.selectedMemberIds[0];
    }
  } else {
    const memberIds = body.selectedMemberIds ?? (selectedMemberId ? [selectedMemberId] : []);
    if (memberIds.length === 0) {
      return new Response("Missing selectedMemberIds or selectedMemberId", { status: 400 });
    }
    discussion = {
      id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      question: message ?? "",
      userId,
      mode: "chat",
      selectedMemberIds: memberIds,
      messages: [],
      status: "running",
      createdAt: new Date().toISOString(),
      provider: config.provider,
    };
    saveDiscussion(discussion);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send discussionId immediately so client can reference it
        controller.enqueue(encoder.encode(`event: discussion_started\ndata: ${JSON.stringify({ discussionId: discussion.id })}\n\n`));

        // For follow-up requests, save the user message to discussion first
        // (initial request already has the question stored in discussion.question)
        if (!isInitialRequest && message?.trim()) {
          discussion.messages.push({
            id: `user-msg-${Date.now()}`,
            round: 0,
            speakerId: "user",
            speakerName: "我",
            content: message,
            timestamp: new Date().toISOString(),
            sender: "user",
          });
          saveDiscussion(discussion);
        }

        // Initial request: all selected members respond to the question
        if (isInitialRequest && discussion.selectedMemberIds && discussion.selectedMemberIds.length > 0) {
          const memberIds = discussion.selectedMemberIds;
          console.log(`[handleChat] Initial request, ${memberIds.length} members:`, memberIds);

          for (const memberId of memberIds) {
            if (clientAbortSignal.aborted) {
              console.log('[handleChat] Client aborted before member', memberId);
              break;
            }
            console.log('[handleChat] Starting session for member:', memberId);

            // Initial request: include only the user's question, not other members' responses.
            // This prevents the LLM from echoing prior members' exact sentences.
            // The system prompt rule #9 reinforces this at the instruction level.
            const sessionHistory: AIMessage[] = [
              ...conversationHistory.filter((m) => m.role === "user"),
              ...(message ? [{ role: "user" as const, content: message }] : []),
            ];

            console.log(`[handleChat] Member ${memberId} sessionHistory:`, JSON.stringify(sessionHistory, null, 2).slice(0, 500));
            console.log(`[handleChat] Member ${memberId} message:`, message?.slice(0, 100));

            for await (const event of runChatSession(
              message ?? "",
              config,
              sessionHistory,
              memberId,
              abortCtrl.signal
            )) {
              if (event.type === "message_complete" && event.data) {
                const msg = event.data as Partial<DiscussionMessage>;
                discussion.messages.push(msg as DiscussionMessage);
                saveDiscussion(discussion);
              }
              const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
            console.log('[handleChat] Finished session for member:', memberId);

            // Small delay between members to prevent API response caching
            if (memberId !== memberIds[memberIds.length - 1]) {
              await new Promise((r) => setTimeout(r, 2000));
            }
          }
        } else {
          // Subsequent message: respond with specific member(s)
          const memberIds = body.selectedMemberIds ?? [];
          const targetIds = memberIds.length > 0 ? memberIds : (selectedMemberId ? [selectedMemberId] : []);

          if (targetIds.length === 0) {
            const errorEvent = `event: error\ndata: ${JSON.stringify({ message: "未指定回复成员" })}\n\n`;
            controller.enqueue(encoder.encode(errorEvent));
            return;
          }

          for (const memberId of targetIds) {
            if (clientAbortSignal.aborted) break;

            // For follow-up requests, use discussion.messages as the sole conversation source
            // (it already includes the user message we saved above + all prior AI responses)
            // Don't combine with client conversationHistory to avoid duplicating messages
            const sessionHistory: AIMessage[] = discussion.messages.map((m) => ({
              role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
              content: m.content,
            }));

            for await (const event of runChatSession(
              message ?? "",
              config,
              sessionHistory,
              memberId,
              abortCtrl.signal
            )) {
              if (event.type === "message_complete" && event.data) {
                const msg = event.data as Partial<DiscussionMessage>;
                discussion.messages.push(msg as DiscussionMessage);
                saveDiscussion(discussion);
              }
              const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }
        }
      } catch (err) {
        const errMsg = (err as Error).message;
        if (!clientAbortSignal.aborted) {
          discussion.status = "failed";
          discussion.error = errMsg;
          saveDiscussion(discussion);
          const errorEvent = `event: error\ndata: ${JSON.stringify({ message: errMsg })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 300;
