"use client";
import { useId } from "react";
import { useAudio } from "./audio-controller";
import { ALL_MOOD_NAMES } from "@/lib/ambient-music";
import { Icon } from "./ui/icons";
export function SoundControl() {
  const audio = useAudio(),
    id = useId();
  if (!audio.supported) return null;
  return (
    <div className="sound-wrap">
      <button
        className="icon-button"
        aria-label="诗乐设置"
        aria-pressed={audio.enabled}
        popoverTarget={id}
        onClick={() => {
          if (audio.enabled) audio.setEnabled(true);
        }}
      >
        <Icon name={audio.enabled ? "speaker" : "muted"} />
      </button>
      <div id={id} className="sound-pop" popover="auto">
        <h2>听见诗境</h2>
        <button
          className="chip"
          aria-pressed={audio.enabled}
          onClick={() => audio.setEnabled(!audio.enabled)}
        >
          {audio.enabled ? "关闭诗乐" : "开启诗乐"}
        </button>
        <label>
          音乐
          <input
            aria-label="音乐音量"
            type="range"
            min="0"
            max="1"
            step=".05"
            value={audio.musicVolume}
            onChange={(e) => audio.setMusicVolume(Number(e.target.value))}
          />
        </label>
        <label>
          音效
          <input
            aria-label="音效音量"
            type="range"
            min="0"
            max="1"
            step=".05"
            value={audio.sfxVolume}
            onChange={(e) => audio.setSfxVolume(Number(e.target.value))}
          />
        </label>
        <label>
          意境
          <select
            aria-label="诗乐意境"
            value={audio.mood}
            onChange={(e) => audio.setMood(e.target.value)}
          >
            {ALL_MOOD_NAMES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          className="page-btn"
          onClick={() => audio.preview()}
          disabled={!audio.enabled}
        >
          试听八秒
        </button>
        <p className="sound-status" aria-live="polite">
          {audio.enabled
            ? "诗乐已选择开启；重新加载后需点击开启以恢复声音。"
            : "静音入境，诗意常在。"}
          阅读和影片使用各自的播放控制。
        </p>
      </div>
    </div>
  );
}
