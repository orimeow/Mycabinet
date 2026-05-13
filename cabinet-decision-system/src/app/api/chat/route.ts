import { runDiscussion } from "@/lib/agents/orchestrator";
import { saveDiscussion } from "@/lib/db/database";
import { AIProviderConfig, Discussion, DiscussionMessage } from "@/lib/types";

export async function POST(req: Request) {
  const body = await req.json();
  const { question, config, userId } = body as {
    question: string;
    config: AIProviderConfig;
    userId: string;
  };

  if (!question?.trim()) {
    return new Response("Missing question", { status: 400 });
  }
  if (!userId) {
    return new Response("Missing userId", { status: 400 });
  }

  const discussionId = `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();

  const discussion: Discussion = {
    id: discussionId,
    question,
    userId,
    messages: [],
    status: "running",
    createdAt,
    provider: config.provider,
  };

  saveDiscussion(discussion);

  // Create AbortController for server-side abort (client disconnect)
  const abortCtrl = new AbortController();
  req.signal.addEventListener("abort", () => {
    abortCtrl.abort();
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runDiscussion(question, config, abortCtrl.signal)) {
          // Persist messages as they complete
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
            // Check if it's a non-retryable error that should terminate the discussion
            const msg = String(event.data.message);
            if (
              !msg.includes("请稍后重试") // rate-limit errors retry, don't terminate
            ) {
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
        // Only mark as failed if not already aborted by client disconnect
        if (!req.signal.aborted) {
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
