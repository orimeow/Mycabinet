import { CabinetMember } from "@/lib/types";
import { cabinetMembers as builtInMembers } from "@/data/personas";

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
