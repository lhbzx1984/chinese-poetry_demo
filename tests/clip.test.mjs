import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { generatePoemClip, waitForClipImages } = await import('../src/lib/clip.ts');

// Node 没有浏览器媒体设备；仅替换媒体边界，执行真实合成流程。
function mediaHarness(t, fail = false) {
  let time = 0;
  const tracks = [];
  const track = kind => { const value = { kind, stopped: false, stop() { this.stopped = true; } }; tracks.push(value); return value; };
  class Stream {
    constructor(items) { this.items = items; }
    getTracks() { return this.items; }
    getAudioTracks() { return this.items.filter(t => t.kind === 'audio'); }
    addTrack(track) { this.items.push(track); }
  }
  const music = new Stream([track('audio')]);
  const contexts = [];
  const texts = [];
  const speakerConnections = [];
  const node = () => ({ connect(target) { if (target?.speaker) speakerConnections.push(target); for (const track of target.stream?.getAudioTracks() ?? []) track.input = true; return target; }, disconnect() {}, gain: { value: 1 }, start() {} });
  class Audio {
    constructor() { this.currentTime = 0; this.destination = { speaker: true }; this.state = 'running'; contexts.push(this); }
    async resume() {}
    async close() { this.state = 'closed'; }
    createMediaStreamDestination() { return { stream: new Stream([track('audio')]) }; }
    createMediaStreamSource() { return node(); }
    createBufferSource() { return node(); }
    createGain() { return node(); }
    async decodeAudioData() { return { duration: 1 }; }
  }
  class Canvas {
    getContext() { return new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), fillText: text => texts.push(text) }, { get: (o, p) => o[p] ?? (() => {}) }); }
    captureStream() { return new Stream([track('video')]); }
  }
  class Recorder {
    static isTypeSupported() { return true; }
    constructor(stream) { this.stream = stream; this.state = 'inactive'; }
    start() {
      if (this.stream.getAudioTracks().length > 1) throw new Error('multiple audio tracks');
      this.state = 'recording';
      if (fail) queueMicrotask(() => { this.state = 'inactive'; this.onerror?.({ error: new Error('encoder failed') }); this.onstop?.(); });
    }
    stop() { this.state = 'inactive'; this.ondataavailable({ data: this.stream.getAudioTracks().some(t => !t.input) ? new Blob() : new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), new Uint8Array(10000)]) }); this.onstop(); }
  }
  const globals = { window: { matchMedia: () => ({ matches: false }) }, document: { createElement: () => new Canvas() }, Image: class { width = 1280; height = 720; async decode() {} }, AudioContext: Audio, HTMLCanvasElement: Canvas, MediaRecorder: Recorder, requestAnimationFrame: callback => { time += 1000; return setImmediate(callback); }, cancelAnimationFrame: clearImmediate };
  for (const [key, value] of Object.entries(globals)) { const original = Object.getOwnPropertyDescriptor(globalThis, key); Object.defineProperty(globalThis, key, { value, configurable: true }); t.after(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]); }
  t.mock.method(performance, 'now', () => time);
  return { music, contexts, tracks, texts, speakerConnections };
}

const exp = { poem: { title: '静夜思', author: '李白', dynasty: '唐' }, scenes: [{ lines: ['床前明月光。'] }] };
test('配乐和旁白混成单一音轨，成功后释放录制设备，保留外部配乐流', async t => {
  const { music, contexts, tracks } = mediaHarness(t);
  const { blob, total } = await generatePoemClip({ exp, images: ['/scenes/moon.webp'], musicStream: music, narrations: [{ sceneIndex: 0, mp3: new ArrayBuffer(1) }] });
  assert.ok(blob.size > 10000);
  assert.ok(total >= 5);
  assert.equal(contexts[0].state, 'closed');
  assert.ok(tracks.slice(1).every(t => t.stopped));
  assert.equal(music.getAudioTracks()[0].stopped, false);
});

test('录制器异步失败时返回错误并释放设备，不停留在合成中', { timeout: 2000 }, async t => {
  const { contexts, tracks } = mediaHarness(t, true);
  await assert.rejects(generatePoemClip({ exp, images: ['/scenes/moon.webp'], musicStream: null, narrations: [] }), /encoder failed/);
  assert.equal(contexts[0].state, 'closed');
  assert.ok(tracks.slice(1).every(t => t.stopped));
});

test('旁白失败且配乐关闭时，不附加没有音频输入的空音轨', async t => {
  mediaHarness(t);
  const { blob } = await generatePoemClip({ exp, images: ['/scenes/moon.webp'], musicStream: null, narrations: [] });
  assert.ok(blob.size > 10000);
});

test('取消合成后释放音轨和音频上下文', async t => {
  const { contexts, tracks } = mediaHarness(t);
  const controller = new AbortController();
  const pending = generatePoemClip({ exp, images: ['/scenes/moon.webp'], musicStream: null, narrations: [], signal: controller.signal });
  queueMicrotask(() => controller.abort());
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(contexts[0].state, 'closed');
  assert.ok(tracks.slice(1).every(t => t.stopped));
});

for (const poem of [{ title: '题西林壁', author: '苏轼', dynasty: '宋', line: '横看成岭侧成峰。' }, { title: '关雎', author: '佚名', dynasty: '先秦', line: '关关雎鸠，在河之洲。' }]) {
  test(`通用短片流程支持${poem.dynasty}代《${poem.title}》，使用对应标题与字幕`, async t => {
    const { texts } = mediaHarness(t);
    const { blob } = await generatePoemClip({ exp: { poem, scenes: [{ lines: [poem.line] }] }, images: ['/scenes/river.webp'], musicStream: null, narrations: [] });
    assert.ok(blob.size > 10000);
    assert.ok(texts.includes(poem.title));
    assert.ok(texts.includes(`${poem.dynasty} · ${poem.author}`));
    assert.ok(texts.includes(poem.line));
  });
}

test('合成时朗诵只写入视频音轨，不提前从扬声器播放', async t => {
  const { speakerConnections } = mediaHarness(t);
  await generatePoemClip({ exp, images: ['/scenes/moon.webp'], musicStream: null, narrations: [{ sceneIndex: 0, mp3: new ArrayBuffer(1) }] });
  assert.equal(speakerConnections.length, 0);
});

test('等待配音时并行加载所有画面，音画都就绪才开始录制', async t => {
  mediaHarness(t);
  const loaded = [];
  t.mock.method(Image.prototype, 'decode', async function () { loaded.push(this.src); });
  let release;
  const narrations = new Promise(resolve => { release = resolve; });
  let recording = false;
  const pending = generatePoemClip({
    exp: { ...exp, scenes: [exp.scenes[0], exp.scenes[0]] },
    images: ['/one.webp', '/two.webp'], musicStream: null, narrations,
    onRecording: () => { recording = true; },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(loaded, ['/one.webp', '/two.webp']);
  assert.equal(recording, false);
  release([{ sceneIndex: 0, mp3: new ArrayBuffer(1) }, { sceneIndex: 1, mp3: new ArrayBuffer(1) }]);
  assert((await pending).blob.size > 10000);
  assert.equal(recording, true);
});

test('录制前重新读取逐幕 AI 配图，缺图不再静默替换为重复背景', async t => {
  const scenes = [{ index: 0, text: '月明。' }, { index: 1, text: '江水。' }];
  const experience = { poem: { id: 123 }, scenes };
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: {
    scenes, images: [{ index: 1, status: 'ready', url: '/new-1.jpg' }, { index: 0, status: 'ready', url: '/new-0.jpg' }],
  } }));
  assert.deepEqual(await waitForClipImages(experience, new AbortController().signal, () => {}), ['/new-0.jpg', '/new-1.jpg']);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: { scenes, images: [{ index: 0, status: 'idle' }, { index: 1, status: 'idle' }] } }));
  await assert.rejects(waitForClipImages(experience, new AbortController().signal, () => {}), /不会用同一张/);
});

test('图片解码卡住时，取消仍立即退出并释放音频上下文', async t => {
  const { contexts } = mediaHarness(t);
  t.mock.method(Image.prototype, 'decode', () => new Promise(() => {}));
  const controller = new AbortController();
  const pending = generatePoemClip({ exp, images: ['/stuck.webp'], musicStream: null, narrations: [], signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(contexts[0].state, 'closed');
});

test('配图请求返回前取消，不再覆盖进度或继续轮询', async t => {
  const controller = new AbortController();
  let progress = 0;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => {
    controller.abort();
    return { data: { scenes: [], images: [] } };
  } }));
  await assert.rejects(waitForClipImages({ poem: { id: 1 }, scenes: [] }, controller.signal, () => progress++), { name: 'AbortError' });
  assert.equal(progress, 0);
});
