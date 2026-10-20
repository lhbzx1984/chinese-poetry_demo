"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAudio } from "./audio-controller";
import { Seal } from "./ui/seal";
import { Icon } from "./ui/icons";
const VERSES = [
  ["海内存知己，天涯若比邻。", "王勃"],
  ["孤帆远影碧空尽。", "李白"],
  ["春江潮水连海平。", "张若虚"],
  ["会当凌绝顶，一览众山小。", "杜甫"],
  ["采菊东篱下，悠然见南山。", "陶渊明"],
  ["大漠孤烟直，长河落日圆。", "王维"],
  ["但愿人长久，千里共婵娟。", "苏轼"],
];
const subscribe = (callback: () => void) => {
  const media = window.matchMedia("(prefers-reduced-motion:reduce)"),
    connection = (navigator as Navigator & { connection?: EventTarget })
      .connection;
  media.addEventListener("change", callback);
  connection?.addEventListener("change", callback);
  return () => {
    media.removeEventListener("change", callback);
    connection?.removeEventListener("change", callback);
  };
};
const allowed = () =>
  !window.matchMedia("(prefers-reduced-motion:reduce)").matches &&
  !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    ?.saveData;
const POSTER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'%3E%3Cpath fill='%230b1417' d='M0 0h1600v900H0z'/%3E%3Cpath fill='%231a2e2c' d='m0 900 420-540 300 320 390-530 490 750Z'/%3E%3C/svg%3E";
export default function HomeHero({
  videoAvailable = false,
}: {
  videoAvailable?: boolean;
}) {
  const router = useRouter(),
    audio = useAudio(),
    hero = useRef<HTMLElement>(null),
    video = useRef<HTMLVideoElement>(null);
  const canPlay = useSyncExternalStore(subscribe, allowed, () => false),
    [videoOk, setVideoOk] = useState(true),
    [total, setTotal] = useState<number | null>(null),
    [jumping, setJumping] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/meta", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.data) setTotal(d.data.total);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  useEffect(() => {
    const element = hero.current,
      player = video.current;
    if (!element || !player) return;
    let visible = true;
    const sync = () => {
      if (visible && !document.hidden && canPlay)
        void player.play().catch(() => {});
      else player.pause();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        sync();
      },
      { threshold: 0.05 },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      player.pause();
    };
  }, [canPlay, videoAvailable, videoOk]);
  async function randomEntry() {
    setJumping(true);
    audio.playSfx("chime");
    try {
      const r = await fetch("/api/poems/random");
      const d = await r.json();
      if (!r.ok || !d.data?.id) throw new Error(d.error || "暂时没有可用诗词");
      router.push(`/read/${d.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "暂时无法入境，请稍后重试。");
    } finally {
      setJumping(false);
    }
  }
  return (
    <section className="cinema" id="top" ref={hero} aria-label="步入诗境">
      <div className="cinema-bg" aria-hidden>
        {videoAvailable && canPlay && videoOk && (
          <video
            ref={video}
            className="cinema-video"
            src="/media/hero-landscape.mp4"
            poster={POSTER}
            muted
            playsInline
            loop
            preload="metadata"
            onError={() => setVideoOk(false)}
          />
        )}
      </div>
      <div className="cinema-scrim" aria-hidden />
      <div className="hero-verses">
        {VERSES.map(([text, poet], i) => (
          <button
            key={poet}
            className="verse-column"
            style={{ animationDelay: `-${i * 3}s` }}
            aria-label={`${poet}：${text}`}
            onPointerEnter={() => {
              if (window.matchMedia("(hover:hover)").matches)
                audio.playSfx("pluck", {
                  note: [0, 2, 4, 7, 9, 12, 14][i],
                  volume: 0.5,
                });
            }}
            onFocus={() => audio.playSfx("pluck", { note: i * 2, volume: 0.5 })}
            onClick={() => audio.playSfx("pluck", { note: i * 2 })}
          >
            <span>{text}</span>
            <span className="verse-poet">{poet}</span>
          </button>
        ))}
      </div>
      <div className="cinema-content">
        <p className="cinema-eyebrow">山河为卷 · 诗意成境</p>
        <div className="cinema-title-row">
          <h1 className="cinema-title ink-bleed">诗境</h1>
          <Seal>山河</Seal>
        </div>
        <p className="cinema-sub">
          越过千年烟水，
          <br />
          与一首诗，悄然相逢。
        </p>
        <p className="cinema-meta">
          {total ? total.toLocaleString() + " 首诗词 · " : ""}
          循诗人足迹，听山河回响
        </p>
        <div className="cinema-cta">
          <a
            className="cta primary"
            href="#map"
            onClick={() => audio.playSfx("knock")}
          >
            <Icon name="map" />
            步入山河
          </a>
          <Link
            className="cta"
            href="/library"
            prefetch={false}
            onClick={() => audio.playSfx("ink")}
          >
            <Icon name="library" />
            漫游书库
          </Link>
          <button
            className="cta"
            onClick={() => void randomEntry()}
            disabled={jumping}
          >
            <Icon name="shuffle" />
            {jumping ? "正在入境" : "任入一境"}
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="cinema-scroll">往下，遇见另一重诗意 ↓</div>
    </section>
  );
}
