import { NextRequest, NextResponse } from "next/server";
import { createProvider } from "@/lib/ai/provider";
import { chatCompletionNonStreaming } from "@/lib/ai/non-streaming";
import { DISTILL_SYSTEM_PROMPT, buildDistillUserPrompt } from "@/lib/ai/distill-prompt";
import { CabinetMember, PersonaDoc, AIProviderConfig } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface DistillRequest {
  name: string;
  config: AIProviderConfig;
}

interface DistillResult {
  nameZh: string;
  nameEn: string;
  title: string;
  color: string;
  avatar: string;
  biography: string;
  coreValues: string[];
  decisionFramework: string[];
  mentalModels: { name: string; summary: string }[];
  decisionHeuristics: string[];
  speakingStyle: string;
  expressionDNA: string;
  biases: string[];
  innerTensions: string[];
  antiPatterns: string[];
  catchphrases: string[];
  historicalViews: Record<string, string>;
}

function generateId(nameZh: string): string {
  const base = nameZh
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "")
    .slice(0, 20);
  return base + "-" + Date.now().toString(36).slice(-4);
}

function parseDistillResult(raw: string): DistillResult {
  // Try to extract JSON from markdown code fences or raw text
  let jsonStr = raw.trim();

  // Remove markdown code fences if present
  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  const parsed = JSON.parse(jsonStr) as Partial<DistillResult>;

  // Validate and provide defaults
  return {
    nameZh: parsed.nameZh || "",
    nameEn: parsed.nameEn || "",
    title: parsed.title || "",
    color: parsed.color || "#3B82F6",
    avatar: parsed.avatar || "",
    biography: parsed.biography || "",
    coreValues: Array.isArray(parsed.coreValues) ? parsed.coreValues : [],
    decisionFramework: Array.isArray(parsed.decisionFramework) ? parsed.decisionFramework : [],
    mentalModels: Array.isArray(parsed.mentalModels) ? parsed.mentalModels : [],
    decisionHeuristics: Array.isArray(parsed.decisionHeuristics) ? parsed.decisionHeuristics : [],
    speakingStyle: parsed.speakingStyle || "",
    expressionDNA: parsed.expressionDNA || "",
    biases: Array.isArray(parsed.biases) ? parsed.biases : [],
    innerTensions: Array.isArray(parsed.innerTensions) ? parsed.innerTensions : [],
    antiPatterns: Array.isArray(parsed.antiPatterns) ? parsed.antiPatterns : [],
    catchphrases: Array.isArray(parsed.catchphrases) ? parsed.catchphrases : [],
    historicalViews: typeof parsed.historicalViews === "object" && parsed.historicalViews !== null
      ? parsed.historicalViews
      : {},
  };
}

function checkQuality(result: DistillResult): { ok: boolean; warning?: string } {
  if (!result.nameZh && !result.nameEn) {
    return { ok: false, warning: "无法识别该人物，请确认名字是否正确" };
  }
  if (!result.biography || result.biography.length < 50) {
    return { ok: false, warning: "该人物公开信息较少，生成的画像可能不够完整" };
  }
  if (!result.coreValues?.length) {
    return { ok: false, warning: "无法提取有效的人格特征，建议手动录入" };
  }
  if (result.mentalModels?.length < 2) {
    return { ok: false, warning: "心智模型提取不足，建议补充完善" };
  }
  return { ok: true };
}

function toCabinetMember(result: DistillResult): CabinetMember {
  const persona: PersonaDoc = {
    biography: result.biography,
    coreValues: result.coreValues,
    decisionFramework: result.decisionFramework,
    mentalModels: result.mentalModels.length ? result.mentalModels : [{ name: "", summary: "" }],
    decisionHeuristics: result.decisionHeuristics,
    speakingStyle: result.speakingStyle,
    expressionDNA: result.expressionDNA,
    biases: result.biases,
    innerTensions: result.innerTensions,
    antiPatterns: result.antiPatterns,
    catchphrases: result.catchphrases,
    historicalViews: result.historicalViews,
  };

  return {
    id: generateId(result.nameZh || result.nameEn),
    nameZh: result.nameZh,
    nameEn: result.nameEn,
    title: result.title,
    color: result.color,
    avatar: result.avatar,
    persona,
    source: "custom",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DistillRequest;
    const { name, config } = body;

    if (!name || !config) {
      return NextResponse.json({ error: "Missing name or config" }, { status: 400 });
    }

    const provider = createProvider(config);

    const { text, usage } = await chatCompletionNonStreaming(provider, {
      messages: [
        { role: "system", content: DISTILL_SYSTEM_PROMPT },
        { role: "user", content: buildDistillUserPrompt(name) },
      ],
      model: config.model,
      temperature: 0.7,
      maxTokens: 8192,
    });

    const result = parseDistillResult(text);
    const member = toCabinetMember(result);

    const quality = checkQuality(result);

    return NextResponse.json({
      member,
      usage,
      warning: quality.ok ? undefined : quality.warning,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
