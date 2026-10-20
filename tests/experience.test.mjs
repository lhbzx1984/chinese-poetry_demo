import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

test('AI仅新任务消耗限流额度，缓存命中和未配置AI仍可读取', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shijing-ai-'));
  const cwd = process.cwd();
  const originalFetch = globalThis.fetch;
  process.chdir(dir);
  process.env.POETRY_DB_PATH = path.join(dir, 'poetry.db');
  process.env.AGNES_API_KEY = 'test-only';
  process.env.TEXT_MODEL = '';
  process.env.RATE_LIMIT_AI = '1';
  const fixture = new DatabaseSync(process.env.POETRY_DB_PATH);
  fixture.exec(`CREATE TABLE poems(id INTEGER PRIMARY KEY,title TEXT,subtitle TEXT,author TEXT,dynasty TEXT,collection TEXT,first_line TEXT,tag_json TEXT,lines_json TEXT);
    INSERT INTO poems VALUES(1,'静夜思',NULL,'李白','唐','tangshi','床前明月光','[]','["床前明月光，疑是地上霜。","举头望明月，低头思故乡。"]');
    INSERT INTO poems SELECT 2,title,subtitle,author,dynasty,collection,first_line,tag_json,lines_json FROM poems WHERE id=1;`);
  fixture.close();
  const legacy = path.join(dir, 'data', 'generated', '1');
  fs.mkdirSync(legacy, { recursive: true });
  fs.writeFileSync(path.join(legacy, '0.jpg'), Buffer.alloc(1001));
  fs.writeFileSync(path.join(legacy, 'analysis.json'), JSON.stringify({ scenes: [{ yi: '旧分镜整联译文', jian: '' }] }));
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ data: [{ b64_json: Buffer.alloc(1001, 7).toString('base64') }] });
  };
  const { GET } = await import('../src/app/api/poems/[id]/experience/route.ts');
  const { getDb } = await import('../src/lib/db.ts');
  const { imageStatuses } = await import('../src/lib/imagegen.ts');
  const { GET: imageGet } = await import('../src/app/api/images/[id]/[index]/route.ts');
  const request = new Request('http://localhost/api/poems/1/experience', { headers: { 'x-forwarded-for': 'cache-test' } });
  const context = id => ({ params: Promise.resolve({ id: String(id) }) });
  try {
    const first = await GET(request, context(1));
    assert.equal(first.status, 200);
    const { data } = await first.json();
    assert.equal(data.scenes[0].translation, null, '旧分镜译文不得配到新分镜');
    for (let i = 0; i < 100 && imageStatuses(data.poem, data.scenes.length).running; i++) await new Promise(r => setImmediate(r));
    const cached = await GET(request, context(1));
    assert.equal(cached.status, 200);
    const cachedData = (await cached.json()).data;
    assert.equal(cachedData.imagesCached, true);
    assert.match(cachedData.images[0].url, /v=scenes2_/);
    const image = await imageGet(request, { params: Promise.resolve({ id: '1', index: '0' }) });
    assert.equal(image.status, 200);
    assert.equal(new Uint8Array(await image.arrayBuffer())[0], 7, '读图路由必须定位当前分镜缓存');
    assert.equal(calls, 4);
    const denied = await GET(request, context(2));
    assert.equal(denied.status, 429);
    assert.ok(Number(denied.headers.get('Retry-After')) > 0);
    delete process.env.AGNES_API_KEY;
    assert.equal((await GET(request, context(2))).status, 200);
    assert.equal(calls, 4);
  } finally {
    getDb().close();
    globalThis.fetch = originalFetch;
    process.chdir(cwd);
    for (const key of ['POETRY_DB_PATH', 'AGNES_API_KEY', 'TEXT_MODEL', 'RATE_LIMIT_AI']) delete process.env[key];
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
