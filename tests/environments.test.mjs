import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const { matchSceneEnvironment, SCENE_ENVIRONMENTS } = await import('../src/lib/scene-environments.ts');

test('每一种阅读环境都有本地背景图', () => {
  for (const environment of SCENE_ENVIRONMENTS) {
    assert.ok(existsSync(new URL(`../public${environment.image}`, import.meta.url)), `${environment.name} 缺少背景图`);
  }
});

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
