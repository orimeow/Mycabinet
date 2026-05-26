"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CabinetMember, PersonaDoc, AIProviderConfig } from "@/lib/types";
import { getUserId } from "@/lib/user";
import { loadCustomMembers } from "@/lib/members";

const DEFAULT_PERSONA: PersonaDoc = {
  biography: "",
  coreValues: [""],
  decisionFramework: [""],
  mentalModels: [{ name: "", summary: "" }],
  decisionHeuristics: [""],
  speakingStyle: "",
  expressionDNA: "",
  biases: [""],
  innerTensions: [""],
  antiPatterns: [""],
  catchphrases: [""],
  historicalViews: {},
};

const EMPTY_MEMBER: CabinetMember = {
  id: "",
  nameZh: "",
  nameEn: "",
  title: "",
  color: "#3B82F6",
  avatar: "",
  persona: DEFAULT_PERSONA,
  source: "custom",
};

function generateId(nameZh: string): string {
  const base = nameZh
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "")
    .slice(0, 20);
  return base + "-" + Date.now().toString(36).slice(-4);
}

function arrayInput(value: string[]): string {
  return value.filter(Boolean).join("\n");
}

function parseArrayInput(text: string): string[] {
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

function getStoredConfig(): AIProviderConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const provider = localStorage.getItem("ai-provider") || "gemini";
    const apiKey = localStorage.getItem("ai-api-key") || "";
    const model = localStorage.getItem("ai-model") || "gemini-2.0-flash";
    const baseUrl = localStorage.getItem("ai-base-url") || "http://localhost:11434";
    if (!apiKey && provider !== "ollama") return null;
    return { provider: provider as AIProviderConfig["provider"], apiKey, model, baseUrl };
  } catch {
    return null;
  }
}

export default function EditMemberPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const [userId, setUserId] = useState("");
  const [member, setMember] = useState<CabinetMember>(EMPTY_MEMBER);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    basic: false,
    persona: false,
    style: false,
    meta: false,
  });

  // Distillation states
  const [creationMode, setCreationMode] = useState<"distill" | "manual">("distill");
  const [distillName, setDistillName] = useState("");
  const [distilling, setDistilling] = useState(false);
  const [distillError, setDistillError] = useState("");
  const [aiConfig, setAiConfig] = useState<AIProviderConfig | null>(null);

  useEffect(() => {
    const uid = getUserId();
    setUserId(uid);
    setAiConfig(getStoredConfig());
    if (editId) {
      loadCustomMembers(uid).then((members) => {
        const found = members.find((m) => m.id === editId);
        if (found) {
          setMember({
            ...found,
            persona: {
              ...DEFAULT_PERSONA,
              ...found.persona,
              mentalModels: found.persona.mentalModels?.length ? found.persona.mentalModels : [{ name: "", summary: "" }],
            },
          });
        }
        setLoading(false);
      });
    }
  }, [editId]);

  const updatePersona = useCallback((patch: Partial<PersonaDoc>) => {
    setMember((prev) => ({ ...prev, persona: { ...prev.persona, ...patch } }));
  }, []);

  const handleDistill = async () => {
    if (!distillName.trim()) {
      setDistillError("请输入名人名字");
      return;
    }
    const config = getStoredConfig();
    if (!config) {
      setDistillError("请先配置 AI Provider（设置页面）");
      return;
    }
    setDistilling(true);
    setDistillError("");
    try {
      const res = await fetch("/api/members/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: distillName.trim(), config }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "蒸馏失败");
      }
      const distilled: CabinetMember = data.member;
      setMember({
        ...distilled,
        persona: {
          ...DEFAULT_PERSONA,
          ...distilled.persona,
          mentalModels: distilled.persona.mentalModels?.length
            ? distilled.persona.mentalModels
            : [{ name: "", summary: "" }],
        },
      });
      setCreationMode("manual");
    } catch (err) {
      setDistillError(err instanceof Error ? err.message : "蒸馏失败，请重试");
    } finally {
      setDistilling(false);
    }
  };

  const handleSave = async () => {
    if (!member.nameZh || !member.nameEn) {
      alert("请填写成员名称");
      return;
    }
    if (!member.persona.biography) {
      alert("请填写生平介绍");
      return;
    }
    setSaving(true);
    const payload = { ...member };
    if (!editId) {
      payload.id = generateId(member.nameZh);
    }
    try {
      const res = await fetch("/api/members", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          member: payload,
          ...(editId ? { id: editId } : {}),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      router.push("/members");
    } catch {
      alert("保存失败，请重试");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-56px)] items-center justify-center">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    );
  }

  // Distillation mode UI (only for new members)
  if (!editId && creationMode === "distill") {
    return (
      <div className="relative min-h-screen">
        <main className="relative mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">创建成员</h1>
              <p className="mt-1 text-sm text-gray-400">自定义你的内阁成员，赋予其独特的思维框架</p>
            </div>
            <button
              onClick={() => router.push("/members")}
              className="rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-black/5"
            >
              取消
            </button>
          </div>

          {/* Mode switcher */}
          <div className="mb-6 flex rounded-lg border p-1" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <button
              onClick={() => setCreationMode("distill")}
              className="flex-1 rounded-md py-2 text-sm font-medium transition-all bg-[#1a1a1a] text-white"
            >
              自动蒸馏
            </button>
            <button
              onClick={() => setCreationMode("manual")}
              className="flex-1 rounded-md py-2 text-sm font-medium text-gray-500 transition-all hover:bg-black/5"
            >
              手动录入
            </button>
          </div>

          <div className="rounded-xl border bg-white/60 p-6 backdrop-blur-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">AI 自动蒸馏</h2>
              <p className="mt-1 text-sm text-gray-400">
                输入一个真实人物的名字，AI 会自动调研并生成完整的思维框架画像。
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">名人名字</label>
                <input
                  type="text"
                  value={distillName}
                  onChange={(e) => setDistillName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !distilling && handleDistill()}
                  placeholder="如：埃隆·马斯克、Charlie Munger、张一鸣..."
                  className="w-full rounded-md border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
                  style={{ borderColor: "rgba(0,0,0,0.08)" }}
                  disabled={distilling}
                />
                <p className="mt-1 text-xs text-gray-400">支持中文或英文名字</p>
              </div>

              {aiConfig ? (
                <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  当前使用：{aiConfig.provider} / {aiConfig.model}
                </div>
              ) : (
                <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-600">
                  尚未配置 AI Provider，请先前往
                  <button onClick={() => router.push("/settings")} className="ml-1 underline">设置页面</button>
                  配置
                </div>
              )}

              {distillError && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-500">
                  {distillError}
                </div>
              )}

              <button
                onClick={handleDistill}
                disabled={distilling || !aiConfig}
                className="w-full rounded-md bg-[#1a1a1a] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#333] active:scale-[0.98] disabled:opacity-50"
              >
                {distilling ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    正在蒸馏中，请稍候...
                  </span>
                ) : (
                  "开始蒸馏"
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const Section = ({ title, keyName, children }: { title: string; keyName: string; children: React.ReactNode }) => (
    <div className="rounded-md border bg-white/60 backdrop-blur-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <button
        onClick={() => setCollapsed((p) => ({ ...p, [keyName]: !p[keyName] }))}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${collapsed[keyName] ? "" : "rotate-180"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!collapsed[keyName] && <div className="space-y-4 px-4 pb-4">{children}</div>}
    </div>
  );

  const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
    <label className="block text-xs font-medium text-gray-500">
      {children}
      {required && <span className="ml-1 text-red-400">*</span>}
    </label>
  );

  const TextInput = ({ value, onChange, placeholder, required }: { value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) => (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
      required={required}
    />
  );

  const TextArea = ({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) => (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-none rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    />
  );

  const ArrayTextArea = ({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) => (
    <TextArea
      value={arrayInput(value)}
      onChange={(v) => onChange(parseArrayInput(v))}
      placeholder={placeholder || "每行一项"}
      rows={4}
    />
  );

  return (
    <div className="relative min-h-screen">
      <main className="relative mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">{editId ? "编辑成员" : "创建成员"}</h1>
            <p className="mt-1 text-sm text-gray-400">自定义你的内阁成员，赋予其独特的思维框架</p>
          </div>
          <button
            onClick={() => router.push("/members")}
            className="rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-black/5"
          >
            取消
          </button>
        </div>

        {/* Mode switcher (only for new members) */}
        {!editId && (
          <div className="mb-6 flex rounded-lg border p-1" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <button
              onClick={() => setCreationMode("distill")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${creationMode === "distill" ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:bg-black/5"}`}
            >
              自动蒸馏
            </button>
            <button
              onClick={() => setCreationMode("manual")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${creationMode === "manual" ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:bg-black/5"}`}
            >
              手动录入
            </button>
          </div>
        )}

        <div className="space-y-4">
          <Section title="基本信息" keyName="basic">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>中文名</Label>
                <TextInput value={member.nameZh} onChange={(v) => setMember((p) => ({ ...p, nameZh: v }))} placeholder="如：埃隆·马斯克" required />
              </div>
              <div>
                <Label required>英文名</Label>
                <TextInput value={member.nameEn} onChange={(v) => setMember((p) => ({ ...p, nameEn: v }))} placeholder="如：Elon Musk" required />
              </div>
            </div>
            <div>
              <Label required>头衔</Label>
              <TextInput value={member.title} onChange={(v) => setMember((p) => ({ ...p, title: v }))} placeholder="如：Tesla / SpaceX CEO" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>主题色</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={member.color}
                    onChange={(e) => setMember((p) => ({ ...p, color: e.target.value }))}
                    className="h-9 w-14 rounded-md border p-0.5"
                    style={{ borderColor: "rgba(0,0,0,0.08)" }}
                  />
                  <span className="text-xs text-gray-400">{member.color}</span>
                </div>
              </div>
              <div>
                <Label>头像 URL</Label>
                <TextInput value={member.avatar} onChange={(v) => setMember((p) => ({ ...p, avatar: v }))} placeholder="https://..." />
              </div>
            </div>
          </Section>

          <Section title="人格核心" keyName="persona">
            <div>
              <Label required>生平介绍</Label>
              <TextArea
                value={member.persona.biography}
                onChange={(v) => updatePersona({ biography: v })}
                placeholder="成员的背景、经历和核心使命..."
                rows={5}
              />
            </div>
            <div>
              <Label>核心价值观</Label>
              <ArrayTextArea value={member.persona.coreValues} onChange={(v) => updatePersona({ coreValues: v })} placeholder="每行一条价值观，如：深度理解大于快速使用" />
            </div>
            <div>
              <Label>决策框架</Label>
              <ArrayTextArea value={member.persona.decisionFramework} onChange={(v) => updatePersona({ decisionFramework: v })} placeholder="每行一条决策原则" />
            </div>
            <div>
              <Label>心智模型</Label>
              <div className="space-y-2">
                {member.persona.mentalModels.map((m, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => {
                        const next = [...member.persona.mentalModels];
                        next[i] = { ...next[i], name: e.target.value };
                        updatePersona({ mentalModels: next });
                      }}
                      placeholder="模型名称"
                      className="w-1/3 rounded-md border bg-white px-3 py-2 text-sm"
                      style={{ borderColor: "rgba(0,0,0,0.08)" }}
                    />
                    <input
                      type="text"
                      value={m.summary}
                      onChange={(e) => {
                        const next = [...member.persona.mentalModels];
                        next[i] = { ...next[i], summary: e.target.value };
                        updatePersona({ mentalModels: next });
                      }}
                      placeholder="简要说明"
                      className="flex-1 rounded-md border bg-white px-3 py-2 text-sm"
                      style={{ borderColor: "rgba(0,0,0,0.08)" }}
                    />
                    <button
                      onClick={() => {
                        const next = member.persona.mentalModels.filter((_, idx) => idx !== i);
                        updatePersona({ mentalModels: next.length ? next : [{ name: "", summary: "" }] });
                      }}
                      className="rounded-md px-2 text-xs text-gray-400 hover:text-red-500"
                    >
                      删除
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => updatePersona({ mentalModels: [...member.persona.mentalModels, { name: "", summary: "" }] })}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  + 添加心智模型
                </button>
              </div>
            </div>
            <div>
              <Label>决策启发式</Label>
              <ArrayTextArea value={member.persona.decisionHeuristics} onChange={(v) => updatePersona({ decisionHeuristics: v })} placeholder="每行一条启发式规则" />
            </div>
          </Section>

          <Section title="表达风格" keyName="style">
            <div>
              <Label>说话风格</Label>
              <TextArea
                value={member.persona.speakingStyle}
                onChange={(v) => updatePersona({ speakingStyle: v })}
                placeholder="描述成员的说话方式、语气、节奏..."
                rows={4}
              />
            </div>
            <div>
              <Label>表达 DNA</Label>
              <TextArea
                value={member.persona.expressionDNA}
                onChange={(v) => updatePersona({ expressionDNA: v })}
                placeholder="具体的输出格式、用词偏好、禁忌、幽默方式..."
                rows={5}
              />
            </div>
          </Section>

          <Section title="元信息" keyName="meta">
            <div>
              <Label>已知偏见</Label>
              <ArrayTextArea value={member.persona.biases} onChange={(v) => updatePersona({ biases: v })} />
            </div>
            <div>
              <Label>内在张力</Label>
              <ArrayTextArea value={member.persona.innerTensions} onChange={(v) => updatePersona({ innerTensions: v })} />
            </div>
            <div>
              <Label>明确拒绝的事</Label>
              <ArrayTextArea value={member.persona.antiPatterns} onChange={(v) => updatePersona({ antiPatterns: v })} />
            </div>
            <div>
              <Label>名言 / 口头禅</Label>
              <ArrayTextArea value={member.persona.catchphrases} onChange={(v) => updatePersona({ catchphrases: v })} />
            </div>
            <div>
              <Label>历史观点</Label>
              <p className="mb-1 text-[10px] text-gray-400">格式：话题=观点（每行一个）</p>
              <TextArea
                value={Object.entries(member.persona.historicalViews).map(([k, v]) => `${k}=${v}`).join("\n")}
                onChange={(v) => {
                  const obj: Record<string, string> = {};
                  v.split("\n").forEach((line) => {
                    const idx = line.indexOf("=");
                    if (idx > 0) obj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
                  });
                  updatePersona({ historicalViews: obj });
                }}
                placeholder="ai=对AI的看法\neducation=对教育的看法"
                rows={4}
              />
            </div>
          </Section>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={() => router.push("/members")}
            className="rounded-md border px-5 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50"
            style={{ borderColor: "rgba(0,0,0,0.08)" }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-[#1a1a1a] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333] active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "保存中..." : editId ? "保存修改" : "创建成员"}
          </button>
        </div>
      </main>
    </div>
  );
}
