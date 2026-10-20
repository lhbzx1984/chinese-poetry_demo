import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { matchSceneEnvironment } = await import('../src/lib/scene-environments.ts');

test('诗句意象决定主要场景，诗名只在本幕无景物时兜底', () => {
  assert.equal(matchSceneEnvironment('床前明月光，疑是地上霜。').id, 'moon');
  assert.equal(matchSceneEnvironment('疑是地上霜。', '静夜思').id, 'moon');
  assert.equal(matchSceneEnvironment('大漠孤烟直，长河落日圆。').id, 'frontier');
  assert.equal(matchSceneEnvironment('空山新雨后，天气晚来秋。').id, 'rain');
  assert.equal(matchSceneEnvironment('此情可待成追忆。', '夜雨寄北').id, 'rain');
});

test('无明显景物时保留中性水墨场景', () => {
  assert.equal(matchSceneEnvironment('人生自有道理。').id, 'ink');
});
