import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { buildScenes, scenePrompt } = await import('../src/lib/scenes.ts');

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

test('逐幕配图提示以当前诗句为主体，并保留整首诗的语境', () => {
  const spring = poem(['春眠不觉晓，处处闻啼鸟。', '夜来风雨声，花落知多少。'], { title: '春晓', author: '孟浩然' });
  const { bible, scenes } = buildScenes(spring);
  const morning = scenePrompt(bible, scenes[0], spring, scenes);
  const rain = scenePrompt(bible, scenes[2], spring, scenes);
  assert.match(morning, /PRIMARY SOURCE[^\n]*春眠不觉晓/);
  assert.match(rain, /PRIMARY SOURCE[^\n]*夜来风雨声/);
  assert.match(morning, /Whole-poem context[^\n]*花落知多少/);
  assert.notEqual(morning, rain);
  assert.match(rain, /Do not combine all verses into one image/);
});
