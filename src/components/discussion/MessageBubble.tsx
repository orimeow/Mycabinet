import React from "react";
import { DiscussionMessage } from "@/lib/types";
import { getMemberById } from "@/data/personas";
import { motion } from "framer-motion";

interface Props {
  message: DiscussionMessage;
  isActive: boolean;
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length > 0) {
      result.push(
        <ul key={`list-${result.length}`} className="ml-4 list-disc space-y-1 py-1">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm">{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  }

  function renderInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Bold: **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Italic: *text*
      const italicMatch = remaining.match(/(?<!\*)\*([^*]+?)\*(?!\*)/);
      // Code: `text`
      const codeMatch = remaining.match(/`([^`]+)`/);

      let firstMatch: { index: number; length: number; type: string; content: string } | null = null;

      if (boldMatch && boldMatch.index !== undefined) {
        firstMatch = { index: boldMatch.index, length: boldMatch[0].length, type: "bold", content: boldMatch[1] };
      }
      if (italicMatch && italicMatch.index !== undefined) {
        if (!firstMatch || italicMatch.index < firstMatch.index) {
          firstMatch = { index: italicMatch.index, length: italicMatch[0].length, type: "italic", content: italicMatch[1] };
        }
      }
      if (codeMatch && codeMatch.index !== undefined) {
        if (!firstMatch || codeMatch.index < firstMatch.index) {
          firstMatch = { index: codeMatch.index, length: codeMatch[0].length, type: "code", content: codeMatch[1] };
        }
      }

      if (firstMatch) {
        if (firstMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.slice(0, firstMatch.index)}</span>);
        }
        if (firstMatch.type === "bold") {
          parts.push(<strong key={key++}>{renderInline(firstMatch.content)}</strong>);
        } else if (firstMatch.type === "italic") {
          parts.push(<em key={key++}>{renderInline(firstMatch.content)}</em>);
        } else if (firstMatch.type === "code") {
          parts.push(
            <code key={key++} className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">
              {firstMatch.content}
            </code>
          );
        }
        remaining = remaining.slice(firstMatch.index + firstMatch.length);
      } else {
        parts.push(<span key={key++}>{remaining}</span>);
        remaining = "";
      }
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inCodeBlock) {
      if (line.startsWith("```")) {
        inCodeBlock = false;
        result.push(
          <pre key={`code-${result.length}`} className="my-2 rounded-md bg-gray-900 p-3 text-xs text-gray-100 overflow-x-auto">
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (line.startsWith("```")) {
      inCodeBlock = true;
      flushList();
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const sizes = ["text-xl font-bold", "text-lg font-bold", "text-base font-semibold", "text-sm font-semibold"];
      result.push(
        <div key={`h-${result.length}`} className={`${sizes[level - 1]} mt-3 mb-1 text-gray-900`}>
          {renderInline(headingMatch[2])}
        </div>
      );
      continue;
    }

    // Table rows
    if (line.includes("|") && !line.startsWith("-") && !line.startsWith("*")) {
      const cells = line.split("|").map(c => c.trim()).filter((_, idx, arr) => {
        // Skip first and last empty cells from leading/trailing |
        if (idx === 0 || idx === arr.length - 1) return false;
        return true;
      });

      // Skip separator lines like |---|---|
      if (cells.length > 0 && cells.every(c => /^[-:]+$/.test(c))) {
        continue;
      }

      flushList();

      if (result.length > 0) {
        const lastEl = result[result.length - 1] as React.ReactElement | undefined;
        if (lastEl && typeof lastEl === "object" && "type" in lastEl && lastEl.type === "table") {
          const props = (lastEl as React.ReactElement<{ children?: React.ReactNode[] | React.ReactNode }>).props;
          const existingChildren = Array.isArray(props.children) ? props.children : props.children ? [props.children] : [];
          existingChildren.push(
            <tr key={`row-${result.length}`}>
              {cells.map((cell, ci) => (
                <td key={ci} className="border border-gray-200 px-3 py-1.5 text-sm">{renderInline(cell)}</td>
              ))}
            </tr>
          );
          result[result.length - 1] = React.cloneElement(lastEl, {}, existingChildren);
          continue;
        }
      }

      result.push(
        <table key={`table-${result.length}`} className="my-2 border-collapse w-full">
          <tbody>
            <tr>
              {cells.map((cell, ci) => (
                <td key={ci} className="border border-gray-200 px-3 py-1.5 text-sm">{renderInline(cell)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      );
      continue;
    }

    // List items
    const listMatch = line.match(/^\s*[-*]\s+(.+)/);
    if (listMatch) {
      listItems.push(listMatch[1]);
      continue;
    }

    flushList();

    // Empty line
    if (line.trim() === "") {
      result.push(<div key={`br-${result.length}`} className="h-2" />);
      continue;
    }

    // Regular paragraph
    result.push(
      <p key={`p-${result.length}`} className="py-0.5">{renderInline(line)}</p>
    );
  }

  flushList();

  return result;
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
      <div className="ml-10 text-sm leading-relaxed text-gray-700">
        {message.content ? (
          renderMarkdown(message.content)
        ) : (
          <span className="animate-pulse text-gray-400">正在思考...</span>
        )}
      </div>

      {/* Typing dots */}
      {isActive && !message.content && (
        <div className="ml-10 mt-2 flex items-center gap-1.5">
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
