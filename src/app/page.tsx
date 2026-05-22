"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cabinetMembers as builtInMembers } from "@/data/personas";
import { AIProviderConfig, CabinetMember } from "@/lib/types";
import { getUserId } from "@/lib/user";
import { loadCustomMembers } from "@/lib/members";
import MemberPicker from "@/components/common/MemberPicker";

const debateQuestions = [
  "AI 是否会取代人类工作？我们该如何应对？",
  "面对气候变化，个人、企业和政府应该如何分工承担责任？",
  "全球化和逆全球化趋势下，发展中国家应该如何选择发展道路？",
  "全民基本收入是解决贫富差距的有效方案还是养懒人的福利陷阱？",
  "数据隐私保护与国家安全之间应该如何取舍？",
  "基因编辑技术是否应该被允许用于人类增强？",
  "社交媒体平台是否应该为虚假内容承担责任？",
  "自动驾驶汽车在不可避免的事故中应该优先保护谁？",
  "加密货币是否应该被各国政府全面禁止？",
  "远程办公是否会永久改变未来的工作模式？",
  "教育应该优先培养创新能力还是基础知识？",
  "太空探索的资源投入是否值得？",
  "动物实验在医学研究中是否仍然必要？",
  "核能是否是应对能源危机的最佳方案？",
  "人工智能是否应该拥有法律人格？",
  "贫富差距的根源在于制度还是个人能力？",
  "言论自由的边界在哪里？",
  "死刑是否应该被彻底废除？",
  "数字人民币的推广是利大于弊还是弊大于利？",
  "人类是否应该为火星殖民做准备？",
];

const chatQuestions = [
  "如何高效管理个人财务并实现理财目标？",
  "在职场中如何有效地向上级汇报工作成果？",
  "如何平衡工作和生活，避免职业倦怠？",
  "学习一门新语言的最佳方法是什么？",
  "如何建立和维护高质量的人际关系？",
  "面对重大决策时，如何克服选择困难症？",
  "如何在团队中有效处理意见分歧和冲突？",
  "如何培养长期主义思维来做人生规划？",
  "在不确定时代，个人应该如何提升抗风险能力？",
  "如何高效阅读并真正吸收一本书的内容？",
  "创业者在早期阶段最应该关注什么？",
  "如何通过写作来提升自己的思考能力？",
  "面对信息过载，如何筛选有价值的信息？",
  "如何有效地进行自我管理和时间规划？",
  "在全球化时代，跨文化沟通能力为什么如此重要？",
  "如何判断一个行业或领域是否值得深耕？",
  "父母应该如何培养孩子的独立思考能力？",
  "如何通过运动来改善心理健康？",
  "在 AI 时代，人类最不可替代的能力是什么？",
  "如何从失败中学习并快速恢复状态？",
];

function getRandomQuestions(pool: string[], count: number, seed: number): string[] {
  let x = seed;
  const seededRandom = () => {
    x = (x * 1664525 + 1013904223) & 0xffffffff;
    return (x >>> 0) / 4294967296;
  };
  const shuffled = [...pool].sort(() => seededRandom() - 0.5);
  return shuffled.slice(0, count);
}

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"debate" | "chat">("debate");
  const [question, setQuestion] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showApiSetupModal, setShowApiSetupModal] = useState(false);
  const [customMembers, setCustomMembers] = useState<CabinetMember[]>([]);
  // SSR: show first 3 questions (deterministic). Client: randomize after mount.
  const [displayedQuestions, setDisplayedQuestions] = useState<string[]>(
    () => debateQuestions.slice(0, 3)
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const didSelectInSession = useRef(false);
  const activeAtPos = useRef<number | null>(null);

  const allMembers = [...builtInMembers, ...customMembers];

  useEffect(() => {
    const uid = getUserId();
    loadCustomMembers(uid).then(setCustomMembers);
    // Randomize questions only on client
    setDisplayedQuestions(getRandomQuestions(debateQuestions, 3, Math.floor(Math.random() * 10000)));

    // Check if API is configured — show setup modal for first-time users
    const provider = localStorage.getItem("ai-provider") || "openrouter";
    const hasConfig = provider === "ollama"
      ? localStorage.getItem("ai-base-url")
      : localStorage.getItem("ai-api-key");
    if (!hasConfig) setShowApiSetupModal(true);
  }, []);

  useEffect(() => {
    const pool = mode === "debate" ? debateQuestions : chatQuestions;
    setDisplayedQuestions(getRandomQuestions(pool, 3, Math.floor(Math.random() * 10000)));
  }, [mode]);

  // Track @ character in textarea
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const cursorPos = e.target.selectionStart ?? value.length;
      setQuestion(value);

      // Check if there's a fresh @ before cursor (not part of an email or completed @mention)
      const textBeforeCursor = value.slice(0, cursorPos);
      const lastAt = textBeforeCursor.lastIndexOf("@");
      if (lastAt !== -1) {
        // Ensure @ is not preceded by a word char (avoid triggering on emails like user@example)
        if (lastAt > 0 && /\w/.test(textBeforeCursor[lastAt - 1])) {
          setShowPicker(false);
          activeAtPos.current = null;
          return;
        }
        const afterAt = textBeforeCursor.slice(lastAt + 1);
        // Only show picker if @ is followed by 0-20 letters/Chinese chars (still being typed)
        if (/^[a-zA-Z一-龥]{0,20}$/.test(afterAt)) {
          activeAtPos.current = lastAt;
          setShowPicker(true);
          return;
        }
      }
      // Don't auto-close — let user keep the picker open to @ more members
    },
    []
  );

  const handleSelectMember = useCallback(
    (memberId: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const member = allMembers.find((m) => m.id === memberId);
      const displayName = member ? member.nameZh : memberId;

      const value = textarea.value;
      const targetAt = activeAtPos.current;

      // Use the tracked @ position from handleInputChange
      // Only fall back to scanning if no position was tracked
      let pos: number;
      if (targetAt != null && targetAt < value.length && value[targetAt] === "@") {
        pos = targetAt;
      } else {
        pos = -1;
      }

      const newText =
        pos >= 0
          ? value.slice(0, pos) + "@" + displayName + " "
          : value + "@" + displayName + " ";

      didSelectInSession.current = true;
      setQuestion(newText);
      setSelectedIds((prev) => (prev.includes(memberId) ? prev : [...prev, memberId]));
      activeAtPos.current = null;

      const newCursorPos = pos >= 0 ? pos + displayName.length + 2 : value.length + displayName.length + 2;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    []
  );

  const handleClosePicker = useCallback(() => {
    // Remove orphan @ only if no member was selected in this session
    if (!didSelectInSession.current) {
      const textarea = textareaRef.current;
      if (textarea) {
        const value = textarea.value;
        const cursorPos = textarea.selectionStart ?? value.length;
        const beforeCursor = value.slice(0, cursorPos);
        const afterCursor = value.slice(cursorPos);
        if (beforeCursor.endsWith("@")) {
          setQuestion(value.slice(0, cursorPos - 1) + afterCursor);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(cursorPos - 1, cursorPos - 1);
          }, 0);
        }
      }
    }
    didSelectInSession.current = false;
    setShowPicker(false);
  }, []);

  const removeMember = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const handleSubmit = () => {
    if (!question.trim()) return;

    const config: AIProviderConfig = {
      provider: (localStorage.getItem("ai-provider") as AIProviderConfig["provider"]) || "openrouter",
      apiKey: localStorage.getItem("ai-api-key") || "",
      model: localStorage.getItem("ai-model") || "google/gemma-4-31b-it:free",
      baseUrl: localStorage.getItem("ai-base-url") || undefined,
    };

    if (config.provider !== "ollama" && !config.apiKey) {
      alert("请先在设置页面配置 API Key");
      router.push("/settings");
      return;
    }

    sessionStorage.setItem("pending-question", question);
    sessionStorage.setItem("pending-config", JSON.stringify({ ...config, mode, selectedMemberIds: selectedIds }));
    router.push(`/discussion/new`);
  };

  const canSubmit = question.trim() && question.replace(/@[^\s]+/g, "").trim().length > 0 && selectedIds.length >= (mode === "debate" ? 2 : 1);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Gradient mesh background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-pink-200/40 to-orange-200/40 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-teal-200/30 to-cyan-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-purple-200/20 to-pink-200/20 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-4xl px-4 pb-20 pt-8 md:px-6 md:pt-10">
        {/* Mode toggle - capsule tab */}
        <div className="mb-6 flex justify-center">
          <div
            className="inline-flex rounded-full p-1"
            style={{ backgroundColor: "rgba(0,0,0,0.04)", borderColor: "rgba(0,0,0,0.06)" }}
          >
            <button
              onClick={() => setMode("debate")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${
                mode === "debate" ? "bg-[#1a1a1a] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              辩论
            </button>
            <button
              onClick={() => setMode("chat")}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${
                mode === "chat" ? "bg-[#1a1a1a] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              聊天
            </button>
          </div>
        </div>

        {/* Question input card */}
        <div className="rounded-md border bg-white/60 backdrop-blur-sm"
          style={{ borderColor: 'rgba(0,0,0,0.08)' }}
        >
          <div className="px-3 pt-3 md:px-4">
            <textarea
              ref={textareaRef}
              id="question"
              value={question}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSubmit();
              }}
              placeholder={mode === "debate" ? "输入问题后 @成员 开始辩论" : "输入消息后 @成员 开始聊天"}
              className="w-full resize-none bg-transparent px-4 py-3 text-base leading-relaxed
                placeholder:text-gray-400 placeholder:font-normal focus:outline-none"
              rows={3}
              maxLength={2000}
            />
          </div>
          <div className="mt-2 flex items-center justify-between px-3 py-2 md:px-4">
            <span className="text-xs text-gray-400 md:hidden">
              {selectedIds.length > 0 ? `已选 ${selectedIds.length} 人` : "点击头像选择成员"}
            </span>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="ml-auto shrink-0 rounded-md bg-[#1a1a1a] px-5 py-2 text-sm font-semibold text-white
                transition-all hover:bg-[#333] active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-40 md:px-6"
            >
              {mode === "debate" ? "开始辩论" : "发起聊天"}
            </button>
          </div>
        </div>

        {/* Suggested questions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {displayedQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => {
                const prefix = selectedIds.length > 0
                  ? selectedIds.map((id) => {
                      const m = allMembers.find((c) => c.id === id);
                      return m ? "@" + m.nameZh + " " : "";
                    }).join("")
                  : "";
                setQuestion(prefix + q);
              }}
              className="rounded-md px-3 py-1.5 text-xs text-gray-400 transition-all hover:bg-white/50 hover:text-gray-600"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="my-10 flex items-center gap-4">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
            内阁成员
          </span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Member avatars */}
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 sm:gap-6 md:gap-10">
            {allMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => setSelectedIds((prev) => prev.includes(member.id) ? prev.filter((x) => x !== member.id) : [...prev, member.id])}
                className="group flex flex-col items-center gap-1.5"
              >
                <div
                  className="flex h-16 w-16 md:h-24 md:w-24 items-center justify-center overflow-hidden rounded-full border transition-all group-hover:scale-105"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.03)',
                    borderColor: 'rgba(0,0,0,0.15)',
                  }}
                >
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.nameZh}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-lg md:text-2xl font-bold text-gray-400">
                      {member.nameZh.charAt(0)}
                    </span>
                  )}
                </div>
                <span className="text-xs md:text-sm font-medium text-gray-700 text-center whitespace-nowrap">{member.nameZh}</span>
                <span className="hidden md:block text-xs text-gray-400">{member.title}</span>
              </button>
            ))}
        </div>

        {/* Member Picker Overlay */}
        {showPicker && (
          <MemberPicker
            mode={mode}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            onClose={handleClosePicker}
            onConfirm={handleSubmit}
            onSelect={handleSelectMember}
            members={allMembers}
          />
        )}

        {/* API Setup Modal for first-time users */}
        {showApiSetupModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowApiSetupModal(false)}
          >
            <div
              className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-xl mx-4"
              style={{ borderColor: "rgba(0,0,0,0.06)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">配置 AI 供应商</h3>
              <p className="mt-2 text-sm text-gray-500">
                系统不提供兜底的 AI 服务，请先配置你的 API Key 才能开始使用。
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => {
                    setShowApiSetupModal(false);
                    router.push("/settings");
                  }}
                  className="flex-1 rounded-md bg-[#1a1a1a] px-4 py-2.5 text-sm font-semibold text-white
                    transition-all hover:bg-[#333] active:scale-[0.98]"
                >
                  去设置
                </button>
                <button
                  onClick={() => setShowApiSetupModal(false)}
                  className="flex-1 rounded-md border px-4 py-2.5 text-sm font-medium text-gray-600
                    transition-all hover:bg-gray-50"
                  style={{ borderColor: "rgba(0,0,0,0.08)" }}
                >
                  稍后设置
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
