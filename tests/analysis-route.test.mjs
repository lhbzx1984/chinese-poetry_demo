import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

test('译注端点区分未配置、处理中、成功和失败，独立文本密钥不触发配图', async () => {
  const cwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shijing-text-route-'));
  const originalFetch = globalThis.fetch;
  process.chdir(dir);
  process.env.POETRY_DB_PATH = path.join(dir, 'poetry.db');
  const fixture = new DatabaseSync(process.env.POETRY_DB_PATH);
  fixture.exec(`CREATE TABLE poems(id INTEGER PRIMARY KEY,title TEXT,subtitle TEXT,author TEXT,dynasty TEXT,collection TEXT,first_line TEXT,tag_json TEXT,lines_json TEXT);
    INSERT INTO poems VALUES(1,'静夜思',NULL,'李白','唐','tangshi','床前明月光','[]','["床前明月光，疑是地上霜。","举头望明月，低头思故乡。"]');
    INSERT INTO poems SELECT 2,title,subtitle,author,dynasty,collection,first_line,tag_json,lines_json FROM poems WHERE id=1;`);
  fixture.close();
  const { GET } = await import('../src/app/api/poems/[id]/experience/route.ts');
  const { getDb } = await import('../src/lib/db.ts');
  const read = async (id = 1) => {
    const response = await GET(new Request('http://localhost/api/poems/1/experience'), { params: Promise.resolve({ id: String(id) }) });
    assert.equal(response.status, 200);
    return response.json();
  };
  try {
    assert.equal((await read()).data.analysisStatus, 'unconfigured');
    let complete;
    globalThis.fetch = async url => {
      assert.equal(url, 'https://text.example/v1/chat/completions');
      return new Promise(resolve => { complete = resolve; });
    };
    process.env.TEXT_API_KEY = 'test-only';
    process.env.TEXT_API_BASE_URL = 'https://text.example/v1';
    const pending = await read();
    assert.equal(pending.data.analysisStatus, 'pending');
    assert.equal(pending.settled, false);
    assert.equal(pending.data.mode, 'fallback');
    complete(Response.json({ choices: [{ message: { content: '[{"scene":2,"jian":"疑：好像。"}]' } }] }));
    await new Promise(r => setImmediate(r));
    const ready = await read();
    assert.equal(ready.data.analysisStatus, 'ready');
    assert.equal(ready.settled, true);
    assert.equal(ready.data.scenes[0].note, null);
    assert.equal(ready.data.scenes[1].translation, null);
    assert.equal(ready.data.scenes[1].note, '疑：好像。');
    await read(2);
    complete(new Response('unavailable', { status: 503 }));
    await new Promise(r => setImmediate(r));
    const failed = await read(2);
    assert.equal(failed.data.analysisStatus, 'failed');
    assert.equal(failed.settled, true);
  } finally {
    getDb().close();
    globalThis.fetch = originalFetch;
    process.chdir(cwd);
    for (const key of ['POETRY_DB_PATH', 'TEXT_API_KEY', 'TEXT_API_BASE_URL']) delete process.env[key];
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
