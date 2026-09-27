// 影片馆：用户生成的短片存储（data/videos/{id}.webm + {id}.json 元数据）
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "data", "videos");

export type VideoMeta = {
  id: string;
  title: string;
  author: string;
  duration: number;
  bytes: number;
  createdAt: string;
};

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

export function listVideos(): VideoMeta[] {
  ensureDir();
  const out: VideoMeta[] = [];
  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith(".json")) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as VideoMeta);
    } catch { /* 跳过损坏条目 */ }
  }
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}

export function readMeta(id: string): VideoMeta | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), "utf8")) as VideoMeta;
  } catch {
    return null;
  }
}

export function videoPath(id: string) {
  return path.join(DIR, `${id}.webm`);
}

export function saveVideo(title: string, author: string, duration: number, bytes: Buffer): VideoMeta {
  ensureDir();
  const id = "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const meta: VideoMeta = {
    id,
    title: title.slice(0, 60) || "无题",
    author: author.slice(0, 30) || "佚名",
    duration,
    bytes: bytes.length,
    createdAt: new Date().toISOString(),
  };
  const tmp = videoPath(id) + ".tmp";
  fs.writeFileSync(tmp, bytes);
  fs.renameSync(tmp, videoPath(id));
  fs.writeFileSync(path.join(DIR, `${id}.json`), JSON.stringify(meta, null, 2));
  return meta;
}

export function deleteVideo(id: string) {
  ensureDir();
  for (const suffix of [".webm", ".json"]) {
    try { fs.rmSync(path.join(DIR, id + suffix), { force: true }); } catch { /* 忽略 */ }
  }
}
