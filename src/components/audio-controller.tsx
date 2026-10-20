"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { ambientMusic, moodByName } from "@/lib/ambient-music";
import { audioEngine } from "@/lib/audio-engine";
import { playSfx as synth, type SfxName } from "@/lib/sfx";
type AudioPrefs = {
  enabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  mood: string;
};
type AudioApi = AudioPrefs & {
  supported: boolean;
  setEnabled: (on: boolean) => void;
  setMusicVolume: (n: number) => void;
  setSfxVolume: (n: number) => void;
  setMood: (name: string) => void;
  preview: (name?: string) => void;
  playSfx: typeof synth;
};
const defaults: AudioPrefs = {
  enabled: false,
  musicVolume: 0.25,
  sfxVolume: 0.5,
  mood: "山水清音",
};
const Context = createContext<AudioApi | null>(null);
export function AudioController({ children }: { children: ReactNode }) {
  const pathname = usePathname(),
    [prefs, setPrefs] = useState(defaults),
    [supported, setSupported] = useState(false),
    [unlocked, setUnlocked] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    current = useRef(prefs);
  useEffect(() => {
    current.current = prefs;
  }, [prefs]);
  const update = useCallback((patch: Partial<AudioPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem("shijing:audio", next.enabled ? "on" : "off");
        localStorage.setItem("shijing:audio-prefs", JSON.stringify(next));
      } catch {
        /* 私密模式仍可使用 */
      }
      return next;
    });
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setSupported(audioEngine.supported());
      try {
        const raw = JSON.parse(
          localStorage.getItem("shijing:audio-prefs") || "{}",
        );
        setPrefs({
          ...defaults,
          enabled: localStorage.getItem("shijing:audio") === "on",
          musicVolume:
            typeof raw.musicVolume === "number"
              ? Math.min(1, Math.max(0, raw.musicVolume))
              : 0.25,
          sfxVolume:
            typeof raw.sfxVolume === "number"
              ? Math.min(1, Math.max(0, raw.sfxVolume))
              : 0.5,
          mood: moodByName(raw.mood)?.name || defaults.mood,
        });
      } catch {
        /* 使用默认值 */
      }
    });
    const visibility = () => {
      void audioEngine.visibility(document.hidden);
    };
    const touch = () => {
      if (current.current.enabled && audioEngine.context())
        void audioEngine.unlock();
    };
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("touchend", touch, { passive: true });
    (window as unknown as Record<string, unknown>).__shijingAudio = {
      level: () => audioEngine.level(),
      state: () => ({
        ...audioEngine.state(),
        homePlaying: ambientMusic.playing,
        mood: ambientMusic.moodName,
      }),
    };
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("touchend", touch);
      if (previewTimer.current) clearTimeout(previewTimer.current);
      audioEngine.stopSfx();
    };
  }, []);
  useEffect(() => {
    if (pathname !== "/" || !prefs.enabled || !unlocked) {
      ambientMusic.stop(0.6);
      audioEngine.stopSfx();
      return;
    }
    const mood = moodByName(prefs.mood)!;
    ambientMusic.setVolume(current.current.musicVolume);
    void ambientMusic.start({
      ...mood,
      layers: { stream: true, bell: true, chimes: true },
    });
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
      ambientMusic.stop(0.6);
      audioEngine.stopSfx();
    };
  }, [pathname, prefs.enabled, prefs.mood, unlocked]);
  useEffect(() => {
    if (pathname === "/") ambientMusic.setVolume(prefs.musicVolume);
    audioEngine.setSfxVolume(
      pathname === "/" && prefs.enabled ? prefs.sfxVolume : 0,
    );
  }, [pathname, prefs.musicVolume, prefs.sfxVolume, prefs.enabled]);
  const setEnabled = useCallback(
    (on: boolean) => {
      if (on) {
        void audioEngine.unlock().then((ctx) => {
          if (ctx) setUnlocked(true);
        });
      } else {
        ambientMusic.stop(0.6);
        audioEngine.stopSfx();
      }
      update({ enabled: on });
    },
    [update],
  );
  const playSfx = useCallback<typeof synth>(
    (name, opts) => {
      if (pathname === "/" && prefs.enabled && unlocked) synth(name, opts);
    },
    [pathname, prefs.enabled, unlocked],
  );
  const setMood = useCallback(
    (mood: string) => {
      if (moodByName(mood)) update({ mood });
    },
    [update],
  );
  const preview = useCallback(
    (name?: string) => {
      if (!prefs.enabled || !unlocked || pathname !== "/") return;
      if (previewTimer.current) clearTimeout(previewTimer.current);
      const mood = moodByName(name || prefs.mood);
      if (!mood) return;
      ambientMusic.setVolume(prefs.musicVolume);
      void ambientMusic.start({
        ...mood,
        layers: { stream: true, bell: true, chimes: true },
      });
      previewTimer.current = setTimeout(() => {
        const original = moodByName(current.current.mood);
        if (original && current.current.enabled)
          void ambientMusic.start({
            ...original,
            layers: { stream: true, bell: true, chimes: true },
          });
      }, 8000);
    },
    [pathname, prefs, unlocked],
  );
  useEffect(() => {
    const reveal = () => playSfx("paper", { volume: 0.2 });
    document.addEventListener("shijing:reveal", reveal);
    return () => document.removeEventListener("shijing:reveal", reveal);
  }, [playSfx]);
  return (
    <Context.Provider
      value={{
        ...prefs,
        supported,
        setEnabled,
        setMood,
        playSfx,
        preview,
        setMusicVolume: (n) =>
          update({ musicVolume: Math.max(0, Math.min(1, n)) }),
        setSfxVolume: (n) => update({ sfxVolume: Math.max(0, Math.min(1, n)) }),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAudio() {
  const audio = useContext(Context);
  if (!audio) throw new Error("声音控件缺少共享控制器");
  return audio;
}
export function useSfxProps(name: SfxName) {
  const { playSfx } = useAudio();
  return {
    onPointerEnter: () => {
      if (window.matchMedia("(hover:hover)").matches)
        playSfx(name, { volume: 0.5 });
    },
    onFocus: () => playSfx(name, { volume: 0.5 }),
    onClick: () => playSfx(name),
  };
}
