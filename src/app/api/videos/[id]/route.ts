// 单个短片：GET 播放（支持 Range 拖动）/ DELETE 删除
import fs from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { deleteVideo, videoPath } from "@/lib/videos";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_RE = /^v[0-9a-z]+$/;

export async function GET(request: Request, context: RouteContext<"/api/videos/[id]">) {
  const { id } = await context.params;
  if (!ID_RE.test(id)) return new Response("参数无效", { status: 400 });
  const filePath = videoPath(id);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return new Response("影片不存在", { status: 404 });
  }
  const range = request.headers.get("range");
  const headersBase: Record<string, string> = {
    "Content-Type": "video/webm",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    const suffix = m && !m[1] && m[2] ? Number(m[2]) : null;
    const start = suffix !== null ? Math.max(0, stat.size - suffix) : Number(m?.[1] || 0);
    const end = suffix !== null ? stat.size - 1 : m?.[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
    if (!m || (!m[1] && !m[2]) || suffix === 0 || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= stat.size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    }
    const stream = Readable.toWeb(fs.createReadStream(filePath, { start, end })) as ReadableStream<Uint8Array>;
    return new Response(stream, {
      status: 206,
      headers: {
        ...headersBase,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream<Uint8Array>, {
    headers: { ...headersBase, "Content-Length": String(stat.size) },
  });
}

export async function DELETE(request: Request, context: RouteContext<"/api/videos/[id]">) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await context.params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "参数无效。" }, { status: 400 });
  deleteVideo(id);
  return NextResponse.json({ data: { ok: true } });
}
