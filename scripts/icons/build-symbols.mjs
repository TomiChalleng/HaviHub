// Generates src/renderer/lib/icon-symbols.js: the symbols of the instance icon
// editor. Every symbol is an original voxel model drawn here: blocks and
// objects are projected isometrically like an inventory render, with
// Minecraft-style light (top bright, left mid, right dark) and a shadow cast on
// the ground; items are 16×16 pixel sprites seen from the front with a little
// depth. Everything is saved as SVG polygons in a 100×100 box.
//   node scripts/icons/build-symbols.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import polygonClipping from 'polygon-clipping';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(root, 'src', 'renderer', 'lib', 'icon-symbols.js');

// ------------------------------------------------------------------ helpers
// deterministic noise so the textures never change between builds
function rnd(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
const hashXYZ = (x, y, z, k = 0) => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + k * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const pick = (list, v) => list[Math.min(list.length - 1, Math.floor(v * list.length))];

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const shade = (hex, k) => toHex(hexToRgb(hex).map((v) => v * k));

// A model: Map "x,y,z" -> { c: color or (face) => color, glow?: bool, a?: opacity }
class Model {
  constructor() {
    this.v = new Map();
  }
  set(x, y, z, c, opts = {}) {
    this.v.set(`${x},${y},${z}`, { x, y, z, c, ...opts });
    return this;
  }
  has(x, y, z) {
    return this.v.has(`${x},${y},${z}`);
  }
  get(x, y, z) {
    return this.v.get(`${x},${y},${z}`);
  }
  del(x, y, z) {
    this.v.delete(`${x},${y},${z}`);
  }
  box(x0, y0, z0, x1, y1, z1, c, opts) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, typeof c === 'function' ? (f) => c(x, y, z, f) : c, opts);
    return this;
  }
}

// ------------------------------------------------------------------ projection
const C30 = Math.cos(Math.PI / 6);
const proj = (x, y, z) => [(x - y) * C30, (x + y) * 0.5 - z];
const LIGHT = { top: 1, left: 0.84, right: 0.66 };
// The light comes from the upper left (behind the left side of the view), so
// the right faces are the darkest and shadows fall to the lower right, along
// +x on the ground: SHADOW units of length per unit of height.
const SHADOW = 0.5;
const SHADOW_OPACITY = 0.3;
const r1 = (n) => Math.round(n * 10) / 10;

// Fit points into the 100×100 box (uniform scale, centered).
function fitBox(points, pad) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of points) {
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const k = (100 - pad * 2) / Math.max(w, h);
  const ox = (100 - w * k) / 2 - minX * k;
  const oy = (100 - h * k) / 2 - minY * k;
  return { k, X: (x) => r1(x * k + ox), Y: (y) => r1(y * k + oy) };
}

// MultiPolygon -> one even-odd path
function polysPath(multi, map) {
  let d = '';
  for (const poly of multi)
    for (const ring of poly) {
      const pts = ring.slice(0, -1).map(map);
      d += 'M' + pts.map(([x, y]) => `${x} ${y}`).join(' ') + 'Z';
    }
  return d;
}

// The shadow a voxel model casts on the ground (z = 0): every vertical run of
// voxels sweeps its footprint along +x, which on the ground is a rectangle.
function groundShadow(model) {
  const cols = new Map();
  for (const v of model.v.values()) {
    if (v.noShadow) continue;
    const key = `${v.x},${v.y}`;
    if (!cols.has(key)) cols.set(key, []);
    cols.get(key).push(v.z);
  }
  const rects = [];
  for (const [key, zs] of cols) {
    const [x, y] = key.split(',').map(Number);
    zs.sort((a, b) => a - b);
    const push = (z0, z1) => {
      const a = x + SHADOW * z0;
      const b = x + 1 + SHADOW * (z1 + 1);
      rects.push([[[a, y], [b, y], [b, y + 1], [a, y + 1], [a, y]]]);
    };
    let start = zs[0];
    let prev = zs[0];
    for (let i = 1; i < zs.length; i++) {
      if (zs[i] !== prev + 1) {
        push(start, prev);
        start = zs[i];
      }
      prev = zs[i];
    }
    push(start, prev);
  }
  return rects.length ? polygonClipping.union(...rects) : [];
}

// a neighbor hides a face only if it is solid (not see-through)
function render(model, { light = LIGHT, pad = 0, shadow = true } = {}) {
  const faces = [];
  const solid = (x, y, z) => {
    const n = model.get(x, y, z);
    return n && !(n.a < 1);
  };
  const vox = [...model.v.values()].sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z) || a.z - b.z);
  for (const v of vox) {
    const { x, y, z } = v;
    const dirs = [
      ['top', !solid(x, y, z + 1), [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]],
      ['left', !solid(x, y + 1, z), [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]],
      ['right', !solid(x + 1, y, z), [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]]],
    ];
    for (const [face, visible, pts] of dirs) {
      if (!visible) continue;
      // a see-through voxel next to the same material shows no inner wall
      if (v.a < 1) {
        const [dx, dy, dz] = face === 'top' ? [0, 0, 1] : face === 'left' ? [0, 1, 0] : [1, 0, 0];
        const n = model.get(x + dx, y + dy, z + dz);
        if (n && n.a === v.a) continue;
      }
      let col = v.c;
      while (typeof col === 'function') col = col(face);
      if (!col) continue;
      const glow = v.glow || col.startsWith('!');
      col = col.replace('!', '');
      const fill = glow ? (face === 'top' ? col : shade(col, face === 'left' ? 0.94 : 0.86)) : shade(col, light[face]);
      faces.push({ pts: pts.map((p) => proj(...p)), fill, a: v.a, depth: x + y + z });
    }
  }
  const shadowPolys = shadow ? groundShadow(model) : [];
  const shadowPts = [];
  for (const poly of shadowPolys) for (const ring of poly) for (const [gx, gy] of ring) shadowPts.push(proj(gx, gy, 0));
  const fit = fitBox([...faces.flatMap((f) => f.pts), ...shadowPts], pad);
  let out = '';
  if (shadowPolys.length) out += `<path fill="#000" fill-opacity="${SHADOW_OPACITY}" fill-rule="evenodd" d="${polysPath(shadowPolys, ([gx, gy]) => {
    const [px, py] = proj(gx, gy, 0);
    return [fit.X(px), fit.Y(py)];
  })}"/>`;
  // Voxels with the same x+y+z never overlap on screen, so inside one such
  // slab the faces can be grouped by color (one path per color run). Each
  // face is grown a hair from its center so neighbors leave no seams.
  faces.sort((a, b) => a.depth - b.depth || (a.fill < b.fill ? -1 : a.fill > b.fill ? 1 : 0) || (a.a || 1) - (b.a || 1));
  let run = null;
  const flush = () => {
    if (!run) return;
    const a = run.a < 1 ? ` fill-opacity="${run.a}"` : '';
    out += `<path fill="${run.fill}"${a} d="${run.d}"/>`;
    run = null;
  };
  for (const f of faces) {
    const cx = f.pts.reduce((t, p) => t + p[0], 0) / 4;
    const cy = f.pts.reduce((t, p) => t + p[1], 0) / 4;
    const grow = (px, py) => {
      const dx = px - cx;
      const dy = py - cy;
      const len = Math.hypot(dx, dy) || 1;
      const g = 0.18 / fit.k; // ≈0.18 units of the 100 box
      return [px + (dx / len) * g, py + (dy / len) * g];
    };
    const d = 'M' + f.pts.map(([px, py]) => grow(px, py)).map(([px, py]) => `${fit.X(px)} ${fit.Y(py)}`).join(' ') + 'Z';
    const key = `${f.fill}|${f.a || 1}|${f.depth}`;
    if (run && run.key === key) run.d += d;
    else {
      flush();
      run = { key, fill: f.fill, a: f.a || 1, d };
    }
  }
  flush();
  return out;
}

// ------------------------------------------------------------------ pixel items
// A 16×16 sprite seen from the front, pushed back a little so its right and
// bottom edges show, with a drop shadow to the lower right.
const ITEM_DEPTH = 0.6; // how much of the side shows, in sprite pixels
const ITEM_SHADOW = [1.1, 1.3];
const ITEM_SIDE = { right: 0.6, bottom: 0.46 };
function item(rows, palette) {
  return { rows, palette };
}
function renderItem({ rows, palette }, { pad = 7 } = {}) {
  const px = new Map();
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (palette[ch]) px.set(`${c},${r}`, { c, r, col: palette[ch] });
    });
  });
  const has = (c, r) => px.has(`${c},${r}`);
  const e = ITEM_DEPTH;
  const [sx, sy] = ITEM_SHADOW;
  const shadow = polygonClipping.union(...[...px.values()].map(({ c, r }) => [[[c + sx, r + sy], [c + 1 + sx, r + sy], [c + 1 + sx, r + 1 + sy], [c + sx, r + 1 + sy], [c + sx, r + sy]]]));
  // sides: vertical runs of right faces, horizontal runs of bottom faces
  const sides = [];
  for (const { c, r, col } of px.values()) {
    if (!has(c + 1, r) && !(has(c, r - 1) && !has(c + 1, r - 1) && px.get(`${c},${r - 1}`).col === col)) {
      let r2 = r;
      while (has(c, r2 + 1) && !has(c + 1, r2 + 1) && px.get(`${c},${r2 + 1}`).col === col) r2++;
      sides.push({ fill: shade(col, ITEM_SIDE.right), pts: [[c + 1, r], [c + 1 + e, r + e], [c + 1 + e, r2 + 1 + e], [c + 1, r2 + 1]] });
    }
    if (!has(c, r + 1) && !(has(c - 1, r) && !has(c - 1, r + 1) && px.get(`${c - 1},${r}`).col === col)) {
      let c2 = c;
      while (has(c2 + 1, r) && !has(c2 + 1, r + 1) && px.get(`${c2 + 1},${r}`).col === col) c2++;
      sides.push({ fill: shade(col, ITEM_SIDE.bottom), pts: [[c, r + 1], [c2 + 1, r + 1], [c2 + 1 + e, r + 1 + e], [c + e, r + 1 + e]] });
    }
  }
  // fronts: horizontal runs of the same color
  const fronts = [];
  for (let r = 0; r < rows.length; r++) {
    let c = 0;
    while (c < 16) {
      const p = px.get(`${c},${r}`);
      if (!p) {
        c++;
        continue;
      }
      let c2 = c;
      while (px.get(`${c2 + 1},${r}`) && px.get(`${c2 + 1},${r}`).col === p.col) c2++;
      fronts.push({ fill: p.col, pts: [[c, r], [c2 + 1, r], [c2 + 1, r + 1], [c, r + 1]] });
      c = c2 + 1;
    }
  }
  const shadowPts = shadow.flatMap((poly) => poly.flatMap((ring) => ring));
  const fit = fitBox([...sides.flatMap((s) => s.pts), ...fronts.flatMap((f) => f.pts), ...shadowPts], pad);
  const g = 0.16 / fit.k;
  const grow = (pts) => {
    const cx = pts.reduce((t, p) => t + p[0], 0) / pts.length;
    const cy = pts.reduce((t, p) => t + p[1], 0) / pts.length;
    return pts.map(([x, y]) => [x + Math.sign(x - cx) * g, y + Math.sign(y - cy) * g]);
  };
  let out = `<path fill="#000" fill-opacity="${SHADOW_OPACITY}" fill-rule="evenodd" d="${polysPath(shadow, ([x, y]) => [fit.X(x), fit.Y(y)])}"/>`;
  const group = (list) => {
    const by = new Map();
    for (const s of list) by.set(s.fill, (by.get(s.fill) || '') + 'M' + grow(s.pts).map(([x, y]) => `${fit.X(x)} ${fit.Y(y)}`).join(' ') + 'Z');
    for (const [fill, d] of by) out += `<path fill="${fill}" d="${d}"/>`;
  };
  group(sides);
  group(fronts);
  return out;
}

// A sprite from a function: f(x, y) -> palette key or '.'
function spriteFrom(f) {
  const rows = [];
  for (let y = 0; y < 16; y++) {
    let s = '';
    for (let x = 0; x < 16; x++) s += f(x, y);
    rows.push(s);
  }
  return rows;
}
// Wrap the filled pixels of a sprite with an outline key.
function outline(rows, key = 'O') {
  const at = (x, y) => (y >= 0 && y < 16 && x >= 0 && x < 16 ? rows[y][x] : '.');
  return spriteFrom((x, y) => {
    if (at(x, y) !== '.') return at(x, y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (at(x + dx, y + dy) !== '.' && at(x + dx, y + dy) !== key) return key;
    return '.';
  });
}

// ------------------------------------------------------------------ blocks (8×8×8)
const N = 8;
// tex(face, u, v) -> color; u, v in 0..7 (v = 0 is the top row on the sides)
function cube(tex, opts = {}) {
  const m = new Model();
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++)
      for (let z = 0; z < N; z++) {
        const surface = x === N - 1 || y === N - 1 || z === N - 1;
        if (!surface) continue;
        m.set(
          x,
          y,
          z,
          (face) => {
            if (face === 'top') return tex('top', x, y, z);
            if (face === 'left') return tex('left', x, N - 1 - z, z);
            return tex('right', y, N - 1 - z, z);
          },
          opts,
        );
      }
  return m;
}
const noise = (cols, seed) => (u, v, k = 0) => pick(cols, hashXYZ(u, v, seed, k));

function grass() {
  const g = noise(['#5cb547', '#4fa63d', '#69c452', '#58b043', '#74cf5a'], 1);
  const d = noise(['#8a5a3b', '#7a4e33', '#966645', '#83563a', '#6f462e'], 2);
  return cube((face, u, v) => {
    if (face === 'top') return g(u, v);
    const drip = v === 0 || (v === 1 && hashXYZ(u, face === 'left' ? 1 : 2, 9) > 0.45) || (v === 2 && hashXYZ(u, face === 'left' ? 3 : 4, 9) > 0.82);
    return drip ? g(u, v, 3) : d(u, v);
  });
}
function stone() {
  const s = noise(['#8e9399', '#82878d', '#9aa0a6', '#7b8086', '#a3a8ad'], 3);
  return cube((face, u, v) => {
    const crack = (face === 'left' && ((u === 2 && v >= 2 && v <= 4) || (v === 4 && u >= 2 && u <= 3))) || (face === 'right' && ((u === 5 && v >= 1 && v <= 2) || (v === 5 && u >= 4 && u <= 6))) || (face === 'top' && ((u === 4 && v === 2) || (u === 5 && v === 3)));
    return crack ? '#666b71' : s(u, v, face.length);
  });
}
function planks() {
  const w = noise(['#b8894f', '#ad7f47', '#c29358', '#a87a43'], 4);
  return cube((face, u, v) => {
    if (face === 'top') return u % 4 === 3 ? '#7f5a33' : w(u, v);
    const row = Math.floor(v / 2);
    if (v % 2 === 1) return '#80592f';
    const joint = (row % 2 === 0 ? 5 : 2) === u;
    return joint ? '#8c6337' : w(u, v, row);
  });
}
function bricks() {
  const b = noise(['#b4523a', '#a5472f', '#c05e45', '#ad4c35'], 5);
  const mortar = '#c7bcaa';
  return cube((face, u, v) => {
    if (face === 'top') return (u === 3 || u === 7 || v === 3 || v === 7) && !(u === 3 && v === 3) ? mortar : b(u, v);
    if (v % 4 === 3) return mortar;
    const row = Math.floor(v / 4);
    return u === (row % 2 === 0 ? 3 : 7) ? mortar : b(u, v, row);
  });
}
function sand() {
  const s = noise(['#e7d398', '#dcc685', '#efddab', '#e2cd8e', '#d6bf7c'], 6);
  return cube((face, u, v) => s(u, v, face.length));
}
function snow() {
  const s = noise(['#f6fafc', '#eaf1f6', '#ffffff', '#e4edf3'], 7);
  const f = noise(['#d5e3ed', '#c6d8e5', '#dbe8f0'], 8);
  return cube((face, u, v) => (face === 'top' || v <= 1 || (v === 2 && hashXYZ(u, face.length, 11) > 0.5) ? s(u, v) : f(u, v)));
}
function ice() {
  const i = noise(['#9cd6f3', '#8acbec', '#b2e3f9'], 9);
  return cube(
    (face, u, v) => {
      if ((u + v) % 7 === 2 || (u + v) % 7 === 3) return '#e8f8ff';
      return i(u, v, face.length);
    },
    { a: 1 },
  );
}
function gold() {
  return cube((face, u, v) => {
    if (u === 0 || v === 0) return '#ffe582';
    if (u === 7 || v === 7) return '#c88f1c';
    if ((u === 2 && v === 2) || (u === 3 && v === 2) || (u === 2 && v === 3)) return '#fff2b8';
    return hashXYZ(u, v, 12) > 0.8 ? '#e9b42c' : '#f4c63b';
  });
}
function gemOre() {
  const s = noise(['#8e9399', '#83888e', '#9aa0a6', '#7b8086'], 13);
  const gems = { top: [[2, 2], [5, 4], [3, 6]], left: [[1, 2], [5, 1], [4, 5], [2, 6]], right: [[2, 1], [6, 3], [3, 5]] };
  return cube((face, u, v) => {
    for (const [gu, gv] of gems[face]) {
      if (u === gu && v === gv) return '#e8364f';
      if (u === gu + 1 && v === gv) return '#ff7489';
      if (u === gu && v === gv + 1) return '#b81f38';
    }
    return s(u, v, face.length);
  });
}
function magma() {
  const r = noise(['#3b1d16', '#4a2419', '#331813', '#562a1c'], 14);
  const crack = (face, u, v) => {
    if (face === 'top') return (u === v || u === v + 1) && u > 0 && u < 7 ? 1 : u === 5 && v <= 2 ? 1 : 0;
    if (face === 'left') return (v === 3 && u <= 4) || (u === 4 && v >= 3 && v <= 6) ? 1 : 0;
    return (v === 5 && u >= 2) || (u === 2 && v <= 5 && v >= 2) ? 1 : 0;
  };
  return cube((face, u, v) => (crack(face, u, v) ? (hashXYZ(u, v, 15) > 0.5 ? '!#ff7a18' : '!#ffae2e') : r(u, v, face.length)));
}
function leaves() {
  const l = noise(['#3f9a3a', '#2f822c', '#53b04a', '#3a8f35', '#2a7326'], 16);
  return cube((face, u, v) => (hashXYZ(u, v, face.length, 17) > 0.83 ? '#1f5a1c' : l(u, v, face.length)));
}
function log() {
  const bark = noise(['#6a4a2b', '#5b3e23', '#77553a', '#614427'], 18);
  return cube((face, u, v) => {
    if (face === 'top') {
      const d = Math.max(Math.abs(u - 3.5), Math.abs(v - 3.5));
      if (d > 3) return '#5d4026';
      return d > 2 ? '#b3854f' : d > 1 ? '#9c7144' : '#b3854f';
    }
    return u % 3 === 1 ? '#4f3520' : bark(u, v);
  });
}
function pumpkin({ carved = false } = {}) {
  const m = cube((face, u, v) => {
    if (face === 'top') {
      if (u >= 3 && u <= 4 && v >= 3 && v <= 4) return '#6f8a2c';
      return (u + v) % 3 === 0 ? '#c4651a' : '#d8761f';
    }
    if (carved && face === 'left') {
      const eyes = (v === 2 || v === 3) && (u === 1 || u === 2 || u === 5 || u === 6) && !(v === 2 && (u === 1 || u === 6));
      const mouth = (v === 5 && u >= 1 && u <= 6) || (v === 6 && (u === 2 || u === 3 || u === 5)) || (v === 4 && (u === 1 || u === 6));
      if (eyes || mouth) return hashXYZ(u, v, 19) > 0.4 ? '!#ffd23a' : '!#ffb21f';
    }
    return u % 2 === 0 ? '#df7420' : '#cc6418';
  });
  // stem
  m.set(3, 3, 8, (f) => (f === 'top' ? '#6f8a2c' : '#55701f'));
  m.set(4, 3, 9, (f) => (f === 'top' ? '#7d9a33' : '#5d7a22'));
  return m;
}
function gift() {
  return cube((face, u, v) => {
    const ribbon = face === 'top' ? u === 3 || u === 4 || v === 3 || v === 4 : u === 3 || u === 4;
    if (ribbon) return (face === 'top' && (u + v) % 2 === 0) || v === 0 ? '#ffd65c' : '#efb829';
    return v === 0 ? '#e5484a' : hashXYZ(u, v, 20) > 0.85 ? '#c93636' : '#d93d3f';
  }).set(2, 3, 8, '#ffd65c').set(5, 4, 8, '#ffd65c').set(3, 2, 8, '#efb829').set(4, 5, 8, '#efb829');
}
function jelly() {
  const m = new Model();
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) if (x === N - 1 || y === N - 1 || z === N - 1) m.set(x, y, z, (f) => (f === 'top' ? '#9be98f' : '#76d66b'), { a: 0.72 });
  m.box(2, 2, 2, 5, 5, 5, (x, y, z) => ((x + y + z) % 3 === 0 ? '#3e9c3a' : '#4aad45'));
  return m;
}
function crate() {
  const w = noise(['#b0814a', '#a47544', '#bb8b52'], 21);
  return cube((face, u, v) => {
    if (u === 0 || u === 7 || v === 0 || v === 7) return '#6e4a26';
    if (u === v || u === 7 - v) return '#7f5730';
    return w(u, v, face.length);
  });
}

// ------------------------------------------------------------------ objects
function chest() {
  const m = new Model();
  const wood = (x, y, z, f) => {
    if (z === 3) return '#5b3b1a';
    if (f === 'top') return (x + y) % 4 === 0 ? '#9c6a31' : '#ab7637';
    return z === 6 ? '#b88044' : (x + z) % 3 === 0 ? '#93612b' : '#a26e33';
  };
  m.box(0, 0, 0, 7, 6, 6, wood);
  // latch on the front (left face, y = 6)
  m.set(3, 7, 3, '#f0cf55').set(4, 7, 3, '#d9b33b').set(3, 7, 2, '#c79f2f').set(4, 7, 2, '#b88f28');
  return m;
}
function cake() {
  const m = new Model();
  m.box(0, 0, 0, 7, 7, 3, (x, y, z, f) => {
    if (z === 3) return f === 'top' ? '#f7f2ea' : '#efe8dc';
    if (z === 2 && f !== 'top' && (x + y) % 3 === 0) return '#efe8dc';
    return z === 1 ? '#c98f55' : '#e3b979';
  });
  for (const [x, y] of [[1, 1], [5, 1], [3, 4], [1, 6], [6, 6]]) m.set(x, y, 4, (f) => (f === 'top' ? '#e5283f' : '#bd1d31'));
  return m;
}
function campfire() {
  const m = new Model();
  const logC = (x, y, z, f) => (f === 'top' ? '#7a5533' : '#5f4127');
  m.box(0, 3, 0, 7, 4, 0, logC);
  m.box(3, 0, 1, 4, 7, 1, logC);
  m.set(0, 3, 0, '#b78753').set(0, 4, 0, '#b78753').set(3, 0, 1, '#b78753').set(4, 0, 1, '#b78753');
  for (let x = 2; x <= 5; x++) for (let y = 2; y <= 5; y++) if (!m.has(x, y, 0)) m.set(x, y, 0, '#3b2a22');
  const flame = [
    [3, 3, 2, '#ff6a1a'], [4, 3, 2, '#ff8a1f'], [3, 4, 2, '#ff8a1f'], [4, 4, 2, '#ffb52e'],
    [3, 3, 3, '#ff8a1f'], [4, 4, 3, '#ffd23a'], [3, 4, 3, '#ffb52e'], [4, 3, 3, '#ffb52e'],
    [4, 4, 4, '#ffe066'], [3, 4, 4, '#ffd23a'], [4, 4, 5, '#fff2a8'], [2, 3, 2, '#ff6a1a'], [5, 4, 2, '#ff6a1a'],
  ];
  for (const [x, y, z, c] of flame) m.set(x, y, z, c, { glow: true });
  return m;
}
function lantern() {
  const m = new Model();
  const frame = (x, y, z, f) => (f === 'top' ? '#4a4f56' : '#34383d');
  m.box(1, 1, 0, 6, 6, 0, frame);
  m.box(1, 1, 6, 6, 6, 6, frame);
  m.box(2, 2, 7, 5, 5, 7, frame);
  for (const [x, y] of [[1, 1], [6, 1], [1, 6], [6, 6]]) m.box(x, y, 1, x, y, 5, frame);
  m.box(2, 2, 1, 5, 5, 5, (x, y, z) => ((x + y + z) % 2 === 0 ? '#ffd56b' : '#ffc23d'), { glow: true });
  m.set(3, 3, 8, '#34383d').set(4, 3, 8, '#34383d').set(3, 4, 8, '#34383d').set(4, 4, 8, '#34383d').set(3, 3, 9, '#4a4f56');
  return m;
}
function mushroom() {
  const m = new Model();
  m.box(3, 3, 0, 4, 4, 3, (x, y, z, f) => (f === 'top' ? '#f2eadb' : '#e2d6c0'));
  m.box(1, 1, 4, 6, 6, 5, '#d6303b');
  m.box(2, 2, 6, 5, 5, 6, '#d6303b');
  for (const [x, y, z] of [[2, 6, 5], [5, 6, 4], [6, 3, 5], [6, 5, 4], [3, 3, 6], [5, 4, 6], [1, 2, 5]]) m.set(x, y, z, '#fbf6ec');
  return m;
}
function tree() {
  const m = new Model();
  m.box(3, 3, 0, 4, 4, 4, (x, y, z, f) => (f === 'top' ? '#8a6038' : '#664627'));
  const leafC = ['#47a23d', '#3b8f33', '#56b74b', '#358230'];
  for (let x = 0; x <= 7; x++)
    for (let y = 0; y <= 7; y++)
      for (let z = 4; z <= 9; z++) {
        const dx = x - 3.5;
        const dy = y - 3.5;
        const dz = (z - 6.5) * 1.2;
        if (dx * dx + dy * dy + dz * dz <= 15.5 && hashXYZ(x, y, z, 23) > 0.06) m.set(x, y, z, pick(leafC, hashXYZ(x, y, z, 24)));
      }
  return m;
}
function cactus() {
  const m = new Model();
  const g = (x, y, z, f) => (f === 'top' ? '#6cc04a' : (z + x + y) % 3 === 0 ? '#4b9433' : '#58a93c');
  m.box(3, 3, 0, 4, 4, 9, g);
  m.box(5, 3, 4, 6, 4, 4, g);
  m.box(6, 3, 5, 6, 4, 7, g);
  m.box(1, 3, 3, 2, 4, 3, g);
  m.box(1, 3, 4, 1, 4, 6, g);
  for (const [x, y, z] of [[3, 5, 7], [4, 5, 2], [6, 5, 6], [1, 5, 5]]) m.set(x, y, z, '#ece6c6');
  return m;
}
function anvil() {
  const m = new Model();
  const iron = (x, y, z, f) => (f === 'top' ? '#6a7077' : (x + z) % 3 === 0 ? '#474c52' : '#53585e');
  m.box(1, 2, 0, 6, 5, 0, iron);
  m.box(2, 3, 1, 5, 4, 1, iron);
  m.box(3, 3, 2, 4, 4, 3, iron);
  m.box(0, 2, 4, 7, 5, 5, iron);
  m.box(8, 3, 5, 8, 4, 5, iron);
  return m;
}
function crystal() {
  const m = new Model();
  const c = (x, y, z, f) => (f === 'top' ? '#a8f6f8' : (x + y + z) % 2 ? '#56d6e0' : '#3cbccb');
  m.box(3, 3, 0, 4, 4, 9, c, { glow: false });
  m.box(1, 4, 0, 2, 5, 5, c);
  m.box(5, 2, 0, 6, 3, 6, c);
  m.box(4, 5, 0, 5, 6, 3, c);
  for (let x = 0; x <= 7; x++) for (let y = 1; y <= 7; y++) if (!m.has(x, y, 0)) m.set(x, y, 0, (x + y) % 2 ? '#7a7f86' : '#6c7178');
  return m;
}

// ------------------------------------------------------------------ item sprites

const SWORD = item(
  [
    '................',
    '.............OO.',
    '............OWLO',
    '...........OWLMO',
    '..........OWLMO.',
    '.........OWLMO..',
    '........OWLMO...',
    '...OO..OWLMO....',
    '...OGO.OLMO.....',
    '....OGOLMO......',
    '.....OGGO.......',
    '.....OHGGO......',
    '....OHHO.OO.....',
    '...OHHO.........',
    '...OOO..........',
    '................',
  ],
  { O: '#2b2f36', W: '#f4f8fb', L: '#c9d3df', M: '#8f9cad', G: '#e2b23e', H: '#7a5230' },
);
const PICKAXE = item(
  [
    '................',
    '....OOOOOO......',
    '...OSSSSSSO.....',
    '..OSLLLLLSSO....',
    '.OSLOOOOOLSSO...',
    '.OSO....OHOSO...',
    '.OO....OHO.OSO..',
    '......OHO...OSO.',
    '.....OHO.....OO.',
    '....OHO.........',
    '...OHO..........',
    '..OHO...........',
    '.OHO............',
    '.OO.............',
    '................',
    '................',
  ],
  { O: '#2b2f36', S: '#aab4c0', L: '#dfe6ee', H: '#8a5a2e' },
);
const AXE = item(
  [
    '................',
    '........OOO.....',
    '.......OSSSO....',
    '......OSLLSSO...',
    '.....OSLSSSSO...',
    '.....OSSSOOSO...',
    '......OSOHOO....',
    '.......OHO......',
    '......OHO.......',
    '.....OHO........',
    '....OHO.........',
    '...OHO..........',
    '..OHO...........',
    '..OO............',
    '................',
    '................',
  ],
  { O: '#2b2f36', S: '#aab4c0', L: '#dfe6ee', H: '#8a5a2e' },
);
const APPLE = item(
  [
    '................',
    '.......OO.......',
    '......OBOOO.....',
    '.....OOBOLLO....',
    '...OOORROOO.....',
    '..ORRRRRRRRO....',
    '.ORWWRRRRRRRO...',
    '.ORWRRRRRRRRO...',
    '.ORRRRRRRRRDO...',
    '.ORRRRRRRRRDO...',
    '..ORRRRRRRDO....',
    '..ORRRRRRDDO....',
    '...ORRDRDDO.....',
    '....OOOOOO......',
    '................',
    '................',
  ],
  { O: '#2b1d1d', R: '#d8303d', D: '#a51f2b', W: '#ff9aa2', B: '#6b4a2b', L: '#58b84b' },
);
const HEART = item(
  [
    '................',
    '................',
    '..OOO....OOO....',
    '.ORRRO..ORRRO...',
    'ORWWRRORRRRRRO..',
    'ORWRRRRRRRRRRO..',
    'ORRRRRRRRRRRRO..',
    'ORRRRRRRRRRRDO..',
    '.ORRRRRRRRRDO...',
    '..ORRRRRRRDO....',
    '...ORRRRRDO.....',
    '....ORRRDO......',
    '.....ORDO.......',
    '......OO........',
    '................',
    '................',
  ],
  { O: '#3a0d14', R: '#e8344d', D: '#b51f36', W: '#ffa3b0' },
);
const KEY = item(
  [
    '................',
    '..OOOO..........',
    '.OYYYYO.........',
    'OYLOOYYO........',
    'OYO..OYO........',
    'OYO..OYO........',
    'OYYOOYYO........',
    '.OYYYYYOOOOOOOO.',
    '..OOOOYYYYYYYYYO',
    '......OOOOOYOYOO',
    '..........OYOYO.',
    '..........OOOOO.',
    '................',
    '................',
    '................',
    '................',
  ],
  { O: '#4a3208', Y: '#f2c23a', L: '#fff0a8' },
);
const STAR = item(
  [
    '.......OO.......',
    '......OYYO......',
    '......OYYO......',
    '.....OYLYYO.....',
    'OOOOOOYLYYOOOOOO',
    'OYYYYYYYYYYYYYYO',
    '.OYYYYYYYYYYYYO.',
    '..OYYYYYYYYYYO..',
    '...OYYYYYYYYO...',
    '...OYYYYYYYYO...',
    '..OYYYYOOYYYYO..',
    '..OYYYO..OYYYO..',
    '.OYYOO....OOYYO.',
    '.OYO........OYO.',
    '.OO..........OO.',
    '................',
  ],
  { O: '#5a3b06', Y: '#ffd23a', L: '#fff3b0' },
);
const MAP = item(
  [
    '................',
    '.OOOOOOOOOOOOO..',
    'OPPPPPPPPPPPPPO.',
    'OPGGGPPPPBBPPPO.',
    'OPGGGGPPBBBBPPO.',
    'OPPGGPPPPBBPPPO.',
    'OPPPPPPRPPPPPPO.',
    'OPPBBPPRRPPGGPO.',
    'OPBBBBPPPPGGGPO.',
    'OPPBBPPPPPPGPPO.',
    'OPPPPPPPGGPPPPO.',
    'OPPPPPPGGGPPPPO.',
    'OPPPPPPPPPPPPPO.',
    '.OOOOOOOOOOOOO..',
    '................',
    '................',
  ],
  { O: '#5e4524', P: '#efe0b6', G: '#7bbd5a', B: '#6aa9d8', R: '#d83a3a' },
);
const FISH = item(
  [
    '................',
    '................',
    '......OOOO......',
    '....OOBBBBOO..OO',
    '...OBBBBBBBBOOBO',
    '..OBWOBBBBBBBBBO',
    '.OBBOOBBBBBBBBO.',
    '.OLLLLLBBBBBBBO.',
    '..OLLLLLLLLBBBBO',
    '...OOLLLLLLOOOBO',
    '.....OOOOOO...OO',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  { O: '#16314a', B: '#4f9fe0', L: '#bfe3fb', W: '#ffffff' },
);
const GEM = item(
  [
    '................',
    '....OOOOOOOO....',
    '...OLLCCCCCCO...',
    '..OLWLCCCCCDDO..',
    '.OCCCCCCCCCDDDO.',
    'OOOOOOOOOOOOOOOO',
    '.OCCLCCCCCCCDDO.',
    '..OCLCCCCCCDDO..',
    '...OCCCCCCDDO...',
    '....OCCCCCDO....',
    '.....OCCCDO.....',
    '......OCDO......',
    '.......OO.......',
    '................',
    '................',
    '................',
  ],
  { O: '#0f3b4d', C: '#43cdee', L: '#a8efff', W: '#ffffff', D: '#2299c4' },
);
const CROWN = item(
  [
    '................',
    '................',
    '..O....O....O...',
    '.OYO..OYO..OYO..',
    '.OYO..ORO..OYO..',
    '.OYYOOYYYOOYYO..',
    '.OYYYYYYYYYYYO..',
    '.OYRYYYBYYYRYO..',
    '.OYYYYYYYYYYYO..',
    '.OLLLLLLLLLLLO..',
    '.OOOOOOOOOOOOO..',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  { O: '#5a3b06', Y: '#f3c13a', L: '#ffe58a', R: '#e2364c', B: '#3f8ee8' },
);

// ------------------------------------------------------------------ more blocks
function oven() {
  const s = noise(['#9a9ea3', '#8f9398', '#a6aaae', '#878b90'], 30);
  return cube((face, u, v) => {
    if (face === 'top') return u === 0 || u === 7 || v === 0 || v === 7 ? '#7d8186' : s(u, v, 1);
    if (face === 'left') {
      // the mouth of the oven with the fire at the bottom
      if (u >= 2 && u <= 5 && v >= 3 && v <= 6) {
        if (v === 6) return hashXYZ(u, v, 31) > 0.5 ? '!#ff8a1f' : '!#ffb52e';
        if (v === 5) return u === 3 || u === 4 ? '!#ffd23a' : '!#ff7a18';
        return '#1f1b1a';
      }
      if (v === 2 && u >= 1 && u <= 6) return '#6f7378';
    }
    if (v === 0 || v === 7) return '#7d8186';
    return s(u, v, face.length);
  });
}
function bookshelf() {
  const w = noise(['#b8894f', '#ad7f47', '#c29358'], 32);
  const books = ['#c0392b', '#2e86c1', '#27ae60', '#8e44ad', '#d4ac0d', '#a0522d', '#e67e22', '#16a085'];
  return cube((face, u, v) => {
    if (face === 'top') return u % 4 === 3 ? '#7f5a33' : w(u, v);
    if (v === 0 || v === 7) return '#9c6f3e';
    if (v === 3) return '#8c6337';
    const shelf = v < 3 ? 0 : 1;
    if (hashXYZ(u, shelf, face.length, 33) > 0.84) return '#3a2a1c';
    const col = pick(books, hashXYZ(u, shelf, face.length, 34));
    return v === 1 || v === 4 ? shade(col, 1.15) : col;
  });
}
function barrel() {
  return cube((face, u, v) => {
    if (face === 'top') {
      const d = Math.max(Math.abs(u - 3.5), Math.abs(v - 3.5));
      if (d > 3) return '#5d4026';
      if (d > 2) return '#7d5531';
      if (u >= 3 && u <= 4 && v >= 3 && v <= 4) return '#3b2a1a';
      return u % 2 ? '#a8784a' : '#b48452';
    }
    if (v === 1 || v === 6) return u % 3 === 0 ? '#737880' : '#5f646b';
    return u % 2 ? '#94683d' : '#a47546';
  });
}
function melon() {
  return cube((face, u, v) => {
    if (face === 'top') {
      if (u >= 3 && u <= 4 && v >= 3 && v <= 4) return '#9bd25c';
      const d = Math.max(Math.abs(u - 3.5), Math.abs(v - 3.5));
      return d > 2.5 ? '#3d8a2c' : (u + v) % 2 ? '#4b9b35' : '#56a83c';
    }
    return u % 3 === 1 ? '#86c94c' : hashXYZ(u, v, face.length, 35) > 0.8 ? '#367d27' : '#3f8f2f';
  });
}

// ------------------------------------------------------------------ more objects
function house() {
  const m = new Model();
  const wall = (x, y, z, f) => (f === 'top' ? '#c29358' : z % 2 ? '#b8894f' : '#a97b45');
  const post = (x, y, z, f) => (f === 'top' ? '#9c7144' : '#5b3e23');
  const roof = (x, y, z, f) => (f === 'top' ? ((x + y) % 2 ? '#d0503f' : '#c64a3a') : f === 'left' ? '#a63a2d' : '#8e3126');
  const lit = (face) => (x, y, z, f) => (f === face ? '!#ffe08a' : '#5b3e23');
  m.box(0, 0, 0, 7, 6, 3, wall);
  for (const [x, y] of [[0, 0], [7, 0], [0, 6], [7, 6]]) m.box(x, y, 0, x, y, 3, post);
  // door and windows on the front (left face, y = 6), window on the side (right face, x = 7)
  for (let z = 0; z <= 2; z++) for (let x = 3; x <= 4; x++) m.set(x, 6, z, (f) => (f === 'left' ? (x === 4 && z === 1 ? '#e0b84a' : '#6b4a2b') : '#5b3e23'));
  for (const x of [1, 6]) for (const z of [1, 2]) m.set(x, 6, z, (f) => lit('left')(x, 6, z, f));
  for (let y = 2; y <= 4; y++) for (const z of [1, 2]) m.set(7, y, z, (f) => lit('right')(7, y, z, f));
  // stepped gable roof along x, with the gable wall filled in
  for (let i = 0; i <= 4; i++)
    for (let x = -1; x <= 8; x++)
      for (let y = i - 1; y <= 7 - i; y++) {
        const rim = y === i - 1 || y === 7 - i || i === 4;
        if (rim) m.set(x, y, 4 + i, roof);
        else if (x >= 0 && x <= 7) m.set(x, y, 4 + i, wall);
      }
  m.box(5, 1, 6, 5, 1, 9, (x, y, z, f) => (f === 'top' ? '#3b3b3b' : z % 2 ? '#9a4b37' : '#8a4130'));
  return m;
}
function island() {
  const m = new Model();
  const LIFT = 1;
  const radii = [1, 1.8, 2.6, 3.3, 3.9, 4.5];
  const top = radii.length - 1;
  for (let z = 0; z <= top; z++)
    for (let x = 0; x <= 8; x++)
      for (let y = 0; y <= 8; y++) {
        const d = Math.hypot(x - 4, y - 4);
        if (d > radii[z] + (hashXYZ(x, y, z, 40) - 0.5) * 0.7) continue;
        if (z === top) m.set(x, y, z + LIFT, (f) => (f === 'top' ? pick(['#5cb547', '#4fa63d', '#69c452', '#58b043'], hashXYZ(x, y, 41)) : '#4fa63d'));
        else m.set(x, y, z + LIFT, pick(['#8a5a3b', '#7a4e33', '#966645', '#6f462e'], hashXYZ(x, y, z, 42)));
      }
  const base = top + LIFT + 1;
  m.box(5, 3, base, 5, 3, base + 2, (x, y, z, f) => (f === 'top' ? '#8a6038' : '#664627'));
  for (let x = 3; x <= 7; x++)
    for (let y = 1; y <= 5; y++)
      for (let z = base + 2; z <= base + 5; z++) {
        const dx = x - 5;
        const dy = y - 3;
        const dz = (z - (base + 3.5)) * 1.3;
        if (dx * dx + dy * dy + dz * dz <= 5.2 && !m.has(x, y, z)) m.set(x, y, z, pick(['#47a23d', '#3b8f33', '#56b74b'], hashXYZ(x, y, z, 43)));
      }
  return m;
}
function tower() {
  const m = new Model();
  const st = (x, y, z, f) => (f === 'top' ? (x + y) % 2 ? '#a9adb2' : '#b3b7bb' : (x + y + z) % 3 === 0 ? '#878b90' : (x * 3 + z) % 5 === 0 ? '#a1a5aa' : '#94989d');
  m.box(0, 0, 0, 5, 5, 8, st);
  for (let x = 0; x <= 5; x++)
    for (let y = 0; y <= 5; y++) {
      const rim = x === 0 || y === 0 || x === 5 || y === 5;
      if (rim && (x + y) % 2 === 0) m.set(x, y, 9, st);
    }
  // door on the front, arrow slits on both sides
  for (let x = 2; x <= 3; x++) for (let z = 0; z <= 2; z++) m.set(x, 5, z, (f) => (f === 'left' ? (z === 2 ? '#4a3420' : '#6b4a2b') : '#94989d'));
  for (const z of [5, 6]) {
    m.set(2, 5, z + 0, (f) => (f === 'left' ? '#2a2420' : '#94989d'));
    m.set(5, 2, z, (f) => (f === 'right' ? '#2a2420' : '#94989d'));
    m.set(5, 3, z - 2, (f) => (f === 'right' ? '#2a2420' : '#94989d'));
  }
  // flag
  m.box(2, 2, 9, 2, 2, 14, (x, y, z, f) => (f === 'top' ? '#8a8e93' : '#5b5f64'));
  for (const [x, z] of [[3, 13], [4, 13], [5, 13], [3, 12], [4, 12], [3, 14], [4, 14], [5, 14]]) m.set(x, 2, z, (f) => (f === 'top' ? '#ee5644' : '#d23f2f'));
  return m;
}
function rocket() {
  const m = new Model();
  const L = 2;
  const body = (x, y, z, f) => (f === 'top' ? '#f3f5f8' : z % 5 === 0 ? '#cfd5dd' : '#e6e9ee');
  const red = (x, y, z, f) => (f === 'top' ? '#ee5644' : '#d23f2f');
  m.box(1, 1, L + 1, 6, 6, L + 11, body);
  for (const [x, y] of [[1, 1], [6, 1], [1, 6], [6, 6]]) for (let z = L + 1; z <= L + 11; z++) m.del(x, y, z);
  // round windows on the two visible sides
  for (const z of [L + 7, L + 8]) {
    for (const x of [3, 4]) m.set(x, 6, z, (f) => (f === 'left' ? (z === L + 8 && x === 3 ? '#c9f3ff' : '#4fb6ea') : '#e6e9ee'));
    for (const y of [3, 4]) m.set(6, y, z, (f) => (f === 'right' ? '#3c9bd0' : '#e6e9ee'));
  }
  for (const [x, y] of [[2, 6], [5, 6]]) m.set(x, y, L + 7, (f) => (f === 'left' ? '#9aa3ad' : '#e6e9ee')).set(x, y, L + 8, (f) => (f === 'left' ? '#9aa3ad' : '#e6e9ee'));
  // nose cone
  m.box(2, 1, L + 12, 5, 6, L + 12, red);
  m.box(1, 2, L + 12, 6, 5, L + 12, red);
  m.box(2, 2, L + 13, 5, 5, L + 14, red);
  m.box(3, 3, L + 15, 4, 4, L + 16, red);
  // fins
  for (let z = L + 1; z <= L + 4; z++) {
    const out = z <= L + 2 ? 2 : 1;
    for (let k = 1; k <= out; k++) {
      m.set(6 + k, 3, z, red).set(6 + k, 4, z, red);
      m.set(3, 6 + k, z, red).set(4, 6 + k, z, red);
      m.set(1 - k, 3, z, red).set(1 - k, 4, z, red);
      m.set(3, 1 - k, z, red).set(4, 1 - k, z, red);
    }
  }
  // flame
  for (const [x, y, c] of [[3, 3, '#ffd23a'], [4, 4, '#ffb52e'], [3, 4, '#ff8a1f'], [4, 3, '#ffd23a'], [2, 3, '#ff8a1f'], [5, 4, '#ff8a1f'], [3, 5, '#ff6a1a'], [4, 2, '#ff6a1a']]) m.set(x, y, L, c, { glow: true });
  m.set(3, 4, L - 1, '#ff8a1f', { glow: true, noShadow: true }).set(4, 4, L - 1, '#ffd23a', { glow: true, noShadow: true }).set(4, 4, L - 2, '#ff6a1a', { glow: true, noShadow: true });
  return m;
}

// ------------------------------------------------------------------ more items
const POTION = item(
  [
    '......OOOO......',
    '......OCcO......',
    '......OCcO......',
    '.....OOOOOO.....',
    '......OGGO......',
    '......OGGO......',
    '....OOGGGGOO....',
    '...OGGGGGGGGO...',
    '..OGWGGGGGGGGO..',
    '..OWLLLLLLLLPO..',
    '..OWPPPPPPPPDO..',
    '..OPPPPPPPPPDO..',
    '..OPPPPPPPPDDO..',
    '...OPPPPPPDDO...',
    '....OOOOOOOO....',
    '................',
  ],
  { O: '#2e1f36', C: '#c08a52', c: '#9c6a37', G: '#cfe6f0', W: '#ffffff', L: '#f08cff', P: '#d24be6', D: '#9a2bb3' },
);
const SHIELD = item(
  [
    '................',
    '.OOOOOOOOOOOOOO.',
    '.OMMMMMMMMMMMMO.',
    '.OMBBBBYYBBBBMO.',
    '.OMBBBBYYBBBBMO.',
    '.OMBBBBYYBBBBMO.',
    '.OMYYYYYYYYYYMO.',
    '.OMYYYYYYYYYYMO.',
    '.OMBBBBYYBBBDMO.',
    '..OMBBBYYBBDMO..',
    '..OMBBBYYBBDMO..',
    '...OMBBYYBDMO...',
    '....OMBYYDMO....',
    '.....OMMMMO.....',
    '......OOOO......',
    '................',
  ],
  { O: '#1d2633', M: '#b8c2cf', B: '#3c78d8', D: '#2a57a8', Y: '#f2c23a' },
);
const BOOK = item(
  [
    '................',
    '...OOOOOOOOOOO..',
    '..OSRRRRRRRRRPO.',
    '..OSGRRRRRRGRPO.',
    '..OSRRRRRRRRRPO.',
    '..OSRRYYYYRRRPO.',
    '..OSRRYRRYRRRPO.',
    '..OSRRYRRYRRRPO.',
    '..OSRRYYYYRRRPO.',
    '..OSRRRRRRRRRPO.',
    '..OSGRRRRRRGRPO.',
    '..OSRRRRRRRRRPO.',
    '..OSDDDDDDDDDPO.',
    '...OOOOOOOOBOO..',
    '...........B....',
    '................',
  ],
  { O: '#2a1214', S: '#8f2430', R: '#c8394a', D: '#a52c3b', G: '#f2c23a', Y: '#f2c23a', P: '#f3ead2', B: '#3f8ee8' },
);
const TORCH = item(
  [
    '.......OO.......',
    '......OYYO......',
    '.....OYWYYO.....',
    '.....OYWWYO.....',
    '....OYYWWYRO....',
    '....ORYYYYRO....',
    '.....ORRRRO.....',
    '......OHHO......',
    '......OSsO......',
    '......OSsO......',
    '......OSsO......',
    '......OSsO......',
    '......OSsO......',
    '......OSsO......',
    '......OSsO......',
    '......OOOO......',
  ],
  { O: '#2b1d10', Y: '#ffd23a', W: '#fff3b0', R: '#ff7a1f', H: '#3b2a1a', S: '#a8763f', s: '#7a5230' },
);
const GEAR = item(
  outline(
    spriteFrom((x, y) => {
      const dx = x + 0.5 - 8;
      const dy = y + 0.5 - 8;
      const r = Math.hypot(dx, dy);
      const u = Math.atan2(dy, dx) / (Math.PI / 4);
      const tooth = Math.abs(u - Math.round(u)) < 0.26;
      if (r < 2.2) return '.';
      if (r <= 5.2 || (r <= 7.2 && tooth)) return dx + dy < -2.5 ? 'L' : dx + dy > 2.5 ? 'D' : 'M';
      return '.';
    }),
  ),
  { O: '#23272e', M: '#9aa4b1', L: '#cdd5df', D: '#6f7986' },
);

// ------------------------------------------------------------------ catalogue
// Three groups, shown in the editor one after the other: blocks, objects, items.
const SYMBOLS = [
  ['blocks', 'grass', 'Bloque de pasto', 'Grass block', grass()],
  ['blocks', 'stone', 'Piedra', 'Stone', stone()],
  ['blocks', 'planks', 'Tablones', 'Planks', planks()],
  ['blocks', 'bricks', 'Ladrillos', 'Bricks', bricks()],
  ['blocks', 'log', 'Tronco', 'Log', log()],
  ['blocks', 'leaves', 'Hojas', 'Leaves', leaves()],
  ['blocks', 'sand', 'Arena', 'Sand', sand()],
  ['blocks', 'snow', 'Nieve', 'Snow', snow()],
  ['blocks', 'ice', 'Hielo', 'Ice', ice()],
  ['blocks', 'gold', 'Bloque de oro', 'Gold block', gold()],
  ['blocks', 'gem-ore', 'Mena de rubí', 'Ruby ore', gemOre()],
  ['blocks', 'magma', 'Magma', 'Magma', magma()],
  ['blocks', 'oven', 'Horno', 'Oven', oven()],
  ['blocks', 'bookshelf', 'Librero', 'Bookshelf', bookshelf()],
  ['blocks', 'barrel', 'Barril', 'Barrel', barrel()],
  ['blocks', 'crate', 'Caja', 'Crate', crate()],
  ['blocks', 'melon', 'Sandía', 'Melon', melon()],
  ['blocks', 'pumpkin', 'Calabaza', 'Pumpkin', pumpkin()],
  ['blocks', 'jack', 'Calabaza tallada', 'Carved pumpkin', pumpkin({ carved: true })],
  ['blocks', 'jelly', 'Gelatina', 'Jelly', jelly()],
  ['blocks', 'gift', 'Regalo', 'Gift', gift()],
  ['objects', 'house', 'Casa', 'House', house()],
  ['objects', 'island', 'Isla flotante', 'Floating island', island()],
  ['objects', 'tree', 'Árbol', 'Tree', tree()],
  ['objects', 'mushroom', 'Hongo', 'Mushroom', mushroom()],
  ['objects', 'cactus', 'Cactus', 'Cactus', cactus()],
  ['objects', 'chest', 'Cofre', 'Chest', chest()],
  ['objects', 'cake', 'Pastel', 'Cake', cake()],
  ['objects', 'campfire', 'Fogata', 'Campfire', campfire()],
  ['objects', 'lantern', 'Farol', 'Lantern', lantern()],
  ['objects', 'anvil', 'Yunque', 'Anvil', anvil()],
  ['objects', 'crystal', 'Cristal', 'Crystal', crystal()],
  ['objects', 'tower', 'Torre', 'Tower', tower()],
  ['objects', 'rocket', 'Cohete', 'Rocket', rocket()],
  ['items', 'sword', 'Espada', 'Sword', SWORD],
  ['items', 'pickaxe', 'Pico', 'Pickaxe', PICKAXE],
  ['items', 'axe', 'Hacha', 'Axe', AXE],
  ['items', 'shield', 'Escudo', 'Shield', SHIELD],
  ['items', 'torch', 'Antorcha', 'Torch', TORCH],
  ['items', 'potion', 'Poción', 'Potion', POTION],
  ['items', 'book', 'Libro', 'Book', BOOK],
  ['items', 'map', 'Mapa', 'Map', MAP],
  ['items', 'key', 'Llave', 'Key', KEY],
  ['items', 'gear', 'Engranaje', 'Gear', GEAR],
  ['items', 'gem', 'Gema', 'Gem', GEM],
  ['items', 'crown', 'Corona', 'Crown', CROWN],
  ['items', 'star', 'Estrella', 'Star', STAR],
  ['items', 'heart', 'Corazón', 'Heart', HEART],
  ['items', 'apple', 'Manzana', 'Apple', APPLE],
  ['items', 'fish', 'Pez', 'Fish', FISH],
];

const lines = SYMBOLS.map(([group, id, es, en, model]) => {
  const svg = model instanceof Model ? render(model, { pad: 3 }) : renderItem(model, { pad: 7 });
  return `  { id: ${JSON.stringify(id)}, group: ${JSON.stringify(group)}, es: ${JSON.stringify(es)}, en: ${JSON.stringify(en)}, svg: ${JSON.stringify(svg)} },`;
});
const ids = new Set();
for (const [, id] of SYMBOLS) {
  if (ids.has(id)) throw new Error(`duplicated symbol ${id}`);
  ids.add(id);
}
const js = `// Generated by scripts/icons/build-symbols.mjs — original voxel symbols for
// the instance icon editor (100×100 box). Do not edit by hand.
export const SYMBOLS = [\n${lines.join('\n')}\n];\n`;
fs.writeFileSync(OUT, js);
console.log(`${SYMBOLS.length} symbols, ${(js.length / 1024).toFixed(0)} KB -> ${path.relative(root, OUT)}`);
