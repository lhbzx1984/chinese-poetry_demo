// 影片馆 API：GET 列表；POST 保存新短片（body 为 webm 字节，元数据在查询参数）
import { NextResponse } from "next/server";
import { listVideos, saveVideo } from "@/lib/videos";
import { requireAdmin } from "@/lib/admin";
import { limitRequest, positiveEnv } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json({ data: listVideos() }); }
  catch { return NextResponse.json({ error: '影片列表暂不可用，请联系站点管理员。' }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (process.env.REQUIRE_TOKEN_FOR_UPLOAD === 'true') {
    const denied = requireAdmin(request);
    if (denied) return denied;
  }
  const limited = limitRequest(request, 'UPLOAD', 5);
  if (limited) return limited;
  const maxBytes = positiveEnv('MAX_VIDEO_MB', 100) * 1024 * 1024;
  if (Number(request.headers.get('content-length')) > maxBytes) return NextResponse.json({ error: '视频超过上传大小限制。' }, { status: 413 });
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'video/webm') return NextResponse.json({ error: '仅支持 video/webm 视频。' }, { status: 400 });
  const p = new URL(request.url).searchParams;
  const title = p.get("title") ?? "无题";
  const author = p.get("author") ?? "佚名";
  const duration = Number(p.get("duration")) || 0;
  try {
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: '视频内容为空。' }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          return NextResponse.json({ error: '视频超过上传大小限制。' }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks, size);
    if (!bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return NextResponse.json({ error: 'WebM 文件头无效。' }, { status: 400 });
    if (bytes.length < 10_000) return NextResponse.json({ error: "视频内容过小，保存被拒绝。" }, { status: 400 });
    if (listVideos().length >= Math.floor(positiveEnv('MAX_VIDEOS', 200))) return NextResponse.json({ error: '影片馆容量已满，请先删除旧影片。' }, { status: 507 });
    const meta = saveVideo(title, author, duration, bytes);
    return NextResponse.json({ data: meta });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "保存失败。" }, { status: 500 });
  }
}
