"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAudio } from "./audio-controller";
import { Seal } from "./ui/seal";
export default function EntryVeil() {
  const dialog = useRef<HTMLDialogElement>(null),
    audio = useAudio(),
    pathname = usePathname(),
    [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (pathname !== "/") return;
    try {
      if (sessionStorage.getItem("shijing:veil-seen")) return;
    } catch {
      /* 无存储仍可入境 */
    }
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pathname]);
  const enter = useCallback(
    (sound: boolean) => {
      audio.setEnabled(sound);
      audio.playSfx("ink");
      try {
        sessionStorage.setItem("shijing:veil-seen", "1");
      } catch {
        /* 忽略存储限制 */
      }
      setLeaving(true);
      timer.current = setTimeout(
        () => {
          dialog.current?.close();
          document.getElementById("main-content")?.focus();
        },
        window.matchMedia("(prefers-reduced-motion:reduce)").matches
          ? 150
          : 900,
      );
    },
    [audio],
  );
  return (
    <dialog
      ref={dialog}
      className={`entry-veil${leaving ? " leaving" : ""}`}
      aria-labelledby="veil-title"
      onCancel={(e) => {
        e.preventDefault();
        enter(false);
      }}
    >
      <div className="veil-inner">
        <Seal>入境</Seal>
        <p className="eyebrow">山河入卷 · 诗意成声</p>
        <h1 id="veil-title">诗境</h1>
        <p>
          把喧嚣留在门外，
          <br />
          在一首诗里，慢下来。
        </p>
        <button className="cta primary" autoFocus onClick={() => enter(true)}>
          入境 · 开启诗乐
        </button>
        <button className="text-button" onClick={() => enter(false)}>
          静音进入
        </button>
      </div>
    </dialog>
  );
}
