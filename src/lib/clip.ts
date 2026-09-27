// 短片合成：分镜图（Ken Burns 缓推 + 交叉淡化）+ 诗句字幕 + 片头卡 + 旁白朗读 + 意境配乐，
// 全部混入 MediaRecorder 录制为 WebM。时长由旁白驱动（每幕 = 旁白长度 + 余量），纯浏览器本地合成。
import type { ExperienceData } from "./types";

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

export type ClipOptions = {
  exp: ExperienceData;
  musicStream: MediaStream | null; // 意境配乐的实时流（可空）
  narrations: NarrationClip[];
  images: HTMLImageElement[];
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
  const imgs: HTMLImageElement[] = [];
  for (const im of opts.exp.images) {
    if (im.status !== "ready" || !im.url) continue;
    const img = new Image();
    img.src = im.url;
    await img.decode();
    imgs.push(img);
  }
  if (!imgs.length) throw new Error("还没有可用的分镜图");
  return generatePoemClipInner({ ...opts, images: imgs });
}

async function generatePoemClipInner(opts: ClipOptions): Promise<{ blob: Blob; total: number }> {
  const { exp, musicStream, narrations, images } = opts;

  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("当前浏览器不支持视频录制，请用 Chrome / Edge。");
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const stream = canvas.captureStream(30);
  // 录制音频总线：独立 AudioContext + 专用 dest，无论配乐开关与否，成片必有音轨
  const recCtx = new AudioContext();
  await recCtx.resume();
  const recDest = recCtx.createMediaStreamDestination();
  for (const t of recDest.stream.getAudioTracks()) stream.addTrack(t);
  if (musicStream) for (const t of musicStream.getAudioTracks()) stream.addTrack(t);
  // 解码旁白 MP3 → AudioBuffer
  const decoded: { sceneIndex: number; buffer: AudioBuffer }[] = [];
  for (const n of narrations) {
    const buffer = await recCtx.decodeAudioData(n.mp3.slice(0));
    decoded.push({ sceneIndex: n.sceneIndex, buffer });
  }

  const durations = sceneDurations(exp.scenes.length, decoded.filter((n) => n.sceneIndex >= 0));
  const titleNarr = decoded.find((n) => n.sceneIndex === -1)?.buffer.duration ?? 0;
  const titleSec = Math.max(TITLE_SEC, titleNarr + 1.0); // 片头时长跟随诗名旁白

  const total = titleSec + durations.reduce((a, b) => a + b, 0);

  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const finished = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  // 旁白调度：与画面时间轴对齐（录音起点 = audioCtx 当前时刻 + 0.15s 缓冲）。
  // 旁白同时接到扬声器（生成过程中可听到）与录制流（captureDest）。
  const startAtAudio = recCtx.currentTime + 0.2;
  for (const n of decoded) {
    const begin = n.sceneIndex === -1 ? 0.3 : titleSec + durations.slice(0, n.sceneIndex).reduce((a, b) => a + b, 0) + 0.3;
    const src = recCtx.createBufferSource();
    src.buffer = n.buffer;
    const gain = recCtx.createGain();
    gain.gain.value = 1;
    src.connect(gain);
    gain.connect(recDest);           // 录入成片
    gain.connect(recCtx.destination); // 生成过程中可监听
    src.start(startAtAudio + begin);
  }

  rec.start(250);
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const draw = () => {
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
        const zoom = idx % 2 === 0 ? 1.02 + local * 0.09 : 1.11 - local * 0.09;
        drawCover(ctx, images[idx], zoom);
        drawScrim(ctx);

        if (idx + 1 < images.length && local > 1 - FADE / durations[idx]) {
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
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  });

  rec.stop();
  return { blob: await finished, total };
}
