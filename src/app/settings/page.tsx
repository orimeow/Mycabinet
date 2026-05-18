"use client";

import { useState, useEffect } from "react";
import { AIProviderConfig } from "@/lib/types";
import { getUserId } from "@/lib/user";

const PROVIDER_OPTIONS = [
  { value: "gemini", label: "Google Gemini", defaultModel: "gemini-2.0-flash" },
  { value: "openrouter", label: "OpenRouter", defaultModel: "google/gemma-4-31b-it:free" },
  { value: "claude", label: "Claude API (Anthropic)", defaultModel: "claude-sonnet-4-20250514" },
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
  { value: "bailian", label: "阿里云百炼", defaultModel: "qwen-plus" },
  { value: "ollama", label: "Ollama (Local)", defaultModel: "llama3" },
];

const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.5-flash-preview-04-17",
  "gemini-2.5-pro-preview-03-25",
  "gemini-2.0-flash-lite",
];

const OPENROUTER_FREE_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "minimax/minimax-m2.5:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
  "z-ai/glm-4.5-air:free",
  "qwen/qwen3-coder:free",
  "meta-llama/llama-3.2-3b-instruct:free",
];

const BAILIAN_MODELS = [
  "qwen-plus",
  "qwen-turbo",
  "qwen-max",
  "qwen-long",
  "qwen-vl-max",
  "deepseek-v3",
  "deepseek-r1",
  "glm-4-plus",
  "yi-lightning",
];

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  claude: "Claude API",
  openai: "OpenAI",
  bailian: "阿里云百炼",
  ollama: "Ollama",
};

function getStored(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) || fallback;
}

export default function SettingsPage() {
  const [provider, setProvider] = useState("gemini");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.0-flash");
  const [baseUrl, setBaseUrl] = useState("http://localhost:11434");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    setUserId(getUserId());
    setProvider(getStored("ai-provider", "gemini"));
    setApiKey(getStored("ai-api-key", ""));
    setModel(getStored("ai-model", "gemini-2.0-flash"));
    setBaseUrl(getStored("ai-base-url", "http://localhost:11434"));
  }, []);

  useEffect(() => {
    const hasApiKey = localStorage.getItem("ai-api-key");
    const hasBaseUrl = localStorage.getItem("ai-base-url");
    const p = localStorage.getItem("ai-provider") || "gemini";
    if (p === "ollama" ? hasBaseUrl : hasApiKey) {
      setIsConfigured(true);
    }
  }, [saved]);

  const handleSave = () => {
    localStorage.setItem("ai-provider", provider);
    localStorage.setItem("ai-api-key", apiKey);
    localStorage.setItem("ai-model", model);
    localStorage.setItem("ai-base-url", baseUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    if (provider !== "ollama" && !apiKey.trim()) {
      setTestResult("请先输入 API Key");
      setTesting(false);
      return;
    }

    try {
      const config: AIProviderConfig = {
        provider: provider as AIProviderConfig["provider"],
        apiKey: apiKey.trim(),
        model,
        baseUrl: provider === "ollama" ? baseUrl : undefined,
      };
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult("ok");
      } else {
        setTestResult(`err:${data.error}`);
      }
    } catch (err) {
      setTestResult(`err:${(err as Error).message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleProviderChange = (value: string) => {
    setProvider(value);
    const opt = PROVIDER_OPTIONS.find((o) => o.value === value);
    if (opt) setModel(opt.defaultModel);
  };

  const borderColor = 'rgba(0,0,0,0.06)';

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Gradient mesh background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-pink-200/40 to-orange-200/40 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-teal-200/30 to-cyan-200/30 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-3xl px-4 py-4 md:px-6 md:py-6">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold">设置</h1>
          <p className="mt-1 text-sm text-gray-400">配置 AI 供应商和 API 密钥</p>
        </div>

        {/* User account ID */}
        {userId && (
          <div className="mb-3 rounded-md border bg-white p-4" style={{ borderColor }}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a]">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-400">设备 ID</p>
                <p className="font-mono text-sm font-medium text-gray-700 truncate">{userId}</p>
              </div>
            </div>
          </div>
        )}

        {/* Current active config indicator */}
        {isConfigured && (
          <div className="mb-3 rounded-md border bg-emerald-50 p-3" style={{ borderColor: "rgba(16,185,129,0.2)" }}>
            <p className="text-xs text-emerald-700">
              当前生效：<strong>{PROVIDER_LABELS[provider]}</strong> · {model}
            </p>
          </div>
        )}

        {/* AI Config Card */}
        <div className="rounded-md border bg-white p-5" style={{ borderColor }}>
          {/* Provider selection */}
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">AI 供应商</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 mb-5">
            {PROVIDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleProviderChange(opt.value)}
                className={`rounded-md px-3 py-3 text-sm font-medium transition-all duration-200 ${
                  provider === opt.value
                    ? 'bg-[#1a1a1a] text-white'
                    : 'border text-gray-600 hover:bg-gray-50'
                }`}
                style={{ borderColor: provider === opt.value ? undefined : borderColor, borderWidth: provider === opt.value ? undefined : 1 }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t my-4" style={{ borderColor }} />

          {/* API Key / Ollama URL */}
          {provider === "ollama" ? (
            <div className="mb-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">服务地址</p>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full rounded-md border bg-gray-50 px-4 py-3 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                style={{ borderColor }}
              />
            </div>
          ) : (
            <div className="mb-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">API Key</p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-md border bg-gray-50 px-4 py-3 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                style={{ borderColor }}
              />
              {provider === "openrouter" && (
                <p className="mt-2 text-xs text-gray-400">
                  在 openrouter.ai 获取 API Key，免费模型无需付费。
                </p>
              )}
              {provider === "bailian" && (
                <p className="mt-2 text-xs text-gray-400">
                  在阿里云百炼控制台创建 API Key，使用 OpenAI 兼容格式。
                </p>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="border-t my-4" style={{ borderColor }} />

          {/* Model */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">模型</p>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="模型名称"
              className="w-full rounded-md border bg-gray-50 px-4 py-3 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
              style={{ borderColor }}
            />

            {/* Model quick-select */}
            {provider === "gemini" && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {GEMINI_MODELS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                      model === m
                        ? 'bg-[#1a1a1a] text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            {provider === "openrouter" && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {OPENROUTER_FREE_MODELS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                      model === m
                        ? 'bg-[#1a1a1a] text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {m.split("/")[1]}
                  </button>
                ))}
              </div>
            )}
            {provider === "bailian" && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {BAILIAN_MODELS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                      model === m
                        ? 'bg-[#1a1a1a] text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleTest}
              disabled={testing || (provider !== "ollama" && !apiKey.trim())}
              className="rounded-md border px-5 py-3 text-sm font-medium transition-all duration-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor }}
            >
              {testing ? "测试中..." : "测试连接"}
            </button>
            {testResult && (
              <span className={`text-sm ${testResult === "ok" ? "text-green-600" : "text-red-600"}`}>
                {testResult === "ok" ? "✓ 连接成功" : `✗ ${testResult.slice(4)}`}
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={handleSave}
              className="rounded-md bg-[#1a1a1a] px-5 py-3 text-sm font-medium text-white transition-all hover:bg-[#333] active:scale-[0.98]"
            >
              {saved ? "✓ 已保存" : "保存设置"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
