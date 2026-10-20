import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

test('诗词端点拒绝非法分页，限制条数，特殊 FTS 输入安全且连接只读', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shijing-db-'));
  process.env.POETRY_DB_PATH = path.join(dir, 'poetry.db');
  const fixture = new DatabaseSync(process.env.POETRY_DB_PATH);
  fixture.exec(`CREATE TABLE poems(id INTEGER PRIMARY KEY,title TEXT,subtitle TEXT,author TEXT,dynasty TEXT,collection TEXT,first_line TEXT,tag_json TEXT);
    CREATE VIRTUAL TABLE poems_fts USING fts5(title, author, blob, tokenize='trigram',content='');`);
  const insert = fixture.prepare("INSERT INTO poems VALUES(?, '明月', NULL, '李白', '唐', 'tangshi', '明月光', '[]')");
  for (let i = 1; i <= 80; i++) insert.run(i);
  fixture.close();
  const { GET } = await import('../src/app/api/poems/route.ts');
  const { getDb } = await import('../src/lib/db.ts');
  try {
    for (const query of ['page=Infinity', 'page=NaN', 'page=-1', 'pageSize=2.5', 'pageSize=0']) {
      assert.equal((await GET(new Request(`http://localhost/api/poems?${query}`))).status, 400, query);
    }
    const capped = await GET(new Request('http://localhost/api/poems?pageSize=999999'));
    assert.equal(capped.status, 200);
    assert.equal((await capped.json()).data.items.length, 60);
    for (const q of ['" OR *', '明月"光', 'a:b NEAR(', '%%%%']) {
      assert.equal((await GET(new Request(`http://localhost/api/poems?q=${encodeURIComponent(q)}`))).status, 200, q);
    }
    assert.throws(() => getDb().exec('DELETE FROM poems'), /readonly/i);
  } finally {
    getDb().close();
    delete process.env.POETRY_DB_PATH;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
