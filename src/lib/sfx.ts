import { audioEngine } from "./audio-engine";
export type SfxName =
  "pluck" | "drop" | "knock" | "bell" | "chime" | "paper" | "ink";
export function playSfx(
  name: SfxName,
  opts: { note?: number; volume?: number; root?: number } = {},
) {
  const ctx = audioEngine.context(),
    bus = audioEngine.sfx;
  if (
    !ctx ||
    !bus ||
    ctx.state !== "running" ||
    bus.gain.value <= 0 ||
    !audioEngine.gate.allow(name)
  )
    return;
  const nodes: AudioScheduledSourceNode[] = [];
  const output = ctx.createGain();
  output.gain.value = Math.min(1, Math.max(0, opts.volume ?? 1)) * 0.2;
  output.connect(bus);
  const send = name === "pluck" && audioEngine.reverb ? ctx.createGain() : null;
  if (send && audioEngine.reverb) {
    send.gain.value = 0.3;
    output.connect(send).connect(audioEngine.reverb);
  }
  const now = ctx.currentTime,
    root = opts.root || 146.83;
  const tone = (
    freq: number,
    duration: number,
    delay = 0,
    gain = 0.3,
    type: OscillatorType = "sine",
    end?: number,
  ) => {
    const osc = ctx.createOscillator(),
      env = ctx.createGain(),
      lp = ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + delay);
    if (end)
      osc.frequency.exponentialRampToValueAtTime(end, now + delay + 0.09);
    lp.type = "lowpass";
    lp.frequency.value = 1800;
    env.gain.setValueAtTime(0, now + delay);
    env.gain.linearRampToValueAtTime(gain, now + delay + 0.008);
    env.gain.exponentialRampToValueAtTime(
      0.0001,
      now + delay + duration - 0.01,
    );
    env.gain.linearRampToValueAtTime(0, now + delay + duration);
    osc.connect(lp).connect(env).connect(output);
    osc.start(now + delay);
    osc.stop(now + delay + duration);
    nodes.push(osc);
  };
  const noise = (duration: number, high = false) => {
    const source = ctx.createBufferSource(),
      buffer = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * duration),
        ctx.sampleRate,
      );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] =
        (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / data.length) * 0.08;
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = high ? "highpass" : "bandpass";
    filter.frequency.value = high ? 2200 : 800;
    filter.Q.value = 8;
    source.connect(filter).connect(output);
    source.start();
    nodes.push(source);
  };
  if (name === "pluck")
    tone(
      root * 2 * Math.pow(2, (opts.note ?? 0) / 12),
      1.2,
      0,
      0.45,
      "triangle",
    );
  if (name === "drop") tone(1200, 0.35, 0, 0.4, "sine", 320);
  if (name === "knock") {
    noise(0.05);
    tone(400, 0.06);
  }
  if (name === "paper") noise(0.15, true);
  if (name === "bell")
    [1, 2.76, 5.4, 8.93].forEach((ratio, i) =>
      tone(root * ratio, 2, 0, 0.23 / (i + 1)),
    );
  if (name === "chime")
    [0, 2, 4, 7, 9].forEach((note, i) =>
      tone(root * 2 * Math.pow(2, note / 12), 0.7, i * 0.075, 0.25),
    );
  if (name === "ink") {
    tone(90, 0.2, 0, 0.4);
    tone(1200, 0.35, 0, 0.15, "sine", 320);
  }
  const stop = () => {
    output.gain.setTargetAtTime(0, ctx.currentTime, 0.008);
    for (const node of nodes) {
      try {
        node.stop(ctx.currentTime + 0.04);
      } catch {
        /* 已结束 */
      }
    }
  };
  const release = audioEngine.gate.add(stop);
  const last = nodes[nodes.length - 1];
  if (last)
    last.onended = () => {
      release();
      output.disconnect();
      send?.disconnect();
    };
}
