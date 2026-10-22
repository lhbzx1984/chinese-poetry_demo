import fs from 'node:fs';
import path from 'node:path';
import { fixWebmDuration } from '../src/lib/webm-duration.ts';

const dir = process.env.VIDEOS_DIR || path.join(process.cwd(), 'data', 'videos');
const backup = path.join(dir, '.duration-backups');
let repaired = 0;
for (const entry of fs.readdirSync(dir)) {
  if (!/^v[0-9a-z]+\.json$/.test(entry)) continue;
  const metaPath = path.join(dir, entry);
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const file = path.join(dir, entry.replace(/\.json$/, '.webm'));
  const bytes = fs.readFileSync(file);
  const fixed = fixWebmDuration(bytes, meta.duration);
  if (fixed === bytes) continue;
  fs.mkdirSync(backup, { recursive: true });
  for (const original of [file, metaPath]) {
    const copy = path.join(backup, path.basename(original));
    if (!fs.existsSync(copy)) fs.copyFileSync(original, copy, fs.constants.COPYFILE_EXCL);
  }
  fs.writeFileSync(file + '.duration.tmp', fixed);
  fs.renameSync(file + '.duration.tmp', file);
  meta.bytes = fixed.length;
  fs.writeFileSync(metaPath + '.duration.tmp', JSON.stringify(meta, null, 2));
  fs.renameSync(metaPath + '.duration.tmp', metaPath);
  repaired++;
}
console.log(`已修复 ${repaired} 部影片，原文件备份于 ${backup}`);
