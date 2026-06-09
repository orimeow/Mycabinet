import { NextRequest, NextResponse } from "next/server";
import { createProvider } from "@/lib/ai/provider";
import { chatCompletionNonStreaming } from "@/lib/ai/non-streaming";
import { DISTILL_SYSTEM_PROMPT, buildDistillUserPrompt } from "@/lib/ai/distill-prompt";
import { CabinetMember, PersonaDoc, AIProviderConfig } from "@/lib/types";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

interface DistillRequest {
  name: string;
  config: AIProviderConfig;
}

interface DistillI18nEn {
  title?: string;
  biography?: string;
  coreValues?: string[];
  decisionFramework?: string[];
  speakingStyle?: string;
  biases?: string[];
  catchphrases?: string[];
  historicalViews?: Record<string, string>;
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
  i18n?: { en?: DistillI18nEn };
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

  // Remove markdown code fences if present — use regex to handle fences anywhere in the text
  const fenceMatch = jsonStr.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  } else {
    // Try bare fences
    const bareMatch = jsonStr.match(/```\s*\n?([\s\S]*?)\n?\s*```/);
    if (bareMatch) {
      jsonStr = bareMatch[1].trim();
    } else {
      // No fences — strip leading/trailing non-JSON text
      const firstBrace = jsonStr.indexOf('{');
      const lastBrace = jsonStr.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
      }
    }
  }

  let parsed: Partial<DistillResult>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("AI 返回格式不正确，无法解析 JSON，请重试");
  }

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
    i18n: parsed.i18n ? {
      en: parsed.i18n.en ? {
        title: parsed.i18n.en.title,
        biography: parsed.i18n.en.biography,
        coreValues: Array.isArray(parsed.i18n.en.coreValues) ? parsed.i18n.en.coreValues : undefined,
        decisionFramework: Array.isArray(parsed.i18n.en.decisionFramework) ? parsed.i18n.en.decisionFramework : undefined,
        speakingStyle: parsed.i18n.en.speakingStyle,
        biases: Array.isArray(parsed.i18n.en.biases) ? parsed.i18n.en.biases : undefined,
        catchphrases: Array.isArray(parsed.i18n.en.catchphrases) ? parsed.i18n.en.catchphrases : undefined,
        historicalViews: typeof parsed.i18n.en.historicalViews === "object" ? parsed.i18n.en.historicalViews : undefined,
      } : undefined,
    } : undefined,
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
    i18n: result.i18n,
  };
}

export async function POST(req: NextRequest) {
  let body: DistillRequest;
  try {
    body = (await req.json()) as DistillRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  try {
    const { name, config } = body;

    if (!name || !config) {
      return NextResponse.json({ error: "Missing name or config" }, { status: 400 });
    }

    // Rate limit by IP — userId/name are client-controlled and easily spoofed
    const clientIp = getClientIp(req);
    const rl = checkRateLimit(`distill:${clientIp}`, 5, 10 * 60_000);
    if (!rl.allowed) {
      const retryAfter = Math.ceil((rl.retryAfterMs ?? 60_000) / 1000);
      return NextResponse.json(
        { error: `蒸馏请求过于频繁，请 ${Math.ceil(retryAfter / 60)} 分钟后重试` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
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
