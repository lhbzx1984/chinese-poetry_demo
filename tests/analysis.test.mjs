import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('赏析按场景编号对应原句，保留缺项位置，拒绝重复编号和错误类型', async () => {
  const cwd = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shijing-analysis-'));
  const originalFetch = globalThis.fetch;
  process.chdir(dir);
  process.env.AGNES_API_KEY = 'test-only';
  process.env.TEXT_MODEL = 'test-model';
  const { ensureAnalysis, readAnalysis, needsAnalysis } = await import('../src/lib/analysis.ts');
  const poem = { id: 10, title: '静夜思', author: '李白', dynasty: '唐', collection: 'tangshi', subtitle: null, tags: [], lines: ['床前明月光，疑是地上霜。', '举头望明月，低头思故乡。'] };
  let reply;
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify(reply) } }] });
  async function generate(id, entries) {
    reply = entries;
    const p = { ...poem, id };
    ensureAnalysis(p);
    for (let i = 0; i < 100 && !readAnalysis(p); i++) await new Promise(r => setImmediate(r));
    return readAnalysis(p);
  }
  try {
    const result = await generate(10, [{ scene: 4, yi: '低头思念故乡。' }, { scene: 2 }, { scene: 1, yi: '床前洒满明亮的月光。' }]);
    assert.equal(result.scenes.length, 4);
    assert.equal(result.scenes[0].yi, '床前洒满明亮的月光。');
    assert.equal(result.scenes[1].yi, '');
    assert.equal(result.scenes[2].yi, '');
    assert.equal(result.scenes[3].yi, '低头思念故乡。');
    const notes = await generate(13, [{ scene: 2, jian: '疑：好像。' }]);
    assert.equal(notes.scenes[0].jian, '');
    assert.equal(notes.scenes[1].jian, '疑：好像。');
    assert.equal(notes.scenes[1].yi, '');
    assert.deepEqual((await generate(11, [{ scene: 1, yi: '第一项' }, { scene: 1, yi: '重复项' }])).scenes, []);
    assert.deepEqual((await generate(12, [{ scene: 1, yi: { text: '错误结构' } }])).scenes, []);
    assert.equal(needsAnalysis(poem), false);
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(cwd);
    delete process.env.AGNES_API_KEY;
    delete process.env.TEXT_MODEL;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('译注可使用独立密钥和地址，不被配图服务配置覆盖', async () => {
  const { textConfig } = await import('../src/lib/analysis.ts');
  process.env.TEXT_API_KEY = 'text-only';
  process.env.IMAGE_API_KEY = 'images-only';
  process.env.TEXT_API_BASE_URL = 'https://text.example/v1/';
  process.env.TEXT_MODEL = 'text-model';
  try {
    const config = textConfig();
    assert.equal(config.key, 'text-only');
    assert.equal(config.base, 'https://text.example/v1');
    assert.equal(config.enabled, true);
  } finally {
    for (const key of ['TEXT_API_KEY', 'IMAGE_API_KEY', 'TEXT_API_BASE_URL', 'TEXT_MODEL']) delete process.env[key];
  }
});

test('只有密钥时沿用模板的默认赏析模型，显式留空仍可关闭', async () => {
  const { textConfig } = await import('../src/lib/analysis.ts');
  process.env.AGNES_API_KEY = 'test-only';
  try {
    delete process.env.TEXT_MODEL;
    assert.equal(textConfig().enabled, true);
    process.env.TEXT_MODEL = '';
    assert.equal(textConfig().enabled, false);
  } finally {
    delete process.env.AGNES_API_KEY;
    delete process.env.TEXT_MODEL;
  }
});
