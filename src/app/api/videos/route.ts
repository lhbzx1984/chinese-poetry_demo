// 影片馆 API：GET 列表；POST 保存新短片（body 为 webm 字节，元数据在查询参数）
import { NextResponse } from "next/server";
import { listVideos, saveVideo } from "@/lib/videos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ data: listVideos() });
}

export async function POST(request: Request) {
  const p = new URL(request.url).searchParams;
  const title = p.get("title") ?? "无题";
  const author = p.get("author") ?? "佚名";
  const duration = Number(p.get("duration")) || 0;
  try {
    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.length < 10_000) return NextResponse.json({ error: "视频内容过小，保存被拒绝。" }, { status: 400 });
    const meta = saveVideo(title, author, duration, bytes);
    return NextResponse.json({ data: meta });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "保存失败。" }, { status: 500 });
  }
}
