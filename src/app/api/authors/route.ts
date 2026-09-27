import { NextResponse } from "next/server";
import { listAuthors } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const authors = listAuthors({
      dynasty: url.searchParams.get("dynasty") || undefined,
      q: url.searchParams.get("q") || undefined,
      limit: Number(url.searchParams.get("limit")) || 50,
    });
    return NextResponse.json({ data: authors });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "作者数据不可用" }, { status: 500 });
  }
}
