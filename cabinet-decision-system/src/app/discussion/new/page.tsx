"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AIProviderConfig } from "@/lib/types";
import DiscussionView from "@/components/discussion/DiscussionView";

export default function NewDiscussionPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [config, setConfig] = useState<AIProviderConfig | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    // Guard against React Strict Mode double-mount in dev
    if (initialized.current) return;
    initialized.current = true;

    const stored = sessionStorage.getItem("pending-question");
    const storedConfig = sessionStorage.getItem("pending-config");
    if (!stored || !storedConfig) {
      router.push("/");
      return;
    }
    setQuestion(stored);
    setConfig(JSON.parse(storedConfig));
    // Clear immediately after reading
    sessionStorage.removeItem("pending-question");
    sessionStorage.removeItem("pending-config");
  }, [router]);

  if (!question || !config) {
    return (
      <div className="flex h-[calc(100vh-60px)] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <div className="flex gap-2">
            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
          </div>
          <p className="text-sm">正在进入讨论...</p>
        </div>
      </div>
    );
  }

  return <DiscussionView question={question} config={config} />;
}
