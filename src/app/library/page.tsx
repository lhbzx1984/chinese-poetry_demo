import { Suspense } from "react";
import Library from "@/components/library";

export const metadata = { title: "书库 · 诗境" };

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="status-line">书库载入中…</div>}>
      <Library />
    </Suspense>
  );
}
