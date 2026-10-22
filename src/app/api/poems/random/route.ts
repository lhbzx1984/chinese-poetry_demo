import { NextResponse } from "next/server";
import { randomPoemId } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  try {
    const id = randomPoemId({
      dynasty: p.get("dynasty") || undefined,
      tag: p.get("tag") || undefined,
      author: p.get("author") || undefined,
      q: p.get("q")?.slice(0, 200) || undefined,
    });
    return NextResponse.json({ data: { id } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "随机诗词不可用" }, { status: 500 });
  }
}
