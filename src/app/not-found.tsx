import Link from "next/link";
import { Seal } from "@/components/ui/seal";

export default function NotFound() {
  return (
    <main id="main-content" className="error-page" tabIndex={-1}>
      <Seal>山河有信</Seal>
      <span className="error-code">四〇四</span>
      <h1>此处尚无诗踪</h1>
      <p>这卷诗可能已移往别处。回到书库，再寻一境。</p>
      <Link className="cta" href="/library">
        重返书库
      </Link>
    </main>
  );
}
