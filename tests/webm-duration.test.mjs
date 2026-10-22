import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { fixWebmDuration } = await import('../src/lib/webm-duration.ts');
const header = Buffer.from('1a45dfa39f4286810142f7810142f2810442f381084282847765626d42878104428581021853806701ffffffffffffff1549a966992ad7b1830f42404d80864368726f6d655741864368726f6d65','hex');
const frames = Buffer.from('1f43b67501ffffffffffffffe78100a386810000806162','hex');
test('为浏览器录制的 WebM 写入有限时长，保留完整媒体字节，重复处理不改变文件', () => {
  const source = Buffer.concat([header,frames]);
  const result = fixWebmDuration(source, 32.4);
  const duration = result.indexOf(Buffer.from([0x44,0x89,0x88]));
  assert.ok(duration >= 0);
  assert.equal(result.readDoubleBE(duration+3), 32400);
  assert.equal(result[52], 0x80 | (25+11));
  assert.deepEqual(result.subarray(-frames.length),frames);
  assert.deepEqual(source,Buffer.concat([header,frames]),'不得修改输入文件');
  assert.deepEqual(fixWebmDuration(result,32.4),result);
});
test('使用文件时间尺度换算，非法输入和已有时长保持原样', () => {
  const source=Buffer.concat([header,frames]);
  const scaled=Buffer.from(source);
  scaled.set([0x1e,0x84,0x80],scaled.indexOf(Buffer.from('2ad7b183','hex'))+4); // 2,000,000 ns
  const result=fixWebmDuration(scaled,10);
  const duration=result.indexOf(Buffer.from([0x44,0x89,0x88]));
  assert.equal(result.readDoubleBE(duration+3),5000);
  assert.deepEqual(fixWebmDuration(source,0),source);
  assert.deepEqual(fixWebmDuration(source,Infinity),source);
  for(const input of [Buffer.alloc(0),Buffer.from([0x1a,0x45]),source.subarray(0,60)]) assert.deepEqual(fixWebmDuration(input,10),input);
});
