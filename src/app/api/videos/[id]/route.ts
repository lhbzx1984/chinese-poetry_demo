// 单个短片：GET 播放（支持 Range 拖动）/ DELETE 删除
import fs from "node:fs";
import { NextResponse } from "next/server";
import { deleteVideo, readMeta, videoPath } from "@/lib/videos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_RE = /^v[0-9a-z]+$/;

export async function GET(request: Request, context: RouteContext<"/api/videos/[id]">) {
  const { id } = await context.params;
  if (!ID_RE.test(id)) return new Response("参数无效", { status: 400 });
  const meta = readMeta(id);
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
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
    if (start >= stat.size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    }
    const chunk = fs.readFileSync(filePath).subarray(start, end + 1);
    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: {
        ...headersBase,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Content-Length": String(chunk.length),
      },
    });
  }
  const bytes = await fs.promises.readFile(filePath);
  return new Response(new Uint8Array(bytes), {
    headers: { ...headersBase, "Content-Length": String(stat.size) },
  });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/videos/[id]">) {
  const { id } = await context.params;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "参数无效。" }, { status: 400 });
  deleteVideo(id);
  return NextResponse.json({ data: { ok: true } });
}
