import React from "react";
import { DiscussionMessage } from "@/lib/types";
import { getMemberById } from "@/data/personas";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  message: DiscussionMessage;
  isActive: boolean;
}

export default function MessageBubble({ message, isActive }: Props) {
  const member =
    message.speakerId === "moderator"
      ? null
      : getMemberById(message.speakerId);

  const name = member?.nameZh || "主持人";
  const nameEn = member?.nameEn || "";
  const color = member?.color || "#6B7280";

  const isModerator = message.speakerId === "moderator";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-md border p-4 transition-all duration-200 ${
        isActive ? "shadow-md" : ""
      }`}
      style={{
        backgroundColor: isModerator
          ? "rgba(0,0,0,0.03)"
          : "rgba(255,255,255,0.8)",
        borderColor: isActive ? `${color}40` : "rgba(0,0,0,0.04)",
        boxShadow: isActive ? `0 0 16px ${color}15` : undefined,
      }}
    >
      {/* Avatar + name row */}
      <div className="flex items-baseline gap-2.5 mb-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs"
          style={{
            backgroundColor: isModerator ? "transparent" : `${color}10`,
            borderColor: "rgba(0,0,0,0.15)",
          }}
        >
          {isModerator ? (
            <span>🎤</span>
          ) : member?.avatar ? (
            <img src={member.avatar} alt={name} className="h-full w-full object-cover" />
          ) : (
            <span style={{ backgroundColor: color }} className="font-bold text-white">{name.charAt(0)}</span>
          )}
        </div>
        <span className="text-sm font-semibold text-gray-900">
          {name}
        </span>
        {nameEn && (
          <span className="text-xs text-gray-300">{nameEn}</span>
        )}
        {message.challengeTarget && (
          <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-xs text-red-500"
            style={{ backgroundColor: "rgba(220,38,38,0.06)" }}
          >
            → 挑战 {getMemberById(message.challengeTarget)?.nameZh}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="ml-0 md:ml-10 text-sm leading-relaxed text-gray-700 markdown-content">
        {message.content ? (
          <ReactMarkdown>{message.content}</ReactMarkdown>
        ) : (
          <span className="animate-pulse text-gray-400">正在思考...</span>
        )}
      </div>

      {/* Timestamp */}
      <div className="ml-0 md:ml-10 mt-1.5 text-[10px] text-gray-300">
        {formatTime(message.timestamp)}
      </div>

      {/* Typing dots */}
      {isActive && !message.content && (
        <div className="ml-0 md:ml-10 mt-2 flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full"
            style={{ backgroundColor: color, animationDelay: "0ms" }} />
          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full"
            style={{ backgroundColor: color, animationDelay: "150ms" }} />
          <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full"
            style={{ backgroundColor: color, animationDelay: "300ms" }} />
        </div>
      )}
    </motion.div>
  );
}
