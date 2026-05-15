import { NextResponse } from "next/server";
import { createProvider } from "@/lib/ai/provider";
import { AIProviderConfig } from "@/lib/types";

export async function POST(req: Request) {
  const config = (await req.json()) as AIProviderConfig;
  try {
    const provider = createProvider(config);
    // Test with a minimal request
    const modelMap = {
      claude: "claude-sonnet-4-20250514",
      openai: "gpt-4o",
      openrouter: "google/gemma-4-31b-it:free",
      ollama: "llama3",
      gemini: "gemini-2.0-flash",
      bailian: "qwen-plus",
    };
    const stream = provider.chatCompletion({
      messages: [{ role: "user", content: "Hi" }],
      model: config.model || modelMap[config.provider] || "gpt-4o",
      maxTokens: 10,
      stream: true,
    });
    // Consume just to verify it works
    for await (const _ of stream) break;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
