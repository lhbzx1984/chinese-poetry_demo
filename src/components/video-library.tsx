"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type VideoMeta = {
  id: string;
  title: string;
  author: string;
  duration: number;
  bytes: number;
  createdAt: string;
};

function fmtDur(sec: number) {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function fmtSize(bytes: number) {
  return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export default function VideoLibrary() {
  const [videos, setVideos] = useState<VideoMeta[] | null>(null);
  const [active, setActive] = useState<VideoMeta | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/videos");
      if (r.ok) setVideos((await r.json()).data);
      else setVideos([]);
    } catch {
      setVideos([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    await fetch(`/api/videos/${id}`, { method: "DELETE" });
    setConfirmId(null);
    if (active?.id === id) setActive(null);
    void load();
  }

  return (
    <main>
      <header className="topbar">
        <Link href="/" className="brand">
          诗境
          <small>影片馆 · FILM GALLERY</small>
        </Link>
        <div className="navlinks-row">
          <Link className="chip" href="/library">
            书库
          </Link>
          <Link className="chip" href="/">
            首页
          </Link>
        </div>
      </header>

      <section className="video-hero">
        <h1>影片馆</h1>
        <p>
          沉浸页里分镜图就绪后点「🎬 生成短片」，诗词朗读、意境配乐与画面合成的短片会保存在这里，随时回看与下载。
        </p>
      </section>

      <section className="video-list">
        {videos === null ? (
          <div className="status-line">影片载入中…</div>
        ) : videos.length === 0 ? (
          <div className="status-line">
            还没有影片。
            <br />
            <small>
              去 <Link href="/">首页</Link> 选一首诗进入沉浸页，分镜画面就绪后点「🎬 生成短片」即可创作第一部。
            </small>
          </div>
        ) : (
          <>
            {active ? (
              <div className="player-card">
                <video key={active.id} controls autoPlay preload="auto" src={`/api/videos/${active.id}`} />
                <div className="player-meta">
                  <div>
                    <span className="p-title">《{active.title}》</span>
                    <span className="p-author">
                      {active.author} · {fmtDur(active.duration)} · {fmtSize(active.bytes)}
                    </span>
                  </div>
                  <div className="player-actions">
                    <a className="page-btn" href={`/api/videos/${active.id}`} download={`诗境·${active.title}·${active.author}.webm`}>
                      ⬇ 下载影片
                    </a>
                    <button
                      className="page-btn danger"
                      onClick={() => (confirmId === active.id ? void remove(active.id) : setConfirmId(active.id))}
                    >
                      {confirmId === active.id ? "再点一次确认删除" : "删除"}
                    </button>
                    <button className="page-btn" onClick={() => setActive(null)}>
                      收起
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="video-grid">
              {videos.map((v) => (
                <button
                  key={v.id}
                  className={`video-card${active?.id === v.id ? " active" : ""}`}
                  onClick={() => setActive(v)}
                >
                  <span className="vc-title">《{v.title}》</span>
                  <span className="vc-author">
                    {v.author} · {fmtDur(v.duration)} · {fmtSize(v.bytes)}
                  </span>
                  <span className="vc-date">{new Date(v.createdAt).toLocaleString("zh-CN", { hour12: false })}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
