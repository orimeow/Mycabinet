export interface CabinetMember {
  id: string;
  nameEn: string;
  nameZh: string;
  title: string;
  color: string;
  avatar: string;
  persona: PersonaDoc;
}

export interface PersonaDoc {
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

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DiscussionMessage {
  id: string;
  round: number;
  speakerId: string | "moderator";
  speakerName?: string;
  speakerNameEn?: string;
  content: string;
  timestamp: string;
  sender?: "user" | "member" | "moderator";
  // For round 2: who is challenging whom
  challengeTarget?: string;
}

export interface Discussion {
  id: string;
  question: string;
  userId: string;
  mode?: "debate" | "chat";
  selectedMemberIds?: string[];
  messages: DiscussionMessage[];
  status: "pending" | "running" | "completed" | "terminated" | "failed";
  createdAt: string;
  completedAt?: string;
  terminatedAt?: string;
  error?: string;
  provider: string;
}

export interface AIProviderConfig {
  provider: "claude" | "openai" | "ollama" | "openrouter" | "gemini" | "bailian";
  apiKey?: string;
  model: string;
  baseUrl?: string; // for Ollama or custom OpenAI-compatible endpoints
}

export interface ProviderResponse {
  text: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export type RoundType = "opening" | "cross_exam" | "refined" | "summary";

export const ROUNDS: { id: number; label: string; type: RoundType }[] = [
  { id: 1, label: "第一轮：开场陈述", type: "opening" },
  { id: 2, label: "第二轮：交叉辩论", type: "cross_exam" },
  { id: 3, label: "第三轮：观点总结", type: "summary" },
];
