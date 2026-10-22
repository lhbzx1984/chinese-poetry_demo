import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { ambientMusic, moodForPoem } = await import('../src/lib/ambient-music.ts');

test('配乐录制模式保持音频流但不连接扬声器，普通朗读仍可外放', async t => {
  const speakers = [];
  const destination = {};
  const node = () => ({connect(target) { if(target === destination) speakers.push(target); return target; }, disconnect() {}, start() {}, stop() {}, gain:{value:0,setTargetAtTime(){}},frequency:{value:0},detune:{value:0},Q:{value:0}});
  class Context {
    sampleRate = 10;
    currentTime = 0;
    destination = destination;
    async resume() {}
    createGain() { return node(); }
    createAnalyser() { return node(); }
    createConvolver() { return node(); }
    createOscillator() { return node(); }
    createBiquadFilter() { return node(); }
    createBufferSource() { return node(); }
    createBuffer(_channels,length) { return { getChannelData:()=>new Float32Array(length) }; }
    createMediaStreamDestination() { return { ...node(), stream:{audio:true} }; }
  }
  const oldWindow = globalThis.window;
  globalThis.window = {AudioContext:Context};
  t.after(()=> { ambientMusic.stop(0); if(oldWindow === undefined) delete globalThis.window; else globalThis.window=oldWindow; });
  const mood = moodForPoem('', '');
  await ambientMusic.start(mood, false);
  assert.ok(ambientMusic.getCaptureStream());
  assert.equal(speakers.length, 0);
  await ambientMusic.start(mood);
  assert.equal(speakers.length, 1);
});
