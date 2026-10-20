import Link from "next/link";
import { Seal } from "./ui/seal";
export default function Footer() {
  return (
    <footer className="site-footer">
      <Seal>诗境</Seal>
      <p className="footer-title">一卷诗书，一程山河。</p>
      <nav aria-label="页脚导航">
        <Link href="/library">漫游书库</Link>
        <Link href="/#map">诗人行迹</Link>
        <Link href="/video">影片馆</Link>
      </nav>
      <p>
        诗词数据{" "}
        <a href="https://github.com/chinese-poetry/chinese-poetry">
          chinese-poetry · MIT
        </a>
      </p>
      <p>译文与配图由 AI 生成，仅供欣赏参考。地图为文学地理示意。</p>
      <small>SHI JING · 在诗意中，安放心绪</small>
    </footer>
  );
}
