import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Converter } from 'opencc-js';
import { tagPoem } from './tag-lexicon.mjs';
import { POET_PLACES } from '../src/data/poet-places.ts';

if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
const dbPath = process.env.POETRY_DB_PATH || path.resolve('data/poetry.db');
assert(fs.existsSync(dbPath), '请先准备数据库；本脚本只追加作品，不重建数据库。');
const convert = Converter({ from: 't', to: 'cn' });
const records = JSON.parse(fs.readFileSync(new URL('./supplement-poems.json', import.meta.url), 'utf8'));
const poets = new Map(POET_PLACES.map(p => [p.name, p.dynasty === '汉魏' ? '汉' : p.dynasty]));
const dataDir = process.argv[2] || process.env.POETRY_DATA_DIR || 'data/chinese-poetry';
function visit(value, source) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value.paragraphs) && value.author) {
    const author = convert(value.author).split(/[：:]/).at(-1).trim();
    if (poets.has(author)) records.push({ author, dynasty: poets.get(author), title: convert(value.chapter || value.title || ''), lines: value.paragraphs.map(convert), source });
  }
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') visit(child, source);
  }
}
for (const name of ['guwenguanzhi', 'qianjiashi', 'tangshisanbaishou']) {
  const file = path.join(dataDir, '蒙学', name + '.json');
  if (fs.existsSync(file)) visit(JSON.parse(fs.readFileSync(file, 'utf8')), `chinese-poetry/蒙学/${name}.json`);
}
for (const p of records) assert(p.author && p.title && p.dynasty && p.source && p.lines.length && p.lines.every(s => typeof s === 'string' && s.trim()), '补充作品格式无效');
const db = new DatabaseSync(dbPath);
try {
  const backup = dbPath + '.before-supplement-' + Date.now();
  // 调用前停服，保留原库及全部作品编号。
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  fs.copyFileSync(dbPath, backup, fs.constants.COPYFILE_EXCL);
  const before = db.prepare('SELECT COUNT(*) n, MAX(id) last FROM poems').get();
  const existing = db.prepare('SELECT 1 FROM poems WHERE author = ? AND (title = ? OR lines_json = ?) LIMIT 1');
  const insert = db.prepare('INSERT INTO poems(title, subtitle, author, dynasty, collection, lines_json, first_line, tag_json, sent_count) VALUES(?,?,?,?,?,?,?,?,?)');
  const tag = db.prepare('INSERT INTO poem_tags VALUES(?,?)');
  const fts = db.prepare('INSERT INTO poems_fts(rowid,title,author,blob) VALUES(?,?,?,?)');
  let added = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const p of records) {
      const lines = JSON.stringify(p.lines);
      if (existing.get(p.author, p.title, lines)) continue;
      const blob = p.title + ' ' + p.author + ' ' + p.lines.join(' ');
      const tags = tagPoem(p.title, blob).map(t => t.tag);
      const id = insert.run(p.title, null, p.author, p.dynasty, 'supplement', lines, p.lines[0].slice(0,60), JSON.stringify(tags), Math.min(999, p.lines.join('').split(/[。！？；]/).filter(Boolean).length)).lastInsertRowid;
      for (const t of tags) tag.run(t, id);
      fts.run(id, p.title, p.author, blob.slice(0,5000));
      added++;
    }
    db.exec('DELETE FROM authors; INSERT INTO authors SELECT author,dynasty,COUNT(*) FROM poems GROUP BY author,dynasty');
    const meta = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='meta'").get().value);
    meta.total = db.prepare('SELECT COUNT(*) n FROM poems').get().n;
    meta.dynasties = db.prepare('SELECT dynasty name,COUNT(*) count FROM poems GROUP BY dynasty ORDER BY count DESC').all();
    meta.tags = db.prepare('SELECT tag name,COUNT(*) count FROM poem_tags GROUP BY tag ORDER BY count DESC').all();
    if (!meta.collections.some(c => c.name === 'supplement')) meta.collections.push({name:'supplement',label:'名篇补遗'});
    db.prepare("UPDATE meta SET value=? WHERE key='meta'").run(JSON.stringify(meta));
    assert.equal(meta.total, before.n + added);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM poems WHERE id <= ?').get(before.last).n, before.n);
    db.exec('COMMIT');
    console.log(`追加 ${added} 篇；原有 ${before.n} 篇及编号保留。备份：${path.basename(backup)}`);
  } catch (e) { db.exec('ROLLBACK'); throw e; }
} finally { db.close(); }
