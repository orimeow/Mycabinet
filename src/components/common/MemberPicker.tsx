"use client";

import { cabinetMembers } from "@/data/personas";
import { useEffect, useRef } from "react";

interface Props {
  mode: "debate" | "chat";
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
  onConfirm?: () => void;
  onSelect?: (memberId: string) => void;
}

export default function MemberPicker({ mode, selectedIds, onChange, onClose, onSelect }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const minCount = mode === "debate" ? 2 : 1;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border bg-white p-6 shadow-xl"
        style={{ borderColor: "rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">
            {mode === "debate" ? "选择辩论成员" : "选择聊天对象"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mt-1 text-xs text-gray-400">
          {mode === "debate" ? "辩论至少需要 2 位成员" : "聊天至少需要 1 位成员"}
          {selectedIds.length > 0 && `（已选 ${selectedIds.length} 位）`}
        </p>

        <div className="mt-4 grid gap-2.5">
          {cabinetMembers.map((m) => {
            const active = selectedIds.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => {
                  const wasActive = selectedIds.includes(m.id);
                  toggle(m.id);
                  if (!wasActive) onSelect?.(m.id);
                }}
                className="flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-150"
                style={{
                  borderColor: active ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.06)",
                  backgroundColor: active ? "rgba(0,0,0,0.02)" : "transparent",
                }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.03)",
                    borderColor: "rgba(0,0,0,0.15)",
                  }}
                >
                  {m.avatar ? (
                    <img src={m.avatar} alt={m.nameZh} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-gray-400">{m.nameZh.charAt(0)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{m.nameZh}</div>
                  <div className="truncate text-xs text-gray-400">{m.title}</div>
                </div>
                {active && (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a]">
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className={`text-xs ${selectedIds.length < minCount ? "text-amber-600" : "text-green-600"}`}>
            {selectedIds.length < minCount
              ? `还需选择 ${minCount - selectedIds.length} 位`
              : `${selectedIds.length} 位成员已选择`}
          </span>
          <button
            onClick={onClose}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              selectedIds.length >= minCount
                ? "bg-[#1a1a1a] text-white hover:bg-[#333]"
                : "cursor-not-allowed bg-gray-200 text-gray-400"
            }`}
            disabled={selectedIds.length < minCount}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
