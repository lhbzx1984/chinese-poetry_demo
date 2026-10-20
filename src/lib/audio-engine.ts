// 仅真实手势解锁时建立一个播放上下文；阅读、首页及录制共用。
export class VoiceGate {
  private last = new Map<string, number>();
  private voices: (() => void)[] = [];
  allow(name: string, now = performance.now()) {
    if (now - (this.last.get(name) ?? -Infinity) < 80) return false;
    this.last.set(name, now);
    return true;
  }
  add(stop: () => void) {
    if (this.voices.length >= 6) this.voices.shift()?.();
    this.voices.push(stop);
    return () => {
      this.voices = this.voices.filter((v) => v !== stop);
    };
  }
  clear() {
    this.voices.splice(0).forEach((stop) => stop());
  }
}
class AudioEngine {
  private ctx: AudioContext | null = null;
  music: GainNode | null = null;
  sfx: GainNode | null = null;
  master: GainNode | null = null;
  reverb: ConvolverNode | null = null;
  private analyser: AnalyserNode | null = null;
  private probe: Float32Array<ArrayBuffer> | null = null;
  readonly gate = new VoiceGate();
  private fxVolume = 0.5;
  context() {
    return this.ctx;
  }
  supported() {
    return (
      typeof window !== "undefined" &&
      Boolean(
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: unknown })
          .webkitAudioContext,
      )
    );
  }
  async unlock() {
    if (!this.supported()) return null;
    if (!this.ctx) {
      if (navigator.userActivation && !navigator.userActivation.isActive)
        return null;
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AC();
      this.ctx = ctx;
      this.music = ctx.createGain();
      this.sfx = ctx.createGain();
      this.master = ctx.createGain();
      this.sfx.gain.value = this.fxVolume;
      this.master.gain.value = 0.5;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.01;
      compressor.release.value = 0.25;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.probe = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.reverb = ctx.createConvolver();
      const impulse = ctx.createBuffer(
        2,
        Math.ceil(ctx.sampleRate * 1.2),
        ctx.sampleRate,
      );
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < data.length; i++)
          data[i] =
            (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3) * 0.25;
      }
      this.reverb.buffer = impulse;
      this.reverb.connect(this.sfx);
      this.master
        .connect(compressor)
        .connect(this.analyser)
        .connect(ctx.destination);
    }
    try {
      if (this.ctx.state === "suspended" && !document.hidden)
        await this.ctx.resume();
    } catch {
      return null;
    }
    return this.ctx;
  }
  setSfxVolume(value: number) {
    this.fxVolume = Math.max(0, Math.min(1, value));
    if (this.ctx && this.sfx)
      this.sfx.gain.setTargetAtTime(this.fxVolume, this.ctx.currentTime, 0.03);
    if (!this.fxVolume) this.gate.clear();
  }
  stopSfx() {
    this.gate.clear();
  }
  async visibility(hidden: boolean) {
    if (!this.ctx) return;
    try {
      if (hidden) {
        this.stopSfx();
        await this.ctx.suspend();
      } else await this.ctx.resume();
    } catch {
      /* 浏览器仍可能要求下一次手势 */
    }
  }
  level() {
    if (!this.analyser || !this.probe || this.ctx?.state !== "running")
      return 0;
    this.analyser.getFloatTimeDomainData(this.probe);
    return Math.sqrt(
      this.probe.reduce((sum, v) => sum + v * v, 0) / this.probe.length,
    );
  }
  state() {
    return {
      state: this.ctx?.state || "locked",
      peakTarget: 0.5,
      sampleRate: this.ctx?.sampleRate || 0,
    };
  }
}
export const audioEngine = new AudioEngine();
