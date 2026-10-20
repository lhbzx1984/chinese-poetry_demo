import "./register.mjs";
import test from "node:test";
import assert from "node:assert/strict";

test("音频引擎导入不创建上下文；共享单例、音量钳制和声部限额", async () => {
  const { audioEngine, VoiceGate } = await import("../src/lib/audio-engine.ts");
  assert.equal(audioEngine.context(), null);
  let stopped = 0;
  const gate = new VoiceGate();
  assert.equal(gate.allow("pluck", 100), true);
  assert.equal(gate.allow("pluck", 150), false);
  assert.equal(gate.allow("pluck", 180), true);
  for (let i = 0; i < 7; i++) gate.add(() => stopped++);
  assert.equal(stopped, 1);
  gate.clear();
  assert.equal(stopped, 7);
});
