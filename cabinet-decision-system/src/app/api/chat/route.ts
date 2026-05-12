import { runDiscussion } from "@/lib/agents/orchestrator";
import { AIProviderConfig } from "@/lib/types";

export async function POST(req: Request) {
  const body = await req.json();
  const { question, config } = body as { question: string; config: AIProviderConfig };

  if (!question?.trim()) {
    return new Response("Missing question", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runDiscussion(question, config)) {
          const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      } catch (err) {
        const errorEvent = `event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
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
