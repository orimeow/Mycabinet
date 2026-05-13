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
  speakingStyle: string;
  biases: string[];
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
  // For round 2: who is challenging whom
  challengeTarget?: string;
}

export interface Discussion {
  id: string;
  question: string;
  userId: string;
  messages: DiscussionMessage[];
  status: "pending" | "running" | "completed" | "terminated" | "failed";
  createdAt: string;
  completedAt?: string;
  terminatedAt?: string;
  error?: string;
  provider: string;
}

export interface AIProviderConfig {
  provider: "claude" | "openai" | "ollama" | "openrouter" | "gemini";
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
  { id: 3, label: "第三轮：观点修正", type: "refined" },
  { id: 4, label: "主持人总结", type: "summary" },
];
