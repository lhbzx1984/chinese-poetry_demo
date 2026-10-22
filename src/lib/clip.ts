// 短片合成：分镜图（Ken Burns 缓推 + 交叉淡化）+ 诗句字幕 + 片头卡 + 旁白朗读 + 意境配乐，
// 全部混入 MediaRecorder 录制为 WebM。时长由旁白驱动（每幕 = 旁白长度 + 余量），纯浏览器本地合成。
import type { ExperienceData } from "./types";
import { DEFAULT_ONLINE_VOICE, DOUBAO_VOICES, EDGE_VOICES } from "./voices";

const W = 1280;
const H = 720;
const TITLE_SEC = 2.6;
const FADE = 0.6;
const MIN_SCENE = 2.4;

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, zoom: number) {
  const scale = Math.max(W / img.width, H / img.height) * zoom;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function drawScrim(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(4,10,13,0.55)");
  g.addColorStop(0.4, "rgba(4,10,13,0.05)");
  g.addColorStop(0.72, "rgba(4,10,13,0.12)");
  g.addColorStop(1, "rgba(4,10,13,0.82)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function kaiti(size: number, weight = "") {
  return `${weight} ${size}px "STKaiti","KaiTi","Noto Serif SC",serif`;
}

export type NarrationClip = { sceneIndex: number; mp3: ArrayBuffer };

export async function waitForClipImages(exp: ExperienceData, signal: AbortSignal, onProgress: (stage: string) => void): Promise<string[]> {
  const deadline = Date.now() + 360_000;
  while (true) {
    signal.throwIfAborted();
    const response = await fetch(`/api/poems/${exp.poem.id}/experience`, { signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) });
    const result = await response.json();
    signal.throwIfAborted();
    if (!response.ok) throw new Error(result.error || "分镜画面读取失败。");
    const current = result.data as ExperienceData;
    if (current.scenes.length !== exp.scenes.length || current.scenes.some((s, i) => s.text !== exp.scenes[i].text)) throw new Error("分镜已更新，请刷新阅读页再生成。");
    const images = exp.scenes.map(s => current.images.find(image => image.index === s.index));
    if (images.every(image => image?.status === 'ready' && image.url)) return images.map(image => image!.url!);
    onProgress(`准备逐幕 AI 画面 ${images.filter(image => image?.status === 'ready').length}/${images.length}…`);
    if (!images.some(image => image?.status === 'pending') || Date.now() >= deadline) throw new Error("部分 AI 分镜尚未生成成功，请稍后重试；不会用同一张默认图代替整部短片。");
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 1500);
      signal.addEventListener('abort', abort, { once: true });
    });
  }
}

export async function synthesizeClipNarrations(
  scenes: ExperienceData["scenes"],
  settings: { edgeVoice: string; pitch: number; rate: number },
  signal: AbortSignal,
  onProgress: (stage: string) => void,
): Promise<NarrationClip[]> {
  const voice = [...DOUBAO_VOICES, ...EDGE_VOICES].some(v => v.id === settings.edgeVoice) ? settings.edgeVoice : DEFAULT_ONLINE_VOICE;
  const narrations: NarrationClip[] = [];
  const batch = new AbortController();
  const batchSignal = AbortSignal.any([signal, batch.signal]);
  let next = 0;
  let completed = 0;
  onProgress(`准备诗词朗诵 0/${scenes.length}…`);
  const worker = async () => {
    while (next < scenes.length) {
      const i = next++;
      try {
        batchSignal.throwIfAborted();
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: scenes[i].lines.join("\n"), voice, pitch: Math.round((settings.pitch - 1) * 60), rate: settings.rate }),
          signal: AbortSignal.any([batchSignal, AbortSignal.timeout(190_000)]),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "诗词朗诵合成失败。");
        const mp3 = await response.arrayBuffer();
        batchSignal.throwIfAborted();
        if (!response.headers.get("Content-Type")?.startsWith("audio/") || mp3.byteLength < 1000) throw new Error("没有收到有效的朗诵音频。");
        narrations[i] = { sceneIndex: i, mp3 };
        onProgress(`诗词朗诵已就绪 ${++completed}/${scenes.length}…`);
      } catch (error) {
        signal.throwIfAborted();
        if (batch.signal.aborted) throw batch.signal.reason;
        const failure = new Error(`第 ${i + 1} 幕朗诵失败：${error instanceof Error ? error.message : "网络异常"} 请重试，短片尚未保存。`);
        batch.abort(failure);
        throw failure;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, scenes.length) }, worker));
  return narrations;
}

export type ClipOptions = {
  exp: ExperienceData;
  musicStream: MediaStream | null; // 意境配乐的实时流（可空）
  narrations: NarrationClip[] | Promise<NarrationClip[]>;
  images: string[] | Promise<string[]>; // 配图可与朗诵同时准备。
  audioContext?: AudioContext; // 点击时解锁，避免等待旁白后丢失音频播放权限
  signal?: AbortSignal;
  onRecording?: () => void;
};

// 各幕时长：有旁白取旁白时长 + 余量，无旁白用最小值
function sceneDurations(count: number, narrations: { sceneIndex: number; buffer: AudioBuffer }[]): number[] {
  const durations: number[] = [];
  for (let i = 0; i < count; i++) {
    const nd = narrations.find((n) => n.sceneIndex === i)?.buffer.duration ?? 0;
    durations.push(Math.max(MIN_SCENE, nd + 1.0));
  }
  return durations;
}

export async function generatePoemClip(opts: ClipOptions): Promise<{ blob: Blob; total: number }> {
  const recCtx = opts.audioContext ?? new AudioContext();
  try {
    await recCtx.resume();
    opts.signal?.throwIfAborted();
    const loadingImages = Promise.resolve(opts.images).then(sources => {
      if (sources.length !== opts.exp.scenes.length || sources.length === 0) throw new Error("每一幕都需要对应的画面");
      return Promise.all(sources.map(async source => {
        const img = new Image();
        const signal = AbortSignal.any([...(opts.signal ? [opts.signal] : []), AbortSignal.timeout(30_000)]);
        signal.throwIfAborted();
        img.src = source;
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            img.src = '';
            reject(signal.reason?.name === 'TimeoutError' ? new Error('分镜画面加载超时，请重试。') : signal.reason);
          };
          signal.addEventListener('abort', abort, { once: true });
          img.decode().then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
        });
        signal.throwIfAborted();
        return img;
      }));
    });
    const [imgs, narrations] = await Promise.all([loadingImages, opts.narrations]);
    opts.signal?.throwIfAborted();
    return await generatePoemClipInner({ ...opts, narrations, images: imgs }, recCtx);
  } finally {
    await recCtx.close().catch(() => {});
  }
}

async function generatePoemClipInner(opts: Omit<ClipOptions, "images" | "narrations"> & { images: HTMLImageElement[]; narrations: NarrationClip[] }, recCtx: AudioContext): Promise<{ blob: Blob; total: number }> {
  const { exp, musicStream, narrations, images } = opts;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("当前浏览器不支持视频录制，请用 Chrome / Edge。");
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建视频画布，请刷新后重试。");
  const stream = canvas.captureStream(30);
  let rec: MediaRecorder | undefined;
  let frame = 0;
  try {
    // 没有旁白及配乐时只录画面；空音轨会让部分浏览器输出空文件。
    const recDest = narrations.length || musicStream?.getAudioTracks().length ? recCtx.createMediaStreamDestination() : null;
    if (recDest) for (const t of recDest.stream.getAudioTracks()) stream.addTrack(t);
    // WebM 录制只接收一条混音音轨，配乐与旁白都接入同一音频总线。
    if (recDest && musicStream?.getAudioTracks().length) recCtx.createMediaStreamSource(musicStream).connect(recDest);
    // 解码旁白 MP3 → AudioBuffer
    const decoded = await Promise.all(narrations.map(async n => {
      const buffer = await recCtx.decodeAudioData(n.mp3.slice(0));
      return { sceneIndex: n.sceneIndex, buffer };
    }));
    opts.signal?.throwIfAborted();

    const durations = sceneDurations(exp.scenes.length, decoded.filter((n) => n.sceneIndex >= 0));
    const titleNarr = decoded.find((n) => n.sceneIndex === -1)?.buffer.duration ?? 0;
    const titleSec = Math.max(TITLE_SEC, titleNarr + 1.0); // 片头时长跟随诗名旁白

    const total = titleSec + durations.reduce((a, b) => a + b, 0);

    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      .find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mime) throw new Error("当前浏览器不支持 WebM 录制，请使用 Chrome / Edge。");
    rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    let recordingError: Error | undefined;
    const recorder = rec;
    const finished = new Promise<Blob>((resolve) => {
      recorder.onerror = (event) => {
        recordingError = (event as Event & { error?: Error }).error ?? new Error("视频编码失败，请重试。");
      };
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    });

    // 旁白调度：与画面时间轴对齐（录音起点 = audioCtx 当前时刻 + 0.15s 缓冲）。
    // 合成时只写入录制流，成片播放时再一起出声。
    const startAtAudio = recCtx.currentTime + 0.2;
    for (const n of decoded) {
      const begin = n.sceneIndex === -1 ? 0.3 : titleSec + durations.slice(0, n.sceneIndex).reduce((a, b) => a + b, 0) + 0.3;
      const src = recCtx.createBufferSource();
      src.buffer = n.buffer;
      const gain = recCtx.createGain();
      gain.gain.value = 1;
      src.connect(gain);
      if (recDest) gain.connect(recDest); // 录入成片
      src.start(startAtAudio + begin);
    }

    opts.onRecording?.();
    rec.start(250);
    const t0 = performance.now();
    await new Promise<void>((resolve, reject) => {
      const draw = () => {
        if (recordingError) return reject(recordingError);
        if (recorder.state === "inactive") return reject(new Error("视频录制意外中断，请重试。"));
        try {
          opts.signal?.throwIfAborted();
          const t = (performance.now() - t0) / 1000;
          ctx.fillStyle = "#050d13";
          ctx.fillRect(0, 0, W, H);

          if (t < titleSec) {
            const a = Math.min(1, t / 0.9);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.textAlign = "center";
            ctx.shadowColor = "rgba(227,199,110,0.85)";
            ctx.shadowBlur = 34;
            ctx.fillStyle = "#fdf6e3";
            ctx.font = kaiti(92, "500");
            ctx.fillText(exp.poem.title, W / 2, H / 2 - 14);
            ctx.shadowBlur = 10;
            ctx.fillStyle = "#e3c76e";
            ctx.font = kaiti(28);
            ctx.fillText(`${exp.poem.dynasty} · ${exp.poem.author}`, W / 2, H / 2 + 58);
            ctx.restore();
          } else {
            // 场景时间轴
            let idx = 0;
            let local = 0;
            let acc2 = 0;
            for (let i = 0; i < durations.length; i++) {
              if (t - titleSec < acc2 + durations[i]) {
                idx = i;
                local = (t - titleSec - acc2) / durations[i];
                break;
              }
              acc2 += durations[i];
              idx = i;
              local = 1;
            }
            const zoom = reducedMotion ? 1 : idx % 2 === 0 ? 1.02 + local * 0.09 : 1.11 - local * 0.09;
            drawCover(ctx, images[idx], zoom);
            drawScrim(ctx);

            if (!reducedMotion && idx + 1 < images.length && local > 1 - FADE / durations[idx]) {
              const k = (local - (1 - FADE / durations[idx])) / (FADE / durations[idx]);
              ctx.save();
              ctx.globalAlpha = Math.min(1, k);
              drawCover(ctx, images[idx + 1], 1.02);
              ctx.restore();
              drawScrim(ctx);
            }

            const line = exp.scenes[idx]?.lines.join("  ") ?? "";
            if (line) {
              const fade = Math.min(1, local / 0.35) * Math.min(1, (1 - local) / 0.35 + 0.35);
              ctx.save();
              ctx.globalAlpha = Math.max(0, Math.min(1, fade));
              ctx.textAlign = "center";
              ctx.font = kaiti(30);
              ctx.shadowColor = "rgba(0,0,0,0.9)";
              ctx.shadowBlur = 12;
              ctx.fillStyle = "#f5efdc";
              ctx.fillText(line, W / 2, H - 84);
              ctx.shadowBlur = 0;
              ctx.fillStyle = "rgba(227,199,110,0.85)";
              ctx.font = kaiti(16);
              ctx.fillText(`《${exp.poem.title}》 · ${exp.poem.author}`, W / 2, H - 44);
              ctx.restore();
            }
          }

          if (t >= total) return resolve();
          frame = requestAnimationFrame(draw);
        } catch (error) { reject(error); }
      };
      frame = requestAnimationFrame(draw);
    });

    rec.stop();
    const blob = await finished;
    if (recordingError) throw recordingError;
    const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    if (header.length !== 4 || header[0] !== 0x1a || header[1] !== 0x45 || header[2] !== 0xdf || header[3] !== 0xa3) {
      throw new Error("浏览器未生成有效的 WebM 视频，请使用 Chrome / Edge 重试。");
    }
    return { blob, total };
  } finally {
    cancelAnimationFrame(frame);
    if (rec && rec.state !== "inactive") rec.stop();
    for (const track of stream.getTracks()) track.stop();
  }
}
