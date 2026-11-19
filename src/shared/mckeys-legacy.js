// Key bindings in options.txt. Minecraft 1.13+ stores names
// ("key.keyboard.left.shift"); 1.12 and older store LWJGL 2 key codes ("42"),
// with mouse buttons as negative numbers (-100 = left button).
const LWJGL2 = {
  escape: 1,
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: 7,
  7: 8,
  8: 9,
  9: 10,
  0: 11,
  minus: 12,
  equal: 13,
  backspace: 14,
  tab: 15,
  q: 16,
  w: 17,
  e: 18,
  r: 19,
  t: 20,
  y: 21,
  u: 22,
  i: 23,
  o: 24,
  p: 25,
  'left.bracket': 26,
  'right.bracket': 27,
  enter: 28,
  'left.control': 29,
  a: 30,
  s: 31,
  d: 32,
  f: 33,
  g: 34,
  h: 35,
  j: 36,
  k: 37,
  l: 38,
  semicolon: 39,
  apostrophe: 40,
  'grave.accent': 41,
  'left.shift': 42,
  backslash: 43,
  z: 44,
  x: 45,
  c: 46,
  v: 47,
  b: 48,
  n: 49,
  m: 50,
  comma: 51,
  period: 52,
  slash: 53,
  'right.shift': 54,
  'keypad.multiply': 55,
  'left.alt': 56,
  space: 57,
  'caps.lock': 58,
  f1: 59,
  f2: 60,
  f3: 61,
  f4: 62,
  f5: 63,
  f6: 64,
  f7: 65,
  f8: 66,
  f9: 67,
  f10: 68,
  'num.lock': 69,
  'scroll.lock': 70,
  'keypad.7': 71,
  'keypad.8': 72,
  'keypad.9': 73,
  'keypad.subtract': 74,
  'keypad.4': 75,
  'keypad.5': 76,
  'keypad.6': 77,
  'keypad.add': 78,
  'keypad.1': 79,
  'keypad.2': 80,
  'keypad.3': 81,
  'keypad.0': 82,
  'keypad.decimal': 83,
  'world.2': 86,
  f11: 87,
  f12: 88,
  f13: 100,
  f14: 101,
  f15: 102,
  'keypad.equal': 141,
  'keypad.enter': 156,
  'right.control': 157,
  'keypad.divide': 181,
  'print.screen': 183,
  'right.alt': 184,
  pause: 197,
  home: 199,
  up: 200,
  'page.up': 201,
  left: 203,
  right: 205,
  end: 207,
  down: 208,
  'page.down': 209,
  insert: 210,
  delete: 211,
  'left.win': 219,
  'right.win': 220,
  menu: 221,
  unknown: 0,
};

// true for versions whose options.txt uses LWJGL 2 codes (before 17w43a / 1.13)
function usesLegacyKeys(mcVersion) {
  const s = String(mcVersion || '').trim().toLowerCase();
  if (!s) return false;
  if (/^(a|b|c|rd|inf)[-\d.]/.test(s) || /^(alpha|beta|classic|indev|infdev)/.test(s)) return true;
  const rel = /^1\.(\d+)/.exec(s);
  if (rel) return Number(rel[1]) < 13;
  const snap = /^(\d\d)w(\d\d)[a-z]$/.exec(s);
  if (snap) return Number(snap[1]) < 17 || (Number(snap[1]) === 17 && Number(snap[2]) < 43);
  return false;
}

// "key.keyboard.left.shift" -> "key.keyboard.left.shift" or "42" for old versions
function keyForOptions(key, mcVersion) {
  if (!usesLegacyKeys(mcVersion)) return key;
  const mouse = /^key\.mouse\.(left|right|middle|\d+)$/.exec(key);
  if (mouse) {
    const n = { left: 1, right: 2, middle: 3 }[mouse[1]] || Number(mouse[1]);
    return String(-101 + n);
  }
  const kb = /^key\.keyboard\.(.+)$/.exec(key);
  if (kb && LWJGL2[kb[1]] !== undefined) return String(LWJGL2[kb[1]]);
  return null;
}

module.exports = { usesLegacyKeys, keyForOptions, LWJGL2 };
