"use client";
import type { CSSProperties } from "react";
import Link from "next/link";
import { MOOD_META } from "@/lib/ambient-music";
import { useAudio } from "./audio-controller";
import { useReveal } from "@/lib/use-reveal";
import { Icon } from "./ui/icons";
export default function MoodTiles() {
  const audio = useAudio(),
    ref = useReveal<HTMLElement>();
  return (
    <section className="section" ref={ref}>
      <div className="section-head">
        <div>
          <span className="section-kicker">按意境入境</span>
          <h2>此刻的你，想去哪里？</h2>
        </div>
        <p className="section-copy">
          八重心境，八种回响。
          <br />
          开启诗乐后，可轻触试听。
        </p>
      </div>
      <div className="mood-grid">
        {MOOD_META.map((m, i) => (
          <article
            className="mood-tile"
            key={m.name}
            style={{ "--accent": m.accent } as CSSProperties}
            onPointerEnter={() => {
              if (window.matchMedia("(hover:hover)").matches)
                audio.preview(m.name);
            }}
          >
            <span className="mood-number">0{i + 1}</span>
            <button
              className="icon-button"
              aria-label={`试听${m.name}`}
              onClick={() => {
                audio.playSfx("knock");
                audio.preview(m.name);
              }}
            >
              <Icon name="play" />
            </button>
            <h3>{m.name}</h3>
            <p>{m.description}</p>
            <Link
              href={`/library?tag=${encodeURIComponent(m.genre)}`}
              prefetch={false}
              aria-label={`${m.name}，浏览${m.genre}诗词`}
              onClick={() => audio.playSfx("ink")}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
