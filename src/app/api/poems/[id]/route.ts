import { NextResponse } from "next/server";
import { getPoem } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/poems/[id]">) {
  const { id } = await context.params;
  const poem = getPoem(Number(id));
  if (!poem) return NextResponse.json({ error: "没有找到这首诗。" }, { status: 404 });
  return NextResponse.json({ data: poem });
}
