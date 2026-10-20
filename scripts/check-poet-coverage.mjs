import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { POET_PLACES } from '../src/data/poet-places.ts';

if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
const dbPath = process.env.POETRY_DB_PATH || path.resolve(import.meta.dirname, '../data/poetry.db');
if (!fs.existsSync(dbPath)) {
  console.error('诗词数据库不存在：请下载 chinese-poetry 数据集后运行 npm run build:db，或设置 POETRY_DB_PATH。');
  process.exit(1);
}
const db = new DatabaseSync(dbPath, { readOnly: true });
try {
  const rows = POET_PLACES.map(p => {
    const authors = db.prepare('SELECT dynasty FROM authors WHERE name = ?').all(p.name);
    // 汉魏为文学史分期，现有书库把曹操诗集归为汉。
    const expected = p.dynasty === '汉魏' ? '汉' : p.dynasty;
    const missing = p.famous.filter(kw => !db.prepare("SELECT 1 FROM poems WHERE author = ? AND (instr(title, ?) > 0 OR instr(COALESCE(subtitle, ''), ?) > 0 OR instr(lines_json, ?) > 0) LIMIT 1").get(p.name, kw, kw, kw));
    return { 诗人: p.name, 地图朝代: p.dynasty, 书库朝代: authors.map(a => a.dynasty).join('/') || '未收录', 朝代匹配: authors.some(a => a.dynasty === expected), 未命中名篇: missing.join('、'), 通过: authors.some(a => a.dynasty === expected) && missing.length === 0 };
  });
  console.table(rows);
  const failed = rows.filter(r => !r.通过).length;
  console.log(`共 ${rows.length} 位诗人，通过 ${rows.length - failed}，失败 ${failed}。未收录作者在地图卡片显示明确提示；不伪造数据。`);
  process.exitCode = failed ? 1 : 0;
} finally { db.close(); }
