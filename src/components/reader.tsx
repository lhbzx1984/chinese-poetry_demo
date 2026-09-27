"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ExperienceData, Poem } from "@/lib/types";
import { ambientMusic, moodByName, moodForPoem, ALL_MOOD_NAMES } from "@/lib/ambient-music";
import { generatePoemClip } from "@/lib/clip";
import {
  DEFAULT_SETTINGS, loadNarrationSettings, saveNarrationSettings, STYLE_PRESETS, useVoices,
  type NarrationSettings,
} from "@/lib/narration-settings";
import { EDGE_VOICES } from "@/lib/voices";

// 程序化水墨背景：AI 配图不可用或尚未生成时的兜底画面。
function ProceduralScene({ palette, index }: { palette: [string, string, string]; index: number }) {
  const [dark, mid, light] = palette;
  const flip = index % 2 === 1;
  const moonX = flip ? "72%" : "24%";
  const moonY = flip ? "20%" : "16%";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `
          radial-gradient(circle at ${moonX} ${moonY}, ${light}66 0%, ${light}22 7%, transparent 16%),
          radial-gradient(ellipse 80% 55% at ${flip ? "20%" : "78%"} 108%, ${dark} 0%, transparent 60%),
          linear-gradient(165deg, ${dark} 0%, ${mid} 68%, ${light}33 100%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          bottom: "-4%",
          left: flip ? "-10%" : "30%",
          width: "75%",
          height: "34%",
          opacity: 0.75,
          background: dark,
          clipPath:
            "polygon(0 100%, 0 62%, 12% 38%, 24% 60%, 37% 12%, 49% 55%, 63% 26%, 76% 62%, 89% 18%, 100% 66%, 100% 100%)",
          filter: "blur(1px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-2%",
          left: flip ? "40%" : "-6%",
          width: "70%",
          height: "22%",
          opacity: 0.4,
          background: mid,
          clipPath: "polygon(0 100%, 0 55%, 18% 30%, 31% 58%, 45% 10%, 58% 50%, 74% 22%, 88% 56%, 100% 40%, 100% 100%)",
          filter: "blur(2px)",
        }}
      />
    </div>
  );
}

export default function Reader({ poem }: { poem: Poem }) {
  const [exp, setExp] = useState<ExperienceData | null>(null);
  const [active, setActive] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [settings, setSettings] = useState<NarrationSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [musicSolo, setMusicSolo] = useState(false);
  const [clipBusy, setClipBusy] = useState(false);
  const [clipStage, setClipStage] = useState<string | null>(null);
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const voices = useVoices();
  const stopRef = useRef(false);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const soloRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsMemo = useRef(new Map<string, string>());

  // 朗读偏好本机记忆
  useEffect(() => setSettings(loadNarrationSettings()), []);
  const update = useCallback((patch: Partial<NarrationSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveNarrationSettings(next);
      return next;
    });
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
        }
      } catch {
        if (!stop) timer = setTimeout(poll, 5000);
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
  }, [exp?.scenes.length]);

  useEffect(() => {
    return () => {
      stopRef.current = true;
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      audioRef.current?.pause();
      ambientMusic.stop();
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
    stopRef.current = true;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    audioRef.current?.pause();
    audioRef.current = null;
    if (!soloRef.current) ambientMusic.stop();
    setSpeaking(false);
  }, []);

  // —— Edge 神经语音合成（结果按 音色+音调+语速+文本 记忆，反复朗读不重复合成）——
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
    });
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      throw new Error(d.error ?? "语音服务不可用");
    }
    const url = URL.createObjectURL(await r.blob());
    ttsMemo.current.set(key, url);
    return url;
  }, []);

  const playEdge = useCallback(async (text: string) => {
    const url = await synthUrl(text, settingsRef.current.edgeVoice);
    const audio = new Audio(url); // 语速/音调已在服务端合成
    audioRef.current = audio;
    audio.onplay = () => ambientMusic.setDuck(true);
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
    audioRef.current = null;
  }, [synthUrl]);

  const speakBrowser = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      const s = settingsRef.current;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-CN";
      u.rate = s.rate;
      u.pitch = s.pitch;
      const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === s.voiceURI);
      if (voice) u.voice = voice;
      u.onstart = () => ambientMusic.setDuck(true);
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    });
  }, []);

  const ensureMusic = useCallback(() => {
    const s = settingsRef.current;
    if (!s.music && !soloRef.current) return;
    ambientMusic.setVolume(s.musicVolume);
    void ambientMusic.start(musicMood());
  }, [musicMood]);

  // 完整朗读：逐幕滚动 + 逐幕发声
  const narrate = useCallback(async () => {
    if (!exp) return;
    if (speaking) {
      stopAll();
      return;
    }
    stopRef.current = false;
    setSpeaking(true);
    ensureMusic();
    // 先念诗名与作者，再进入诗句
    const announce = `《${poem.title}》，${poem.author}。`;
    try {
      if (settingsRef.current.edgeVoice) await playEdge(announce);
      else await speakBrowser(announce);
    } catch { /* 朗读开场白失败不阻塞正文 */ }
    ambientMusic.setDuck(false);
    const scenes = exp.scenes;
    for (let i = 0; i < scenes.length; i++) {
      if (stopRef.current) break;
      const s = scenes[i];
      setActive(i);
      sectionRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
      const text = s.lines.join("。");
      const useEdge = Boolean(settingsRef.current.edgeVoice);
      try {
        if (useEdge) await playEdge(text);
        else await speakBrowser(text);
      } catch (e) {
        if (useEdge) {
          flashNotice(`Edge 音色暂不可用（${e instanceof Error ? e.message : "网络异常"}），本幕改用浏览器语音。`);
          await speakBrowser(text);
        }
      }
      ambientMusic.setDuck(false);
      if (!stopRef.current && i < scenes.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
        if (settingsRef.current.edgeVoice) synthUrl(scenes[i + 1].lines.join("。"), settingsRef.current.edgeVoice).catch(() => void 0);
      }
    }
    if (!soloRef.current) ambientMusic.stop();
    setSpeaking(false);
  }, [exp, speaking, stopAll, ensureMusic, speakBrowser, playEdge, flashNotice, synthUrl, poem]);

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
    if (previewing) {
      speechSynthesis.cancel();
      audioRef.current?.pause();
      audioRef.current = null;
      if (!soloRef.current) ambientMusic.stop();
      setPreviewing(false);
      return;
    }
    setPreviewing(true);
    ensureMusic();
    const text = "明月几时有，把酒问青天。";
    const finish = () => {
      setTimeout(() => {
        if (!soloRef.current) ambientMusic.stop();
        setPreviewing(false);
      }, 900);
    };
    if (settingsRef.current.edgeVoice) {
      try {
        const url = await synthUrl(text, settingsRef.current.edgeVoice);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => ambientMusic.setDuck(true);
        audio.onended = finish;
        audio.onerror = finish;
        await audio.play();
        return;
      } catch (e) {
        flashNotice(`Edge 音色暂不可用（${e instanceof Error ? e.message : "网络异常"}），试听改用浏览器语音。`);
      }
    }
    await speakBrowser(text);
    finish();
  }, [previewing, ensureMusic, synthUrl, speakBrowser, flashNotice]);

  // 生成短片（用户点击触发）：旁白（Edge 音色）+ 意境配乐 + 分镜画面 合成 WebM，保存到影片馆
  const makeClip = useCallback(async () => {
    if (!exp || clipBusy) return;
    if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
      flashNotice("当前浏览器不支持视频录制，请使用 Chrome / Edge。");
      return;
    }
    if (!exp.images.every((i) => i.status === "ready")) {
      flashNotice("分镜画面尚未全部生成，请稍候。");
      return;
    }
    setClipBusy(true);
    try {
      // 1) 逐幕合成旁白（未选音色时默认「晓晓」温柔女声）
      const voice = settingsRef.current.edgeVoice || "zh-CN-XiaoxiaoNeural";
      const pitch = Math.round((settingsRef.current.pitch - 1) * 60);
      const rate = settingsRef.current.rate;
      const narrations: { sceneIndex: number; mp3: ArrayBuffer }[] = [];
      let ttsOk = true;
      // 片头旁白：诗名与作者
      setClipStage("合成片头旁白…");
      try {
        const r = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `《${exp.poem.title}》，${exp.poem.author}。`, voice, pitch, rate }),
        });
        if (!r.ok) throw new Error(await r.text().catch(() => ""));
        narrations.push({ sceneIndex: -1, mp3: await r.arrayBuffer() });
      } catch {
        ttsOk = false;
      }
      for (let i = 0; i < exp.scenes.length; i++) {
        setClipStage(`合成旁白 ${i + 1}/${exp.scenes.length}…`);
        try {
          const r = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: exp.scenes[i].lines.join("。"), voice, pitch, rate }),
          });
          if (!r.ok) throw new Error(await r.text().catch(() => ""));
          narrations.push({ sceneIndex: i, mp3: await r.arrayBuffer() });
        } catch {
          ttsOk = false; // 单幕失败：该幕静音，继续生成
        }
      }
      if (!ttsOk) flashNotice("部分旁白合成失败，短片中对应幕将只有配乐。");

      // 2) 启动意境配乐（其实时流将作为一条音轨混入）
      const s = settingsRef.current;
      let musicStream: MediaStream | null = null;
      if (s.music) {
        ambientMusic.setVolume(Math.min(0.6, s.musicVolume + 0.1));
        await ambientMusic.start(musicMood());
        musicStream = ambientMusic.getCaptureStream();
      }

      // 3) 录制合成（旁白走独立录制总线，成片必有音轨）
      setClipStage("录制画面与混音…");
      const { blob, total } = await generatePoemClip({
        exp,
        musicStream,
        narrations,
        images: [],
      });
      ambientMusic.stop();

      // 4) 保存到影片馆并跳转
      setClipStage("保存到影片馆…");
      const qs = new URLSearchParams({ title: exp.poem.title, author: exp.poem.author, duration: total.toFixed(1) });
      const up = await fetch(`/api/videos?${qs}`, { method: "POST", headers: { "Content-Type": "video/webm" }, body: blob });
      if (!up.ok) throw new Error((await up.json().catch(() => ({}))).error ?? "保存失败");
      router.push("/video");
    } catch (e) {
      ambientMusic.stop();
      flashNotice(e instanceof Error ? e.message : "短片生成失败。");
    } finally {
      setClipBusy(false);
      setClipStage(null);
    }
  }, [exp, clipBusy, musicMood, flashNotice, router]);

  const palette = exp?.visualBible.palette.css ?? ["#0a1a24", "#28505c", "#cfd8e3"];
  const scenes = exp?.scenes ?? [];
  const moodName = exp ? moodForPoem(exp.visualBible.palette.zh, exp.visualBible.mood).name : "";

  return (
    <div className="reader-root">
      {/* 固定画面舞台 */}
      <div className="stage" aria-hidden>
        {scenes.map((s) => (
          <div key={s.index} className={`stage-layer${active === s.index ? " active" : ""}`}>
            <ProceduralScene palette={palette} index={s.index} />
            {exp?.images[s.index]?.status === "ready" && (
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
          {exp && exp.mode === "ai" && exp.images.length > 0 && exp.images.every((i) => i.status === "ready") && (
            <button className="ghost-btn" onClick={() => void makeClip()} disabled={clipBusy} title="用已生成的分镜画面合成 15 秒短片">
              {clipBusy ? clipStage ?? "● 合成中…" : "🎬 生成短片"}
            </button>
          )}
          <button className={`ghost-btn${showSettings ? " speaking" : ""}`} onClick={() => setShowSettings((v) => !v)}>
            ♪ 朗读设置
          </button>
          <button className={`ghost-btn${speaking ? " speaking" : ""}`} onClick={() => void narrate()}>
            {speaking ? "■ 停止朗读" : "▶ 聆听全诗"}
          </button>
        </span>
      </nav>

      {showSettings && (
        <div className="settings-pop">
          <div className="set-title">朗读设置</div>
          <div className="set-row">
            <label>朗读音色</label>
            <select value={settings.edgeVoice} onChange={(e) => update({ edgeVoice: e.target.value })}>
              <optgroup label="Edge 在线神经语音（自然流畅 · 需联网）">
                {EDGE_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}（{v.gender}声 · {v.style}）
                  </option>
                ))}
              </optgroup>
              <optgroup label="本机">
                <option value="">浏览器语音（系统自带 · 离线兜底）</option>
              </optgroup>
            </select>
          </div>
          <p className="set-note" style={{ marginTop: -6 }}>
            Edge 神经语音免费无需配置，男女音色随意切换，语速与音调即时生效；网络异常时自动回退浏览器语音。
          </p>

          {!settings.edgeVoice && (
            <>
              <div className="set-row">
                <label>系统声音</label>
                <select value={settings.voiceURI} onChange={(e) => update({ voiceURI: e.target.value })}>
                  <option value="">系统默认{voices.length ? `（共 ${voices.length} 个中文语音）` : ""}</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}（{v.lang}{v.localService ? " · 本机" : " · 在线"}）
                    </option>
                  ))}
                </select>
              </div>
              <p className="set-note" style={{ marginTop: -6 }}>
                可选声音来自本机与浏览器内置语音：Windows 设置 → 时间和语言 → 语音 中安装的中文语音包越多，可选项越多；
                用 Edge 浏览器打开还能使用「晓晓」等自然在线语音。
              </p>
            </>
          )}
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
              value={settings.rate}
              onChange={(e) => update({ rate: Number(e.target.value) })}
            />
          </div>
          <div className="set-row">
            <label>音调 {settings.pitch.toFixed(2)}</label>
            <input
              type="range" min={0.8} max={1.15} step={0.05}
              value={settings.pitch}
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
            <select value={settings.musicMood} onChange={(e) => update({ musicMood: e.target.value })}>
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
              value={settings.musicVolume}
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
            Edge 音色的语速/音调在合成时生效，结果会缓存，重复朗读不重复合成。
          </p>
          <button className="pop-close" onClick={() => setShowSettings(false)} aria-label="关闭">
            ×
          </button>
        </div>
      )}

      {scenes.length > 1 && (
        <div className="dots" aria-hidden>
          {scenes.map((s) => (
            <button
              key={s.index}
              className={`dot${active === s.index ? " active" : ""}`}
              title={`第 ${s.index + 1} 幕`}
              onClick={() => sectionRefs.current[s.index]?.scrollIntoView({ behavior: "smooth" })}
            />
          ))}
        </div>
      )}

      {exp && exp.mode === "ai" && exp.aiProgress.done < exp.aiProgress.total && (
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
      {exp && exp.mode === "fallback" && <div className="ai-note">未配置 AI 配图 · 展示程序化水墨意境</div>}
      {notice && <div className="ai-note warn">{notice}</div>}

      <div className="scene-wrap">
        <section className="title-block">
          <div className="eyebrow">Immersive Poetry · 沉浸诗境</div>
          {poem.subtitle && (
            <p style={{ margin: "0 0 10px", color: "var(--gold)", letterSpacing: "0.3em", fontSize: 15 }}>
              【{poem.subtitle}】
            </p>
          )}
          <h1>{poem.title}</h1>
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
              </div>
              <div className="scene-lines">
                {s.lines.map((line, li) => (
                  <span className="line" key={li}>
                    {line}
                  </span>
                ))}
              </div>
              {s.imagery.length > 0 && (
                <div className="scene-imagery">
                  {s.imagery.map((img) => (
                    <span key={img.zh}>意象 · {img.zh}</span>
                  ))}
                </div>
              )}
              {s.translation && (
                <div className="scene-trans">
                  <div className="label">白话意译</div>
                  <p>{s.translation}</p>
                  {s.note && <p className="jian">{s.note}</p>}
                </div>
              )}
            </div>
          </section>
        ))}

        <section className="finale">
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
