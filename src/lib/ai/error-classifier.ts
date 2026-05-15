export type ErrorType = "rate-limit" | "quota-exceeded" | "other";

export interface ClassifiedError {
  type: ErrorType;
  message: string;
  statusCode?: number;
}

export function classifyAPIError(error: unknown): ClassifiedError {
  const statusCode = extractStatusCode(error);
  const message = extractErrorMessage(error);
  const lower = message.toLowerCase();

  // 429 — rate limit or quota
  if (statusCode === 429) {
    const quotaKeywords = ["credits", "quota", "insufficient", "balance", "payment"];
    if (quotaKeywords.some((kw) => lower.includes(kw))) {
      return {
        type: "quota-exceeded",
        message: `AI 服务额度已用完：${message}`,
        statusCode: 429,
      };
    }
    // Default: treat as rate-limit (safer — retries instead of terminating)
    return {
      type: "rate-limit",
      message: `请求过于频繁，请稍后重试：${message}`,
      statusCode: 429,
    };
  }

  // >= 500 — server error, terminate
  if (statusCode && statusCode >= 500) {
    return {
      type: "other",
      message: `AI 服务不可用（${statusCode}）：${message}`,
      statusCode,
    };
  }

  // Everything else
  return {
    type: "other",
    message: message || "未知错误",
    statusCode: statusCode || undefined,
  };
}

function extractStatusCode(error: unknown): number | undefined {
  if (error instanceof Error) {
    const msg = error.message;
    const match = msg.match(/status[:\s]*(\d{3})/i) ?? msg.match(/(\d{3})\s*(?:Error|error)/i);
    if (match) return Number(match[1]);
    // Some APIs put it on a `status` or `statusCode` property
    const typed = error as { status?: unknown; statusCode?: unknown; httpStatus?: unknown };
    return (typed.status ?? typed.statusCode ?? typed.httpStatus) as number | undefined;
  }
  return undefined;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return (e.message ?? e.error ?? String(e)) as string;
  }
  return "Unknown error";
}

export function isRetryable(type: ErrorType): boolean {
  return type === "rate-limit";
}
