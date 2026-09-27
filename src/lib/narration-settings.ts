"use client";

import { useEffect, useState } from "react";

export type NarrationSettings = {
  voiceURI: string; // 系统中文语音的 voiceURI（仅 edgeVoice 为空时生效）
  edgeVoice: string; // "" = 浏览器语音；否则为 Edge 神经语音 id（晓晓/云希…，需联网）
  rate: number;
  pitch: number;
  music: boolean;
  musicVolume: number;
  musicMood: string; // "" = 随诗自动匹配；否则为指定意境名
};

export const DEFAULT_SETTINGS: NarrationSettings = {
  voiceURI: "",
  edgeVoice: "",
  rate: 0.85,
  pitch: 1,
  music: true,
  musicVolume: 0.45,
  musicMood: "",
};

const KEY = "shijing:narration";

export function loadNarrationSettings(): NarrationSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as Partial<NarrationSettings>;
    // 只保留仍支持的字段（旧版本残留自动忽略）
    return {
      voiceURI: typeof saved.voiceURI === "string" ? saved.voiceURI : "",
      edgeVoice: typeof saved.edgeVoice === "string" ? saved.edgeVoice : "",
      rate: typeof saved.rate === "number" ? saved.rate : DEFAULT_SETTINGS.rate,
      pitch: typeof saved.pitch === "number" ? saved.pitch : DEFAULT_SETTINGS.pitch,
      music: typeof saved.music === "boolean" ? saved.music : DEFAULT_SETTINGS.music,
      musicVolume: typeof saved.musicVolume === "number" ? saved.musicVolume : DEFAULT_SETTINGS.musicVolume,
      musicMood: typeof saved.musicMood === "string" ? saved.musicMood : "",
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveNarrationSettings(s: NarrationSettings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* 忽略 */ }
}

export const STYLE_PRESETS: { name: string; rate: number; pitch: number }[] = [
  { name: "沉静", rate: 0.72, pitch: 0.92 },
  { name: "平和", rate: 0.85, pitch: 1.0 },
  { name: "明快", rate: 1.0, pitch: 1.06 },
];

// 系统中文语音列表（异步加载）
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      setVoices(all.filter((v) => v.lang.toLowerCase().startsWith("zh")));
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  return voices;
}
