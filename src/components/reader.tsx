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
import { adminFetch } from "@/lib/admin-client";
import { EDGE_VOICES } from "@/lib/voices";
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
  const voices = useVoices();
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

  // 朗读偏好本机记忆
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettings(loadNarrationSettings()));
    return () => cancelAnimationFrame(frame);
  }, []);
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
    return () => {
      stopRef.current = true;
      // 卸载时让仍在等待网络请求的朗读和试听失效。
      narrationRun.current++;
      previewRun.current++;
      speechDoneRef.current?.();
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      audioRef.current?.pause();
      ambientMusic.stop();
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
    stopRef.current = true;
    narrationRunRef.current++;
    speechDoneRef.current?.();
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

  const playEdge = useCallback(async (text: string, runId: number) => {
    const url = await synthUrl(text, settingsRef.current.edgeVoice);
    if (stopRef.current || narrationRunRef.current !== runId) return;
    const audio = new Audio(url); // 语速/音调已在服务端合成
    audioRef.current = audio;
    audio.onplay = () => ambientMusic.setDuck(true);
    await new Promise<void>((resolve) => {
      const finish = () => {
        if (speechDoneRef.current === finish) speechDoneRef.current = null;
        resolve();
      };
      speechDoneRef.current = finish;
      audio.onended = finish;
      audio.onerror = finish;
      audio.play().catch(finish);
    });
    if (audioRef.current === audio) audioRef.current = null;
  }, [synthUrl]);

  const speakBrowser = useCallback((text: string, runId?: number) => {
    return new Promise<void>((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      if (runId !== undefined && (stopRef.current || narrationRunRef.current !== runId)) return resolve();
      const s = settingsRef.current;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-CN";
      u.rate = s.rate;
      u.pitch = s.pitch;
      const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === s.voiceURI);
      if (voice) u.voice = voice;
      u.onstart = () => ambientMusic.setDuck(true);
      const finish = () => {
        if (speechDoneRef.current === finish) speechDoneRef.current = null;
        resolve();
      };
      speechDoneRef.current = finish;
      u.onend = finish;
      u.onerror = finish;
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
    const runId = ++narrationRunRef.current;
    setSpeaking(true);
    ensureMusic();
    // 先念诗名与作者，再进入诗句
    const announce = `《${poem.title}》，${poem.author}。`;
    try {
      if (settingsRef.current.edgeVoice) await playEdge(announce, runId);
      else await speakBrowser(announce, runId);
    } catch { /* 朗读开场白失败不阻塞正文 */ }
    if (stopRef.current || narrationRunRef.current !== runId) return;
    ambientMusic.setDuck(false);
    const scenes = exp.scenes;
    for (let i = 0; i < scenes.length; i++) {
      if (stopRef.current || narrationRunRef.current !== runId) break;
      const s = scenes[i];
      setActive(i);
      sectionRefs.current[i]?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
      const text = s.lines.join("。");
      const useEdge = Boolean(settingsRef.current.edgeVoice);
      try {
        if (useEdge) await playEdge(text, runId);
        else await speakBrowser(text, runId);
      } catch (e) {
        if (useEdge) {
          flashNotice(`Edge 音色暂不可用（${e instanceof Error ? e.message : "网络异常"}），本幕改用浏览器语音。`);
          await speakBrowser(text, runId);
        }
      }
      if (stopRef.current || narrationRunRef.current !== runId) return;
      ambientMusic.setDuck(false);
      if (!stopRef.current && i < scenes.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
        if (stopRef.current || narrationRunRef.current !== runId) return;
        if (settingsRef.current.edgeVoice) synthUrl(scenes[i + 1].lines.join("。"), settingsRef.current.edgeVoice).catch(() => void 0);
      }
    }
    if (stopRef.current || narrationRunRef.current !== runId) return;
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
      previewRunRef.current++;
      speechDoneRef.current?.();
      speechSynthesis.cancel();
      audioRef.current?.pause();
      audioRef.current = null;
      if (!soloRef.current) ambientMusic.stop();
      setPreviewing(false);
      return;
    }
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
        audio.onerror = finish;
        await audio.play();
        return;
      } catch (e) {
        if (previewRunRef.current !== runId) return;
        flashNotice(`Edge 音色暂不可用（${e instanceof Error ? e.message : "网络异常"}），试听改用浏览器语音。`);
      }
    }
    await speakBrowser(text);
    if (previewRunRef.current !== runId) return;
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
      let ttsError = '';
      // 片头旁白：诗名与作者
      setClipStage("合成片头旁白…");
      try {
        const r = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `《${exp.poem.title}》，${exp.poem.author}。`, voice, pitch, rate }),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '旁白合成失败。');
        narrations.push({ sceneIndex: -1, mp3: await r.arrayBuffer() });
      } catch (e) {
        ttsOk = false;
        ttsError = e instanceof Error ? e.message : '旁白合成失败。';
      }
      for (let i = 0; i < exp.scenes.length; i++) {
        setClipStage(`合成旁白 ${i + 1}/${exp.scenes.length}…`);
        try {
          const r = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: exp.scenes[i].lines.join("。"), voice, pitch, rate }),
          });
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || '旁白合成失败。');
          narrations.push({ sceneIndex: i, mp3: await r.arrayBuffer() });
        } catch (e) {
          ttsOk = false; // 单幕失败：该幕静音，继续生成
          ttsError = e instanceof Error ? e.message : '旁白合成失败。';
        }
      }
      if (!ttsOk) flashNotice(`${ttsError} 部分旁白合成失败，对应幕将只有配乐。`);

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
      const up = await adminFetch(`/api/videos?${qs}`, { method: "POST", headers: { "Content-Type": "video/webm" }, body: blob });
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

  const scenes = exp?.scenes ?? [];
  const automaticEnvironments = scenes.map((scene) => matchSceneEnvironment(scene.text, poem.title, poem.tags));
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
          {exp && exp.mode === "ai" && exp.images.length > 0 && exp.images.every((i) => i.status === "ready") && (
            <button className="ghost-btn" onClick={() => void makeClip()} disabled={clipBusy} title="用分镜画面、旁白与配乐合成短片">
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
            <select aria-label="朗读音色" value={settings.edgeVoice} onChange={(e) => update({ edgeVoice: e.target.value })}>
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
                <select aria-label="系统声音" value={settings.voiceURI} onChange={(e) => update({ voiceURI: e.target.value })}>
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
              aria-label="语速" value={settings.rate}
              onChange={(e) => update({ rate: Number(e.target.value) })}
            />
          </div>
          <div className="set-row">
            <label>音调 {settings.pitch.toFixed(2)}</label>
            <input
              type="range" min={0.8} max={1.15} step={0.05}
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
            Edge 音色的语速/音调在合成时生效，结果会缓存，重复朗读不重复合成。
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
              {exp?.images[s.index]?.status === "ready" && <p className="scene-export-note">切换只影响阅读画面；生成短片仍使用 AI 配图。</p>}
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
