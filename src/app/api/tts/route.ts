// 朗读合成：POST {text, voice, pitch, rate} → Edge 神经语音 MP3（磁盘缓存，重复朗读零消耗）。
// 失败时返回 503，前端回退浏览器语音。
import { NextResponse } from "next/server";
import { synthesizeEdge } from "@/lib/edge-tts";
import { EDGE_VOICES } from "@/lib/voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { text?: string; voice?: string; pitch?: number; rate?: number }
    | null;
  const text = (body?.text ?? "").trim();
  const voice = (body?.voice ?? "").trim();
  const pitch = Number.isFinite(body?.pitch) ? Math.max(-60, Math.min(60, Number(body?.pitch))) : 0;
  const rate = Number.isFinite(body?.rate) ? Math.max(0.5, Math.min(1.4, Number(body?.rate))) : 1;
  if (!text || !voice) return NextResponse.json({ error: "参数不完整。" }, { status: 400 });
  if (!EDGE_VOICES.some((v) => v.id === voice)) {
    return NextResponse.json({ error: "未知音色。" }, { status: 400 });
  }
  if (text.length > 2000) return NextResponse.json({ error: "单次合成的文本过长。" }, { status: 400 });
  try {
    const buf = await synthesizeEdge(voice, text, pitch, rate);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "语音合成不可用。" }, { status: 503 });
  }
}
