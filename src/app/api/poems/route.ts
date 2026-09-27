import { NextResponse } from "next/server";
import { listPoems } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  try {
    const result = listPoems({
      dynasty: p.get("dynasty") || undefined,
      author: p.get("author") || undefined,
      tag: p.get("tag") || undefined,
      collection: p.get("collection") || undefined,
      q: p.get("q") || undefined,
      page: Number(p.get("page")) || 1,
      pageSize: Number(p.get("pageSize")) || 20,
    });
    return NextResponse.json({ data: result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "诗词数据不可用" }, { status: 500 });
  }
}
