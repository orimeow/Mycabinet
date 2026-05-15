import { AIProviderConfig, AIMessage, ProviderResponse } from "@/lib/types";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface AIProvider {
  name: string;
  chatCompletion(params: {
    messages: AIMessage[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    stream: true;
  }): AsyncIterable<string>;
}

export class ClaudeProvider implements AIProvider {
  name = "claude";
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async *chatCompletion({
    messages,
    model,
    temperature = 0.7,
    maxTokens = 4096,
  }: {
    messages: AIMessage[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    stream: true;
  }): AsyncIterable<string> {
    const systemMessage = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    // Ensure alternating user/assistant pattern
    const cleaned: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const msg of userMessages) {
      const role = msg.role as "user" | "assistant";
      if (cleaned.length === 0 || role === "user") {
        cleaned.push({ role, content: msg.content });
      } else if (cleaned[cleaned.length - 1]?.role === "user" && role === "assistant") {
        cleaned.push({ role, content: msg.content });
      }
    }

    // If last message is assistant, add empty user message
    if (cleaned.length === 0 || cleaned[cleaned.length - 1]?.role === "assistant") {
      cleaned.push({ role: "user", content: "请继续。" });
    }

    const stream = await this.client.messages.create({
      model: model || "claude-sonnet-4-20250514",
      system: systemMessage?.content || "",
      messages: cleaned,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
        yield chunk.delta.text;
      }
    }
  }
}

export class OpenAIProvider implements AIProvider {
  name = "openai";
  private client: OpenAI;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      timeout: 60_000,
    });
  }

  async *chatCompletion({
    messages,
    model,
    temperature = 0.7,
    maxTokens = 4096,
  }: {
    messages: AIMessage[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    stream: true;
  }): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: model || "gpt-4o",
      messages: messages as OpenAI.ChatCompletionMessageParam[],
      max_tokens: maxTokens,
      temperature,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }
}

const OPENROUTER_FREE_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "minimax/minimax-m2.5:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
  "z-ai/glm-4.5-air:free",
  "qwen/qwen3-coder:free",
  "meta-llama/llama-3.2-3b-instruct:free",
];

export class OpenRouterProvider implements AIProvider {
  name = "openrouter";
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }

  async *chatCompletion({
    messages,
    model,
    temperature = 0.7,
    maxTokens = 4096,
  }: {
    messages: AIMessage[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    stream: true;
  }): AsyncIterable<string> {
    // Build fallback chain: requested model first, then free models that differ
    const modelChain = [model, ...OPENROUTER_FREE_MODELS.filter((m) => m !== model)];

    let lastError: Error | null = null;
    for (const fallbackModel of modelChain) {
      try {
        const stream = await this.client.chat.completions.create({
          model: fallbackModel,
          messages: messages as OpenAI.ChatCompletionMessageParam[],
          max_tokens: maxTokens,
          temperature,
          stream: true,
        });

        let prevText = "";
        for await (const chunk of stream) {
          const fullText = chunk.choices[0]?.delta?.content || "";
          if (!fullText) continue;
          // Some OpenRouter models return cumulative text instead of delta
          const delta = fullText.startsWith(prevText)
            ? fullText.slice(prevText.length)
            : fullText;
          prevText = fullText.startsWith(prevText) ? fullText : prevText + fullText;
          if (delta) {
            yield delta;
          }
        }
        return; // success, exit generator
      } catch (err) {
        lastError = err as Error;
        // Continue to next model on 500/503 errors
        // Retry on server errors (500/503) and model not found (404)
        const errMsg = lastError.message.toLowerCase();
        if (errMsg.includes("500") || errMsg.includes("503") || errMsg.includes("404")) {
          continue;
        }
        throw lastError; // auth/other errors are not model issues
      }
    }
    throw lastError ?? new Error("All OpenRouter free models are unavailable");
  }
}

export class OllamaProvider implements AIProvider {
  name = "ollama";
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:11434") {
    this.baseUrl = baseUrl;
  }

  async *chatCompletion({
    messages,
    model,
    temperature = 0.7,
  }: {
    messages: AIMessage[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    stream: true;
  }): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "llama3",
        messages,
        stream: true,
        options: { temperature },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              yield parsed.message.content;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    }
  }
}

export class GeminiProvider implements AIProvider {
  name = "gemini";
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async *chatCompletion({
    messages,
    model,
    temperature = 0.7,
    maxTokens = 4096,
  }: {
    messages: AIMessage[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    stream: true;
  }): AsyncIterable<string> {
    const systemMessage = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    // Gemini uses parts, not messages array with system role
    const parts = userMessages.map((m) => ({
      text: m.content,
    }));

    const genModel = this.client.getGenerativeModel({
      model: model || "gemini-2.0-flash",
      systemInstruction: systemMessage?.content || "",
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    });

    const result = await genModel.generateContentStream(parts);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }
}

export function createProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case "claude":
      if (!config.apiKey) throw new Error("Claude API key is required");
      return new ClaudeProvider(config.apiKey);
    case "openai":
      if (!config.apiKey) throw new Error("OpenAI API key is required");
      return new OpenAIProvider(config.apiKey, config.baseUrl);
    case "openrouter":
      if (!config.apiKey) throw new Error("OpenRouter API key is required");
      return new OpenRouterProvider(config.apiKey);
    case "ollama":
      return new OllamaProvider(config.baseUrl);
    case "gemini":
      if (!config.apiKey) throw new Error("Gemini API key is required");
      return new GeminiProvider(config.apiKey);
    case "bailian":
      if (!config.apiKey) throw new Error("阿里云百炼 API Key is required");
      return new OpenAIProvider(config.apiKey, "https://dashscope.aliyuncs.com/compatible-mode/v1");
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
