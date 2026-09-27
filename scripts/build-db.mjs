// 把 chinese-poetry JSON 数据集转换成本地 SQLite 数据库 data/poetry.db
// 用法：npm run build:db
//   可用环境变量：POETRY_DATA_DIR（数据集根目录）、POETRY_DB_PATH（输出路径）
// 适配 chinese-poetry 仓库当前的中文目录结构：
//   全唐诗/poet.tang.*.json  唐诗（繁体，自动转简体）
//   全唐诗/poet.song.*.json  宋诗（繁体，自动转简体）
//   宋词/ci.song.*.json      词（繁体，自动转简体，无 title 时用「词牌·首句」生成）
//   诗经/shijing.json  楚辞/chuci.json  元曲/yuanqu.json
//   五代诗词/nantang/poetrys.json  纳兰性德/纳兰性德诗集.json
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { tagPoem } from "./tag-lexicon.mjs";

const require = createRequire(import.meta.url);
const OpenCC = require("opencc-js");
const t2s = OpenCC.Converter({ from: "t", to: "cn" });

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = process.env.POETRY_DATA_DIR || path.join(ROOT, "data", "chinese-poetry");
const OUT = process.env.POETRY_DB_PATH || path.join(ROOT, "data", "poetry.db");

if (!fs.existsSync(DATA_DIR)) {
  console.error(`找不到数据目录：${DATA_DIR}`);
  console.error(`请先把 chinese-poetry 数据集下载解压到 data/chinese-poetry，例如：`);
  console.error(`  curl -L -o data/cp.zip "https://ghproxy.net/https://github.com/chinese-poetry/chinese-poetry/archive/refs/heads/master.zip"`);
  console.error(`  unzip data/cp.zip -d data && mv data/chinese-poetry-master data/chinese-poetry`);
  process.exit(1);
}

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function textOf(v) {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}
// 繁转简（简体输入幂等）
function s(v) {
  const t = textOf(v);
  return t ? t2s(t) : t;
}
function linesOf(poem, ...keys) {
  for (const key of keys) {
    const raw = poem[key];
    if (raw) {
      const arr = Array.isArray(raw) ? raw : [raw];
      const lines = arr.map(s).filter((x) => x.length > 0 && CJK.test(x));
      if (lines.length) return lines;
    }
  }
  return [];
}
function authorOf(poem, fallback = "佚名") {
  const a = poem.author ?? poem.authors;
  if (Array.isArray(a)) return s(a[0]) || fallback;
  return s(a) || fallback;
}
function normDynasty(v) {
  const d = s(v);
  if (!d) return "";
  if (d.includes("五代") || d === "南唐" || d === "吴越" || d === "后蜀" || d.includes("十国")) return "五代";
  return d;
}
// 词牌 + 首句 → 标题（宋词数据没有 title 字段）
function ciTitle(rhythmic, lines) {
  const firstLine = (lines[0] || "").split(/[，。！？；：]/)[0].replace(/\s+/g, "").slice(0, 8);
  return rhythmic && firstLine ? `${rhythmic}·${firstLine}` : rhythmic || firstLine || "无题";
}

const collections = [];
function addCollection(name, label, load) {
  collections.push({ name, label, load });
}

function loadArrayFiles(dir, fileFilter) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json") || !fileFilter.test(f)) continue;
    const fp = path.join(dir, f);
    const data = readJson(fp);
    if (Array.isArray(data)) out.push(...data);
  }
  return out;
}

// 唐诗 + 宋诗（新版仓库把两者都放在 全唐诗/ 目录）
for (const [name, label, prefix, dynasty] of [
  ["tangshi", "唐诗", "poet.tang.", "唐"],
  ["songshi", "宋诗", "poet.song.", "宋"],
]) {
  addCollection(name, label, () => {
    const raw = loadArrayFiles(path.join(DATA_DIR, "全唐诗"), new RegExp("^" + prefix));
    return raw.map((p) => ({
      title: s(p.title) || "无题",
      subtitle: null,
      author: authorOf(p),
      dynasty,
      lines: linesOf(p, "paragraphs", "content", "chapter"),
    }));
  });
}

// 词：宋词/ci.song.*.json（含 2019 年增补），朝代按作者表
addCollection("songci", "词", () => {
  let authorDynasty = new Map();
  for (const f of ["宋词/author.song.json", "宋词/authors.song.json"]) {
    const fp = path.join(DATA_DIR, f);
    if (fs.existsSync(fp)) {
      for (const a of readJson(fp)) {
        const d = normDynasty(a.dynasty);
        if (a.name && d) authorDynasty.set(s(a.name), d);
      }
      break;
    }
  }
  const raw = loadArrayFiles(path.join(DATA_DIR, "宋词"), /^ci\.song\./);
  return raw.map((p) => {
    const lines = linesOf(p, "paragraphs", "content");
    const author = authorOf(p);
    return {
      title: s(p.title) || ciTitle(s(p.rhythmic), lines),
      subtitle: s(p.rhythmic) || null,
      author,
      dynasty: authorDynasty.get(author) || "宋",
      lines,
    };
  });
});

// 诗经：一章一段
addCollection("shijing", "诗经", () => {
  const fp = path.join(DATA_DIR, "诗经", "shijing.json");
  if (!fs.existsSync(fp)) return [];
  return readJson(fp).map((p) => ({
    title: s(p.title) || "无题",
    subtitle: [p.chapter, p.section].map(s).filter(Boolean).join("·") || null,
    author: "佚名",
    dynasty: "先秦",
    lines: linesOf(p, "content", "paragraphs"),
  }));
});

// 楚辞
addCollection("chuci", "楚辞", () => {
  const fp = path.join(DATA_DIR, "楚辞", "chuci.json");
  if (!fs.existsSync(fp)) return [];
  return readJson(fp).map((p) => ({
    title: s(p.title) || "无题",
    subtitle: s(p.section) || null,
    author: authorOf(p),
    dynasty: "先秦",
    lines: linesOf(p, "content", "paragraphs"),
  }));
});

// 五代词：南唐二主词
addCollection("wudai", "五代词", () => {
  const fp = path.join(DATA_DIR, "五代诗词", "nantang", "poetrys.json");
  if (!fs.existsSync(fp)) return [];
  return readJson(fp).map((p) => ({
    title: s(p.title) || ciTitle(s(p.rhythmic), linesOf(p, "paragraphs", "content")),
    subtitle: s(p.rhythmic) || null,
    author: authorOf(p),
    dynasty: "五代",
    lines: linesOf(p, "paragraphs", "content"),
  }));
});

// 元曲
addCollection("yuanqu", "元曲", () => {
  const fp = path.join(DATA_DIR, "元曲", "yuanqu.json");
  if (!fs.existsSync(fp)) return [];
  return readJson(fp).map((p) => ({
    title: s(p.title) || "无题",
    subtitle: null,
    author: authorOf(p),
    dynasty: "元",
    lines: linesOf(p, "paragraphs", "content"),
  }));
});

// 清词：纳兰性德（para 字段）
addCollection("nalan", "纳兰词", () => {
  const fp = path.join(DATA_DIR, "纳兰性德", "纳兰性德诗集.json");
  if (!fs.existsSync(fp)) return [];
  return readJson(fp).map((p) => ({
    title: s(p.title) || "无题",
    subtitle: null,
    author: authorOf(p, "纳兰性德"),
    dynasty: "清",
    lines: linesOf(p, "para", "paragraphs", "content"),
  }));
});

// 汉魏：曹操诗集（追加在最后，保证既有诗词 id 不变、配图缓存不失效）
addCollection("caocao", "曹操诗", () => {
  const fp = path.join(DATA_DIR, "曹操诗集", "caocao.json");
  if (!fs.existsSync(fp)) return [];
  return readJson(fp).map((p) => ({
    title: s(p.title) || "无题",
    subtitle: null,
    author: authorOf(p, "曹操"),
    dynasty: "汉",
    lines: linesOf(p, "paragraphs", "content"),
  }));
});

// ---------- 入库 ----------
fs.mkdirSync(path.dirname(OUT), { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) {
  try { fs.rmSync(OUT + suffix, { force: true }); } catch {}
}
const db = new DatabaseSync(OUT);
db.exec("PRAGMA journal_mode=OFF");
db.exec("PRAGMA synchronous=OFF");

db.exec(`
CREATE TABLE poems(
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  author TEXT NOT NULL,
  dynasty TEXT NOT NULL,
  collection TEXT NOT NULL,
  lines_json TEXT NOT NULL,
  first_line TEXT NOT NULL,
  tag_json TEXT NOT NULL,
  sent_count INTEGER NOT NULL
);
CREATE INDEX idx_poems_dynasty ON poems(dynasty);
CREATE INDEX idx_poems_author ON poems(author);
CREATE INDEX idx_poems_coll ON poems(collection);
CREATE TABLE poem_tags(tag TEXT NOT NULL, poem_id INTEGER NOT NULL);
CREATE INDEX idx_ptag_tag ON poem_tags(tag);
CREATE INDEX idx_ptag_pid ON poem_tags(poem_id);
CREATE TABLE authors(name TEXT NOT NULL, dynasty TEXT NOT NULL, poem_count INTEGER NOT NULL, PRIMARY KEY(name, dynasty));
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE VIRTUAL TABLE poems_fts USING fts5(title, author, blob, tokenize='trigram', content='');
`);

const insPoem = db.prepare(
  "INSERT INTO poems(title, subtitle, author, dynasty, collection, lines_json, first_line, tag_json, sent_count) VALUES (?,?,?,?,?,?,?,?,?)"
);
const insTag = db.prepare("INSERT INTO poem_tags(tag, poem_id) VALUES (?,?)");
const insFts = db.prepare("INSERT INTO poems_fts(rowid, title, author, blob) VALUES (?,?,?,?)");

function splitSentences(lines) {
  const joined = lines.join("\n");
  return joined.split(/(?<=[。！？；!?;])/).map(textOf).filter(Boolean);
}

const stats = {};
let poemId = 0;
const t0 = Date.now();
for (const col of collections) {
  const poems = col.load();
  let kept = 0;
  db.exec("BEGIN");
  for (const p of poems) {
    if (p.lines.length === 0) continue;
    const blob = p.title + " " + p.author + " " + p.lines.join(" ");
    if (!CJK.test(blob)) continue;
    const tags = tagPoem(p.title, blob).map((x) => x.tag);
    const id = ++poemId;
    insPoem.run(
      p.title, p.subtitle, p.author, p.dynasty, col.name,
      JSON.stringify(p.lines),
      p.lines[0].slice(0, 60),
      JSON.stringify(tags),
      Math.min(999, splitSentences(p.lines).length)
    );
    for (const t of tags) insTag.run(t, id);
    insFts.run(id, p.title, p.author, blob.slice(0, 5000));
    kept++;
  }
  db.exec("COMMIT");
  stats[col.label] = kept;
  console.log(`  ${col.label}: ${kept} 首`);
}

db.exec("INSERT INTO authors(name, dynasty, poem_count) SELECT author, dynasty, COUNT(*) FROM poems GROUP BY author, dynasty");
const total = db.prepare("SELECT COUNT(*) n FROM poems").get().n;
const dynasties = db.prepare("SELECT dynasty name, COUNT(*) count FROM poems GROUP BY dynasty ORDER BY count DESC").all();
const tags = db.prepare("SELECT tag name, COUNT(*) count FROM poem_tags GROUP BY tag ORDER BY count DESC").all();
const meta = {
  total,
  dynasties,
  tags,
  collections: collections.map((c) => ({ name: c.name, label: c.label })),
  builtAt: new Date().toISOString(),
};
db.prepare("INSERT INTO meta(key, value) VALUES ('meta', ?)").run(JSON.stringify(meta));

const sizeMB = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
console.log(`\n完成：${total} 首诗，作者 ${db.prepare("SELECT COUNT(*) n FROM authors").get().n} 位，库文件 ${sizeMB} MB，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`输出：${OUT}`);
db.close();
