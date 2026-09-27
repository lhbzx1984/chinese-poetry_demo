// 分镜白话译文与赏析：可选的大模型增强。
// 未配置模型、调用失败、返回不可解析时一律静默降级 —— 页面只少一个模块，不影响使用。
import fs from "node:fs";
import path from "node:path";
import type { Poem, Scene } from "./types";
import { buildScenes } from "./scenes";
import { poemDirOf } from "./imagegen";

const DEFAULT_BASE = "https://apihub.agnes-ai.com/v1";

export function textConfig() {
  const key = process.env.IMAGE_API_KEY || process.env.AGNES_API_KEY || "";
  const base = (process.env.AI_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
  const model = process.env.TEXT_MODEL || "";
  return { key, base, model, enabled: Boolean(key && model) };
}

function analysisFile(poem: Poem) {
  return path.join(poemDirOf(poem), "analysis.json");
}

const inflight = new Map<number, Promise<void>>();

export type SceneAnalysis = { yi: string; jian: string };
export type PoemAnalysis = { scenes: SceneAnalysis[] };

export function readAnalysis(poem: Poem): PoemAnalysis | null {
  try {
    return JSON.parse(fs.readFileSync(analysisFile(poem), "utf8")) as PoemAnalysis;
  } catch {
    return null;
  }
}

function parseJsonLoose(text: string): PoemAnalysis | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    if (!Array.isArray(arr)) return null;
    const scenes = arr
      .map((x) => {
        const o = x as Record<string, unknown>;
        return { yi: String(o?.yi ?? o?.translation ?? "").trim(), jian: String(o?.jian ?? o?.note ?? "").trim() };
      })
      .filter((x) => x.yi || x.jian);
    return scenes.length ? { scenes } : null;
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
    numbered,
    ``,
    `请按场景逐个输出 JSON 数组，不要输出其它文字：`,
    `[{"scene":1,"yi":"该场景诗句的白话意译（30字内，语言优美可诵）","jian":"一句话画面与情感点评（24字内）"}]`,
  ].join("\n");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 1500,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`文本模型返回 HTTP ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonLoose(content);
  if (!parsed) throw new Error("文本模型返回无法解析");
  return parsed;
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
