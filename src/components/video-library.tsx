"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin-client";

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
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoMeta[] | null>(null);
  const [active, setActive] = useState<VideoMeta | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/videos");
      if (r.ok) setVideos((await r.json()).data);
      else throw new Error((await r.json()).error || "影片载入失败。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "影片载入失败。");
      setVideos([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function remove(id: string) {
    try {
      const r = await adminFetch(`/api/videos/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error || "删除失败。");
      setError(null);
      setConfirmId(null);
      if (active?.id === id) setActive(null);
      void load();
    } catch (e) { setError(e instanceof Error ? e.message : "删除失败。"); }
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
          在沉浸页点「🎬 生成短片」，当前逐幕画面、诗词朗读与意境配乐会合成短片，保存在这里供回看与下载。
        </p>
      </section>

      <section className="video-list">
        {error && <p role="alert">{error}</p>}
        {videos === null ? (
          <div className="status-line">影片载入中…</div>
        ) : videos.length === 0 ? (
          <div className="status-line">
            还没有影片。
            <br />
            <small>
              去 <Link href="/">首页</Link> 选一首诗进入沉浸页，点「🎬 生成短片」即可创作第一部。
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
