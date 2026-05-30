"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CabinetMember, PersonaDoc, AIProviderConfig } from "@/lib/types";
import { getUserId, DEFAULT_PROVIDER } from "@/lib/user";
import { loadCustomMembers } from "@/lib/members";
import Avatar from "@/components/common/Avatar";
import { useI18n } from "@/lib/i18n";

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
    const provider = localStorage.getItem("ai-provider") || DEFAULT_PROVIDER;
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
  const { t } = useI18n();
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
  const [distillWarning, setDistillWarning] = useState("");
  const [aiConfig, setAiConfig] = useState<AIProviderConfig | null>(null);

  // Avatar upload states
  const [avatarFileName, setAvatarFileName] = useState("");
  const [useUrlAvatar, setUseUrlAvatar] = useState(false);

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
          if (found.avatar && found.avatar.startsWith("data:")) {
            setAvatarFileName(t("edit.uploadedImage"));
          } else if (found.avatar) {
            setAvatarFileName(t("edit.externalLink"));
            setUseUrlAvatar(true);
          }
        }
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    }
  }, [editId]);

  const updatePersona = useCallback((patch: Partial<PersonaDoc>) => {
    setMember((prev) => ({ ...prev, persona: { ...prev.persona, ...patch } }));
  }, []);

  const handleAvatarFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert(t("edit.imageTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setMember((prev) => ({ ...prev, avatar: dataUrl }));
      setAvatarFileName(file.name);
    };
    reader.onerror = () => {
      alert(t("edit.imageReadFailed"));
    };
    reader.readAsDataURL(file);
  }, []);

  const clearAvatar = useCallback(() => {
    setMember((prev) => ({ ...prev, avatar: "" }));
    setAvatarFileName("");
  }, []);

  const handleDistill = async () => {
    if (!distillName.trim()) {
      setDistillError(t("edit.distillError.missingName"));
      return;
    }
    const config = getStoredConfig();
    if (!config) {
      setDistillError(t("edit.distillError.missingConfig"));
      return;
    }
    setDistilling(true);
    setDistillError("");
    setDistillWarning("");
    try {
      const res = await fetch("/api/members/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: distillName.trim(), config }),
      });
      const data = await res.json().catch(() => ({ error: t("error.serverError") }));
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
      if (data.warning) {
        setDistillWarning(data.warning);
      }
      setCreationMode("manual");
    } catch (err) {
      setDistillError(err instanceof Error ? err.message : t("edit.distillError.failed"));
    } finally {
      setDistilling(false);
    }
  };

  const handleSave = async () => {
    if (!member.nameZh || !member.nameEn) {
      alert(t("edit.missingName"));
      return;
    }
    if (!member.persona.biography) {
      alert(t("edit.missingBiography"));
      return;
    }
    setSaving(true);
    const payload = { ...member };
    if (!editId) {
      payload.id = generateId(member.nameZh);
    }
    try {
      const url = editId
        ? `/api/members?id=${editId}&userId=${userId}`
        : "/api/members";
      const res = await fetch(url, {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editId ? { member: payload } : { userId, member: payload }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Save failed");
      }
      router.push("/members");
    } catch (err) {
      alert(err instanceof Error ? err.message : t("edit.saveFailed"));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-56px)] items-center justify-center">
        <div className="text-sm text-gray-400">{t("common.loading")}</div>
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
              <h1 className="text-lg md:text-xl font-bold tracking-tight">{t("edit.title.create")}</h1>
              <p className="mt-1 text-sm text-gray-400">{t("edit.subtitleCreate")}</p>
            </div>
            <button
              onClick={() => router.push("/members")}
              className="rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-black/5"
            >
              {t("common.cancel")}
            </button>
          </div>

          {/* Mode switcher */}
          <div className="mb-6 flex rounded-lg border p-1" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <button
              onClick={() => setCreationMode("distill")}
              className="flex-1 rounded-md py-2 text-sm font-medium transition-all bg-[#1a1a1a] text-white"
            >
              {t("edit.autoDistill")}
            </button>
            <button
              onClick={() => setCreationMode("manual")}
              className="flex-1 rounded-md py-2 text-sm font-medium text-gray-500 transition-all hover:bg-black/5"
            >
              {t("edit.manual")}
            </button>
          </div>

          <div className="rounded-xl border bg-white/60 p-6 backdrop-blur-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{t("edit.aiDistill.title")}</h2>
              <p className="mt-1 text-sm text-gray-400">{t("edit.aiDistill.description")}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("edit.celebrity.label")}</label>
                <input
                  type="text"
                  value={distillName}
                  onChange={(e) => setDistillName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !distilling && handleDistill()}
                  placeholder={t("edit.celebrity.placeholder")}
                  className="w-full rounded-md border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
                  style={{ borderColor: "rgba(0,0,0,0.08)" }}
                  disabled={distilling}
                />
                <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">{t("edit.nameHint")}</p>
              </div>

              {aiConfig ? (
                <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  {t("edit.currentUsing")} {aiConfig.provider} / {aiConfig.model}
                </div>
              ) : (
                <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-600">
                  {t("edit.configureProviderFirst")}
                  <button onClick={() => router.push("/settings")} className="ml-1 underline">{t("edit.settingsPage")}</button>
                  {" "}{t("edit.configure")}
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
                    {t("edit.distillingProgress")}
                  </span>
                ) : (
                  t("edit.startDistill")
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
            <h1 className="text-lg md:text-xl font-bold tracking-tight">{editId ? t("edit.title.edit") : t("edit.title.create")}</h1>
            <p className="mt-1 text-sm text-gray-400">{t("edit.subtitleCreate")}</p>
          </div>
          <button
            onClick={() => router.push("/members")}
            className="rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-black/5"
          >
            {t("common.cancel")}
          </button>
        </div>

        {/* Mode switcher (only for new members) */}
        {!editId && (
          <div className="mb-6 flex rounded-lg border p-1" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <button
              onClick={() => setCreationMode("distill")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${creationMode === "distill" ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:bg-black/5"}`}
            >
              {t("edit.autoDistill")}
            </button>
            <button
              onClick={() => setCreationMode("manual")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${creationMode === "manual" ? "bg-[#1a1a1a] text-white" : "text-gray-500 hover:bg-black/5"}`}
            >
              {t("edit.manual")}
            </button>
          </div>
        )}

        {!editId && creationMode === "manual" && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 17.25a5.25 5.25 0 100-10.5 5.25 5.25 0 000 10.5z" />
              </svg>
              <div className="text-sm text-amber-800">
                <p className="font-medium">{t("edit.aiGenWarning.title")}</p>
                <p className="mt-0.5 text-xs text-amber-700">{t("edit.aiGenWarning.body")}</p>
              </div>
            </div>
          </div>
        )}

        {distillWarning && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 17.25a5.25 5.25 0 100-10.5 5.25 5.25 0 000 10.5z" />
              </svg>
              <p className="text-sm text-amber-800">{distillWarning}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <Section title={t("edit.sectionBasic")} keyName="basic">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>{t("edit.field.nameZh")}</Label>
                <TextInput value={member.nameZh} onChange={(v) => setMember((p) => ({ ...p, nameZh: v }))} placeholder="e.g. Elon Musk" required />
              </div>
              <div>
                <Label required>{t("edit.field.nameEn")}</Label>
                <TextInput value={member.nameEn} onChange={(v) => setMember((p) => ({ ...p, nameEn: v }))} placeholder="如：Elon Musk" required />
              </div>
            </div>
            <div>
              <Label required>{t("edit.field.title")}</Label>
              <TextInput value={member.title} onChange={(v) => setMember((p) => ({ ...p, title: v }))} placeholder="如：Tesla / SpaceX CEO" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{t("edit.field.color")}</Label>
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
                <Label>{t("edit.field.avatar")}</Label>
                <div className="flex items-center gap-3">
                  <Avatar src={member.avatar} name={member.nameZh || "?"} color={member.color} size={48} />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                        {t("edit.selectImage")}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={handleAvatarFileChange}
                        />
                      </label>
                      {member.avatar && (
                        <button
                          onClick={clearAvatar}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >
                          {t("edit.clearAvatar")}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400">{t("edit.avatarFormat")}</p>
                    {avatarFileName && (
                      <p className="text-[10px] text-gray-500">{avatarFileName}</p>
                    )}
                    <button
                      onClick={() => setUseUrlAvatar((p) => !p)}
                      className="text-[10px] text-gray-400 underline hover:text-gray-600"
                    >
                      {useUrlAvatar ? t("edit.useUpload") : t("edit.useUrl")}
                    </button>
                    {useUrlAvatar && (
                      <TextInput
                        value={member.avatar}
                        onChange={(v) => setMember((p) => ({ ...p, avatar: v }))}
                        placeholder="https://..."
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section title={t("edit.sectionPersona")} keyName="persona">
            <div>
              <Label required>{t("edit.field.biography")}</Label>
              <TextArea
                value={member.persona.biography}
                onChange={(v) => updatePersona({ biography: v })}
                placeholder={t("edit.bioPlaceholder")}
                rows={5}
              />
            </div>
            <div>
              <Label>{t("edit.field.coreValues")}</Label>
              <ArrayTextArea value={member.persona.coreValues} onChange={(v) => updatePersona({ coreValues: v })} placeholder={t("edit.coreValuesPlaceholder")} />
            </div>
            <div>
              <Label>{t("edit.field.decisionFramework")}</Label>
              <ArrayTextArea value={member.persona.decisionFramework} onChange={(v) => updatePersona({ decisionFramework: v })} placeholder={t("edit.decisionFrameworkPlaceholder")} />
            </div>
            <div>
              <Label>{t("edit.field.mentalModels")}</Label>
              <div className="space-y-2">
                {member.persona.mentalModels.map((m, i) => (
                  <div key={m.name + m.summary + i} className="flex gap-2">
                    <input
                      type="text"
                      value={m.name}
                      onChange={(e) => {
                        const next = [...member.persona.mentalModels];
                        next[i] = { ...next[i], name: e.target.value };
                        updatePersona({ mentalModels: next });
                      }}
                      placeholder={t("edit.mentalModelName")}
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
                      placeholder={t("edit.mentalModelSummary")}
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
                      {t("common.delete")}
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => updatePersona({ mentalModels: [...member.persona.mentalModels, { name: "", summary: "" }] })}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  {t("edit.addMentalModel")}
                </button>
              </div>
            </div>
            <div>
              <Label>{t("edit.field.decisionHeuristics")}</Label>
              <ArrayTextArea value={member.persona.decisionHeuristics} onChange={(v) => updatePersona({ decisionHeuristics: v })} placeholder={t("edit.decisionHeuristicsPlaceholder")} />
            </div>
          </Section>

          <Section title={t("edit.sectionStyle")} keyName="style">
            <div>
              <Label>{t("edit.field.speakingStyle")}</Label>
              <TextArea
                value={member.persona.speakingStyle}
                onChange={(v) => updatePersona({ speakingStyle: v })}
                placeholder={t("edit.speakingStylePlaceholder")}
                rows={4}
              />
            </div>
            <div>
              <Label>{t("edit.field.expressionDNA")}</Label>
              <TextArea
                value={member.persona.expressionDNA}
                onChange={(v) => updatePersona({ expressionDNA: v })}
                placeholder={t("edit.expressionDNAPlaceholder")}
                rows={5}
              />
            </div>
          </Section>

          <Section title={t("edit.sectionMeta")} keyName="meta">
            <div>
              <Label>{t("edit.field.biases")}</Label>
              <ArrayTextArea value={member.persona.biases} onChange={(v) => updatePersona({ biases: v })} />
            </div>
            <div>
              <Label>{t("edit.field.innerTensions")}</Label>
              <ArrayTextArea value={member.persona.innerTensions} onChange={(v) => updatePersona({ innerTensions: v })} />
            </div>
            <div>
              <Label>{t("edit.field.antiPatterns")}</Label>
              <ArrayTextArea value={member.persona.antiPatterns} onChange={(v) => updatePersona({ antiPatterns: v })} />
            </div>
            <div>
              <Label>{t("edit.field.catchphrases")}</Label>
              <ArrayTextArea value={member.persona.catchphrases} onChange={(v) => updatePersona({ catchphrases: v })} />
            </div>
            <div>
              <Label>{t("edit.field.historicalViews")}</Label>
              <p className="mb-1 text-[10px] text-gray-400">{t("edit.historicalViewsFormat")}</p>
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
                placeholder={t("edit.historicalViewsPlaceholder")}
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
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-[#1a1a1a] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333] active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? t("edit.saving") : editId ? t("edit.saveChanges") : t("edit.createMember")}
          </button>
        </div>
      </main>
    </div>
  );
}
