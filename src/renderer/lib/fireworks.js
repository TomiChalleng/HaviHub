import { isQuiet, requestFrame, cancelFrame } from './quiet.js';
// Minecraft-style fireworks on a canvas over the window: rockets that rise and
// burst into pixel sparks. Shapes: small ball, large ball, star, burst and a
// heart (in place of the creeper face); effects: trail, twinkle and fade
// color, as in the game. Colors are the game's firework dye colors.
import { fireworkSound } from './sfx.js';
import { mcTex, tinted } from './mc-textures.js';

// A spark of the game in a colour (the game colours its grey pictures the same way); kept, few colours repeat
const sparks = new Map();
function spark(frame, r, g, b) {
  const key = `${frame}:${r >> 4}:${g >> 4}:${b >> 4}`;
  let cv = sparks.get(key);
  if (!cv) {
    if (sparks.size > 800) sparks.clear();
    cv = tinted(mcTex(`particle/spark_${frame}`).canvas, `rgb(${r | 0},${g | 0},${b | 0})`);
    sparks.set(key, cv);
  }
  return cv;
}

export const DYE = {
  white: '#f0f0f0',
  orange: '#eb8844',
  magenta: '#c354cd',
  lightBlue: '#6689d3',
  yellow: '#decf2a',
  lime: '#41cd34',
  pink: '#d88198',
  gray: '#434343',
  lightGray: '#ababab',
  cyan: '#287697',
  purple: '#7b2fbe',
  blue: '#253192',
  brown: '#51301a',
  green: '#3b511a',
  red: '#b3312c',
  black: '#1e1b1b',
};
const BRIGHT = ['white', 'orange', 'magenta', 'lightBlue', 'yellow', 'lime', 'pink', 'cyan', 'purple', 'red', 'blue'];

// The five rockets of the reference table, in its order
export const RECIPES = [
  { shape: 'small', colors: ['brown'], twinkle: true, flight: 1 },
  { shape: 'heart', colors: ['pink'], flight: 2 },
  { shape: 'burst', colors: ['orange'], fade: ['red'], flight: 2 },
  { shape: 'burst', colors: ['green'], fade: ['yellow'], twinkle: true, flight: 3 },
  { shape: 'star', colors: ['blue'], fade: ['red'], trail: true, flight: 2 },
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const rand = (a, b) => a + Math.random() * (b - a);
function gauss() {
  let u = 0;
  let v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export function randomRecipe() {
  const n = Math.random() < 0.6 ? 1 : Math.random() < 0.7 ? 2 : 3;
  const colors = Array.from({ length: n }, () => pick(BRIGHT));
  return {
    shape: pick(['small', 'small', 'large', 'large', 'star', 'burst', 'heart']),
    colors,
    fade: Math.random() < 0.45 ? [pick(BRIGHT)] : null,
    trail: Math.random() < 0.35,
    twinkle: Math.random() < 0.4,
    flight: 1 + Math.floor(Math.random() * 3),
  };
}

// unit outline points of a five-point star and of a heart
function starOutline() {
  const pts = [];
  const corners = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 1 : 0.42;
    corners.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  for (let i = 0; i < 10; i++) {
    const [x0, y0] = corners[i];
    const [x1, y1] = corners[(i + 1) % 10];
    for (let k = 0; k < 4; k++) pts.push([x0 + ((x1 - x0) * k) / 4, y0 + ((y1 - y0) * k) / 4]);
  }
  return pts;
}
function heartOutline() {
  const pts = [];
  for (let i = 0; i < 44; i++) {
    const t = (i / 44) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([x / 17, y / 17]);
  }
  return pts;
}
const STAR = starOutline();
const HEART = heartOutline();

const DRAG = 0.969; // per frame (60 fps)
const GRAVITY = 0.011;
const MAX_PARTS = 7000;

export class Fireworks {
  constructor(canvas, { sound = true } = {}) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.sound = sound;
    this.rockets = [];
    this.parts = [];
    this.raf = 0;
    this.last = 0;
    this.until = 0;
    this.nextAt = 0;
    this.queue = [];
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.cv.width = Math.round(this.w * dpr);
    this.cv.height = Math.round(this.h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  destroy() {
    cancelFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.rockets = [];
    this.parts = [];
  }

  // A show: the reference rockets first, then random ones, for `ms`
  show(ms, { first = RECIPES } = {}) {
    this.queue = [...first];
    this.until = performance.now() + ms;
    this.nextAt = performance.now() + 200;
    this.start();
  }

  start() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (ts) => {
      const dt = Math.min(3, (ts - this.last) / (1000 / 60));
      this.last = ts;
      if (!isQuiet()) {
        this.schedule(ts);
        this.update(dt);
        this.draw();
      }
      if (this.rockets.length || this.parts.length || ts < this.until) this.raf = requestFrame(loop);
      else {
        this.raf = 0;
        this.g.clearRect(0, 0, this.w, this.h);
        if (this.onEnd) this.onEnd();
      }
    };
    this.raf = requestFrame(loop);
  }

  schedule(ts) {
    if (ts > this.until || ts < this.nextAt) return;
    const salvo = this.queue.length ? 1 : Math.random() < 0.18 ? 3 : 1;
    for (let i = 0; i < salvo; i++) this.launch(this.queue.length ? this.queue.shift() : randomRecipe(), salvo > 1 ? this.w * (0.25 + i * 0.25) + rand(-40, 40) : undefined);
    this.nextAt = ts + rand(380, 1150);
  }

  launch(recipe = randomRecipe(), x) {
    const scale = rand(0.7, 1.12);
    const flight = recipe.flight || 2;
    const x0 = x === undefined ? rand(0.12, 0.88) * this.w : x;
    const top = this.h * (0.5 - 0.1 * flight) + rand(-0.05, 0.05) * this.h;
    this.rockets.push({ x: x0, y: this.h + 10, x0, y0: this.h + 10, top: Math.max(this.h * 0.08, top), drift: rand(-0.35, 0.35), age: 0, frames: 46 + 16 * flight, recipe, scale });
    if (this.sound) fireworkSound('launch', { gain: 0.45 * scale, pan: (x0 / this.w) * 2 - 1 });
  }

  spark(x, y, vx, vy, r, opt = {}) {
    if (this.parts.length > MAX_PARTS) return;
    const col = hexRgb(DYE[pick(r.colors)] || DYE.white);
    const fade = r.fade && r.fade.length ? hexRgb(DYE[pick(r.fade)] || DYE.white) : null;
    const life = opt.life || 140 + Math.random() * 40;
    this.parts.push({ x, y, vx, vy, age: 0, life, col: [...col], fade, twinkle: r.twinkle, trail: r.trail && !opt.isTrail, size: (opt.size || 3.4) * (opt.scale || 1), isTrail: opt.isTrail, gravity: opt.gravity === undefined ? GRAVITY : opt.gravity });
  }

  explode(k) {
    const r = k.recipe;
    const s = k.scale;
    const sp = (vx, vy, extra) => this.spark(k.x, k.y, vx * s, vy * s, r, { scale: s, ...extra });
    if (r.shape === 'small' || r.shape === 'large') {
      const size = r.shape === 'small' ? 2 : 3;
      const speed = r.shape === 'small' ? 2.7 : 4.9;
      for (let i = -size; i <= size; i++)
        for (let j = -size; j <= size; j++)
          for (let l = -size; l <= size; l++) {
            if (Math.max(Math.abs(i), Math.abs(j), Math.abs(l)) !== size) continue;
            const a = i + rand(-0.5, 0.5);
            const b = j + rand(-0.5, 0.5);
            const c = l + rand(-0.5, 0.5);
            const len = Math.hypot(a, b, c) || 1;
            const v = speed * (1 + rand(-0.06, 0.06));
            sp((a / len) * v, (b / len) * v);
          }
    } else if (r.shape === 'star' || r.shape === 'heart') {
      const pts = r.shape === 'star' ? STAR : HEART;
      const speed = r.shape === 'star' ? 5.8 : 5.2;
      const turn = rand(0, Math.PI);
      const copies = r.shape === 'star' ? 3 : 2;
      const step = r.shape === 'star' ? 1.07 : 0.11;
      for (let c = 0; c < copies; c++) {
        const sx = Math.cos(turn + c * step);
        for (const [px, py] of pts) sp(px * speed * sx, py * speed);
      }
    } else {
      // burst: a spray thrown up that falls back
      const ox = gauss() * 0.15;
      for (let i = 0; i < 90; i++) sp(gauss() * 1.35 + ox, -(Math.random() * 4.6 + 0.6), { gravity: GRAVITY * 3.2, life: 120 + Math.random() * 50 });
    }
    if (this.sound) {
      const far = s < 0.85;
      const big = r.shape === 'large' || r.shape === 'star';
      const pan = (k.x / this.w) * 2 - 1;
      fireworkSound(`${big ? 'largeBlast' : 'blast'}${far ? 'Far' : ''}`, { gain: 0.8 * s, pan });
      if (r.twinkle) fireworkSound(far ? 'twinkleFar' : 'twinkle', { gain: 0.7 * s, pan, at: 0.85 });
    }
  }

  update(dt) {
    for (const k of this.rockets) {
      k.age += dt;
      const t = Math.min(1, k.age / k.frames);
      const ease = 1 - (1 - t) ** 2.2;
      k.x = k.x0 + k.drift * k.age;
      k.y = k.y0 + (k.top - k.y0) * ease;
      // the rocket's own trail of sparks
      if (Math.random() < 0.8 * dt) this.parts.push({ x: k.x + rand(-1, 1), y: k.y + 6, vx: rand(-0.25, 0.25), vy: rand(0.4, 1.2), age: 0, life: rand(14, 26), col: [255, 236, 190], fade: null, size: 2.2, isTrail: true, gravity: 0.02 });
      if (t >= 1) {
        k.done = true;
        this.explode(k);
      }
    }
    this.rockets = this.rockets.filter((k) => !k.done);
    const add = [];
    for (const p of this.parts) {
      p.age += dt;
      const drag = DRAG ** dt;
      p.vx *= drag;
      p.vy = p.vy * drag + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // in the second half of its life a spark takes the fade color
      if (p.fade && p.age > p.life / 2) {
        const k = 1 - 0.82 ** dt;
        for (let i = 0; i < 3; i++) p.col[i] += (p.fade[i] - p.col[i]) * k;
      }
      if (p.trail && Math.random() < 0.5 * dt && this.parts.length + add.length < MAX_PARTS) add.push({ x: p.x, y: p.y, vx: 0, vy: 0.15, age: 0, life: 26, col: [...p.col], fade: null, size: p.size * 0.75, isTrail: true, gravity: 0.004 });
    }
    this.parts = this.parts.filter((p) => p.age < p.life).concat(add);
  }

  draw() {
    const g = this.g;
    g.clearRect(0, 0, this.w, this.h);
    g.globalCompositeOperation = 'lighter';
    const rocket = mcTex('item/firework_rocket');
    g.imageSmoothingEnabled = false;
    for (const k of this.rockets) {
      if (rocket) {
        // the game's rocket, as it flies
        g.globalCompositeOperation = 'source-over';
        g.drawImage(rocket.canvas, Math.round(k.x) - 12, Math.round(k.y) - 14, 24, 24);
        g.globalCompositeOperation = 'lighter';
        continue;
      }
      g.fillStyle = '#d8d8d8';
      g.fillRect(Math.round(k.x) - 1, Math.round(k.y) - 4, 3, 9);
      g.fillStyle = '#c43b30';
      g.fillRect(Math.round(k.x) - 1, Math.round(k.y) - 2, 3, 2);
      g.fillRect(Math.round(k.x) - 1, Math.round(k.y) + 2, 3, 2);
    }
    const sprites = mcTex('particle/spark_0') && mcTex('particle/spark_7');
    for (const p of this.parts) {
      const life = p.age / p.life;
      // twinkling sparks blink in their last two thirds
      if (p.twinkle && life > 0.33 && Math.floor(p.age / 3) % 2 === 1) continue;
      const alpha = life < 0.5 ? 1 : Math.max(0, 1 - (life - 0.5) / 0.5);
      const size = Math.max(1, p.size * (1 - life * 0.55));
      const [r, gg, b] = p.col;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (sprites) {
        // the game's own spark: eight pictures, from the biggest to the last glimmer, in the spark's colour
        const img = spark(7 - Math.min(7, Math.floor(life * 8)), r, gg, b);
        const d = Math.max(4, Math.round(p.size * (p.isTrail ? 2.2 : 3.4)));
        g.globalAlpha = alpha;
        g.drawImage(img, x - d / 2, y - d / 2, d, d);
        g.globalAlpha = 1;
        continue;
      }
      if (!p.isTrail) {
        g.fillStyle = `rgba(${r | 0},${gg | 0},${b | 0},${0.22 * alpha})`;
        const h = size * 1.8;
        g.fillRect(x - h, y - h, h * 2, h * 2);
      }
      // a bright core, a pixel "+" while the spark is big
      const cr = Math.min(255, r + (255 - r) * 0.35);
      const cg = Math.min(255, gg + (255 - gg) * 0.35);
      const cb = Math.min(255, b + (255 - b) * 0.35);
      g.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${alpha})`;
      const c = Math.max(1, Math.round(size / 2));
      if (size >= 3 && !p.isTrail) {
        g.fillRect(x - c, y - c / 2, c * 2, c);
        g.fillRect(x - c / 2, y - c, c, c * 2);
      } else g.fillRect(x - c / 2, y - c / 2, c, c);
    }
    g.globalCompositeOperation = 'source-over';
  }
}
