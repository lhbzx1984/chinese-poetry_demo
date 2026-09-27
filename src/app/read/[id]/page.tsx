import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Reader from "@/components/reader";
import { getPoem } from "@/lib/db";

export async function generateMetadata(props: PageProps<"/read/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const poem = getPoem(Number(id));
  if (!poem) return { title: "诗境 · 未找到此诗" };
  return { title: `${poem.title} · ${poem.dynasty} · ${poem.author} | 诗境` };
}

export default async function ReadPage(props: PageProps<"/read/[id]">) {
  const { id } = await props.params;
  const poem = getPoem(Number(id));
  if (!poem) notFound();
  return <Reader poem={poem} />;
}
