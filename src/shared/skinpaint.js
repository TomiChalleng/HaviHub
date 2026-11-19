// Procedural, original placeholder textures (skin / cape) painted into an RGBA
// buffer. Used for the default preview skin, the default elytra texture and
// for test fixtures. Works in Node and in the browser.

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function shade([r, g, b], f) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return [c(r), c(g), c(b)];
}

function makeCanvas(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  };
  const rect = (x, y, rw, rh, color, a = 255, noise = 0, seed = 1) => {
    let s = seed;
    for (let j = 0; j < rh; j++)
      for (let i = 0; i < rw; i++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const n = noise ? 1 + ((s % 1000) / 1000 - 0.5) * noise : 1;
        set(x + i, y + j, shade(color, n), a);
      }
  };
  return { w, h, data, set, rect };
}

// Paint the 6 faces of a box in the skin UV layout.
// (u,v) = top-left of the box's UV area; size w x h x d (pixels)
function box(c, u, v, w, h, d, color, seed) {
  c.rect(u + d, v, w, d, shade(color, 1.12), 255, 0.12, seed); // top
  c.rect(u + d + w, v, w, d, shade(color, 0.8), 255, 0.12, seed + 1); // bottom
  c.rect(u, v + d, d, h, shade(color, 0.92), 255, 0.12, seed + 2); // right
  c.rect(u + d, v + d, w, h, color, 255, 0.12, seed + 3); // front
  c.rect(u + d + w, v + d, d, h, shade(color, 0.92), 255, 0.12, seed + 4); // left
  c.rect(u + d + w + d, v + d, w, h, shade(color, 0.86), 255, 0.12, seed + 5); // back
}

function paintSkin({ skin = '#e0b48c', hair = '#3a2a1e', shirt = '#3d7bd9', pants = '#2b3245', shoes = '#1b1b1f', eyes = '#2a6bd1', slim = false } = {}) {
  const c = makeCanvas(64, 64);
  const S = hexToRgb(skin);
  const H = hexToRgb(hair);
  const T = hexToRgb(shirt);
  const P = hexToRgb(pants);
  const F = hexToRgb(shoes);
  const armW = slim ? 3 : 4;
  // head
  box(c, 0, 0, 8, 8, 8, S, 11);
  // hair: top + back + upper sides
  c.rect(8, 0, 8, 8, H, 255, 0.2, 3);
  c.rect(24, 8, 8, 8, H, 255, 0.2, 4);
  c.rect(0, 8, 8, 3, H, 255, 0.2, 5);
  c.rect(16, 8, 8, 3, H, 255, 0.2, 6);
  c.rect(8, 8, 8, 2, H, 255, 0.2, 7); // fringe
  // face
  const E = hexToRgb(eyes);
  c.rect(9, 12, 2, 1, [245, 245, 245]);
  c.rect(13, 12, 2, 1, [245, 245, 245]);
  c.rect(10, 12, 1, 1, E);
  c.rect(13, 12, 1, 1, E);
  c.rect(11, 14, 2, 1, shade(S, 0.75));
  // body
  box(c, 16, 16, 8, 12, 4, T, 21);
  // arms (sleeve top part shirt, rest skin)
  box(c, 40, 16, armW, 12, 4, S, 31);
  box(c, 32, 48, armW, 12, 4, S, 41);
  for (const [u, v] of [
    [40, 16],
    [32, 48],
  ]) {
    c.rect(u, v + 4, armW * 2 + 8, 4, T, 255, 0.12, 51);
    c.rect(u + 4, v, armW, 4, T, 255, 0.12, 52);
  }
  // legs
  box(c, 0, 16, 4, 12, 4, P, 61);
  box(c, 16, 48, 4, 12, 4, P, 71);
  c.rect(0, 29, 16, 3, F, 255, 0.1, 81);
  c.rect(16, 61, 16, 3, F, 255, 0.1, 82);
  // belt
  c.rect(16, 29, 24, 1, shade(P, 0.6));
  return c;
}

function paintCape({ main = '#5b3fd6', accent = '#f2c14e' } = {}) {
  const c = makeCanvas(64, 32);
  const M = hexToRgb(main);
  const A = hexToRgb(accent);
  // cape: 10 x 16 x 1 at (0,0)
  box(c, 0, 0, 10, 16, 1, M, 91);
  // a simple emblem on the back (12..21, 1..16 area is the back)
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6 - Math.abs(3 - y) * 2 + 1; x++) c.set(13 + Math.abs(3 - y) + x, 6 + y, A);
  // elytra wing area (22,0) 12x22x2 approx
  box(c, 22, 0, 10, 20, 2, M, 101);
  for (let y = 4; y < 20; y += 4) c.rect(24, y, 10, 1, shade(M, 1.25));
  return c;
}

module.exports = { paintSkin, paintCape, makeCanvas, hexToRgb };
