// Minecraft's textures in the page: asked once from the main process (which
// reads them from the game on this computer), cut to their first frame, plus a
// few made from them the way the game does (grass takes its green from a tint).
import { useSyncExternalStore } from 'react';
import { call, on } from './api.js';
import { symbolTextures } from './mc-symbols.js';

export const GRASS_TINT = '#91bd59'; // plains
const POTION_TINT = '#f82423'; // healing

// what the skin stage needs (lib/skyscene.js); sun and moon moved between versions
export const SCENE_TEXTURES = [
  'block/dirt', 'block/stone', 'block/short_grass', 'block/grass', 'block/poppy', 'block/dandelion', 'block/oxeye_daisy', 'block/cornflower', 'block/azure_bluet',
  'block/oak_log', 'block/oak_log_top', 'block/oak_leaves', 'misc/shadow',
  'environment/clouds', 'environment/celestial/sun', 'environment/sun', 'environment/celestial/moon/full_moon', 'environment/moon_phases',
];

// the festive themes (components/Seasonal.jsx): pumpkins, the snow that falls,
// the sparks of fireworks, the clock, the bat and the default player skin
const pad = (n) => String(n).padStart(2, '0');
export const SEASON_TEXTURES = [
  'block/jack_o_lantern', 'block/carved_pumpkin', 'block/spruce_sapling', 'environment/snow', 'particle/flash', 'item/firework_star',
  'entity/bat/bat', 'entity/bat', 'entity/player/wide/steve', 'entity/steve',
  ...Array.from({ length: 8 }, (_, i) => `particle/spark_${i}`),
  ...Array.from({ length: 64 }, (_, i) => `item/clock_${pad(i)}`),
];

// the game's title (the header of the game's pages): "MINECRAFT" and its "JAVA EDITION" ribbon
export const TITLE_TEXTURES = ['gui/title/minecraft', 'gui/title/edition'];
// the grass block that stands for the game in the sidebar, coloured as in the inventory
const BRAND_TEXTURES = ['block/grass_block_top', 'block/grass_block_side', 'block/grass_block_side_overlay', 'colormap/grass'];

const tex = new Map(); // name → { url, canvas }
const subs = new Set();
let version = 0;
let loading = null;
let settled = false; // the first look at the game's files ended (with or without them)

export const mcReady = () => tex.size > 0;
export const mcSettled = () => settled;
// the two pictures that stand for the game: its title and its grass block
export const brandReady = () => Boolean(tex.get('gui/title#logo') && tex.get('block/grass#inventory'));
export const mcTex = (name) => tex.get(name) || null;
export const mcUrl = (name) => (tex.get(name) ? tex.get(name).url : null);
export function useMcTextures() {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => version,
  );
}
export function onMcTextures(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  // kept in ordinary memory: these small pictures are read back (as addresses,
  // as pixels) far more often than they are drawn
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  return [c, g];
}

async function decode(url, { square = true } = {}) {
  const img = new Image();
  img.src = url;
  await img.decode();
  // animated textures are a strip of frames: the first one
  const w = img.naturalWidth;
  const h = square ? Math.min(img.naturalHeight, w) : img.naturalHeight;
  const [c, g] = canvasOf(w, h);
  g.drawImage(img, 0, 0, w, h, 0, 0, w, h);
  // a texture used whole keeps the address it came with
  if (h === img.naturalHeight) c.sourceUrl = url;
  return c;
}

// a greyscale texture times a colour (how the game colours grass and leaves); `mask` keeps its own transparency
export function tinted(src, color) {
  const [c, g] = canvasOf(src.width, src.height);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(src, 0, 0);
  return c;
}

function over(base, top) {
  const [c, g] = canvasOf(base.width, base.height);
  g.drawImage(base, 0, 0);
  g.drawImage(top, 0, 0);
  return c;
}

// The game's logo as its title screen lays it out: the "JAVA EDITION" ribbon
// centred under "MINECRAFT", over the logo's lower edge. Since 1.20 the logo is
// one piece (256×64, of which the top 44 rows are used); up to 1.19 it came in
// two halves, one above the other (256×256). Any other shape is left unused.
function titleLogo(logo, edition) {
  const k = logo.width / 256;
  if (!Number.isInteger(k) || k < 1) return null;
  let width;
  let pieces; // [source x, source y, width, height, x on the canvas]
  if (logo.height === 64 * k) {
    width = 256;
    pieces = [[0, 0, 256, 44, 0]];
  } else if (logo.height === 256 * k) {
    width = 274;
    pieces = [[0, 0, 155, 44, 0], [0, 45, 155, 44, 155]];
  } else return null;
  const ribbon = edition && edition.width === 128 * k ? (width === 256 ? { w: 128, x: 64 } : { w: 98, x: 88 }) : null;
  const [c, g] = canvasOf(width * k, (ribbon ? 51 : 44) * k);
  for (const [sx, sy, w, h, dx] of pieces) g.drawImage(logo, sx * k, sy * k, w * k, h * k, dx * k, 0, w * k, h * k);
  if (ribbon) g.drawImage(edition, 0, 0, ribbon.w * k, 14 * k, ribbon.x * k, 37 * k, ribbon.w * k, 14 * k);
  return c;
}

// The grass block as the game draws it in the inventory: its top and two of
// its sides, seen from above at the usual angle, the top fully lit, the left
// side at 80% and the right one at 60%, with the colour the game gives grass
// outside a world (its colour map at temperature 0.5 and rainfall 1.0, the
// map's middle). Drawn pixel by pixel (four samples each, so the edges are
// smooth) on a 150×150 picture that the cube fills, without shadow.
const SHADE = { top: 1, left: 0.8, right: 0.6 };
function grassColor(colormap) {
  if (!colormap || colormap.width < 2) return null;
  const x = Math.floor((127 / 256) * colormap.width);
  const y = Math.floor((127 / 256) * colormap.height);
  const d = colormap.getContext('2d').getImageData(x, y, 1, 1).data;
  return d[3] ? `rgb(${d[0]}, ${d[1]}, ${d[2]})` : null;
}
function inventoryGrassBlock(c) {
  const top0 = c('block/grass_block_top');
  const side0 = c('block/grass_block_side');
  if (!top0 || !side0) return null;
  const color = grassColor(c('colormap/grass')) || GRASS_TINT;
  const overlay = c('block/grass_block_side_overlay');
  const faces = {
    top: tinted(top0, color),
    side: overlay ? over(side0, tinted(overlay, color)) : side0,
  };
  const pixels = {};
  for (const [k, cv] of Object.entries(faces)) pixels[k] = { w: cv.width, h: cv.height, d: cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data };
  const N = 150;
  const cx = 75; // the front edge
  const half = 67; // from the front edge to either side corner
  const y0 = 1; // the back corner of the top
  const hh = half / 2; // the top seen at 2:1
  const sh = 82; // height of the sides
  // texel of a face at (u, v) in 0..16, or null outside the cube
  const sample = (px, py) => {
    const dx = px - cx;
    let face;
    let u;
    let v;
    if (Math.abs(dx) / half + Math.abs(py - (y0 + hh)) / hh <= 1) {
      face = 'top';
      const a = (dx * 16) / half;
      const b = ((py - y0) * 16) / hh;
      u = (a + b) / 2;
      v = (b - a) / 2;
    } else if (dx < 0 && dx >= -half) {
      const edge = y0 + hh + ((dx + half) * hh) / half;
      if (py < edge || py >= edge + sh) return null;
      face = 'left';
      u = ((dx + half) * 16) / half;
      v = ((py - edge) * 16) / sh;
    } else if (dx >= 0 && dx <= half) {
      const edge = y0 + 2 * hh - (dx * hh) / half;
      if (py < edge || py >= edge + sh) return null;
      face = 'right';
      u = (dx * 16) / half;
      v = ((py - edge) * 16) / sh;
    } else return null;
    const img = face === 'top' ? pixels.top : pixels.side;
    const tx = Math.min(img.w - 1, Math.max(0, Math.floor((u / 16) * img.w)));
    const ty = Math.min(img.h - 1, Math.max(0, Math.floor((v / 16) * img.h)));
    const i = (ty * img.w + tx) * 4;
    const k = SHADE[face];
    return [img.d[i] * k, img.d[i + 1] * k, img.d[i + 2] * k, img.d[i + 3]];
  };
  const [cv, g] = canvasOf(N, N);
  const out = g.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let r = 0;
      let gr = 0;
      let b = 0;
      let a = 0;
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const s = sample(x + ox, y + oy);
        if (!s) continue;
        const w = s[3] / 255;
        r += s[0] * w;
        gr += s[1] * w;
        b += s[2] * w;
        a += w;
      }
      if (!a) continue;
      const i = (y * N + x) * 4;
      out.data[i] = r / a;
      out.data[i + 1] = gr / a;
      out.data[i + 2] = b / a;
      out.data[i + 3] = (a / 4) * 255;
    }
  }
  g.putImageData(out, 0, 0);
  return cv;
}

// The address of a texture (a PNG data URL) is made the first time it is asked
// for: making all of them at start kept the window busy for seconds, and most
// are never shown.
const put = (name, canvas) => {
  let url = canvas.sourceUrl || null;
  tex.set(name, {
    canvas,
    get url() {
      if (!url) url = canvas.toDataURL('image/png');
      return url;
    },
  });
};

export function loadMcTextures() {
  if (loading) return loading;
  loading = (async () => {
    try {
      const r = await call('mc.textures', [...new Set([...symbolTextures(), ...SCENE_TEXTURES, ...SEASON_TEXTURES, ...TITLE_TEXTURES, ...BRAND_TEXTURES])]);
      const got = (r && r.textures) || {};
      const next = new Map();
      await Promise.all(
        Object.entries(got).map(async ([name, url]) => {
          try {
            next.set(name, await decode(url, { square: !/environment\/|misc\/|entity\/|gui\//.test(name) }));
          } catch {
            // an unreadable file: as if it were not there
          }
        }),
      );
      tex.clear();
      for (const [name, canvas] of next) put(name, canvas);
      const c = (n) => next.get(n);
      if (c('block/grass_block_top')) put('block/grass_block_top#tint', tinted(c('block/grass_block_top'), GRASS_TINT));
      if (c('block/grass_block_side')) {
        put('block/grass_block_side#grass', c('block/grass_block_side_overlay') ? over(c('block/grass_block_side'), tinted(c('block/grass_block_side_overlay'), GRASS_TINT)) : c('block/grass_block_side'));
      }
      const blades = c('block/short_grass') || c('block/grass');
      if (blades) put('block/short_grass#tint', tinted(blades, GRASS_TINT));
      if (c('block/oak_leaves')) put('block/oak_leaves#tint', tinted(c('block/oak_leaves'), '#77ab2f'));
      // the bat, front view, from the pieces of its texture (as its model lays them out): wings up and wings down
      const bat = c('entity/bat/bat') || c('entity/bat');
      if (bat && bat.width === 32 && bat.height === 32) {
        const frame = (up) => {
          const [cv, g] = canvasOf(21, 16);
          const part = (x, y, w, h, dx, dy) => g.drawImage(bat, x, y, w, h, dx, dy, w, h);
          const tip = up ? 2 : 6;
          const wing = up ? 5 : 6;
          part(16, 0, 6, 8, 0, tip);
          part(12, 0, 2, 7, 6, wing);
          part(12, 7, 2, 7, 13, wing);
          part(16, 8, 6, 8, 15, tip);
          part(2, 2, 3, 5, 9, 8);
          part(2, 9, 4, 3, 8, 5);
          part(1, 15, 3, 5, 6, 1);
          part(8, 15, 3, 5, 12, 1);
          return cv;
        };
        put('entity/bat#up', frame(true));
        put('entity/bat#down', frame(false));
      }
      // the default skin with blank white eyes: the figure of the old Minecraft legend (the Halloween scare)
      const steve = c('entity/player/wide/steve') || c('entity/steve');
      if (steve && steve.width === 64) {
        const [cv, g] = canvasOf(64, steve.height);
        g.drawImage(steve, 0, 0);
        g.fillStyle = '#ffffff';
        g.fillRect(9, 12, 2, 1);
        g.fillRect(13, 12, 2, 1);
        put('entity/steve#blank-eyes', cv);
      }
      // the moon without its dark sky (its picture is made to be added to one): the lit part only
      const moon = c('environment/celestial/moon/full_moon');
      if (moon) {
        const px = moon.getContext('2d').getImageData(0, 0, moon.width, moon.height);
        let x0 = moon.width, y0 = moon.height, x1 = -1, y1 = -1;
        for (let y = 0; y < moon.height; y++) {
          for (let x = 0; x < moon.width; x++) {
            const i = (y * moon.width + x) * 4;
            if (px.data[i + 3] > 40 && px.data[i] + px.data[i + 1] + px.data[i + 2] > 150) {
              x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
            }
          }
        }
        if (x1 > x0) {
          const side = Math.max(x1 - x0, y1 - y0) + 1;
          const [cv, g] = canvasOf(side, side);
          g.drawImage(moon, x0, y0, side, side, 0, 0, side, side);
          put('environment/moon#disc', cv);
        }
      }
      // the falling snow, thinned out: the game's sheet is made for a whole sky; over a window with text, a third of its flakes is plenty
      const snow = c('environment/snow');
      if (snow) {
        const [cv, g] = canvasOf(snow.width, snow.height);
        g.drawImage(snow, 0, 0);
        for (let y = 0; y < snow.height; y += 8) {
          for (let x = 0; x < snow.width; x += 8) {
            let h = (Math.imul(x + 3, 374761393) + Math.imul(y + 7, 668265263)) | 0;
            h = Math.imul(h ^ (h >>> 13), 1274126177);
            if (((h ^ (h >>> 16)) >>> 0) / 4294967296 > 0.3) g.clearRect(x, y, 8, 8);
          }
        }
        put('environment/snow#light', cv);
      }
      const title = c('gui/title/minecraft') && titleLogo(c('gui/title/minecraft'), c('gui/title/edition'));
      if (title) put('gui/title#logo', title);
      const grass = inventoryGrassBlock(c);
      if (grass) put('block/grass#inventory', grass);
      if (c('item/potion')) put('item/potion#filled', c('item/potion_overlay') ? over(tinted(c('item/potion_overlay'), POTION_TINT), c('item/potion')) : c('item/potion'));
    } catch {
      // no textures: the built-in drawings stay
    }
    loading = null;
    settled = true;
    version++;
    for (const fn of subs) fn();
  })();
  return loading;
}

// Look again, after a look already under way (which may have started before
// the files were there)
export function reloadMcTextures() {
  return loading ? loading.then(() => loadMcTextures()) : loadMcTextures();
}

// a game was installed (or the download of one ended)
on('mc:assets', () => reloadMcTextures());
