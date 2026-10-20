import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { POET_PLACES, DYNASTY_ORDER } from '../src/data/poet-places.ts';
import { IMAGERY } from '../src/lib/imagery.ts';
import { EDGE_VOICES } from '../src/lib/voices.ts';
import { TAG_LEXICON } from './tag-lexicon.mjs';

if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
const dbPath = process.env.POETRY_DB_PATH || path.resolve(import.meta.dirname, '../data/poetry.db');
console.log(`地图：${POET_PLACES.length} 位诗人，${POET_PLACES.reduce((n, p) => n + p.spots.length, 0)} 处足迹`);
console.table(DYNASTY_ORDER.map(d => ({ 朝代: d.key, 诗人: POET_PLACES.filter(p => p.dynasty === d.key).length })));
console.log(`词表：${TAG_LEXICON.length} 类题材，${IMAGERY.length} 种意象，${EDGE_VOICES.length} 个 Edge 中文音色`);
if (fs.existsSync(dbPath)) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    console.log(`书库：${db.prepare('SELECT COUNT(*) n FROM poems').get().n} 首诗词`);
    console.table(db.prepare('SELECT dynasty 朝代, COUNT(*) 诗词 FROM poems GROUP BY dynasty ORDER BY dynasty').all());
    console.log(`数据库题材：${db.prepare('SELECT COUNT(DISTINCT tag) n FROM poem_tags').get().n} 类`);
  } finally { db.close(); }
} else console.log('数据库不存在；请下载数据集并运行 npm run build:db 后查看精确数量。');
