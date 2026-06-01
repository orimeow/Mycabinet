import { CabinetMember } from "@/lib/types";
import { cabinetMembers as builtInMembers } from "@/data/personas";
import type { Locale } from "@/lib/i18n";

// Cache for custom members to avoid repeated fetches
let customMembersCache: CabinetMember[] | null = null;
let cacheUserId: string | null = null;

export async function loadCustomMembers(userId: string): Promise<CabinetMember[]> {
  if (customMembersCache && cacheUserId === userId) {
    return customMembersCache;
  }
  try {
    const res = await fetch(`/api/members?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) {
      customMembersCache = [];
      cacheUserId = userId;
      return [];
    }
    const data = (await res.json()) as CabinetMember[];
    // Ensure source is set
    const members = data.map((m) => ({ ...m, source: "custom" as const }));
    customMembersCache = members;
    cacheUserId = userId;
    return members;
  } catch {
    customMembersCache = [];
    cacheUserId = userId;
    return [];
  }
}

export function getMemberById(id: string, customMembers: CabinetMember[]): CabinetMember | undefined {
  return builtInMembers.find((m) => m.id === id) || customMembers.find((m) => m.id === id);
}

export function invalidateCache() {
  customMembersCache = null;
  cacheUserId = null;
}

// Re-export built-in members for convenience
export { builtInMembers };

// ===== Locale-aware member display helpers =====

export function getMemberName(member: CabinetMember, locale: Locale): string {
  return locale === "en" ? member.nameEn : member.nameZh;
}

export function getMemberTitle(member: CabinetMember, locale: Locale): string {
  return locale === "en" ? (member.i18n?.en?.title || member.title) : member.title;
}

export function getMemberBiography(member: CabinetMember, locale: Locale): string {
  return locale === "en" ? (member.i18n?.en?.biography || member.persona.biography) : member.persona.biography;
}

export function getMemberCoreValues(member: CabinetMember, locale: Locale): string[] {
  return locale === "en" ? (member.i18n?.en?.coreValues || member.persona.coreValues) : member.persona.coreValues;
}

export function getMemberDecisionFramework(member: CabinetMember, locale: Locale): string[] {
  return locale === "en" ? (member.i18n?.en?.decisionFramework || member.persona.decisionFramework) : member.persona.decisionFramework;
}

export function getMemberSpeakingStyle(member: CabinetMember, locale: Locale): string {
  return locale === "en" ? (member.i18n?.en?.speakingStyle || member.persona.speakingStyle) : member.persona.speakingStyle;
}

export function getMemberBiases(member: CabinetMember, locale: Locale): string[] {
  return locale === "en" ? (member.i18n?.en?.biases || member.persona.biases) : member.persona.biases;
}

export function getMemberCatchphrases(member: CabinetMember, locale: Locale): string[] {
  return locale === "en" ? (member.i18n?.en?.catchphrases || member.persona.catchphrases) : member.persona.catchphrases;
}

export function getMemberHistoricalViews(member: CabinetMember, locale: Locale): Record<string, string> {
  return locale === "en" ? (member.i18n?.en?.historicalViews || member.persona.historicalViews) : member.persona.historicalViews;
}
