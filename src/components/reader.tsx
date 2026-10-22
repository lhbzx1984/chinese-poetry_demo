"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ExperienceData, Poem } from "@/lib/types";
import { ambientMusic, moodByName, moodForPoem, ALL_MOOD_NAMES } from "@/lib/ambient-music";
import { generatePoemClip, synthesizeClipNarrations, waitForClipImages } from "@/lib/clip";
import {
  DEFAULT_SETTINGS, loadNarrationSettings, saveNarrationSettings, STYLE_PRESETS,
  type NarrationSettings,
} from "@/lib/narration-settings";
import { adminFetch } from "@/lib/admin-client";
import { DOUBAO_VOICES } from "@/lib/voices";
import { environmentById, matchSceneEnvironment, SCENE_ENVIRONMENTS, type SceneEnvironment, type SceneEnvironmentId } from "@/lib/scene-environments";

// 本地写实场景资源无需运行时 AI 密钥；诗句和手动选择共同决定画面。
function EnvironmentScene({ environment }: { environment: SceneEnvironment }) {
  return (
    <div className="environment-art" style={{ backgroundImage: `url("${environment.image}")` }} />
  );
}

export default function Reader({ poem }: { poem: Poem }) {
  const [exp, setExp] = useState<ExperienceData | null>(null);
  const [active, setActive] = useState(0);
  const [sceneOverrides, setSceneOverrides] = useState<Partial<Record<number, SceneEnvironmentId>>>({});
  const [showIllustrations, setShowIllustrations] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [settings, setSettings] = useState<NarrationSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [musicSolo, setMusicSolo] = useState(false);
  const [clipBusy, setClipBusy] = useState(false);
  const [clipStage, setClipStage] = useState<string | null>(null);
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const stopRef = useRef(false);
  const narrationRunRef = useRef(0);
  const previewRunRef = useRef(0);
  const speechDoneRef = useRef<(() => void) | null>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const soloRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsMemo = useRef(new Map<string, string>());
  const clipAbortRef = useRef<AbortController | null>(null);
  const clipContextRef = useRef<AudioContext | null>(null);

  // 朗读偏好本机记忆
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettings(loadNarrationSettings()));
    return () => cancelAnimationFrame(frame);
  }, []);
  const update = useCallback((patch: Partial<NarrationSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    saveNarrationSettings(next);
    if ('edgeVoice' in patch || 'voiceURI' in patch || 'pitch' in patch || 'rate' in patch) {
      previewRunRef.current++;
      narrationRunRef.current++;
      stopRef.current = true;
      speechDoneRef.current?.();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      audioRef.current?.pause();
      audioRef.current = null;
      ambientMusic.setDuck(false);
      if (!soloRef.current) ambientMusic.stop();
      setPreviewing(false);
      setSpeaking(false);
    }
  }, []);

  // 沉浸体验数据（配图/译文）轮询
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const r = await fetch(`/api/poems/${poem.id}/experience`);
        const d = await r.json();
        if (stop) return;
        if (r.ok) {
          setExp(d.data);
          if (!d.settled) timer = setTimeout(poll, 3000);
        } else {
          setNotice(d.error || "诗境载入失败，请刷新重试。");
          if (r.status === 429) timer = setTimeout(poll, Math.max(1, Number(r.headers.get("Retry-After")) || 60) * 1000);
        }
      } catch {
        if (!stop) setNotice("网络连接失败，请刷新后重试。");
      }
    }
    poll();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [poem.id]);

  // 滚动监听：视口中线穿过哪个场景，舞台就切到哪一幕
  useEffect(() => {
    if (!exp) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) setActive(idx);
          }
        }
      },
      { rootMargin: "-46% 0px -46% 0px", threshold: 0 }
    );
    for (const el of sectionRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [exp]);

  useEffect(() => {
    const narrationRun = narrationRunRef;
    const previewRun = previewRunRef;
    const urls = ttsMemo.current;
    const clipAbort = clipAbortRef;
    const clipContext = clipContextRef;
    return () => {
      stopRef.current = true;
      // 卸载时让仍在等待网络请求的朗读和试听失效。
      narrationRun.current++;
      previewRun.current++;
      speechDoneRef.current?.();
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      audioRef.current?.pause();
      ambientMusic.stop();
      clipAbort.current?.abort();
      void clipContext.current?.close().catch(() => {});
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  const flashNotice = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? null : n)), 6000);
  }, []);

  const musicMood = useCallback(() => {
    const custom = settingsRef.current.musicMood;
    if (custom) {
      const m = moodByName(custom);
      if (m) return m;
    }
    return moodForPoem(exp?.visualBible.palette.zh ?? "", exp?.visualBible.mood ?? "");
  }, [exp]);

  const stopAll = useCallback(() => {
    previewRunRef.current++;
    setPreviewing(false);
    stopRef.current = true;
    narrationRunRef.current++;
    speechDoneRef.current?.();
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    audioRef.current?.pause();
    audioRef.current = null;
    if (!soloRef.current) ambientMusic.stop();
    setSpeaking(false);
  }, []);

  // 在线配音按音色、音调、语速与文本记忆，反复朗读不重复合成。
  const synthUrl = useCallback(async (text: string, voice: string) => {
    const s = settingsRef.current;
    const pitch = Math.round((s.pitch - 1) * 60);
    const rate = s.rate;
    const key = `${voice}|${pitch}|${rate}|${text}`;
    const hit = ttsMemo.current.get(key);
    if (hit) return hit;
    const r = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, pitch, rate }),
      signal: AbortSignal.timeout(190_000),
    });
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      throw new Error(d.error ?? "语音服务不可用");
    }
    const url = URL.createObjectURL(await r.blob());
    ttsMemo.current.set(key, url);
    return url;
  }, []);

  const playOnline = useCallback(async (text: string, runId: number) => {
    const url = await synthUrl(text, settingsRef.current.edgeVoice);
    if (stopRef.current || narrationRunRef.current !== runId) return;
    const audio = new Audio(url); // 语速/音调已在服务端合成
    audioRef.current = audio;
    audio.onplay = () => ambientMusic.setDuck(true);
    await new Promise<void>((resolve, reject) => {
      const finish = () => {
        if (speechDoneRef.current === finish) speechDoneRef.current = null;
        resolve();
      };
      speechDoneRef.current = finish;
      audio.onended = finish;
      const fail = () => {
        if (speechDoneRef.current === finish) speechDoneRef.current = null;
        reject(new Error("朗读音频播放失败，请重新点击播放。"));
      };
      audio.onerror = fail;
      audio.play().catch(fail);
    });
    if (audioRef.current === audio) audioRef.current = null;
  }, [synthUrl]);

  const ensureMusic = useCallback(() => {
    const s = settingsRef.current;
    if (!s.music && !soloRef.current) return;
    ambientMusic.setVolume(s.musicVolume);
    void ambientMusic.start(musicMood());
  }, [musicMood]);

  // 完整朗读：逐幕滚动 + 逐幕发声
  const narrate = useCallback(async () => {
    if (clipAbortRef.current) return;
    if (!exp) return;
    if (speaking) {
      stopAll();
      return;
    }
    stopRef.current = false;
    const runId = ++narrationRunRef.current;
    setSpeaking(true);
    ensureMusic();
    // 先念诗名与作者，再进入诗句
    const announce = `《${poem.title}》，${poem.author}。`;
    try {
      await playOnline(announce, runId);
    } catch { /* 朗读开场白失败不阻塞正文 */ }
    if (stopRef.current || narrationRunRef.current !== runId) return;
    ambientMusic.setDuck(false);
    const scenes = exp.scenes;
    for (let i = 0; i < scenes.length; i++) {
      if (stopRef.current || narrationRunRef.current !== runId) break;
      const s = scenes[i];
      setActive(i);
      sectionRefs.current[i]?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
      const text = s.lines.join("\n");
      try {
        await playOnline(text, runId);
      } catch (e) {
        if (stopRef.current || narrationRunRef.current !== runId) return;
        stopAll();
        flashNotice(`豆包朗读失败：${e instanceof Error ? e.message : "网络异常"}。请重试，不会切换为本机声音。`);
        return;
      }
      if (stopRef.current || narrationRunRef.current !== runId) return;
      ambientMusic.setDuck(false);
      if (!stopRef.current && i < scenes.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
        if (stopRef.current || narrationRunRef.current !== runId) return;
        if (settingsRef.current.edgeVoice) synthUrl(scenes[i + 1].lines.join("\n"), settingsRef.current.edgeVoice).catch(() => void 0);
      }
    }
    if (stopRef.current || narrationRunRef.current !== runId) return;
    if (!soloRef.current) ambientMusic.stop();
    setSpeaking(false);
  }, [exp, speaking, stopAll, ensureMusic, playOnline, flashNotice, synthUrl, poem]);

  // 只听配乐：单独开关
  const toggleMusicSolo = useCallback(() => {
    if (musicSolo) {
      soloRef.current = false;
      setMusicSolo(false);
      ambientMusic.stop();
      return;
    }
    soloRef.current = true;
    setMusicSolo(true);
    ambientMusic.setVolume(settingsRef.current.musicVolume);
    void ambientMusic.start(musicMood());
  }, [musicSolo, musicMood]);

  // 试听当前设置
  const preview = useCallback(async () => {
    if (clipAbortRef.current) return;
    if (previewing) {
      previewRunRef.current++;
      speechDoneRef.current?.();
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      audioRef.current?.pause();
      audioRef.current = null;
      if (!soloRef.current) ambientMusic.stop();
      setPreviewing(false);
      return;
    }
    stopAll();
    const runId = ++previewRunRef.current;
    setPreviewing(true);
    ensureMusic();
    const text = "明月几时有，把酒问青天。";
    const finish = () => {
      setTimeout(() => {
        if (previewRunRef.current !== runId) return;
        if (!soloRef.current) ambientMusic.stop();
        setPreviewing(false);
      }, 900);
    };
    if (settingsRef.current.edgeVoice) {
      try {
        const url = await synthUrl(text, settingsRef.current.edgeVoice);
        if (previewRunRef.current !== runId) return;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => ambientMusic.setDuck(true);
        audio.onended = finish;
        audio.onerror = () => { flashNotice("试听音频播放失败，请重新点击试听。"); finish(); };
        await audio.play();
        return;
      } catch (e) {
        if (previewRunRef.current !== runId) return;
        flashNotice(`所选音色试听失败：${e instanceof Error ? e.message : "网络异常"}。请重试或选择其他音色。`);
        finish();
        return;
      }
    }
    finish();
  }, [previewing, ensureMusic, synthUrl, flashNotice, stopAll]);

  // 生成短片：在线诗词朗诵 + 意境配乐 + 分镜画面，沿用浏览器 WebM 合成流程。
  const makeClip = useCallback(async () => {
    if (!exp || clipBusy || clipAbortRef.current) return;
    if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
      flashNotice("当前浏览器不支持视频录制，请使用 Chrome / Edge。");
      return;
    }
    setClipBusy(true);
    const controller = new AbortController();
    clipAbortRef.current = controller;
    let recordingContext: AudioContext | null = null;
    try {
      stopAll();
      previewRunRef.current++;
      setPreviewing(false);
      recordingContext = new AudioContext();
      clipContextRef.current = recordingContext;
      await recordingContext.resume();
      controller.signal.throwIfAborted();
      const poemContext = poem.lines.join(" ");
      const images = exp.scenes.map((scene) => {
        const generated = exp.images[scene.index];
        if (showIllustrations && generated?.status === "ready" && generated.url) return generated.url;
        const selected = sceneOverrides[scene.index];
        return selected
          ? environmentById(selected).image
          : matchSceneEnvironment(scene.text, poem.title, poem.tags, poemContext).image;
      });

      // 2) 启动意境配乐，随后接入与诗词朗诵共用的混音总线
      const s = settingsRef.current;
      let musicStream: MediaStream | null = null;
      if (s.music) {
        ambientMusic.setVolume(Math.min(0.6, s.musicVolume + 0.1));
        await ambientMusic.start(musicMood(), false);
        controller.signal.throwIfAborted();
        musicStream = ambientMusic.getCaptureStream();
      }

      // 配音请求与全部画面加载同时进行，准备完成再同步录制。
      const { blob, total } = await generatePoemClip({
        exp,
        musicStream,
        narrations: synthesizeClipNarrations(exp.scenes, settingsRef.current, controller.signal, setClipStage),
        images: showIllustrations && exp.mode === 'ai'
          ? waitForClipImages(exp, controller.signal, setClipStage)
          : images,
        audioContext: recordingContext,
        signal: controller.signal,
        onRecording: () => setClipStage("正在同步录制画面与配音，完成后播放…"),
      });
      ambientMusic.stop();
      controller.signal.throwIfAborted();

      // 4) 保存到影片馆并跳转
      setClipStage("保存到影片馆…");
      const qs = new URLSearchParams({ title: exp.poem.title, author: exp.poem.author, duration: total.toFixed(1) });
      const up = await adminFetch(`/api/videos?${qs}`, { method: "POST", headers: { "Content-Type": "video/webm" }, body: blob, signal: controller.signal });
      if (!up.ok) throw new Error((await up.json().catch(() => ({}))).error ?? "保存失败");
      controller.signal.throwIfAborted();
      const saved = (await up.json()).data;
      router.push(`/video?play=${encodeURIComponent(saved.id)}`);
    } catch (e) {
      if (!controller.signal.aborted) {
        controller.abort();
        ambientMusic.stop();
        flashNotice(e instanceof Error ? e.message : "短片生成失败。");
      }
    } finally {
      if (recordingContext && recordingContext.state !== "closed") await recordingContext.close().catch(() => {});
      if (clipAbortRef.current === controller) {
        clipAbortRef.current = null;
        clipContextRef.current = null;
      }
      if (clipAbortRef.current === null) {
        setClipBusy(false);
        setClipStage(null);
      }
    }
  }, [exp, clipBusy, musicMood, flashNotice, router, poem, sceneOverrides, showIllustrations, stopAll]);

  const scenes = exp?.scenes ?? [];
  const poemContext = poem.lines.join(" ");
  const automaticEnvironments = scenes.map((scene) => matchSceneEnvironment(scene.text, poem.title, poem.tags, poemContext));
  const sceneEnvironments = scenes.map((scene, index) => {
    const selected = sceneOverrides[scene.index];
    return selected ? environmentById(selected) : automaticEnvironments[index];
  });
  const selectEnvironment = (index: number, value: string) => {
    setSceneOverrides((previous) => {
      const next = { ...previous };
      if (value === "auto") delete next[index];
      else next[index] = value as SceneEnvironmentId;
      return next;
    });
    setShowIllustrations(false);
  };
  const moodName = exp ? moodForPoem(exp.visualBible.palette.zh, exp.visualBible.mood).name : "";

  return (
    <div className="reader-root">
      {/* 固定画面舞台 */}
      <div className="stage" aria-hidden>
        {scenes.map((s) => (
          <div key={s.index} className={`stage-layer${active === s.index ? " active" : ""}`}>
            <EnvironmentScene environment={sceneEnvironments[s.index]} />
            {showIllustrations && exp?.images[s.index]?.status === "ready" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={`stage-img ${s.index % 2 === 0 ? "kb-a" : "kb-b"}`}
                src={exp.images[s.index].url ?? ""}
                alt={`《${poem.title}》分镜 ${s.index + 1}`}
              />
            )}
          </div>
        ))}
        <div className="scrim" />
      </div>

      <nav className="reader-top">
        <Link className="ghost-btn" href="/">
          ← 返回首页
        </Link>
        <span className="reader-title">
          {poem.title} · {poem.dynasty} · {poem.author}
        </span>
        <span className="reader-actions">
          {exp && exp.scenes.length > 0 && (
            <button className="ghost-btn" onClick={() => void makeClip()} disabled={clipBusy} title="用当前画面、诗词朗诵与配乐合成短片">
              {clipBusy ? clipStage ?? "● 合成中…" : "🎬 生成短片"}
            </button>
          )}
          <button className={`ghost-btn${showSettings ? " speaking" : ""}`} disabled={clipBusy} onClick={() => setShowSettings((v) => !v)}>
            ♪ 朗读设置
          </button>
          <button className={`ghost-btn${speaking ? " speaking" : ""}`} disabled={clipBusy} onClick={() => void narrate()}>
            {speaking ? "■ 停止朗读" : "▶ 聆听全诗"}
          </button>
        </span>
      </nav>

      {showSettings && (
        <div className="settings-pop">
          <div className="set-title">朗读设置</div>
          <div className="set-row">
            <label>朗读音色</label>
            <select aria-label="朗读音色" value={settings.edgeVoice} onChange={(e) => update({ edgeVoice: e.target.value })}>
              <optgroup label="豆包大模型配音">
                {DOUBAO_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}（{v.gender}声 · {v.style}）</option>)}
              </optgroup>
            </select>
          </div>
          <p className="set-note" style={{ marginTop: -6 }}>
            全诗朗读、试听和短片统一使用豆包，支持男女音色、语速与音调；服务异常时会提示重试。
          </p>

          <div className="set-row">
            <label>风格</label>
            <span className="preset-chips">
              {STYLE_PRESETS.map((p) => (
                <button
                  key={p.name}
                  className={`chip small${settings.rate === p.rate && settings.pitch === p.pitch ? " active" : ""}`}
                  onClick={() => update({ rate: p.rate, pitch: p.pitch })}
                >
                  {p.name}
                </button>
              ))}
            </span>
          </div>
          <div className="set-row">
            <label>语速 {settings.rate.toFixed(2)}×</label>
            <input
              type="range" min={0.6} max={1.2} step={0.05}
              aria-label="语速" value={settings.rate}
              onChange={(e) => update({ rate: Number(e.target.value) })}
            />
          </div>
          <div className="set-row">
            <label>音调 {settings.pitch.toFixed(2)}</label>
            <input
              type="range" min={0.7} max={1.3} step={0.05}
              aria-label="音调" value={settings.pitch}
              onChange={(e) => update({ pitch: Number(e.target.value) })}
            />
          </div>
          <div className="set-divider" />
          <div className="set-row">
            <label>意境配乐</label>
            <button
              className={`chip small${settings.music ? " active" : ""}`}
              onClick={() => update({ music: !settings.music })}
              title={settings.music ? "正在随朗读播放，点击关闭" : "已关闭，点击开启"}
            >
              {settings.music ? "♪ 配乐：开" : "✕ 配乐：关"}
            </button>
            <button className={`chip small${musicSolo ? " active" : ""}`} onClick={toggleMusicSolo}>
              {musicSolo ? "■ 停止配乐" : "▶ 只听配乐"}
            </button>
            <span className="mood-hint">{exp ? `当前意境 · ${moodName}` : "进入诗境后自动匹配"}</span>
          </div>
          <div className="set-row">
            <label>配乐意境</label>
            <select aria-label="配乐意境" value={settings.musicMood} onChange={(e) => update({ musicMood: e.target.value })}>
              <option value="">自动 · 随诗匹配</option>
              {ALL_MOOD_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="set-row">
            <label>乐声 {Math.round(settings.musicVolume * 100)}%</label>
            <input
              type="range" min={0} max={1} step={0.05}
              aria-label="乐声音量" value={settings.musicVolume}
              onChange={(e) => {
                update({ musicVolume: Number(e.target.value) });
                ambientMusic.setVolume(Number(e.target.value));
              }}
            />
          </div>
          <div className="set-row">
            <button className="chip small" onClick={() => void preview()}>
              {previewing ? "■ 停止试听" : "▶ 试听当前效果"}
            </button>
          </div>
          <p className="set-note">
            背景音乐为实时生成的古琴风环境音，随诗的情绪自动变化；朗读时只会温和压低，不会盖住人声。
            在线音色的语速与音调在合成时生效，结果会缓存，重复朗读不重复合成。
          </p>
          <button className="pop-close" onClick={() => setShowSettings(false)} aria-label="关闭">
            ×
          </button>
        </div>
      )}

      {scenes.length > 1 && (
        <div className="dots" aria-label="场景导航">
          {scenes.map((s) => (
            <button
              key={s.index}
              className={`dot${active === s.index ? " active" : ""}`}
              aria-label={`跳转至第 ${s.index + 1} 幕`}
              onClick={() => sectionRefs.current[s.index]?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}
            />
          ))}
        </div>
      )}

      {exp && exp.mode === "ai" && exp.aiProgress.done < exp.aiProgress.total && exp.images.some(i => i.status === 'pending') && (
        <div className="ai-note">
          分镜画面绘制中 {exp.aiProgress.done}/{exp.aiProgress.total} · 完成后自动淡入
        </div>
      )}
      {exp && exp.mode === "ai" && exp.aiProgress.done >= exp.aiProgress.total && (
        <div className="ai-note">
          {exp.imagesCached ? "配图取自本地图库 · 未消耗生成额度" : `分镜配图 ${exp.aiProgress.done}/${exp.aiProgress.total} · 已保存到本地图库`}
        </div>
      )}
      {clipBusy && <div className="ai-note">{clipStage ?? "短片合成中"} · 完成后自动前往影片馆</div>}
      {exp && exp.mode === "fallback" && <div className="ai-note">未配置 AI 配图 · 展示写实风格诗境画面</div>}
      {exp && exp.mode === 'ai' && exp.aiProgress.done < exp.aiProgress.total && !exp.images.some(i => i.status === 'pending') && <div className="ai-note">部分配图未能生成 · 展示写实风格诗境画面</div>}
      {notice && <div className="ai-note warn" role="alert">{notice}</div>}

      <div className="scene-wrap">
        <section className="title-block">
          <div className="eyebrow">Immersive Poetry · 沉浸诗境</div>
          {poem.subtitle && (
            <p style={{ margin: "0 0 10px", color: "var(--gold)", letterSpacing: "0.3em", fontSize: 15 }}>
              【{poem.subtitle}】
            </p>
          )}
          <h1>{poem.title}</h1>
          {!exp && notice && <div className="scene-lines">{poem.lines.map((line, i) => <p key={i}>{line}</p>)}</div>}
          <p className="ai-disclaimer">场景依据诗句意象匹配；AI 译文与配图仅供欣赏参考。</p>
          <p className="meta">
            {poem.dynasty} · {poem.author}
          </p>
          {exp && (
            <div className="bible">
              <span className="bible-chip">{exp.visualBible.era}</span>
              <span className="bible-chip">{exp.visualBible.mood}</span>
              <span className="bible-chip">色调 · {exp.visualBible.palette.zh}</span>
              {exp.visualBible.imagerySummary && <span className="bible-chip">意象 · {exp.visualBible.imagerySummary}</span>}
            </div>
          )}
          {scenes.length > 0 && (
            <div className="journey-preview">
              <div className="journey-heading">
                <span>这一首的诗境路线</span>
                <small>{scenes.length} 幕 · 点击进入</small>
              </div>
              <div className="journey-list">
                {scenes.map((scene) => (
                  <button
                    key={scene.index}
                    className="journey-stop"
                    style={{ backgroundImage: `linear-gradient(180deg, rgba(4, 12, 15, 0.42), rgba(4, 12, 15, 0.9)), url("${sceneEnvironments[scene.index].image}")` }}
                    onClick={() => sectionRefs.current[scene.index]?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}
                    aria-label={`进入第 ${scene.index + 1} 幕：${sceneEnvironments[scene.index].name}`}
                  >
                    <span>{String(scene.index + 1).padStart(2, "0")}</span>
                    <strong>{sceneEnvironments[scene.index].name}</strong>
                    <small>{scene.lines[0]}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="scroll-hint">向下滚动 · 步入诗境 ↓</div>
        </section>

        {scenes.map((s) => (
          <section
            className="scene-section"
            key={s.index}
            data-index={s.index}
            ref={(el) => {
              sectionRefs.current[s.index] = el;
            }}
          >
            <div className={`scene-card${active === s.index ? " visible" : ""}`}>
              <div className="scene-no">
                <span className="num">{["壹", "贰", "叁", "肆", "伍", "陆"][s.index] ?? s.index + 1}</span>
                <span className="cap">
                  幕 {s.index + 1} / {scenes.length}
                </span>
                <span className="scene-setting-name">{sceneEnvironments[s.index].name}</span>
              </div>
              <div className="scene-lines">
                {s.lines.map((line, li) => (
                  <span className="line" key={li}>
                    {line}
                  </span>
                ))}
              </div>
              <div className="scene-environment-info">
                <span className="scene-environment-kicker">此幕画面 · {sceneOverrides[s.index] ? "手动选择" : "诗句匹配"}</span>
                <strong>{sceneEnvironments[s.index].atmosphere}</strong>
                <p>{sceneEnvironments[s.index].description}</p>
              </div>
              <div className="scene-environment-controls">
                <label htmlFor={`scene-environment-${s.index}`}>切换环境</label>
                <select
                  id={`scene-environment-${s.index}`}
                  value={sceneOverrides[s.index] ?? "auto"}
                  onChange={(event) => selectEnvironment(s.index, event.target.value)}
                >
                  <option value="auto">自动匹配 · {automaticEnvironments[s.index].name}</option>
                  {SCENE_ENVIRONMENTS.map((environment) => (
                    <option key={environment.id} value={environment.id}>{environment.name}</option>
                  ))}
                </select>
                {exp?.images[s.index]?.status === "ready" && (
                  <div className="scene-visual-toggle" role="group" aria-label={`第 ${s.index + 1} 幕画面来源`}>
                    <button className={!showIllustrations ? "selected" : ""} aria-pressed={!showIllustrations} onClick={() => setShowIllustrations(false)}>意境画面</button>
                    <button className={showIllustrations ? "selected" : ""} aria-pressed={showIllustrations} onClick={() => setShowIllustrations(true)}>AI 配图</button>
                  </div>
                )}
              </div>
              {exp?.images[s.index]?.status === "ready" && <p className="scene-export-note">短片会使用当前选中的画面；没有专属配图时使用匹配场景。</p>}
              {s.imagery.length > 0 && (
                <div className="scene-imagery">
                  {s.imagery.map((img) => (
                    <span key={img.zh}>意象 · {img.zh}</span>
                  ))}
                </div>
              )}
              <div className="scene-trans">
                {s.translation || s.note ? <>
                  <div className="label">{s.translation ? "白话意译" : "诗句注释"}</div>
                  {s.translation && <p>{s.translation}</p>}
                  {s.note && <p className="jian">注释 · {s.note}</p>}
                </> : <>
                  <div className="label">译文与注释</div>
                  <p role="status">{exp?.analysisStatus === "pending" ? "正在整理本句译注，请稍候…" : exp?.analysisStatus === "unconfigured" ? "本站尚未启用译注服务，暂时无法提供本句解释。" : exp?.analysisStatus === "failed" ? "译注暂时载入失败，请稍后刷新重试。" : "本句暂无可靠译注。"}</p>
                </>}
              </div>
            </div>
          </section>
        ))}

        <section className="finale">
          <a href="https://github.com/chinese-poetry/chinese-poetry">诗词数据：chinese-poetry（MIT）</a>
          <div className="end-mark">全诗终</div>
          <p>
            《{poem.title}》 · {poem.dynasty} · {poem.author}
            <br />
            愿这一幕幕诗境，陪你走过一段静时光。
          </p>
          <Link className="ghost-btn" href="/library">
            去书库 · 再选一首 →
          </Link>
        </section>
      </div>
    </div>
  );
}
