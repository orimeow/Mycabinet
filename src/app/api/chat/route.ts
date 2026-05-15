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
  const { question } = body;
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

  const discussionId = `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();

  const discussion: Discussion = {
    id: discussionId,
    question,
    userId,
    mode: "debate",
    selectedMemberIds,
    messages: [],
    status: "running",
    createdAt,
    provider: config.provider,
  };

  saveDiscussion(discussion);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send discussion ID immediately so client knows it started
        controller.enqueue(encoder.encode(`event: discussion_started\ndata: ${JSON.stringify({ discussionId })}\n\n`));

        for await (const event of runDiscussion(question, config, selectedMemberIds, abortCtrl.signal)) {
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

            // Build conversation history including all prior responses
            const sessionHistory: AIMessage[] = [
              ...conversationHistory,
              ...(message ? [{ role: "user" as const, content: message }] : []),
              ...discussion.messages.map((m) => ({
                role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
                content: m.content,
              })),
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

            // Small delay between members to avoid free-tier model caching
            if (memberId !== memberIds[memberIds.length - 1]) {
              await new Promise((r) => setTimeout(r, 500));
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

            const sessionHistory: AIMessage[] = [
              ...conversationHistory,
              ...(message ? [{ role: "user" as const, content: message }] : []),
              ...discussion.messages.map((m) => ({
                role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
                content: m.content,
              })),
            ];

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
