// 沉浸体验数据：分镜方案（确定性、即时）+ 场景配图状态 + 大模型译文赏析（可选）。
// 首次访问会触发后台生成配图与赏析；客户端轮询本接口直到状态收敛。
// 同一首诗再次访问时 imagesCached=true：全部配图直接来自本地缓存，不消耗生成额度。
import { NextResponse } from "next/server";
import { getPoem } from "@/lib/db";
import { buildScenes } from "@/lib/scenes";
import { ensureImages, imageStatuses, imageConfig } from "@/lib/imagegen";
import { ensureAnalysis, readAnalysis, textConfig } from "@/lib/analysis";
import type { ExperienceData } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/poems/[id]/experience">) {
  const { id } = await context.params;
  const poem = getPoem(Number(id));
  if (!poem) return NextResponse.json({ error: "没有找到这首诗。" }, { status: 404 });

  try {
    const { bible, scenes } = buildScenes(poem);
    // 进入时先快照一次：若所有配图早已在磁盘上，本次访问零生成
    const before = imageStatuses(poem, scenes.length);
    const imagesCached = scenes.length > 0 && !before.running && before.ready === scenes.length;
    ensureImages(poem);
    const images = imageStatuses(poem, scenes.length);

    const analysis = readAnalysis(poem);
    const analysisReady = Boolean(analysis);
    ensureAnalysis(poem);

    const scenesWithText: ExperienceData["scenes"] = scenes.map((s) => {
      const a = analysis?.scenes?.[s.index];
      return {
        ...s,
        translation: a?.yi || null,
        note: a?.jian || null,
      };
    });

    const analysisFailed = analysis !== null && analysis.scenes.length === 0;
    const imagesSettled = !images.running || images.list.every((x) => x.status !== "pending");

    const data: ExperienceData = {
      poem,
      visualBible: {
        era: bible.eraZh,
        mood: bible.mood.zh,
        palette: { zh: bible.palette.zh, css: bible.palette.css },
        imagerySummary: [...new Set(scenes.flatMap((s) => s.imagery.map((i) => i.zh)))].slice(0, 6).join(" · "),
      },
      scenes: scenesWithText,
      images: images.list,
      mode: imageConfig().enabled ? "ai" : "fallback",
      aiProgress: { done: images.ready, total: scenes.length },
      imagesCached,
      analysisDone: (textConfig().enabled && (analysisReady || analysisFailed)) || !textConfig().enabled,
    };

    return NextResponse.json({ data, settled: imagesSettled && (data.analysisDone || analysisFailed) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "体验数据不可用" }, { status: 500 });
  }
}
