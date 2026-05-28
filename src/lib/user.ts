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
  let id = localStorage.getItem("user-id");
  if (!id) {
    id = generateDeviceId();
    localStorage.setItem("user-id", id);
  }
  return id;
}

// --- Simple nickname system (zero backend) ---

export function getUserName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("user-name");
}

export function setUserName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("user-name", name.trim());
}

export function hasUserName(): boolean {
  return !!getUserName();
}

// --- API config check (shared across pages) ---

export function checkApiConfig(): boolean {
  if (typeof window === "undefined") return false;
  const provider = localStorage.getItem("ai-provider") || "openrouter";
  if (provider === "ollama") {
    return !!localStorage.getItem("ai-base-url");
  }
  return !!localStorage.getItem("ai-api-key");
}
