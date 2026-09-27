// 生成首页山水诗意背景视频（一次生成，永久使用；输出 public/media/hero-landscape.mp4）
// 用法：node scripts/fetch-hero-video.mjs
import fs from "node:fs";
import path from "node:path";

const KEY = process.env.AGNES_API_KEY;
if (!KEY) {
  console.error("缺少 AGNES_API_KEY（.env.local）");
  process.exit(1);
}
const BASE = (process.env.AI_API_BASE_URL || "https://apihub.agnes-ai.com/v1").replace(/\/$/, "");
const OUT = path.resolve(import.meta.dirname, "..", "public", "media", "hero-landscape.mp4");
if (fs.existsSync(OUT) && fs.statSync(OUT).size > 200_000) {
  console.log("背景视频已存在：", OUT);
  process.exit(0);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const PROMPT =
  "史诗电影航拍镜头，中国山水画意境：云雾缭绕的青绿群山之间，一条大江蜿蜒流向远方，" +
  "晨光穿透云层洒在江面泛起金光，一叶孤帆顺流而下，镜头缓慢向前推移，" +
  "大气磅礴、静谧诗意、水墨青绿色调、电影级光影、无文字、无水印";

const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const post = await fetch(`${BASE}/videos`, {
  method: "POST",
  headers,
  body: JSON.stringify({ model: process.env.VIDEO_MODEL || "agnes-video-2.5-flash", prompt: PROMPT, seconds: "5", mode: "text", size: "720P", aspect_ratio: "16:9", n: 1 }),
  signal: AbortSignal.timeout(90_000),
});
const created = await post.json().catch(() => ({}));
if (!post.ok) {
  console.error("创建视频任务失败：", JSON.stringify(created).slice(0, 300));
  process.exit(1);
}
const videoId = created.video_id ?? created.id ?? created.task_id;
if (!videoId) {
  console.error("未返回任务 ID：", JSON.stringify(created).slice(0, 300));
  process.exit(1);
}
console.log("任务 ID：", videoId, "等待生成…");

let url = null;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const q = await fetch(`${BASE}/videos/${encodeURIComponent(videoId)}`, { headers, signal: AbortSignal.timeout(30_000) });
  const d = await q.json().catch(() => ({}));
  const status = d.status ?? d.task_status;
  if (d.video_url ?? d.url ?? d.output?.[0]) { url = d.video_url ?? d.url ?? d.output?.[0]; break; }
  if (status === "completed" && (d.video_url ?? d.url)) { url = d.video_url ?? d.url; break; }
  if (status === "failed" || status === "error") {
    console.error("视频生成失败：", JSON.stringify(d).slice(0, 300));
    process.exit(1);
  }
  process.stdout.write(`  [${i * 5}s] ${status ?? "processing"}\n`);
}
if (!url) {
  console.error("超时未获取视频地址");
  process.exit(1);
}
console.log("下载：", url);
const bin = await fetch(url, { signal: AbortSignal.timeout(300_000) });
if (!bin.ok) {
  console.error("下载失败 HTTP", bin.status);
  process.exit(1);
}
fs.writeFileSync(OUT, Buffer.from(await bin.arrayBuffer()));
console.log("已保存：", OUT, (fs.statSync(OUT).size / 1048576).toFixed(1) + "MB");
