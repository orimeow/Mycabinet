import { AIMessage, TokenUsage } from "@/lib/types";
import { AIProvider } from "./provider";

export interface NonStreamingResponse {
  text: string;
  usage?: TokenUsage;
}

export async function chatCompletionNonStreaming(
  provider: AIProvider,
  params: {
    messages: AIMessage[];
    model: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<NonStreamingResponse> {
  const stream = provider.chatCompletion({
    ...params,
    stream: true,
  });

  let fullText = "";
  let usage: TokenUsage | undefined;

  for await (const chunk of stream) {
    if (chunk.text) {
      fullText += chunk.text;
    }
    if (chunk.usage) {
      usage = chunk.usage;
    }
  }

  return { text: fullText, usage };
}
