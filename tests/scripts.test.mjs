import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

test('无库统计可运行，覆盖检查以清晰提示非零退出', () => {
  const env = { ...process.env, POETRY_DB_PATH: path.join(os.tmpdir(), `missing-shijing-${process.pid}.db`) };
  const stats = spawnSync(process.execPath, ['scripts/stats.mjs'], { env, encoding: 'utf8' });
  assert.equal(stats.status, 0, stats.stderr);
  assert.match(stats.stdout, /96 位诗人，405 处足迹/);
  assert.match(stats.stdout, /数据库不存在/);
  const coverage = spawnSync(process.execPath, ['scripts/check-poet-coverage.mjs'], { env, encoding: 'utf8' });
  assert.equal(coverage.status, 1);
  assert.match(coverage.stderr, /npm run build:db/);
  assert.doesNotMatch(coverage.stderr, /\n\s+at /);
});
