"use client";

import { cabinetMembers as builtInMembers } from "@/data/personas";
import type { CabinetMember } from "@/lib/types";
import { useEffect, useRef } from "react";
import Avatar from "@/components/common/Avatar";
import { useI18n } from "@/lib/i18n";

interface Props {
  mode: "debate" | "chat";
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
  onConfirm?: () => void;
  onSelect?: (memberId: string) => void;
  members?: CabinetMember[];
}

export default function MemberPicker({ mode, selectedIds, onChange, onClose, onSelect, members }: Props) {
  const { t } = useI18n();
  const allMembers = members ?? builtInMembers;
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
        className="w-full max-w-lg rounded-xl border bg-white p-5 shadow-xl"
        style={{ borderColor: "rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">
            {mode === "debate" ? t("picker.title.debate") : t("picker.title.chat")}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mt-1 text-xs text-gray-400">
          {mode === "debate" ? t("picker.title.debate") : t("picker.title.chat")}
          {selectedIds.length > 0 && ` · ${t("picker.selected", { count: selectedIds.length })}`}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {allMembers.map((m) => {
            const active = selectedIds.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => {
                  const wasActive = selectedIds.includes(m.id);
                  toggle(m.id);
                  if (!wasActive) onSelect?.(m.id);
                }}
                className="group relative flex flex-col items-center gap-1.5 rounded-lg border py-3 px-2 transition-all duration-150"
                style={{
                  borderColor: active ? m.color : "rgba(0,0,0,0.06)",
                  backgroundColor: active ? "rgba(0,0,0,0.02)" : "transparent",
                }}
              >
                <Avatar src={m.avatar} name={m.nameZh} color={m.color} size={48} className="transition-all" />
                <div className="text-xs font-medium leading-tight text-center">{m.nameZh}</div>
                {active && (
                  <div className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#1a1a1a]">
                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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
            {t("picker.selected", { count: selectedIds.length })}
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
            {t("picker.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
