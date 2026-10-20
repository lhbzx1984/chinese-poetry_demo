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
          数据源 <a href="https://github.com/chinese-poetry/chinese-poetry">chinese-poetry（MIT）</a> · AI 配图与语音合成 · <a href="/library">书库</a>
        </p>
      </footer>
    </main>
  );
}
