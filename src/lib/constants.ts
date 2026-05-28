/** Shared UI constants for discussion status and mode rendering */

export const STATUS_LABELS: Record<string, string> = {
  running: "进行中",
  completed: "已完成",
  terminated: "已终止",
  failed: "失败",
  pending: "待开始",
};

export const MODE_LABELS: Record<string, string> = {
  debate: "辩论",
  chat: "聊天",
};

export const MODE_BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  debate: { bg: "rgba(139,92,246,0.1)", color: "#7c3aed" },
  chat: { bg: "rgba(6,182,212,0.1)", color: "#0891b2" },
};

export const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  running: { bg: "rgba(234,179,8,0.1)", color: "#ca8a04" },
  completed: { bg: "rgba(34,197,94,0.1)", color: "#16a34a" },
  terminated: { bg: "rgba(107,114,128,0.1)", color: "#6b7280" },
  failed: { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
  pending: { bg: "rgba(107,114,128,0.1)", color: "#6b7280" },
};
