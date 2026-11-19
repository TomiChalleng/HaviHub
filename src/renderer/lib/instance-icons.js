// Generated instance icons: a background color plus a symbol (see
// icon-symbols.js), like an item render on a colored tile. A recipe is
// { bg, symbol }; it is saved as "bg/symbol" in instance.cfg (HaviHubIcon) and
// in the list of recent icons.
import { SYMBOLS } from './icon-symbols.js';
import { MC_SYMBOLS, LEGACY } from './mc-symbols.js';
import { mcReady, mcUrl, onMcTextures } from './mc-textures.js';

export const BACKGROUNDS = [
  { id: 'red', es: 'Rojo', a: '#ff7a7a', b: '#d33355' },
  { id: 'orange', es: 'Naranja', a: '#ffbe5c', b: '#f2712b' },
  { id: 'yellow', es: 'Amarillo', a: '#ffe36e', b: '#f2b026' },
  { id: 'lime', es: 'Lima', a: '#c6f26a', b: '#62bf3a' },
  { id: 'green', es: 'Verde', a: '#5fe08a', b: '#169a49' },
  { id: 'teal', es: 'Turquesa', a: '#52e5cb', b: '#11978a' },
  { id: 'sky', es: 'Celeste', a: '#6fd3ff', b: '#2d86e3' },
  { id: 'indigo', es: 'Añil', a: '#8d8dff', b: '#4b3fd6' },
  { id: 'purple', es: 'Morado', a: '#c08cff', b: '#7c3fe0' },
  { id: 'pink', es: 'Rosa', a: '#ff93dc', b: '#d24fae' },
  { id: 'slate', es: 'Gris', a: '#a3adbb', b: '#5c6676' },
  { id: 'graphite', es: 'Grafito', a: '#3d4048', b: '#1b1d22' },
];

export const SYMBOL_GROUPS = ['blocks', 'objects', 'items'];
export { SYMBOLS };

const BG = new Map(BACKGROUNDS.map((b) => [b.id, b]));
const SYM = new Map(SYMBOLS.map((s) => [s.id, s])); // Havi Hub's own drawings (used while the game's textures are not at hand)
const MC = new Map(MC_SYMBOLS.map((s) => [s.id, s]));
const FROM_MC = new Map(Object.entries(LEGACY).map(([old, mc]) => [`mc-${mc}`, old]));

export const recipeKey = (r) => `${r.bg}/${r.symbol}`;

export function parseRecipe(str) {
  if (!str || typeof str !== 'string') return null;
  const [bg, symbol] = str.split('/');
  return BG.has(bg) && (SYM.has(symbol) || MC.has(symbol)) ? { bg, symbol } : null;
}

// a Minecraft symbol can be drawn when the game's textures for it are here
const usable = (s) => Boolean(s && (s.flat ? mcUrl(s.flat) : mcUrl(s.top) && mcUrl(s.front) && mcUrl(s.side)));

// What a symbol id is drawn with: the game's textures when they are at hand
// (older ids go to their Minecraft counterpart), else the built-in drawing.
function resolve(id) {
  const mc = MC.get(id) || MC.get(`mc-${LEGACY[id]}`);
  if (usable(mc)) return { mc };
  return { own: SYM.get(id) || SYM.get(FROM_MC.get(id)) || SYMBOLS[0] };
}

// The symbols to choose from (the editor): Minecraft's, or the built-in ones without the game
export function symbolList() {
  const mc = mcReady() ? MC_SYMBOLS.filter(usable) : [];
  return mc.length ? mc : SYMBOLS;
}
export const usingMinecraft = () => symbolList() !== SYMBOLS;

function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return h >>> 0;
}

// The icon an instance shows while it has no image of its own: always the same
// one for the same instance.
export function defaultRecipe(seed) {
  const h = hash(seed || 'instance');
  return { bg: BACKGROUNDS[h % BACKGROUNDS.length].id, symbol: SYMBOLS[Math.floor(h / BACKGROUNDS.length) % SYMBOLS.length].id };
}

export function randomRecipe(avoid) {
  const list = symbolList();
  for (;;) {
    const r = {
      bg: BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)].id,
      symbol: list[Math.floor(Math.random() * list.length)].id,
    };
    if (!avoid || r.bg !== avoid.bg || r.symbol !== avoid.symbol) return r;
  }
}

export const symbolName = (id, lang) => {
  const r = resolve(id);
  const s = r.mc || r.own;
  return s ? (lang === 'en' ? s.en : s.es) : id;
};
export const backgroundOf = (id) => BG.get(id) || BACKGROUNDS[0];

// ---- drawing
// Pixel art stays crisp (no blur between its pixels); what makes it sit well on
// the colour is around it: a soft light behind, a soft shadow that follows its
// outline, and a faint shadow on the "ground" under it.
const PIX = 'image-rendering="pixelated" style="image-rendering:pixelated"';
const FX =
  '<filter id="ds" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="2.4" stdDeviation="1.7" flood-color="#000" flood-opacity=".36"/></filter>' +
  '<filter id="sb" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="2.6"/></filter>';

// an item or a plant, as in the inventory
function flatSvg(url) {
  return `<ellipse cx="50" cy="84" rx="21" ry="4" fill="#000" opacity=".3" filter="url(#sb)"/>` + `<image href="${url}" x="20" y="17" width="60" height="60" ${PIX} filter="url(#ds)"/>`;
}

// a block: its top and two of its sides, the left one lit more than the right one (as the game's inventory does)
function cubeSvg(top, left, right) {
  const face = (url, m) => `<image href="${url}" width="1" height="1" preserveAspectRatio="none" ${PIX} transform="matrix(${m})"/>`;
  return (
    `<ellipse cx="50" cy="86" rx="29" ry="5" fill="#000" opacity=".3" filter="url(#sb)"/>` +
    `<g filter="url(#ds)">${face(top, '30 15 -30 15 50 13')}${face(left, '30 15 0 36 20 28')}${face(right, '30 -15 0 36 50 43')}` +
    `<path d="M20 28 50 43 50 79 20 64Z" fill="#000" opacity=".2"/><path d="M50 43 80 28 80 64 50 79Z" fill="#000" opacity=".42"/></g>`
  );
}

function symbolBody(id) {
  const r = resolve(id);
  if (r.mc) return r.mc.flat ? flatSvg(mcUrl(r.mc.flat)) : cubeSvg(mcUrl(r.mc.top), mcUrl(r.mc.front), mcUrl(r.mc.side));
  return `<g transform="translate(14 14) scale(.72)">${r.own.svg}</g>`;
}

// Square, full-bleed SVG. The symbol sits a little inside the edges, so it
// still reads when the icon is shown rounded.
export function iconSvg(r, { size } = {}) {
  const bg = backgroundOf(r.bg);
  const wh = size ? ` width="${size}" height="${size}"` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${wh}>` +
    `<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg.a}"/><stop offset="1" stop-color="${bg.b}"/></linearGradient>` +
    `<radialGradient id="h" cx=".32" cy=".26" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="v" cx=".5" cy=".5" r=".75"><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></radialGradient>${FX}</defs>` +
    `<rect width="100" height="100" fill="url(#b)"/><rect width="100" height="100" fill="url(#h)"/><rect width="100" height="100" fill="url(#v)"/>${symbolBody(r.symbol)}</svg>`
  );
}

const urls = new Map();
export function iconUrl(r) {
  const key = recipeKey(r);
  let url = urls.get(key);
  if (!url) {
    url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg(r));
    urls.set(key, url);
  }
  return url;
}

// The symbol alone (for the editor's grid), on a transparent background.
const symUrls = new Map();
export function symbolUrl(id) {
  let url = symUrls.get(id);
  if (!url) {
    url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${FX}</defs>${symbolBody(id)}</svg>`);
    symUrls.set(id, url);
  }
  return url;
}

// the game's textures arrived (or changed): every icon is drawn again
onMcTextures(() => {
  urls.clear();
  symUrls.clear();
});

// PNG of the icon, to save it as the instance image (Prism and the other
// launchers read it as any other picture).
export async function iconPng(r, size = 512) {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg(r, { size }));
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  cv.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, size, size);
  const blob = await new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

export function pushRecent(list, r, max = 8) {
  const key = recipeKey(r);
  return [key, ...(Array.isArray(list) ? list : []).filter((k) => k !== key)].slice(0, max);
}
