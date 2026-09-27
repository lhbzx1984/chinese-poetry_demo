// 分镜引擎：把一首诗切分成 5-8 个电影感场景，并为每个场景生成统一视觉规范下的画面提示词。
// 参考 immersive-poetry-page skill 的思路：文学分镜 → 视觉圣经 → 逐场景画面。
// 全部为确定性规则，不依赖大模型；大模型只负责锦上添花的译文与赏析（见 analysis.ts）。
import type { Poem, Scene } from "./types";
import { IMAGERY, MOODS, DEFAULT_MOOD, pickPalette } from "./imagery";

export type VisualBible = {
  era: string;
  eraZh: string;
  mood: { en: string; zh: string };
  palette: { zh: string; css: [string, string, string]; hint: string };
  styleSuffix: string;
};

const ERAS: { match: string[]; en: string; zh: string }[] = [
  { match: ["先秦"], en: "ancient pre-Qin China, bronze-age ritual aesthetic, oracle and lacquer motifs", zh: "先秦古意" },
  { match: ["汉"], en: "Han dynasty China, wide-sleeved robes and lacquerware", zh: "两汉风骨" },
  { match: ["魏晋", "三国"], en: "Wei-Jin period China, wide-sleeved scholars and bamboo groves", zh: "魏晋风流" },
  { match: ["隋"], en: "Sui dynasty China", zh: "隋代" },
  { match: ["唐"], en: "Tang dynasty China, flowing silk robes, Chang'an splendor", zh: "盛唐气象" },
  { match: ["五代"], en: "Five Dynasties China, Southern Tang refinement", zh: "五代烟水" },
  { match: ["宋"], en: "Song dynasty China, refined scholar aesthetic and subtle landscape painting", zh: "两宋风雅" },
  { match: ["元"], en: "Yuan dynasty China", zh: "元代" },
  { match: ["明"], en: "Ming dynasty China", zh: "明代" },
  { match: ["清"], en: "Qing dynasty China", zh: "清代" },
];

export function buildVisualBible(poem: Poem): VisualBible {
  const era = ERAS.find((e) => poem.dynasty.includes(e.match[0]) || e.match.some((m) => poem.dynasty.includes(m)));
  const mood = MOODS.find((m) => poem.tags.includes(m.key)) ?? DEFAULT_MOOD;
  const palette = pickPalette(poem.title + " " + poem.lines.join(" ") + " " + poem.tags.join(" "));
  return {
    era: era?.en ?? "classical imperial China",
    eraZh: era?.zh ?? poem.dynasty,
    mood: { en: mood.en, zh: mood.zh },
    palette,
    styleSuffix:
      "cinematic film still, epic composition, atmospheric volumetric light, " +
      palette.hint +
      ", Chinese ink-wash color sensibility, highly detailed, 35mm photography, no text, no watermark",
  };
}

function splitSentences(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    // 按 。！？； 切句，保留标点
    const parts = line.split(/(?<=[。！？；!?;])/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) out.push(line);
    else out.push(...parts);
  }
  return out;
}

function extractImagery(text: string): { zh: string; en: string }[] {
  const found: { zh: string; en: string; pos: number }[] = [];
  for (const entry of IMAGERY) {
    let pos = Infinity;
    for (const kw of entry.kw) {
      const i = text.indexOf(kw);
      if (i >= 0 && i < pos) pos = i;
    }
    if (pos < Infinity) found.push({ zh: entry.zh, en: entry.en, pos });
  }
  found.sort((a, b) => a.pos - b.pos);
  // 去重同 zh 标签，最多 4 个意象
  const seen = new Set<string>();
  const out: { zh: string; en: string }[] = [];
  for (const f of found) {
    if (seen.has(f.zh)) continue;
    seen.add(f.zh);
    out.push({ zh: f.zh, en: f.en });
    if (out.length >= 4) break;
  }
  return out;
}

function chunk<T>(arr: T[], groups: number): T[][] {
  const size = Math.ceil(arr.length / groups);
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const MAX_SCENES = 6;
const MIN_SCENES = 3;

export function buildScenes(poem: Poem): { bible: VisualBible; scenes: Scene[] } {
  const bible = buildVisualBible(poem);
  const isCi = Boolean(poem.subtitle) && poem.collection === "songci";
  const isShijing = poem.collection === "shijing";

  let groups: string[][];
  if (isShijing || (isCi && poem.lines.length > 1 && poem.lines.length <= MAX_SCENES)) {
    // 诗经：一章一景；短词：一阕一景
    groups = poem.lines.map((l) => [l]);
  } else {
    const sentences = splitSentences(poem.lines);
    if (sentences.length <= MAX_SCENES) {
      groups = sentences.map((s) => [s]);
    } else {
      const target = Math.max(MIN_SCENES, Math.min(MAX_SCENES, Math.ceil(sentences.length / 4)));
      groups = chunk(sentences, target).map((g) => [g.join("")]);
    }
  }
  // 场景数限制
  if (groups.length > MAX_SCENES) groups = chunk(groups.flat(), MAX_SCENES).map((g) => [g.join(" ")]);

  const scenes: Scene[] = groups.slice(0, MAX_SCENES).map((g, i) => {
    const lines = g.map((s) => s.replace(/\s+/g, "")).filter(Boolean);
    const text = lines.join(" ");
    return {
      index: i,
      lines,
      text,
      imagery: extractImagery(text + (i === 0 ? " " + poem.title : "")),
      translation: null,
      note: null,
    };
  });

  // 首屏若意象太少，用标题补充
  if (scenes.length && scenes[0].imagery.length < 2) {
    for (const extra of extractImagery(poem.lines.join(" "))) {
      if (scenes[0].imagery.some((x) => x.zh === extra.zh)) continue;
      scenes[0].imagery.push(extra);
      if (scenes[0].imagery.length >= 3) break;
    }
  }
  return { bible, scenes };
}

export function scenePrompt(bible: VisualBible, scene: Scene, poem: Poem): string {
  const imagery = scene.imagery.length
    ? scene.imagery.map((x) => x.en).join(", ")
    : "a quiet classical Chinese landscape with soft mist";
  return [
    `Scene ${scene.index + 1} of a cinematic adaptation of the classical Chinese poem "${poem.title}" (${poem.dynasty} dynasty, by ${poem.author}).`,
    imagery + ".",
    `Era: ${bible.era}.`,
    `Mood: ${bible.mood.en}.`,
    bible.styleSuffix + ".",
  ].join(" ");
}
