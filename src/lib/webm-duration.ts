// MediaRecorder 输出流式 WebM 时常缺少 Duration，保存前补齐，供原生播放器拖动。
export function fixWebmDuration(bytes: Buffer, seconds: number): Buffer {
  if (!Number.isFinite(seconds) || seconds <= 0) return bytes;
  try {
    const element = (offset: number, limit: number) => {
      const vint = (start: number, id = false) => {
        let length = 1;
        while (length <= 8 && !(bytes[start] & (0x80 >> (length - 1)))) length++;
        if (length > (id ? 4 : 8) || start + length > limit) throw new Error("Invalid EBML");
        let value = id ? bytes[start] : bytes[start] & ((0x80 >> (length - 1)) - 1);
        for (let i = 1; i < length; i++) value = value * 256 + bytes[start + i];
        const unknown = !id && value === 2 ** (7 * length) - 1;
        if (!unknown && !Number.isSafeInteger(value)) throw new Error("Invalid EBML size");
        return { value, length, unknown };
      };
      const id = vint(offset, true);
      const sizeOffset = offset + id.length;
      const size = vint(sizeOffset);
      const start = sizeOffset + size.length;
      const end = size.unknown ? limit : start + size.value;
      if (end > limit) throw new Error("Truncated EBML");
      return { id: id.value, sizeOffset, sizeLength: size.length, start, end, unknown: size.unknown };
    };
    let offset = 0;
    while (offset < bytes.length) {
      const segment = element(offset, bytes.length);
      offset = segment.end;
      if (segment.id !== 0x18538067) continue;
      // shortcut: 只补录制器的无索引流式文件；已有完整封装的文件保留原样。
      if (!segment.unknown) return bytes;
      let position = segment.start;
      while (position < segment.end) {
        const info = element(position, segment.end);
        position = info.end;
        if (info.id === 0x114d9b74 || info.id === 0x1f43b675) return bytes;
        if (info.id !== 0x1549a966 || info.unknown) continue;
        let scale = 1_000_000;
        for (let child = info.start; child < info.end;) {
          const field = element(child, info.end);
          child = field.end;
          if (field.id === 0x4489) return bytes;
          if (field.id === 0x2ad7b1) {
            if (field.end - field.start > 6) return bytes;
            scale = bytes.readUIntBE(field.start, field.end - field.start);
          }
        }
        if (scale <= 0) return bytes;
        const duration = Buffer.alloc(11);
        duration.set([0x44, 0x89, 0x88]);
        duration.writeDoubleBE(seconds * 1e9 / scale, 3);
        let size = info.end - info.start + duration.length;
        if (size >= 2 ** (7 * info.sizeLength) - 1) return bytes;
        const prefix = Buffer.from(bytes.subarray(0, info.end));
        for (let i = info.sizeLength - 1; i >= 0; i--) {
          prefix[info.sizeOffset + i] = size % 256;
          size = Math.floor(size / 256);
        }
        prefix[info.sizeOffset] |= 0x80 >> (info.sizeLength - 1);
        return Buffer.concat([prefix, duration, bytes.subarray(info.end)]);
      }
    }
  } catch { /* 非录制器文件或损坏的结构交由原有播放流程处理 */ }
  return bytes;
}
