import test from 'node:test';
import assert from 'node:assert/strict';
import { POET_PLACES, DYNASTY_ORDER } from '../src/data/poet-places.ts';
import { tagPoem } from '../scripts/tag-lexicon.mjs';

test('地图姓名唯一、足迹非空、坐标及朝代有效', () => {
  assert.equal(new Set(POET_PLACES.map(p => p.name)).size, POET_PLACES.length);
  const outside = [];
  for (const p of POET_PLACES) {
    assert.ok(p.spots.length > 0, p.name);
    assert.ok(DYNASTY_ORDER.some(d => d.key === p.dynasty), p.name);
    for (const s of p.spots) if (!(s.lng >= 73 && s.lng <= 136 && s.lat >= 18 && s.lat <= 54)) outside.push(`${p.name}:${s.city}(${s.lng},${s.lat})`);
  }
  assert.deepEqual(outside, []);
});
test('关键词标签：思乡、边塞、无匹配', () => {
  assert.ok(tagPoem('静夜思', '举头望明月，低头思故乡。').some(t => t.tag === '思乡怀人'));
  assert.ok(tagPoem('出塞', '大漠孤烟直，长河落日圆。').some(t => t.tag === '边塞征战'));
  assert.deepEqual(tagPoem('', 'abcdef'), []);
});
