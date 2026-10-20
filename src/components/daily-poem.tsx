"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Poem } from "@/lib/types";
import { useAudio } from "./audio-controller";
import { Seal } from "./ui/seal";
import { Icon } from "./ui/icons";
export default function DailyPoem() {
  const [poem, setPoem] = useState<Poem | null | undefined>(undefined),
    [loading, setLoading] = useState(false),
    audio = useAudio();
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const r = await fetch("/api/poems/random", { signal });
      const d = await r.json();
      if (!r.ok || !d.data?.id) throw Error();
      const next = await fetch(`/api/poems/${d.data.id}`, { signal });
      const json = await next.json();
      if (!next.ok) throw Error();
      setPoem(json.data);
    } catch {
      if (!signal?.aborted) setPoem(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => void load(ctrl.signal), 0);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [load]);
  if (poem === null) return null;
  return (
    <section className="daily-section">
      <div className="section daily-poem">
        <div>
          <span className="section-kicker">今日一诗 · 偶然相逢</span>
          <Seal>{poem?.author.slice(0, 2) || "诗意"}</Seal>
          <h2>{poem?.title || "一首诗，正在途中"}</h2>
          <p className="section-copy">
            {poem ? `${poem.dynasty} · ${poem.author}` : "不必赶路，且待片刻。"}
          </p>
          <div className="daily-actions">
            {poem && (
              <Link
                href={`/read/${poem.id}`}
                prefetch={false}
                className="cta primary"
                onClick={() => audio.playSfx("ink")}
              >
                步入此诗
                <Icon name="next" />
              </Link>
            )}
            <button
              className="ghost-btn"
              disabled={loading}
              onClick={() => {
                audio.playSfx("chime");
                void load();
              }}
            >
              <Icon name="shuffle" />
              换一首
            </button>
          </div>
        </div>
        {poem ? (
          <div className="daily-lines">
            {poem.lines.slice(0, 4).map((line, i) => (
              <p key={i}>{line.length > 42 ? line.slice(0, 42) + "…" : line}</p>
            ))}
          </div>
        ) : (
          <div className="skeleton" aria-label="诗词载入中" />
        )}
      </div>
    </section>
  );
}
