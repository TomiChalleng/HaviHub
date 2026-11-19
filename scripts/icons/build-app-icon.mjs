// Builds the Havi Hub app icon: an orange voxel "H" (seen from the front, with
// its top and right sides showing) on a night-blue tile with pixel stars.
// Writes build/icon.svg, build/icon.png (512), build/icon.ico (16–256),
// src/renderer/static/icon.png / icon.ico and src/renderer/lib/brand-mark.js
// (the H alone, for the title bar). Needs Playwright's Chromium to rasterize.
//   node scripts/icons/build-app-icon.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(root, 'package.json'));

// ------------------------------------------------------------------ the H
const H = ['XX...XX', 'XX...XX', 'XX...XX', 'XXXXXXX', 'XX...XX', 'XX...XX', 'XX...XX'];
const filled = (c, r) => r >= 0 && r < H.length && c >= 0 && c < H[0].length && H[r][c] === 'X';
const DEPTH = 0.62; // the sides show up and to the right, in cells

function hash(c, r) {
  let h = Math.imul(c * 73856093 ^ r * 19349663, 2654435761);
  h ^= h >>> 13;
  return ((h >>> 0) % 1000) / 1000;
}
const mix = (a, b, k) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join('');
};

// faces of the H in cell units: front cells, top and right sides
function hFaces({ textured }) {
  const fronts = [];
  const tops = [];
  const rights = [];
  const rows = H.length;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < H[0].length; c++) {
      if (!filled(c, r)) continue;
      // light top, deeper bottom; a little per-block grain on the big icon
      const k = r / (rows - 1);
      let front = mix('#ffa24e', '#ec5a1f', k);
      if (textured) front = mix(front, hash(c, r) > 0.5 ? '#fff1d6' : '#8a2a06', 0.06 + hash(r, c) * 0.06);
      fronts.push({ c, r, fill: front });
      if (!filled(c, r - 1)) tops.push({ c, r, fill: textured ? mix('#ffd29a', '#ffb76a', hash(c + 9, r)) : '#ffc98c' });
      if (!filled(c + 1, r)) rights.push({ c, r, fill: mix('#b9461a', '#8f300c', k) });
    }
  return { fronts, tops, rights };
}

// SVG paths for the H fitted into a box (x, y, size): returns markup
function hMarkup({ x, y, size, textured = true, classes = false }) {
  const cols = H[0].length;
  const unit = size / (cols + DEPTH);
  const ox = x;
  const oy = y + DEPTH * unit; // the sides stick out above
  const P = (cx, cy) => `${(ox + cx * unit).toFixed(2)} ${(oy + cy * unit).toFixed(2)}`;
  const { fronts, tops, rights } = hFaces({ textured });
  const e = DEPTH;
  const g = 0.012; // grow a hair so the faces leave no seams
  const by = new Map();
  const add = (fill, d, cls) => {
    const key = classes ? cls : fill;
    by.set(key, (by.get(key) || '') + d);
  };
  for (const { c, r, fill } of rights) add(fill, `M${P(c + 1 - g, r - g)}L${P(c + 1 + e, r - e - g)}L${P(c + 1 + e, r + 1 - e + g)}L${P(c + 1 - g, r + 1 + g)}Z`, 'r');
  for (const { c, r, fill } of tops) add(fill, `M${P(c - g, r + g)}L${P(c + e - g, r - e)}L${P(c + 1 + e + g, r - e)}L${P(c + 1 + g, r + g)}Z`, 't');
  for (const { c, r, fill } of fronts) add(fill, `M${P(c - g, r - g)}L${P(c + 1 + g, r - g)}L${P(c + 1 + g, r + 1 + g)}L${P(c - g, r + 1 + g)}Z`, 'f');
  let out = '';
  for (const [key, d] of by) out += classes ? `<path class="${key}" d="${d}"/>` : `<path fill="${key}" d="${d}"/>`;
  return out;
}

// ------------------------------------------------------------------ the tile
const STARS = [
  [92, 104, 12, 0.9],
  [438, 214, 8, 0.55],
  [70, 236, 8, 0.5],
  [150, 62, 6, 0.45],
  [346, 66, 6, 0.4],
  [214, 82, 6, 0.35],
];
// stepped pixel hills along the bottom of the tile
const HILLS = [
  [16, 404], [64, 404], [64, 388], [112, 388], [112, 372], [176, 372], [176, 388], [224, 388], [224, 404], [288, 404], [288, 388], [336, 388], [336, 372], [400, 372], [400, 356], [448, 356], [448, 372], [496, 372],
];
function appIconSvg({ size = 512, small = false } = {}) {
  const tile = small ? { x: 0, y: 0, w: 512, r: 96 } : { x: 16, y: 16, w: 480, r: 108 };
  const hs = small ? 352 : 300;
  const hx = 256 - hs / 2 - 6;
  const hy = small ? 92 : 128;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">`;
  s += '<defs>';
  s += '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2f93"/><stop offset=".55" stop-color="#231b62"/><stop offset="1" stop-color="#140f3c"/></linearGradient>';
  s += '<radialGradient id="glow" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#ff7a2e" stop-opacity=".42"/><stop offset=".6" stop-color="#ff5a1f" stop-opacity=".12"/><stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/></radialGradient>';
  s += `<clipPath id="tile"><rect x="${tile.x}" y="${tile.y}" width="${tile.w}" height="${tile.w}" rx="${tile.r}"/></clipPath>`;
  s += '</defs>';
  s += `<rect x="${tile.x}" y="${tile.y}" width="${tile.w}" height="${tile.w}" rx="${tile.r}" fill="url(#sky)"/>`;
  if (!small) {
    s += `<g clip-path="url(#tile)"><path fill="#2b2178" d="M${HILLS.map(([x, y]) => `${x} ${y}`).join('L')}L496 496L16 496Z"/>`;
    s += `<path fill="#1d1659" d="M16 452L80 452L80 436L160 436L160 452L320 452L320 436L384 436L384 420L440 420L440 436L496 436L496 496L16 496Z"/></g>`;
    // a thin light rim on the top edge
    s += `<rect x="${tile.x + 1.5}" y="${tile.y + 1.5}" width="${tile.w - 3}" height="${tile.w - 3}" rx="${tile.r - 1.5}" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="3"/>`;
    for (const [x, y, w, a] of STARS) s += `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="#ffffff" fill-opacity="${a}"/>`;
    // one pixel sparkle
    s += '<path fill="#ffe7b0" fill-opacity=".9" d="M404 84h10v10h-10zM394 94h10v10h-10zM414 94h10v10h-10zM404 104h10v10h-10zM404 94h10v10h-10z"/>';
  }
  s += `<ellipse cx="256" cy="${small ? 280 : 300}" rx="${small ? 230 : 210}" ry="${small ? 200 : 180}" fill="url(#glow)"/>`;
  // a soft shadow under the H
  s += `<ellipse cx="256" cy="${hy + hs + (small ? 8 : 14)}" rx="${hs * 0.46}" ry="${small ? 16 : 18}" fill="#05030f" fill-opacity=".45"/>`;
  s += hMarkup({ x: hx, y: hy, size: hs, textured: !small });
  s += '</svg>';
  return s;
}

// ------------------------------------------------------------------ rasterize + write
function icoFile(images) {
  // PNG for 256, 32-bit DIB (with AND mask) for the smaller sizes
  const entries = [];
  for (const { size, rgba, png } of images) {
    let data;
    if (size >= 256) data = png;
    else {
      const header = Buffer.alloc(40);
      header.writeUInt32LE(40, 0);
      header.writeInt32LE(size, 4);
      header.writeInt32LE(size * 2, 8);
      header.writeUInt16LE(1, 12);
      header.writeUInt16LE(32, 14);
      const pixels = Buffer.alloc(size * size * 4);
      const maskRow = Math.ceil(size / 32) * 4;
      const mask = Buffer.alloc(maskRow * size);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const src = (y * size + x) * 4;
          const dst = ((size - 1 - y) * size + x) * 4;
          pixels[dst] = rgba[src + 2];
          pixels[dst + 1] = rgba[src + 1];
          pixels[dst + 2] = rgba[src];
          pixels[dst + 3] = rgba[src + 3];
          if (rgba[src + 3] === 0) mask[(size - 1 - y) * maskRow + (x >> 3)] |= 0x80 >> (x & 7);
        }
      header.writeUInt32LE(pixels.length + mask.length, 20);
      data = Buffer.concat([header, pixels, mask]);
    }
    entries.push({ size, data });
  }
  const head = Buffer.alloc(6 + 16 * entries.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(entries.length, 4);
  let offset = head.length;
  entries.forEach(({ size, data }, i) => {
    const o = 6 + i * 16;
    head.writeUInt8(size >= 256 ? 0 : size, o);
    head.writeUInt8(size >= 256 ? 0 : size, o + 1);
    head.writeUInt16LE(1, o + 4);
    head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(data.length, o + 8);
    head.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...entries.map((e) => e.data)]);
}

const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
async function raster(svg, size) {
  return page.evaluate(
    async ([svg, size]) => {
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = size;
      cv.height = size;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      const rgba = Array.from(ctx.getImageData(0, 0, size, size).data);
      const png = cv.toDataURL('image/png').split(',')[1];
      return { rgba, png };
    },
    [svg, size],
  );
}

const big = appIconSvg({ size: 512 });
fs.writeFileSync(path.join(root, 'build', 'icon.svg'), big + '\n');
const png512 = Buffer.from((await raster(big, 512)).png, 'base64');
fs.writeFileSync(path.join(root, 'build', 'icon.png'), png512);
fs.writeFileSync(path.join(root, 'src', 'renderer', 'static', 'icon.png'), png512);

const images = [];
for (const size of [256, 128, 64, 48, 40, 32, 24, 20, 16]) {
  const svg = appIconSvg({ size, small: size <= 32 });
  const r = await raster(svg, size);
  images.push({ size, rgba: Uint8Array.from(r.rgba), png: Buffer.from(r.png, 'base64') });
}
const ico = icoFile(images);
fs.writeFileSync(path.join(root, 'build', 'icon.ico'), ico);
fs.writeFileSync(path.join(root, 'src', 'renderer', 'static', 'icon.ico'), ico);
// previews for review
fs.mkdirSync('/tmp/appicon', { recursive: true });
for (const im of images) fs.writeFileSync(`/tmp/appicon/icon-${im.size}.png`, im.png);
await browser.close();

// the H alone for the title bar: three paths colored from the theme by CSS
const mark = hMarkup({ x: 0, y: 0, size: 32, textured: false, classes: true });
fs.writeFileSync(
  path.join(root, 'src', 'renderer', 'lib', 'brand-mark.js'),
  `// Generated by scripts/icons/build-app-icon.mjs — the Havi Hub "H" (32×32 box);\n// classes: f = front, t = top side, r = right side.\nexport const BRAND_MARK = ${JSON.stringify(mark)};\n`,
);
console.log('app icon written:', ico.length, 'bytes ico,', png512.length, 'bytes png');
