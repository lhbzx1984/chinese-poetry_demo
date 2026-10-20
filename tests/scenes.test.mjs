import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { buildScenes } = await import('../src/lib/scenes.ts');

const poem = (lines, extra = {}) => ({ id: 1, title: '测试', author: '佚名', dynasty: '唐', collection: 'tangshi', subtitle: null, tags: [], firstLine: '', lines, ...extra });
test('绝句逐句、律诗逐联，正文不丢失', () => {
  const lines = ['床前明月光，', '疑是地上霜。', '举头望明月，', '低头思故乡。'];
  assert.equal(buildScenes(poem([lines.slice(0, 2).join(''), lines.slice(2).join('')])).scenes.length, 4);
  const eight = Array.from({ length: 8 }, (_, i) => `诗句${i}。`);
  const scenes = buildScenes(poem(eight)).scenes;
  assert.equal(scenes.length, 4);
  assert.equal(scenes.map(s => s.text).join('').replace(/\s/g, ''), eight.join(''));
});
test('词逐阕、诗经逐章；长诗至多六幕，空输入安全', () => {
  for (const collection of ['songci', 'shijing']) {
    const lines = ['第一章。第二句。', '第二章。', '第三章。'];
    assert.deepEqual(buildScenes(poem(lines, { collection, subtitle: '词牌' })).scenes.map(s => s.text), lines);
  }
  const count = buildScenes(poem(Array(30).fill('山川。'))).scenes.length;
  assert.ok(count >= 3 && count <= 6);
  assert.deepEqual(buildScenes(poem([])).scenes, []);
});
