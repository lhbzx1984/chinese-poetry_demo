// Edge 神经语音合成（服务端）：msedge-tts 免费调用 Edge Read Aloud 服务，
// 支持多音色（男女）、音调（Hz）、语速（倍率）。结果落盘缓存，重复朗读零消耗。
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CACHE_DIR = path.join(process.cwd(), "data", "tts-cache");

const instances = new Map<string, import("msedge-tts").MsEdgeTTS>();
async function ttsFor(voice: string) {
  let inst = instances.get(voice);
  if (!inst) {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
    inst = new MsEdgeTTS();
    await inst.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    instances.set(voice, inst);
  }
  return inst;
}

function cachePath(key: string) {
  return path.join(CACHE_DIR, `${key}.mp3`);
}
function readCache(key: string): Buffer | null {
  try {
    const buf = fs.readFileSync(cachePath(key));
    return buf.length > 1000 ? buf : null;
  } catch {
    return null;
  }
}
function writeCache(key: string, buf: Buffer) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const tmp = cachePath(key) + ".tmp";
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, cachePath(key));
}

export function edgeTtsKey(voice: string, pitch: number, rate: number, text: string) {
  return crypto.createHash("sha1").update(`${voice}|${pitch}|${rate}|${text}`).digest("hex");
}

export async function synthesizeEdge(voice: string, text: string, pitch: number, rate: number): Promise<Buffer> {
  const key = edgeTtsKey(voice, pitch, rate, text);
  const cached = readCache(key);
  if (cached) return cached;
  // 首次建连偶发抖动：自动重试一次
  let buf: Buffer | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      buf = await synthOnce(voice, text, pitch, rate, attempt > 0);
      break;
    } catch (e) {
      lastErr = e;
      instances.delete(voice); // 丢弃可能损坏的连接实例
    }
  }
  if (!buf) throw lastErr instanceof Error ? lastErr : new Error("语音合成失败");
  writeCache(key, buf);
  return buf;
}

async function synthOnce(voice: string, text: string, pitch: number, rate: number, fresh: boolean): Promise<Buffer> {
  if (fresh) instances.delete(voice);
  const { audioStream } = (await (await ttsFor(voice)).toStream(text, {
    pitch: `${pitch >= 0 ? "+" : ""}${Math.round(pitch)}Hz`,
    rate: rate,
  })) as unknown as { audioStream: NodeJS.ReadableStream };
  const chunks: Buffer[] = [];
  for await (const c of audioStream) chunks.push(c as Buffer);
  const buf = Buffer.concat(chunks);
  if (buf.length < 1000) throw new Error("语音服务返回了空音频");
  return buf;
}
