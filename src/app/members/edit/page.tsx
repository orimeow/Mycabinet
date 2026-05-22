import { Suspense } from "react";
import EditMemberPageClient from "./EditMemberPageClient";

function LoadingFallback() {
  return (
    <div className="flex h-[calc(100dvh-56px)] items-center justify-center">
      <div className="text-sm text-gray-400">加载中...</div>
    </div>
  );
}

export default function EditMemberPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <EditMemberPageClient />
    </Suspense>
  );
}
