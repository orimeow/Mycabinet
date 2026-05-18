"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Discussion, AIProviderConfig } from "@/lib/types";
import DiscussionView from "@/components/discussion/DiscussionView";
import { getUserId } from "@/lib/user";

function ResumeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const discussionId = searchParams.get("id");
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!discussionId) {
      router.push("/history");
      return;
    }
    const userId = getUserId();
    fetch(`/api/discussions?id=${discussionId}&userId=${userId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.status === "running") {
          setDiscussion(data);
        } else {
          router.push(`/discussion/${discussionId}`);
          return;
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [discussionId, router]);

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-56px)] items-center justify-center">
        <div className="text-sm text-gray-400">正在连接讨论...</div>
      </div>
    );
  }

  if (!discussion) return null;

  // Restore API key from localStorage — it's not stored server-side
  const storedApiKey = localStorage.getItem("ai-api-key") || "";
  const storedBaseUrl = localStorage.getItem("ai-base-url") || undefined;
  const storedModel = localStorage.getItem("ai-model") || "";

  return (
    <DiscussionView
      question={discussion.question}
      config={{
        provider: discussion.provider as AIProviderConfig["provider"],
        apiKey: storedApiKey,
        model: storedModel,
        baseUrl: storedBaseUrl,
      }}
      userId={discussion.userId}
      existingMessages={discussion.messages}
      discussionId={discussion.id}
      mode={discussion.mode ?? "debate"}
      selectedMemberIds={discussion.selectedMemberIds ?? []}
    />
  );
}

export default function ResumeDiscussionPage() {
  return (
    <Suspense fallback={<div className="flex h-[calc(100dvh-56px)] items-center justify-center"><div className="text-sm text-gray-400">加载中...</div></div>}>
      <ResumeContent />
    </Suspense>
  );
}
