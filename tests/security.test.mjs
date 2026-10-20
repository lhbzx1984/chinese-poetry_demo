import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('滑动窗口拒绝超限，并在窗口过后恢复', async () => {
  const { rateLimit } = await import('../src/lib/rate-limit.ts');
  assert.equal(rateLimit('test', 1, 20).allowed, true);
  const denied = rateLimit('test', 1, 20);
  assert.equal(denied.allowed, false);
  assert.ok(denied.retryAfter >= 1);
  await new Promise(r => setTimeout(r, 30));
  assert.equal(rateLimit('test', 1, 20).allowed, true);
});
test('上传端点验证大小、类型、魔数、令牌、容量及元数据；播放支持后缀范围', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shijing-videos-'));
  process.env.VIDEOS_DIR = dir;
  process.env.MAX_VIDEO_MB = '0.02';
  process.env.RATE_LIMIT_UPLOAD = '100';
  process.env.ADMIN_TOKEN = 'test-token';
  const { POST } = await import('../src/app/api/videos/route.ts');
  const { GET, DELETE } = await import('../src/app/api/videos/[id]/route.ts');
  const valid = Buffer.alloc(10_001);
  valid.set([0x1a, 0x45, 0xdf, 0xa3]);
  const upload = (body = valid, headers = {}) => POST(new Request('http://localhost/api/videos?title=%01标题&author=%7f作者&duration=999', { method: 'POST', body, headers: { 'Content-Type': 'video/webm', ...headers } }));
  try {
    assert.equal((await upload(valid, { 'Content-Length': '999999' })).status, 413);
    assert.equal((await upload(Buffer.alloc(30_000))).status, 413);
    assert.equal((await upload(valid, { 'Content-Type': 'text/plain' })).status, 400);
    assert.equal((await upload(Buffer.alloc(10_001))).status, 400);
    process.env.REQUIRE_TOKEN_FOR_UPLOAD = 'true';
    assert.equal((await upload()).status, 401);
    const saved = await upload(valid, { Authorization: 'Bearer test-token' });
    assert.equal(saved.status, 200);
    const { data } = await saved.json();
    assert.equal(data.title, '标题'); assert.equal(data.author, '作者'); assert.equal(data.duration, 600);
    process.env.MAX_VIDEOS = '1';
    assert.equal((await upload(valid, { Authorization: 'Bearer test-token' })).status, 507);
    const context = { params: Promise.resolve({ id: data.id }) };
    const suffix = await GET(new Request('http://localhost', { headers: { Range: 'bytes=-4' } }), context);
    assert.equal(suffix.status, 206); assert.equal((await suffix.arrayBuffer()).byteLength, 4);
    assert.equal(suffix.headers.get('Content-Range'), `bytes 9997-10000/10001`);
    const bad = await GET(new Request('http://localhost', { headers: { Range: 'bytes=999999-' } }), context);
    assert.equal(bad.status, 416);
    assert.equal((await DELETE(new Request('http://localhost'), context)).status, 401);
    assert.equal((await DELETE(new Request('http://localhost', { headers: { Authorization: 'Bearer test-token' } }), context)).status, 200);
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    for (const key of ['VIDEOS_DIR', 'MAX_VIDEO_MB', 'RATE_LIMIT_UPLOAD', 'ADMIN_TOKEN', 'REQUIRE_TOKEN_FOR_UPLOAD', 'MAX_VIDEOS']) delete process.env[key];
  }
});
