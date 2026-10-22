import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { loadNarrationSettings } = await import('../src/lib/narration-settings.ts');

test('历史本机和 Edge 偏好迁移为豆包，保留所选豆包男声及音调语速', t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let saved;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => JSON.stringify(saved) } } });
  t.after(() => original ? Object.defineProperty(globalThis, 'window', original) : delete globalThis.window);
  for (const edgeVoice of ['', 'zh-CN-XiaoxiaoNeural', 'unknown']) {
    saved = { edgeVoice, pitch: 1.15, rate: 0.85 };
    const result = loadNarrationSettings();
    assert.equal(result.edgeVoice, 'zh_female_vv_uranus_bigtts');
    assert.equal(result.pitch, 1.15);
    assert.equal(result.rate, 0.85);
  }
  saved = { edgeVoice: 'zh_male_wenrouxiaoge_uranus_bigtts' };
  assert.equal(loadNarrationSettings().edgeVoice, saved.edgeVoice);
});
