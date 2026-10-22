import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { MsEdgeTTS } from 'msedge-tts';
import { synthesizeEdge } from '../src/lib/edge-tts.ts';

test('语音连接或音频流不响应时有超时并关闭连接', { timeout: 2000 }, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let closes = 0;
  t.mock.method(MsEdgeTTS.prototype, 'setMetadata', async () => {});
  t.mock.method(MsEdgeTTS.prototype, 'toStream', () => ({ audioStream: new Readable({ read() {} }) }));
  t.mock.method(MsEdgeTTS.prototype, 'close', () => { closes++; });
  const result = assert.rejects(synthesizeEdge('zh-CN-XiaoxiaoNeural', `timeout-${Date.now()}`, 0, 1), /超时/);
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setImmediate(r));
    t.mock.timers.tick(20_000);
  }
  await result;
  assert.equal(closes, 2);
});
