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
