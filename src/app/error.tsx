"use client";
import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="error-page" tabIndex={-1}>
      <span className="error-code">暂歇</span>
      <h1>山间云起，稍候再试</h1>
      <p>页面暂时未能载入，你可以重试，或先回书库。</p>
      <div className="player-actions">
        <button className="cta" onClick={reset}>
          重新载入
        </button>
        <Link className="ghost-btn" href="/library">
          返回书库
        </Link>
      </div>
    </main>
  );
}
