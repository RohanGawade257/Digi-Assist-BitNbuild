import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { MAX_APPROVED_IMAGE_BYTES, type ApprovedImage } from '@guide/contracts';
import { ApiError } from './errors';

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
// Accept the browser's normalized, non-interlaced RGB/RGBA PNG only. Decode the
// complete compressed raster within a fixed allocation bound; never trust headers alone.
export function validateApprovedImage(image: ApprovedImage) {
  const bytes = Buffer.from(image.data, 'base64');
  try {
    if (bytes.length > MAX_APPROVED_IMAGE_BYTES || bytes.toString('base64') !== image.data || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error();
    if (createHash('sha256').update(bytes).digest('hex') !== image.sha256) throw new Error();
    let offset = 8, width = 0, height = 0, channels = 0, ended = false;
    const compressed: Buffer[] = [];
    const ancillary = new Set<string>();
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset), end = offset + 12 + length;
      if (end > bytes.length || length > MAX_APPROVED_IMAGE_BYTES) throw new Error();
      const type = bytes.toString('ascii', offset + 4, offset + 8), data = bytes.subarray(offset + 8, end - 4);
      if (bytes.subarray(offset + 4, offset + 8).some(value => !(value >= 65 && value <= 90 || value >= 97 && value <= 122))) throw new Error();
      if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) throw new Error();
      if (offset === 8 && type !== 'IHDR') throw new Error();
      if (type === 'IHDR') {
        if (offset !== 8 || length !== 13) throw new Error();
        width = data.readUInt32BE(0); height = data.readUInt32BE(4); channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0;
        if (!width || !height || width !== image.width || height !== image.height || width > 2048 || height > 2048 || width * height > 4_000_000 || data[8] !== 8 || !channels || data[10] || data[11] || data[12]) throw new Error();
      } else if (type === 'IDAT') {
        compressed.push(data);
      } else if (type === 'IEND') {
        if (length || end !== bytes.length || !compressed.length) throw new Error(); ended = true; offset = end; break;
      } else {
        // No text, EXIF, animation, palette or arbitrary ancillary payloads.
        const lengths: Record<string, number> = { sRGB: 1, gAMA: 4, cHRM: 32, pHYs: 9 };
        if (lengths[type] !== length || ancillary.has(type) || compressed.length) throw new Error();
        if (type === 'sRGB' && data[0]! > 3 || type === 'pHYs' && data[8]! > 1 || type === 'gAMA' && data.readUInt32BE(0) === 0) throw new Error();
        ancillary.add(type);
      }
      offset = end;
    }
    if (!ended || offset !== bytes.length) throw new Error();
    const stride = width * channels + 1, expected = stride * height;
    const decoded = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
    try { if (decoded.length !== expected) throw new Error(); for (let row = 0; row < height; row++) if (decoded[row * stride]! > 4) throw new Error(); }
    finally { decoded.fill(0); }
  } catch { throw new ApiError('INVALID_IMAGE', 400); }
  finally { bytes.fill(0); }
}
