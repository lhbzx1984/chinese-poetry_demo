import { NextResponse } from "next/server";
import { getPoem } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/poems/[id]">) {
  const { id } = await context.params;
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) return NextResponse.json({ error: '诗词编号无效。' }, { status: 400 });
  try {
    const poem = getPoem(Number(id));
    if (!poem) return NextResponse.json({ error: "没有找到这首诗。" }, { status: 404 });
    return NextResponse.json({ data: poem });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '诗词数据不可用。' }, { status: 503 });
  }
}
