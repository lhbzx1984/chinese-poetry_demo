"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Seal } from "./ui/seal";
import { SoundControl } from "./sound-control";
import { useAudio } from "./audio-controller";
export default function Topbar() {
  const pathname = usePathname(),
    audio = useAudio();
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label="诗境首页">
        <Seal>诗境</Seal>
        <span>
          诗境<small>SHI JING · IMMERSIVE</small>
        </span>
      </Link>
      <nav className="navlinks-row" aria-label="主要导航">
        <Link
          href="/library"
          prefetch={false}
          aria-current={pathname === "/library" ? "page" : undefined}
          onClick={() => audio.playSfx("ink")}
        >
          书库
        </Link>
        <Link
          href="/video"
          prefetch={false}
          aria-current={pathname === "/video" ? "page" : undefined}
          onClick={() => audio.playSfx("ink")}
        >
          影片馆
        </Link>
        <Link href="/#map" prefetch={false}>
          地图
        </Link>
        <SoundControl />
      </nav>
    </header>
  );
}
