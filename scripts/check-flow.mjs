import assert from 'node:assert/strict';
import { POET_PLACES } from '../src/data/poet-places.ts';

const base = process.argv[2] || 'http://localhost:3100';
let checked = 0;
async function read(route, options) {
  const response = await fetch(base + route, { ...options, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, route);
  checked++;
  return response;
}
async function json(route) { return (await (await read(route)).json()).data; }
for (const page of ['/', '/library', '/video']) assert((await (await read(page)).text()).includes('<html'), page);
for (const name of ['china3d','china','world']) assert((await (await read(`/geo/${name}.json`)).json()).features.length > 0);
assert((await json('/api/meta')).total > 0);
assert((await json('/api/poems?q=' + encodeURIComponent('地上'))).total > 0, '两字正文搜索');
for (let offset = 0; offset < POET_PLACES.length; offset += 4) {
  await Promise.all(POET_PLACES.slice(offset, offset + 4).map(async poet => {
    const result = await json('/api/poems?author=' + encodeURIComponent(poet.name) + '&pageSize=1');
    assert(result.items.length > 0, `${poet.name}缺少作品`);
    const poem = await json(`/api/poems/${result.items[0].id}`);
    assert.equal(poem.author, poet.name);
    assert(poem.lines.length > 0);
    await read(`/read/${poem.id}`);
  }));
}
const random = await json('/api/poems/random?dynasty=' + encodeURIComponent('唐'));
assert.equal((await json(`/api/poems/${random.id}`)).dynasty, '唐');
const videos = await json('/api/videos');
for (const video of videos) {
  const response = await fetch(`${base}/api/videos/${video.id}`, { headers: { Range: 'bytes=0-4095' }, signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 206, video.id);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0,4)], [0x1a,0x45,0xdf,0xa3]);
  assert(response.headers.get('content-range')?.startsWith('bytes 0-'));
  checked++;
}
for (const route of ['/api/poems?page=-1', '/api/poems?pageSize=0']) assert.equal((await fetch(base + route)).status, 400);
console.log(`通过 ${checked} 次页面/接口检查：全部 ${POET_PLACES.length} 位诗人 → 作品 → 阅读页，地图资源、搜索、随机选诗、${videos.length} 部影片的分段读取正常。`);
console.log('此脚本不替代浏览器点击、听音与真实录制验证，也不调用付费生成服务。');
