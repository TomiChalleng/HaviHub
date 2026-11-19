// Stand-ins for the pictures Havi Hub takes from the game's files (its title,
// the grass block, the colour of grass), for tests and screenshots only. They
// are plain shapes in the same sizes and places as the game's, so the code that
// reads, cuts and draws them runs as it does with the real ones; none of them
// is Mojang's artwork. Used by make-fixtures.mjs (an installed game) and by
// mock-net.cjs (the copy Havi Hub downloads when there is none).
const { encodePng } = require('./png.cjs');
const yazl = require('yazl');

const STANDIN_VERSION = '26.2';

function picture(w, h, fn) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = fn(x, y);
      if (!px) continue; // transparent
      const i = (y * w + x) * 4;
      data[i] = px[0];
      data[i + 1] = px[1];
      data[i + 2] = px[2];
      data[i + 3] = px[3] === undefined ? 255 : px[3];
    }
  }
  return encodePng(w, h, data);
}

// the same speckle for the same spot, every time
function speckle(x, y, seed) {
  let h = Math.imul(x + 31 * seed, 374761393) + Math.imul(y + 17 * seed, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const shade = (rgb, k) => rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));

function textures() {
  const fringe = (x) => 3 + (speckle(x, 0, 9) > 0.55 ? 1 : 0); // rows of grass over the dirt, per column
  const dirt = (x, y) => shade([134, 96, 67], 0.8 + speckle(x, y, 1) * 0.4);
  const grey = (x, y, seed) => shade([255, 255, 255], 0.58 + speckle(x, y, seed) * 0.24);
  return {
    'block/dirt': picture(16, 16, dirt),
    // grey, like the game's: the colour comes from the colour map
    'block/grass_block_top': picture(16, 16, (x, y) => grey(x, y, 2)),
    'block/grass_block_side': picture(16, 16, (x, y) => (y < fringe(x) ? shade([112, 168, 72], 0.85 + speckle(x, y, 3) * 0.3) : dirt(x, y))),
    'block/grass_block_side_overlay': picture(16, 16, (x, y) => (y < fringe(x) ? grey(x, y, 3) : null)),
    // a smooth field of greens; its middle (127, 127) is the colour outside a world
    'colormap/grass': picture(256, 256, (x, y) => [Math.round(60 + x * 0.48), Math.round(220 - y * 0.24), 89]),
    // the title: 256×64 with the picture in its top 44 rows (a bar of grey bricks here)
    'gui/title/minecraft': picture(256, 64, (x, y) => {
      if (y < 4 || y >= 40 || x < 6 || x >= 250) return null;
      const row = Math.floor((y - 4) / 9);
      const bx = (x - 6 + (row % 2) * 7) % 14;
      const by = (y - 4) % 9;
      if (bx === 0 || by === 0) return [58, 58, 62];
      return shade(by < 3 ? [214, 214, 218] : [150, 150, 156], 0.92 + speckle(x, y, 5) * 0.16);
    }),
    // the ribbon under it: 128×16, the band in its top 14 rows
    'gui/title/edition': picture(128, 16, (x, y) => {
      if (y >= 14 || x < 8 || x >= 120) return null;
      if (y === 0 || y === 13 || x === 8 || x === 119) return [74, 54, 20];
      return [232, 196, 86];
    }),
  };
}

// A client .jar with them, as big as the launcher expects one to be (it takes
// nothing under 1 MB for a game file): the padding is stored, not compressed.
let jar = null;
function clientJar() {
  if (!jar) {
    jar = new Promise((resolve, reject) => {
      const z = new yazl.ZipFile();
      for (const [name, png] of Object.entries(textures())) z.addBuffer(png, `assets/minecraft/textures/${name}.png`);
      z.addBuffer(Buffer.from(JSON.stringify({ id: STANDIN_VERSION, name: STANDIN_VERSION, stand_in: true })), 'version.json');
      z.addBuffer(Buffer.alloc(1300 * 1024), 'stand-in.bin', { compress: false });
      z.end();
      const parts = [];
      z.outputStream.on('data', (c) => parts.push(c));
      z.outputStream.on('end', () => resolve(Buffer.concat(parts)));
      z.outputStream.on('error', reject);
    });
  }
  return jar;
}

module.exports = { STANDIN_VERSION, textures, clientJar };
