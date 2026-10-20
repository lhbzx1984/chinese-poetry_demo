import { NextResponse } from "next/server";
import { listPoems } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  for (const name of ['page', 'pageSize']) {
    const value = p.get(name);
    if (value !== null && (!Number.isSafeInteger(Number(value)) || Number(value) < 1)) {
      return NextResponse.json({ error: '分页参数必须为正整数。' }, { status: 400 });
    }
  }
  if ((p.get('q')?.length ?? 0) > 200) return NextResponse.json({ error: '搜索词请限制在 200 字以内。' }, { status: 400 });
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
