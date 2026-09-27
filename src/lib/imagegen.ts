// 场景配图：调用 OpenAI 兼容的 images/generations 端点，逐场景生成电影感画面。
// 产物缓存在 data/generated/{id}_{内容哈希}/{index}.jpg —— 磁盘是唯一事实来源，
// 同一首诗只有第一次访问会生成，之后全部直接命中缓存（不消耗任何生成额度）；
// 未配置 key 或生成失败时前端使用程序化水墨背景兜底。
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Poem } from "./types";
import { buildScenes, scenePrompt } from "./scenes";

export const GENERATED_DIR = path.join(process.cwd(), "data", "generated");

const DEFAULT_BASE = "https://apihub.agnes-ai.com/v1";

export function imageConfig() {
  const key = process.env.IMAGE_API_KEY || process.env.AGNES_API_KEY || "";
  const base = (process.env.AI_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
  const model = process.env.IMAGE_MODEL || "agnes-image-2.5-flash";
  const size = process.env.IMAGE_SIZE || "1344x768";
  return { key, base, model, size, enabled: Boolean(key) };
}

// 内容寻址：诗的内容（标题/作者/正文）决定缓存目录，数据库重建导致 id 变化也不失效
function contentHash(poem: Poem): string {
  return crypto
    .createHash("sha1")
    .update(`${poem.id}|${poem.title}|${poem.author}|${poem.lines.join("|")}`)
    .digest("hex")
    .slice(0, 10);
}

function legacyDir(poemId: number): string {
  return path.join(GENERATED_DIR, String(poemId));
}

export function poemDirOf(poem: Poem): string {
  const legacy = legacyDir(poem.id);
  if (fs.existsSync(legacy)) return legacy;
  return path.join(GENERATED_DIR, `${poem.id}_${contentHash(poem)}`);
}

// 图片服务路由用：只知道 id 时定位缓存目录
export function dirForId(poemId: number): string | null {
  const legacy = legacyDir(poemId);
  if (fs.existsSync(legacy)) return legacy;
  try {
    const hit = fs.readdirSync(GENERATED_DIR).find((d) => d.startsWith(`${poemId}_`));
    return hit ? path.join(GENERATED_DIR, hit) : null;
  } catch {
    return null;
  }
}

export function imageFileOf(poem: Poem, index: number) {
  return path.join(poemDirOf(poem), `${index}.jpg`);
}

function hasImage(poem: Poem, index: number) {
  try { return fs.statSync(imageFileOf(poem, index)).size > 1000; } catch { return false; }
}

export function imageStatuses(poem: Poem, sceneCount: number) {
  const running = inflight.has(poem.id);
  let ready = 0;
  const out = [];
  for (let i = 0; i < sceneCount; i++) {
    const ok = hasImage(poem, i);
    if (ok) ready++;
    out.push({
      index: i,
      status: ok ? "ready" as const : running ? "pending" as const : "idle" as const,
      url: ok ? `/api/images/${poem.id}/${i}` : null,
    });
  }
  return { list: out, ready, running };
}

// 进程内去重：同一首诗的生成任务只启动一次
const inflight = new Map<number, Promise<void>>();
const failedRounds = new Map<string, number>(); // `${id}:${index}` -> 已失败次数

async function generateOne(poem: Poem, bible: ReturnType<typeof buildScenes>["bible"], index: number, prompt: string): Promise<void> {
  const { key, base, model, size } = imageConfig();
  const res = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, n: 1, size }),
    signal: AbortSignal.timeout(180_000),
  });
  const data = (await res.json().catch(() => ({}))) as { data?: { url?: string; b64_json?: string }[] };
  const item = data.data?.[0];
  if (!res.ok || !item) throw new Error(`图片服务返回异常（HTTP ${res.status}）`);
  let bytes: Uint8Array;
  if (item.b64_json) {
    bytes = Uint8Array.from(Buffer.from(item.b64_json, "base64"));
  } else if (item.url) {
    const img = await fetch(item.url, { signal: AbortSignal.timeout(120_000) });
    if (!img.ok) throw new Error(`下载生成图片失败（HTTP ${img.status}）`);
    bytes = new Uint8Array(await img.arrayBuffer());
  } else {
    throw new Error("图片服务未返回图片内容");
  }
  if (bytes.byteLength < 1000) throw new Error("生成图片内容异常");
  fs.mkdirSync(poemDirOf(poem), { recursive: true });
  const tmp = imageFileOf(poem, index) + ".tmp";
  fs.writeFileSync(tmp, bytes);
  fs.renameSync(tmp, imageFileOf(poem, index));
}

// 全局并发闸：最多同时 2 张图在生成
let active = 0;
const waiters: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  while (active >= 2) await new Promise<void>((r) => waiters.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiters.shift()?.();
  }
}

export function ensureImages(poem: Poem): void {
  const { enabled } = imageConfig();
  if (!enabled || inflight.has(poem.id)) return;
  const { bible, scenes } = buildScenes(poem);
  const task = (async () => {
    for (const scene of scenes) {
      const failKey = `${poem.id}:${scene.index}`;
      if (hasImage(poem, scene.index)) continue;
      if ((failedRounds.get(failKey) ?? 0) >= 2) continue; // 本轮会话内不再重试
      try {
        await withSlot(() => generateOne(poem, bible, scene.index, scenePrompt(bible, scene, poem)));
        failedRounds.delete(failKey);
      } catch {
        failedRounds.set(failKey, (failedRounds.get(failKey) ?? 0) + 1);
      }
    }
  })().finally(() => inflight.delete(poem.id));
  inflight.set(poem.id, task);
}
