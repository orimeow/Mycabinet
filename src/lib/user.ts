export function generateDeviceId(): string {
  if (typeof window === "undefined") return "unknown";
  const components = [
    navigator.userAgent,
    navigator.platform,
    String(navigator.hardwareConcurrency ?? 0),
    String(screen.width),
    String(screen.height),
    String(Date.now()),
  ].join("|");

  let h = 0x811c9dc5;
  for (let i = 0; i < components.length; i++) {
    h ^= components.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `user-${(h >>> 0).toString(16)}-${Date.now().toString(36)}`;
}

export function getUserId(): string {
  if (typeof window === "undefined") return "";
  let id = safeGetItem("user-id");
  if (!id) {
    id = generateDeviceId();
    safeSetItem("user-id", id);
  }
  return id;
}

// --- Simple nickname system (zero backend) ---

export function getUserName(): string | null {
  if (typeof window === "undefined") return null;
  return safeGetItem("user-name");
}

export function setUserName(name: string): void {
  if (typeof window === "undefined") return;
  safeSetItem("user-name", name.trim());
}

export function hasUserName(): boolean {
  return !!getUserName();
}

// --- API config check (shared across pages) ---

/** Default AI provider — used across all pages that read localStorage */
export const DEFAULT_PROVIDER = "openrouter";

/** Safe localStorage get — returns null if storage is unavailable */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Safe localStorage set — silently fails if storage is unavailable */
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode, quota exceeded, disabled)
  }
}

export function checkApiConfig(): boolean {
  if (typeof window === "undefined") return false;
  const provider = safeGetItem("ai-provider") || DEFAULT_PROVIDER;
  if (provider === "ollama") {
    return !!safeGetItem("ai-base-url");
  }
  return !!safeGetItem("ai-api-key");
}

// --- Onboarding tracking ---

export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") return false;
  return safeGetItem("onboarding-complete") === "1";
}

export function markOnboardingComplete(): void {
  if (typeof window === "undefined") return;
  safeSetItem("onboarding-complete", "1");
}
