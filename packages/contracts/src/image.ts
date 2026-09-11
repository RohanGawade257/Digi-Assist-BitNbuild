// Inspect dimensions before asking the browser to allocate a decoded bitmap.
export function imageDimensions(bytes: Uint8Array, mime: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const byte = (offset: number) => view.getUint8(offset);
  const tag = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  let width = 0, height = 0;
  if (mime === 'image/png' && bytes.length >= 24 && tag(1, 3) === 'PNG' && bytes[0] === 137 && tag(12, 4) === 'IHDR') {
    width = view.getUint32(16); height = view.getUint32(20);
  } else if (mime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216) {
    let cursor = 2;
    while (cursor + 4 <= bytes.length) {
      if (bytes[cursor++] !== 255) break;
      while (bytes[cursor] === 255) cursor++;
      const marker = bytes[cursor++]; if (marker === undefined || marker === 0xda || marker === 0xd9) break;
      if (marker === 1 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (cursor + 2 > bytes.length) break;
      const size = view.getUint16(cursor); if (size < 2 || cursor + size > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && size >= 8) { height = view.getUint16(cursor + 3); width = view.getUint16(cursor + 5); break; }
      cursor += size;
    }
  } else if (mime === 'image/webp' && bytes.length >= 25 && tag(0, 4) === 'RIFF' && tag(8, 4) === 'WEBP') {
    const kind = tag(12, 4);
    if (kind === 'VP8X' && bytes.length >= 30) { width = 1 + byte(24) + (byte(25) << 8) + (byte(26) << 16); height = 1 + byte(27) + (byte(28) << 8) + (byte(29) << 16); }
    if (kind === 'VP8L' && bytes[20] === 0x2f) { width = 1 + byte(21) + ((byte(22) & 0x3f) << 8); height = 1 + (byte(22) >> 6) + (byte(23) << 2) + ((byte(24) & 0xf) << 10); }
    if (kind === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) { width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff; }
  }
  if (!width || !height || width > 16000 || height > 16000 || width * height > 12_000_000) throw new Error('INVALID_IMAGE');
  return { width, height };
}
