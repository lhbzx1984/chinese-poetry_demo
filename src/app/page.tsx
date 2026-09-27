import HomeHero from "@/components/home-hero";
import MapExplorer from "@/components/map-explorer";

export default function Home() {
  return (
    <main>
      <HomeHero />
      <MapExplorer />
      <footer className="home-foot">
        <p>诗境 · 中国古典诗词沉浸馆</p>
        <p>
          数据源 chinese-poetry · 视觉与朗读由本机 AI 生成 · <a href="/library">书库</a>
        </p>
      </footer>
    </main>
  );
}
