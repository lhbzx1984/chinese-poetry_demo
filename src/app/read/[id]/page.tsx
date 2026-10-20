import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Reader from "@/components/reader";
import { getPoem } from "@/lib/db";

export async function generateMetadata(props: PageProps<"/read/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  let poem;
  try { poem = getPoem(Number(id)); } catch { return { title: '诗境 · 书库暂不可用' }; }
  if (!poem) return { title: "诗境 · 未找到此诗" };
  return { title: `${poem.title} · ${poem.dynasty} · ${poem.author} | 诗境` };
}

export default async function ReadPage(props: PageProps<"/read/[id]">) {
  const { id } = await props.params;
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) notFound();
  let poem;
  try { poem = getPoem(Number(id)); } catch {
    return <main className="status-line"><h1>书库暂不可用</h1><p>诗词数据库尚未就绪，请联系站点管理员。</p><a href="/library">返回书库</a></main>;
  }
  if (!poem) notFound();
  return <Reader poem={poem} />;
}
