"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// 挂灯式诗篇：一列列名句从顶部垂下，如树上挂的灯，随风轻摆、光在字间流动
const VERSES: { text: string; poet: string; left: string; size: number; dur: number; delay: number }[] = [
  { text: "海内存知己，天涯若比邻。", poet: "王勃", left: "3.5%", size: 15, dur: 7.4, delay: 0 },
  { text: "孤帆远影碧空尽，唯见长江天际流。", poet: "李白", left: "10.5%", size: 13, dur: 6.8, delay: 1.2 },
  { text: "春江潮水连海平，海上明月共潮生。", poet: "张若虚", left: "17.5%", size: 14, dur: 8.2, delay: 0.6 },
  { text: "会当凌绝顶，一览众山小。", poet: "杜甫", left: "24.5%", size: 16, dur: 7.1, delay: 1.8 },
  { text: "路漫漫其修远兮，吾将上下而求索。", poet: "屈原", left: "31.5%", size: 12, dur: 6.4, delay: 0.3 },
  { text: "采菊东篱下，悠然见南山。", poet: "陶渊明", left: "63.5%", size: 14, dur: 7.8, delay: 0.9 },
  { text: "大漠孤烟直，长河落日圆。", poet: "王维", left: "70.5%", size: 17, dur: 6.9, delay: 1.5 },
  { text: "但愿人长久，千里共婵娟。", poet: "苏轼", left: "77.5%", size: 15, dur: 8.4, delay: 0.4 },
  { text: "人生自古谁无死，留取丹心照汗青。", poet: "文天祥", left: "84.5%", size: 13, dur: 7.2, delay: 2.1 },
  { text: "疏影横斜水清浅，暗香浮动月黄昏。", poet: "林逋", left: "91%", size: 13, dur: 6.6, delay: 1.0 },
  { text: "两情若是久长时，又岂在朝朝暮暮。", poet: "秦观", left: "38.5%", size: 12, dur: 7.6, delay: 2.4 },
  { text: "落霞与孤鹜齐飞，秋水共长天一色。", poet: "王勃", left: "45.5%", size: 12, dur: 6.2, delay: 1.7 },
  { text: "身无彩凤双飞翼，心有灵犀一点通。", poet: "李商隐", left: "52.5%", size: 12, dur: 7.0, delay: 0.8 },
  { text: "近乡情更怯，不敢问来人。", poet: "宋之问", left: "58.5%", size: 12, dur: 6.6, delay: 2.0 },
];

function HeroVerses() {
  return (
    <div className="hero-verses" aria-hidden>
      {VERSES.map((v, i) => (
        <span
          key={i}
          className="verse-float"
          style={{
            left: v.left,
            fontSize: v.size,
            height: `${46 + (i % 4) * 4}vh`,
          }}
        >
          <span className="verse-window">
            <span
              className="verse-scroll"
              style={{
                animationDuration: `${v.dur * 1.9}s`,
                animationDelay: `${-i * 3.7}s`,
              }}
            >
              <span className="verse-text">{v.text}</span>
              <span className="verse-text">{v.text}</span>
              <span className="verse-text">{v.text}</span>
              <span className="verse-text">{v.text}</span>
              <span className="verse-text">{v.text}</span>
              <span className="verse-text">{v.text}</span>
            </span>
          </span>
          <span className="verse-poet">{v.poet}</span>
        </span>
      ))}
    </div>
  );
}

export default function HomeHero() {
  const router = useRouter();
  const [meta, setMeta] = useState<{ total: number; dynasties: { name: string; count: number }[] } | null>(null);
  const [videoOk, setVideoOk] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [jumping, setJumping] = useState(false);

  // 视频等媒体元素在水合完成后再渲染：部分浏览器扩展（如字幕类）会在水合前往
  // 媒体容器注入 DOM，导致服务端/客户端 HTML 不匹配（plasmo-csui SubtitleDiv 等）
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMeta(d.data))
      .catch(() => void 0);
  }, []);

  // 视频加载失败（含文件缺失）→ 立即切换程序化水墨背景
  function onVideoError() {
    setVideoOk(false);
  }

  async function randomEntry() {
    setJumping(true);
    try {
      const r = await fetch("/api/poems/random");
      const d = await r.json();
      if (d.data?.id) router.push(`/read/${d.data.id}`);
    } finally {
      setJumping(false);
    }
  }

  return (
    <header className="cinema" id="top">
      <div className={`cinema-bg${videoOk ? "" : " fallback"}`} aria-hidden suppressHydrationWarning>
        {mounted && videoOk && (
          <video
            className="cinema-video"
            src="/media/hero-landscape.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onError={onVideoError}
          />
        )}
      </div>
      <div className="cinema-scrim" aria-hidden />
      <HeroVerses />

      <nav className="topbar cinema-topbar">
        <Link href="/" className="brand">
          诗境
          <small>SHI JING · IMMERSIVE</small>
        </Link>
        <div className="navlinks-row">
          <Link className="chip" href="/library">
            书库
          </Link>
          <Link className="chip" href="/video">
            影片馆
          </Link>
        </div>
      </nav>

      <div className="cinema-content">
        <div className="cinema-eyebrow">Immersive Classical Chinese Poetry</div>
        <h1 className="cinema-title">诗境</h1>
        <p className="cinema-sub">
          {meta ? (
            <>
              <b>{meta.total.toLocaleString()}</b> 首古典诗词 ·{" "}
              {meta.dynasties.slice(0, 6).map((d) => d.name).join(" / ")} · 每一首都被拆成电影分镜，
              每一位诗人都有他走过的山河。
            </>
          ) : (
            "每一首诗都是一场可以步入的电影，每一位诗人都有他走过的山河。"
          )}
        </p>
        <div className="cinema-cta">
          <a className="cta primary" href="#map">
            ◈ 步入诗人地图
          </a>
          <Link className="cta" href="/library">
            ≡ 漫游书库
          </Link>
          <button className="cta" onClick={randomEntry} disabled={jumping}>
            {jumping ? "正在入梦…" : "❋ 任入一境"}
          </button>
        </div>
      </div>

      <div className="scroll-hint cinema-scroll">向下滚动 · 打开千年山河 ↓</div>
    </header>
  );
}
