// 分镜白话译文与赏析：可选的大模型增强。
// 模型返回按场景编号定位，缺项留空，避免译文错配。
import fs from "node:fs";
import path from "node:path";
import type { Poem, Scene } from "./types";
import { buildScenes } from "./scenes";
import { poemDirOf } from "./imagegen";

const DEFAULT_BASE = "https://apihub.agnes-ai.com/v1";

export function textConfig() {
  const key = process.env.TEXT_API_KEY || process.env.IMAGE_API_KEY || process.env.AGNES_API_KEY || "";
  const base = (process.env.TEXT_API_BASE_URL || process.env.AI_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
  const model = process.env.TEXT_MODEL ?? "agnes-3.0-flash";
  return { key, base, model, enabled: Boolean(key && model) };
}

function analysisFile(poem: Poem) {
  // 不复用旧解析器可能错位的译文；图片缓存不受影响。
  return path.join(poemDirOf(poem), "analysis-v2.json");
}

const inflight = new Map<number, Promise<void>>();

export type SceneAnalysis = { text: string; yi: string; jian: string };
export type PoemAnalysis = { scenes: SceneAnalysis[] };

export function readAnalysis(poem: Poem): PoemAnalysis | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(analysisFile(poem), "utf8")) as PoemAnalysis & { failedAt?: number };
    const scenes = buildScenes(poem).scenes;
    if (!Array.isArray(parsed.scenes)) return null;
    // 失败占位（空结果）超过 10 分钟视为过期：允许重新尝试合成
    if (parsed.scenes.length === 0 && parsed.failedAt && Date.now() - parsed.failedAt > 10 * 60 * 1000) {
      return null;
    }
    if (parsed.scenes.length && (parsed.scenes.length !== scenes.length || parsed.scenes.some((s, i) =>
      s.text !== scenes[i].text || typeof s.yi !== "string" || typeof s.jian !== "string"))) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseJsonLoose(text: string, source: Scene[]): PoemAnalysis | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    if (!Array.isArray(arr)) return null;
    const scenes = source.map(s => ({ text: s.text, yi: "", jian: "" }));
    const seen = new Set<number>();
    for (const item of arr) {
      if (!item || typeof item !== "object") return null;
      const index = item.scene - 1;
      if (!Number.isInteger(item.scene) || index < 0 || index >= scenes.length || seen.has(index)) return null;
      seen.add(index);
      const yi = item.yi ?? item.translation ?? "";
      const jian = item.jian ?? item.note ?? "";
      if (typeof yi !== "string" || typeof jian !== "string") return null;
      scenes[index] = { text: source[index].text, yi: yi.trim(), jian: jian.trim() };
    }
    return scenes.some(s => s.yi || s.jian) ? { scenes } : null;
  } catch {
    return null;
  }
}

async function requestAnalysis(poem: Poem, scenes: Scene[]): Promise<PoemAnalysis> {
  const { key, base, model } = textConfig();
  const numbered = scenes
    .map((s, i) => `场景${i + 1}：${s.lines.join(" / ")}`)
    .join("\n");
  const prompt = [
    `你是古典诗词赏析者。下面是${poem.dynasty}诗人${poem.author}的《${poem.title}》的分镜。`,
    `全诗：${poem.lines.join("\n")}`,
    numbered,
    ``,
    `请按场景逐个输出 JSON 数组，不要输出其它文字：`,
    `[{"scene":1,"yi":"忠实完整的白话译文","jian":"本句关键词、典故或省略的解释；无需解释则留空"}]`,
    `scene 必须使用上面给出的场景编号，一幕一项，不得合并或更换原句。以提供的版本为准，不得用熟悉的同名作品或其他版本替换正文。结合全诗解释省略、比喻与典故，不得将比喻当实景，不杜撰人物、生平、地点及写作背景；不能确定的解释留空。注释须解释诗句含义，不要将配图描述冒充文学解释。`,
  ].join("\n");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 3000,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`文本模型返回 HTTP ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonLoose(content, scenes);
  if (!parsed) throw new Error("文本模型返回无法解析");
  return parsed;
}

export function needsAnalysis(poem: Poem): boolean {
  return textConfig().enabled && !inflight.has(poem.id) && !readAnalysis(poem);
}

export function ensureAnalysis(poem: Poem): void {
  const { enabled } = textConfig();
  if (!enabled || inflight.has(poem.id) || readAnalysis(poem)) return;
  const { scenes } = buildScenes(poem);
  const task = requestAnalysis(poem, scenes)
    .then((analysis) => {
      fs.mkdirSync(path.dirname(analysisFile(poem)), { recursive: true });
      const tmp = analysisFile(poem) + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(analysis));
      fs.renameSync(tmp, analysisFile(poem));
    })
    .catch(() => {
      // 写入一个空结果占位，避免同会话内反复重试拖慢响应
      try {
        fs.mkdirSync(path.dirname(analysisFile(poem)), { recursive: true });
        fs.writeFileSync(analysisFile(poem), JSON.stringify({ scenes: [], failedAt: Date.now() }));
      } catch { /* 忽略 */ }
    })
    .finally(() => inflight.delete(poem.id));
  inflight.set(poem.id, task);
}
