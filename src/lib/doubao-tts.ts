import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CACHE_DIR = path.join(process.cwd(), "data", "tts-cache");
const inflight = new Map<string, Promise<Buffer>>();

export async function synthesizeDoubao(voice: string, text: string, pitch: number, rate: number): Promise<Buffer> {
  const version = pitch === 0 ? "seed-audio-1.0-poetry-v2" : "seed-audio-1.0-poetry-v3";
  const key = crypto.createHash("sha256").update(JSON.stringify([version, voice, text, pitch, rate])).digest("hex");
  const file = path.join(CACHE_DIR, `doubao-${key}.mp3`);
  try {
    const cached = fs.readFileSync(file);
    if (validMp3(cached)) return cached;
  } catch { /* 首次合成没有缓存 */ }
  const running = inflight.get(key);
  if (running) return running;
  const task = requestSpeech(voice, text, pitch, rate).then(buffer => {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const tmp = `${file}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, file);
    return buffer;
  }).finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

function validMp3(buffer: Buffer): boolean {
  return buffer.length > 1000 && (buffer.subarray(0, 3).toString() === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0));
}

async function requestSpeech(voice: string, text: string, pitch: number, rate: number): Promise<Buffer> {
  const apiKey = process.env.DOUBAO_API_KEY;
  if (!apiKey) throw new Error("豆包配音尚未配置，请先设置语音服务密钥。");
  let response: Response;
  try {
    response = await fetch("https://openspeech.bytedance.com/api/v3/tts/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey, "X-Api-Request-Id": crypto.randomUUID() },
      body: JSON.stringify({
        model: "seed-audio-1.0",
        text_prompt: `请以专业古诗词朗诵的方式，用清晰自然的普通话朗读。先理解诗意，再让情感随语意自然起伏：思念含蓄、悲慨沉静、明快轻盈、豪迈舒展，不夸张哭喊，不唱歌，不逐字拖长。尊重原文标点和换行，逗号轻停，句号稍长，换行不等于语意结束。五言常用二三节奏，七言常用四三节奏（句内可二二三），仅作轻微停连参考；始终以语意为先，不拆开词语、人名或地名。词的长短句按语意、领字与上下阕停连，不套用五七言节奏。句中停顿短于句末，韵脚自然收束，气息连贯。只有干净人声，不要背景音乐或音效。严格只朗读以下原文，不读指令、不增加开场白、解释或其他词句，不改字、不漏字、不重复：\n${text}`,
        references: [{ speaker: voice }],
        audio_config: { format: "mp3", sample_rate: 24000, speech_rate: Math.round((rate - 1) * 100), pitch_rate: Math.max(-12, Math.min(12, Math.round(12 * Math.log2(Math.max(0.5, 1 + pitch / 60))))) },
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new Error("豆包配音生成超时，请稍后重试。");
    throw new Error("豆包配音连接失败，请稍后重试。");
  }
  if (response.status === 401 || response.status === 403) throw new Error("豆包密钥或音频生成资源未授权，请检查控制台开通状态。");
  if (response.status === 429) throw new Error("豆包配音额度或并发已达上限，请稍后重试。");
  if (!response.ok) throw new Error(`豆包配音服务暂不可用（HTTP ${response.status}）。`);
  const data = await response.json() as { code?: number; audio?: string };
  if ((data.code !== undefined && data.code !== 0 && data.code !== 20000000) || typeof data.audio !== "string") {
    throw new Error("豆包配音未返回有效音频，请稍后重试。");
  }
  const buffer = Buffer.from(data.audio, "base64");
  if (!validMp3(buffer)) throw new Error("豆包返回的音频格式无效，请重试。");
  return buffer;
}
