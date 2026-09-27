import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "诗境 · 中国古典诗词沉浸馆",
  description: "按年代、作者、题材遨游五万卷古典诗词，每首诗都是一场可以步入的电影。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
