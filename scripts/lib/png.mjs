/**
 * Deterministic gradient PNGs for mock content: no dependencies, no network.
 * The same seed always gives the same image.
 */
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};

const hash = (text) => {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619) >>> 0;
  return h;
};

const hslToRgb = (h, s, l) => {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)].map((v) => v * 255);
};

export const gradientPng = (width, height, seed) => {
  const base = hash(seed);
  const hue = base % 360;
  const [r1, g1, b1] = hslToRgb(hue, 0.32, 0.78);
  const [r2, g2, b2] = hslToRgb((hue + 45) % 360, 0.38, 0.38);
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  let noise = base || 1;
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1);
    raw[row] = 1; // Sub filter: smooth gradients compress to almost nothing
    const line = Buffer.alloc(stride);
    for (let x = 0; x < width; x += 1) {
      const t = (x / width) * 0.35 + (y / height) * 0.65;
      const dx = x / width - 0.3;
      const dy = y / height - 0.25;
      const glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 1.8) * 38;
      noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
      const grain = (noise >>> 29) - 3.5;
      const px = [r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t];
      for (let c = 0; c < 3; c += 1) line[x * 3 + c] = Math.max(0, Math.min(255, Math.round(px[c] + glow + grain)));
    }
    for (let i = 0; i < stride; i += 1) raw[row + 1 + i] = (line[i] - (i >= 3 ? line[i - 3] : 0)) & 255;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
};
