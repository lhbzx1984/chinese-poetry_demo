// 生成式意境背景音乐：Web Audio 实时合成，无需任何音频文件。
// 三层结构：持续和声铺底（可闻的底色）+ 古琴式五声音阶拨弦 + 风声氛围，
// 按诗的视觉规范自动匹配情绪；朗读时仅温和压低（×0.75），停止即淡出。
// window.__shijingMusic.level() 可读取实时电平（RMS），便于确认音乐确在发声。

export type MusicMood = {
  name: string;
  root: number; // 主音频率 Hz
  scale: number[]; // 半音阶上的五声音阶
  pluckEvery: [number, number]; // 拨弦间隔秒范围
  wind: number; // 风声强度 0-1
  padGain: number; // 和声铺底音量
  pluckGain: number; // 拨弦音量
};

const MOODS: { match: string; mood: MusicMood }[] = [
  { match: "月夜青蓝", mood: { name: "月夜清泉", root: 146.83, scale: [0, 3, 5, 7, 10], pluckEvery: [2.0, 3.8], wind: 0.14, padGain: 0.1, pluckGain: 0.26 } },
  { match: "塞外苍黄", mood: { name: "大漠孤烟", root: 98.0, scale: [0, 2, 5, 7, 9], pluckEvery: [2.4, 4.2], wind: 0.45, padGain: 0.12, pluckGain: 0.24 } },
  { match: "春晓青绿", mood: { name: "春风溪流", root: 164.81, scale: [0, 2, 4, 7, 9], pluckEvery: [1.4, 2.8], wind: 0.1, padGain: 0.09, pluckGain: 0.24 } },
  { match: "雪夜冷灰", mood: { name: "霜天寥落", root: 130.81, scale: [0, 3, 5, 7, 10], pluckEvery: [2.6, 4.6], wind: 0.24, padGain: 0.09, pluckGain: 0.2 } },
  { match: "水墨烟白", mood: { name: "空山禅意", root: 130.81, scale: [0, 2, 5, 7, 9], pluckEvery: [2.4, 4.4], wind: 0.12, padGain: 0.1, pluckGain: 0.2 } },
  { match: "闺阁绛红", mood: { name: "烛影红妆", root: 174.61, scale: [0, 2, 5, 7, 9], pluckEvery: [1.6, 3.0], wind: 0.06, padGain: 0.09, pluckGain: 0.22 } },
  { match: "宫阙暗金", mood: { name: "宫阙深沉", root: 110.0, scale: [0, 3, 5, 8, 10], pluckEvery: [2.2, 4.0], wind: 0.1, padGain: 0.13, pluckGain: 0.26 } },
  { match: "秋暮金橙", mood: { name: "秋暮长天", root: 146.83, scale: [0, 2, 5, 7, 9], pluckEvery: [1.8, 3.4], wind: 0.16, padGain: 0.1, pluckGain: 0.22 } },
];
const DEFAULT_MOOD: MusicMood = { name: "山水清音", root: 146.83, scale: [0, 2, 5, 7, 9], pluckEvery: [1.8, 3.6], wind: 0.14, padGain: 0.1, pluckGain: 0.22 };

export function moodForPoem(paletteZh: string, moodZh: string): MusicMood {
  const hit = MOODS.find((m) => paletteZh.includes(m.match));
  if (hit) return hit.mood;
  if (moodZh.includes("边塞") || moodZh.includes("金戈")) return MOODS[1].mood;
  if (moodZh.includes("禅")) return MOODS[4].mood;
  return DEFAULT_MOOD;
}

// 按名称取意境（设置面板手动选择用）
export function moodByName(name: string): MusicMood | null {
  return MOODS.find((m) => m.mood.name === name)?.mood ?? (name === DEFAULT_MOOD.name ? DEFAULT_MOOD : null);
}
export const ALL_MOOD_NAMES = [...MOODS.map((m) => m.mood.name), DEFAULT_MOOD.name];

const DUCK_FACTOR = 0.75;

// 程序生成混响脉冲响应：指数衰减的立体声噪声
function makeImpulseResponse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
} // 朗读时音乐仅温和压低

class AmbientMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private probe: Uint8Array<ArrayBuffer> | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private reverb: ConvolverNode | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private mood: MusicMood = DEFAULT_MOOD;
  private volume = 0.45;
  private _playing = false;
  private _duck = false;

  get playing() { return this._playing; }
  get moodName() { return this.mood.name; }

  // 供录制短片使用：把当前配乐输出为可录制的音频流（需先 start）
  getCaptureStream(): MediaStream | null {
    if (!this.ctx || !this.master || !this._playing) return null;
    if (!this.dest) {
      this.dest = this.ctx.createMediaStreamDestination();
      this.master.connect(this.dest);
    }
    return this.dest.stream;
  }
  // 录制流的目的节点：外部音频（旁白）接入它即可一并录入
  captureDest(): MediaStreamAudioDestinationNode | null {
    if (!this.ctx || !this.master || !this._playing) return null;
    if (!this.dest) {
      this.dest = this.ctx.createMediaStreamDestination();
      this.master.connect(this.dest);
    }
    return this.dest;
  }
  context(): AudioContext | null {
    return this.ctx;
  }

  // 当前输出电平（RMS 0-1），用于确认音乐确实在响
  level(): number {
    if (!this.analyser || !this.probe || !this._playing) return 0;
    this.analyser.getByteTimeDomainData(this.probe);
    let sum = 0;
    for (let i = 0; i < this.probe.length; i++) {
      const v = (this.probe[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / this.probe.length);
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) {
      const target = this._duck ? this.volume * DUCK_FACTOR : this.volume;
      this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.5);
    }
  }

  setDuck(on: boolean) {
    if (this._duck === on) return;
    this._duck = on;
    this.setVolume(this.volume);
  }

  async start(mood: MusicMood) {
    this.stopNow(0.3);
    this.mood = mood;
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = this.ctx ?? new AC();
    try { await this.ctx.resume(); } catch { /* 某些浏览器需在手势里 resume，narrate/试听 均为点击链路 */ }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.probe = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
    this.master.connect(this.analyser);
    this.analyser.connect(ctx.destination);
    this.master.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.8);
    this._playing = true;
    this._duck = false;

    // 混响总线：程序生成的脉冲响应，给拨弦与铺底空间感
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeImpulseResponse(ctx, 2.2, 3.2);
    const revGain = ctx.createGain();
    revGain.gain.value = 0.55;
    this.reverb.connect(revGain).connect(this.master);

    // 一层：和声铺底（主音+五度+高八度，缓慢呼吸的持续音，让音乐始终可闻）
    for (const [i, mult] of [1, 1.5, 2].entries()) {
      const osc = ctx.createOscillator();
      osc.type = i === 2 ? "sine" : "triangle";
      osc.frequency.value = mood.root * mult;
      osc.detune.value = i * 4 - 4;
      const g = ctx.createGain();
      const base = mood.padGain * (i === 0 ? 1 : i === 1 ? 0.55 : 0.3);
      g.gain.value = base;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.045 + i * 0.025;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = base * 0.6;
      lfo.connect(lfoGain).connect(g.gain);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      osc.connect(g).connect(lp).connect(this.master);
      const send = ctx.createGain();
      send.gain.value = 0.25;
      lp.connect(send).connect(this.reverb);
      osc.start();
      lfo.start();
      this.sources.push(osc, lfo);
    }

    // 二层：风声（带通噪声，缓慢游移）
    if (mood.wind > 0.01) {
      const len = ctx.sampleRate * 4;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { last = last * 0.98 + (Math.random() * 2 - 1) * 0.02; data[i] = last * 8; }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 480;
      bp.Q.value = 0.6;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain).connect(bp.frequency);
      const g = ctx.createGain();
      g.gain.value = mood.wind * 0.7;
      src.connect(bp).connect(g).connect(this.master);
      src.start();
      lfo.start();
      this.sources.push(src, lfo);
    }

    this.schedulePluck();
  }

  // 三层：古琴式拨弦（五声音阶随机游走，偶带双音）
  private schedulePluck() {
    if (!this._playing || !this.ctx || !this.master) return;
    const [lo, hi] = this.mood.pluckEvery;
    const delay = (lo + Math.random() * (hi - lo)) * 1000;
    const t = setTimeout(() => {
      if (!this._playing || !this.ctx || !this.master) return;
      // 步进游走：更接近人手弹奏的旋律走向
      this.stepIdx = Math.max(0, Math.min(9, this.stepIdx + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.7 ? 1 : 2)));
      const step = this.mood.scale[this.stepIdx % this.mood.scale.length];
      const octave = this.stepIdx >= this.mood.scale.length ? 4 : 2;
      this.pluck(this.mood.root * octave * Math.pow(2, step / 12), this.mood.pluckGain);
      if (Math.random() < 0.28) {
        const step2 = this.mood.scale[Math.floor(Math.random() * this.mood.scale.length)];
        setTimeout(() => { if (this._playing) this.pluck(this.mood.root * 2 * Math.pow(2, step2 / 12), this.mood.pluckGain * 0.6); }, 260);
      }
      this.schedulePluck();
    }, delay);
    this.timers.push(t);
  }

  private stepIdx = 4;

  // Karplus-Strong 物理合成拨弦：噪声激励 + 延迟线反馈，音色接近真实弦振
  private pluck(freq: number, gain0: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.reverb) return;
    const sampleRate = ctx.sampleRate;
    const dur = 3.2;
    const len = Math.floor(sampleRate * dur);
    const buf = ctx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    const period = Math.max(2, Math.round(sampleRate / freq));
    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const cur = ring[idx];
      const nxt = ring[(idx + 1) % period];
      ring[idx] = (cur + nxt) * 0.5 * 0.9965;
      data[i] = cur;
      idx = (idx + 1) % period;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain0;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    src.connect(lp).connect(g);
    g.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.5;
    g.connect(send).connect(this.reverb);
    src.start();
    src.stop(ctx.currentTime + dur);
    this.sources.push(src);
  }

  stop(fade = 0.5) {
    this.stopNow(fade);
  }

  private stopNow(fade: number) {
    this._playing = false;
    this._duck = false;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    const ctx = this.ctx;
    if (!ctx) return;
    const master = this.master;
    const sources = this.sources;
    const dest = this.dest;
    this.sources = [];
    this.master = null;
    this.dest = null;
    if (master) {
      master.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.05, fade / 3));
      setTimeout(() => {
        for (const s of sources) { try { s.stop(); } catch { /* noop */ } }
        try { master.disconnect(); } catch { /* noop */ }
        try { dest?.disconnect(); } catch { /* noop */ }
      }, fade * 1000 + 500);
    } else {
      for (const s of sources) { try { s.stop(); } catch { /* noop */ } }
    }
  }
}

export const ambientMusic = new AmbientMusic();
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__shijingMusic = ambientMusic;
}
