// 提供缓存的场景配图（目录按内容寻址，兼容旧版纯 id 目录）
import fs from "node:fs";
import path from "node:path";
import { dirForId } from "@/lib/imagegen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/images/[id]/[index]">) {
  const { id, index } = await context.params;
  const poemId = Number(id);
  const sceneIndex = Number(index);
  if (!Number.isInteger(poemId) || !Number.isInteger(sceneIndex) || poemId <= 0 || sceneIndex < 0 || sceneIndex > 20) {
    return new Response("参数无效", { status: 400 });
  }
  const dir = dirForId(poemId);
  if (!dir) return new Response("图片尚未生成", { status: 404 });
  try {
    const bytes = await fs.promises.readFile(path.join(dir, `${sceneIndex}.jpg`));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("图片尚未生成", { status: 404 });
  }
}
