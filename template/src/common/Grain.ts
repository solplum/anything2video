/** Static neutral grain generated from an integer pixel hash, not SVG filters.
 * A small grayscale PNG is encoded here without browser APIs, assets or packages.
 * PNG/DEFLATE framing follows their public file formats; the texture is generated
 * once on module load and is identical in Node, Chromium and out-of-order frames.
 */
export const GRAIN_SIZE = 160;

export function grainPixels(size = GRAIN_SIZE): Uint8Array {
  if (!Number.isInteger(size) || size < 1 || size > 255) throw new RangeError('grain size must be 1..255');
  return Uint8Array.from({length: size * size}, (_, i) => {
    let bits = Math.imul(i + 1, 0x45d9f3b) ^ 0x67a981d;
    bits = Math.imul(bits ^ (bits >>> 16), 0x45d9f3b);
    bits ^= bits >>> 16;
    // Symmetric around neutral gray for overlay blending, with no black bias.
    return 48 + ((bits >>> 0) % 160);
  });
}
const word = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const crc = (bytes: number[]) => {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
};
const chunk = (name: string, data: number[]) => {
  const body = [...Array.from(name, c => c.charCodeAt(0)), ...data];
  return [...word(data.length), ...body, ...word(crc(body))];
};
const base64 = (bytes: number[]) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    result += alphabet[(n >>> 18) & 63] + alphabet[(n >>> 12) & 63] +
      (i + 1 < bytes.length ? alphabet[(n >>> 6) & 63] : '=') +
      (i + 2 < bytes.length ? alphabet[n & 63] : '=');
  }
  return result;
};
export function grainPng(size = GRAIN_SIZE): string {
  const pixels = grainPixels(size);
  const scanlines: number[] = [];
  for (let y = 0; y < size; y++) scanlines.push(0, ...pixels.subarray(y * size, (y + 1) * size));
  let a = 1, b = 0;
  for (const byte of scanlines) { a = (a + byte) % 65521; b = (b + a) % 65521; }
  const n = scanlines.length;
  // One uncompressed final DEFLATE block, bounded by size <= 255 above.
  const zlib = [0x78, 0x01, 1, n & 255, n >>> 8, (~n) & 255, ((~n) >>> 8) & 255,
    ...scanlines, ...word(((b << 16) | a) >>> 0)];
  const png = [137, 80, 78, 71, 13, 10, 26, 10,
    ...chunk('IHDR', [...word(size), ...word(size), 8, 0, 0, 0, 0]),
    ...chunk('IDAT', zlib), ...chunk('IEND', [])];
  return `data:image/png;base64,${base64(png)}`;
}
export const GRAIN_URL = `url("${grainPng()}")`;
