import { NextResponse } from "next/server";
import { getMeta } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ data: getMeta() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "元信息不可用" }, { status: 500 });
  }
}
