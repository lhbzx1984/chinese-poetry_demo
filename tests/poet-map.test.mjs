import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {buildSpots}=await import('../src/lib/poet-map.ts');
const {POET_PLACES}=await import('../src/data/poet-places.ts');
test('初始显示全部诗人主光点，选择任意诗人后只显示本人完整足迹',()=>{
  assert.equal(buildSpots(POET_PLACES,null).points.length,POET_PLACES.length);
  for(const poet of POET_PLACES){
    const {points}=buildSpots(POET_PLACES,poet.name);
    assert.equal(points.length,poet.spots.length,poet.name);
    assert.ok(points.every(p=>p.poet===poet.name&&p.labelOn),poet.name);
  }
});
test('切换朝代或清除诗人选择后，地图恢复对应范围，不残留上一次足迹',()=>{
  const tang=POET_PLACES.filter(p=>p.dynasty==='唐');
  const song=POET_PLACES.filter(p=>p.dynasty==='宋');
  assert.ok(buildSpots(tang,null).points.every(p=>p.dynasty==='唐'));
  assert.equal(buildSpots(song,null).points.length,song.length);
  assert.equal(buildSpots(tang,'岳飞').points.length,0);
  assert.equal(buildSpots(POET_PLACES,null).points.length,96);
});

test('全部405处足迹使用原始经纬度，光点和光晕贴合地图表面',()=>{
  for(const poet of POET_PLACES){
    const {points,halos}=buildSpots(POET_PLACES,poet.name);
    assert.deepEqual(points.map(p=>p.value),poet.spots.map(s=>[s.lng,s.lat,0]),poet.name);
    assert.ok(halos.every(p=>p.value[2]===0));
  }
  const all=buildSpots(POET_PLACES,null).points;
  assert.deepEqual(all.map(p=>p.value.slice(0,2)),POET_PLACES.map(p=>[p.spots[0].lng,p.spots[0].lat]));
});
