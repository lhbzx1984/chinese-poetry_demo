import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

test('豆包已开通的音频生成服务贯通语音端点，缓存重复请求并拒绝错误音频', async () => {
  const cwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shijing-doubao-'));
  const originalFetch = globalThis.fetch;
  process.chdir(dir);
  process.env.DOUBAO_API_KEY = 'test-only';
  const { POST } = await import('../src/app/api/tts/route.ts');
  const audio = Buffer.alloc(2000, 1);
  audio.set(Buffer.from('ID3'));
  let calls = 0;
  let response = () => Response.json({ audio: audio.toString('base64'), duration: 3 });
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://openspeech.bytedance.com/api/v3/tts/create');
    assert.equal(init.headers['X-Api-Key'], 'test-only');
    const p = JSON.parse(init.body);
    assert.equal(p.model, 'seed-audio-1.0');
    assert.equal(p.references[0].speaker, 'zh_female_vv_uranus_bigtts');
    assert.equal(p.audio_config.format, 'mp3');
    assert.equal(p.audio_config.speech_rate, -15);
    assert.equal(p.audio_config.pitch_rate, 3);
    assert.match(p.text_prompt, /只朗读/);
    assert.match(p.text_prompt, /五言.*二三/);
    assert.match(p.text_prompt, /七言.*四三/);
    assert.match(p.text_prompt, /词.*语意/);
    assert.match(p.text_prompt, /情感/);
    assert.match(p.text_prompt, /不.*拆开词语/);
    return response();
  };
  const request = text => POST(new Request('http://localhost/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice: 'zh_female_vv_uranus_bigtts', rate: 0.85, pitch: 12 }) }));
  try {
    const [first, duplicate] = await Promise.all([request('床前看月光'), request('床前看月光')]);
    assert.equal(first.status, 200);
    assert.equal(duplicate.status, 200);
    assert.equal(first.headers.get('Content-Type'), 'audio/mpeg');
    assert.equal(first.headers.get('X-TTS-Provider'), 'doubao');
    assert.deepEqual(Buffer.from(await first.arrayBuffer()), audio);
    assert.equal(calls, 1, '并发相同请求不得重复计费');
    assert.equal((await request('床前看月光')).status, 200);
    assert.equal(calls, 1, '缓存命中不再联网');
    response = () => Response.json({ audio: Buffer.alloc(2000).toString('base64') });
    assert.equal((await request('无效音频')).status, 503);
    response = () => new Response(JSON.stringify({ header: { code: 45000030, message: 'requested resource not granted' } }), { status: 403 });
    const denied = await request('权限不足');
    assert.equal(denied.status, 503);
    assert.match((await denied.json()).error, /未授权/);
    response = () => new Response(JSON.stringify({ code: 55000000, message: 'internal error' }));
    assert.equal((await request('业务失败')).status, 503);
    assert.equal(fs.readdirSync(path.join(dir, 'data', 'tts-cache')).length, 1, '失败或截断音频不写缓存');
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(cwd);
    delete process.env.DOUBAO_API_KEY;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
