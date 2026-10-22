import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { synthesizeClipNarrations } = await import('../src/lib/clip.ts');

test('短片逐幕朗读原文，保留用户所选在线音色，缺失配音立即报错', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return new Response(new Uint8Array(2001), { headers: { 'Content-Type': 'audio/mpeg' } });
  });
  const scenes = [{ lines: ['春花秋月何时了？', '往事知多少。'] }, { lines: ['问君能有几多愁？', '恰似一江春水向东流。'] }];
  const settings = { edgeVoice: 'zh-CN-XiaoxiaoNeural', pitch: 1, rate: 0.85 };
  const result = await synthesizeClipNarrations(scenes, settings, new AbortController().signal, () => {});
  assert.deepEqual(result.map(n => n.sceneIndex), [0, 1]);
  assert.ok(calls.every(c => c.voice === settings.edgeVoice));
  assert.deepEqual(calls.map(c => c.text), scenes.map(s => s.lines.join('\n')));
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: '豆包配音额度不足' }, { status: 503 }));
  await assert.rejects(synthesizeClipNarrations(scenes, settings, new AbortController().signal, () => {}), /第 1 幕.*豆包配音额度不足/);
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array(), { headers: { 'Content-Type': 'audio/mpeg' } }));
  await assert.rejects(synthesizeClipNarrations(scenes, settings, new AbortController().signal, () => {}), /第 1 幕.*音频/);
});

test('三幕并行合成，保持字幕顺序且不超过三个同时请求', async t => {
  let running = 0;
  let peak = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    running++;
    peak = Math.max(peak, running);
    await new Promise(resolve => setTimeout(resolve, 10));
    running--;
    return new Response(new Uint8Array(2001), { headers: { 'Content-Type': 'audio/mpeg' } });
  });
  const result = await synthesizeClipNarrations(Array.from({length: 5}, () => ({lines:['诗句。']})), {edgeVoice:'',pitch:1,rate:0.85}, new AbortController().signal, () => {});
  assert.equal(peak, 3);
  assert.deepEqual(result.map(n => n.sceneIndex), [0,1,2,3,4]);
});

test('一幕失败后取消同批请求，不再继续生成其余幕或更新进度', async t => {
  let calls = 0;
  const progress = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const index = calls++;
    if (index === 0) return Response.json({error:'服务不可用'}, {status:503});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(resolve,30);
      init.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(init.signal.reason);},{once:true});
    });
    return new Response(new Uint8Array(2001), {headers:{'Content-Type':'audio/mpeg'}});
  });
  await assert.rejects(synthesizeClipNarrations(Array.from({length:6},()=>({lines:['诗句。']})),{edgeVoice:'',pitch:1,rate:0.85},new AbortController().signal,stage=>progress.push(stage)),/第 1 幕/);
  const completed=progress.length;
  await new Promise(resolve=>setTimeout(resolve,70));
  assert.equal(calls,3,'失败后不得继续消耗剩余幕的配音额度');
  assert.equal(progress.length,completed,'失败后不得覆盖界面的错误状态');
});
