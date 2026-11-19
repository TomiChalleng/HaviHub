// Seasonal themes: Halloween, Christmas and New Year. Each one turns itself on
// during its week (Settings → Themes → Seasonal themes turns them off) and
// brings pixel decorations in the game's style: pumpkins and bats, a string
// of lights and square snow, a countdown and fireworks at midnight. Also the
// hidden Halloween scare.
import { isQuiet, requestFrame, cancelFrame } from "../lib/quiet.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui.jsx";
import Icon from "./Icon.jsx";
import { useApp } from "../lib/store.jsx";
import { t, getLanguage } from "../lib/i18n.js";
import { now, todayKey } from "../lib/clock.js";
import { Fireworks } from "../lib/fireworks.js";
import { scareSound, audio } from "../lib/sfx.js";
import { seasonYear, seasonEnd, nextNewYear } from "../../shared/seasons.js";
import { mcUrl, mcTex, useMcTextures } from "../lib/mc-textures.js";
import { symbolUrl, usingMinecraft } from "../lib/instance-icons.js";
import { useTrimmed } from "../lib/trim.js";
import { needsWelcome } from "../lib/welcome.js";
import * as skinview3d from "skinview3d";
import * as THREE from "three";

// ------------------------------------------------------------------ pixel art
// rows of characters -> crisp SVG rects (one per horizontal run of a color)
export function Pixels({ rows, palette, size, className = "", title }) {
  const w = rows[0].length;
  const h = rows.length;
  const rects = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < w) {
      const ch = row[x];
      if (!palette[ch]) {
        x++;
        continue;
      }
      let x2 = x;
      while (x2 + 1 < w && row[x2 + 1] === ch) x2++;
      rects.push(
        <rect
          key={`${x},${y}`}
          x={x}
          y={y}
          width={x2 - x + 1}
          height={1}
          fill={palette[ch]}
        />,
      );
      x = x2 + 1;
    }
  });
  const scale = size ? size / Math.max(w, h) : 1;
  return (
    <svg
      className={`pixels ${className}`}
      viewBox={`0 0 ${w} ${h}`}
      width={w * scale}
      height={h * scale}
      shapeRendering="crispEdges"
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {rects}
    </svg>
  );
}

// A piece of the game's own art (a texture, or a block/item drawn as in the
// icons) when the game is on this computer; the built-in drawing otherwise.
export function McArt({ tex, sym, fallback, size, className = "", style, fit }) {
  useMcTextures();
  const raw = sym ? (usingMinecraft() ? symbolUrl(sym) : null) : mcUrl(tex);
  const trimmed = useTrimmed(raw, !!fit);
  const url = fit ? trimmed || raw : raw;
  if (!url)
    return fallback ? (
      <Pixels {...fallback} size={size} className={className} />
    ) : null;
  return (
    <img
      className={`mc-art ${className}`}
      src={url}
      width={size}
      height={size}
      alt=""
      draggable={false}
      style={{ imageRendering: "pixelated", ...style }}
    />
  );
}

const PUMPKIN = {
  rows: [
    ".....GG.....",
    "......G.....",
    "..OOOOOOOO..",
    ".OOoOOOOoOO.",
    "OOYYOOOOYYOO",
    "OOYYOOOOYYOO",
    "OoOOOOOOOOoO",
    "OOYOYYYYOYOO",
    "OOOYYYYYYOOO",
    ".OOOOOOOOOO.",
    "..oooooooo..",
  ],
  palette: { G: "#5d7a22", O: "#e07a1f", o: "#b85c14", Y: "#ffd23a" },
};
const MOON = {
  rows: [
    "....WWWW....",
    "..WWWWWWWW..",
    ".WWWWWWcWWW.",
    ".WWccWWWWWW.",
    "WWWccWWWWWWW",
    "WWWWWWWWccWW",
    "WWWWWWWWccWW",
    "WWcWWWWWWWWW",
    ".WWWWWcWWWW.",
    ".WWWWWWWWWW.",
    "..WWWWWWWW..",
    "....WWWW....",
  ],
  palette: { W: "#f3ecd2", c: "#d6cdb0" },
};
const BAT_UP = {
  rows: [
    "X..............X",
    "XX............XX",
    "XXX...X..X...XXX",
    ".XXXX.XXXX.XXXX.",
    "..XXXXXRXRXXXX..",
    ".....XXXXXX.....",
    "......X..X......",
  ],
  palette: { X: "#6a4f86", R: "#ff5a3d" },
};
const BAT_DOWN = {
  rows: [
    "......X..X......",
    ".....XXXXXX.....",
    "..XXXXXRXRXXXX..",
    ".XXXX.XXXX.XXXX.",
    "XXX..........XXX",
    "XX............XX",
    "X..............X",
  ],
  palette: { X: "#6a4f86", R: "#ff5a3d" },
};
const TREE = {
  rows: [
    ".....S.....",
    "....SYS....",
    ".....G.....",
    "....GGG....",
    "...GRGGG...",
    "....GGG....",
    "...GGGBG...",
    "..GGGGGGG..",
    "...GYGGG...",
    "..GGGGGRG..",
    ".GGBGGGGGG.",
    "GGGGGGYGGGG",
    "....TTT....",
    "....TTT....",
  ],
  palette: {
    S: "#ffe066",
    Y: "#ffd23a",
    G: "#2f8f3a",
    R: "#e4322b",
    B: "#4aa8ff",
    T: "#7a5230",
  },
};
const GIFT = {
  rows: [
    "..Y...Y..",
    "...YYY...",
    "RRRRYRRRR",
    "RRRRYRRRR",
    "YYYYYYYYY",
    "RRRRYRRRR",
    "rRRRYRRRr",
    "rRRRYRRRr",
    "rrrrYrrrr",
  ],
  palette: { R: "#e4322b", r: "#b5221d", Y: "#ffd65c" },
};
const GIFT2 = {
  rows: [
    "...WWW...",
    "BBBBWBBBB",
    "BBBBWBBBB",
    "WWWWWWWWW",
    "BBBBWBBBB",
    "bBBBWBBBb",
    "bbbbWbbbb",
  ],
  palette: { B: "#3f8ee8", b: "#2c68b5", W: "#f4f4f4" },
};
const SPARK = {
  rows: [
    "....Y....",
    ".Y..Y..Y.",
    "..Y.Y.Y..",
    "...WWW...",
    "YYYWWWYYY",
    "...WWW...",
    "..Y.Y.Y..",
    ".Y..Y..Y.",
    "....Y....",
  ],
  palette: { Y: "#f5c542", W: "#fff6d0" },
};
// the scare: an original shadow creature (not any game character)
const FACE = {
  rows: [
    "KKKKKKKKKKKKKKKK",
    "KDDdDDKDDDdDDDdK",
    "KDdDDDDDdDDDKDDK",
    "KDDDKDDDDDDdDDDK",
    "KdDDDDDDDKDDDDdK",
    "KDWWWDDDDDDWWWDK",
    "KDWWWwDDDDwWWWDK",
    "KDDwDDDDDDDDwDDK",
    "KDDDDDDKDDDDDDDK",
    "KDMMMMMMMMMMMMDK",
    "KMTRTRTRTRTRTRMK",
    "KMRRRRRRRRRRRRMK",
    "KMRRRRRRRRRRRRMK",
    "KMRTRTRRTRTRRTMK",
    "KDMMMMMMMMMMMMDK",
    "KKKKKKKKKKKKKKKK",
  ],
  palette: {
    K: "#050505",
    D: "#121212",
    d: "#1c1c1c",
    W: "#ffffff",
    w: "#bff3ff",
    M: "#1e0000",
    R: "#6a0b0b",
    T: "#e6dfcc",
  },
};

// the picture of each theme (notices, settings)
export function SeasonIcon({ season, size }) {
  const art = SEASON_ART[season];
  if (!art) return null;
  // all three drawn the same way (a block or an item of the game, as in the icons), so they are the same size
  const sym = {
    halloween: "mc-jack-o-lantern",
    christmas: "mc-spruce-sapling",
    newyear: "mc-firework-rocket",
  }[season];
  return <McArt sym={sym} fallback={art} size={size || art.size} fit />;
}

export const SEASON_ART = {
  halloween: { ...PUMPKIN, size: 36 },
  christmas: { ...TREE, size: 42 },
  newyear: { ...SPARK, size: 36 },
};

// ------------------------------------------------------------------ top tabs corner
export function TopTabsDecor() {
  const { season } = useApp();
  if (season === "halloween")
    return (
      <span className="season-corner halloween" aria-hidden="true">
        <McArt
          tex="environment/moon#disc"
          fallback={MOON}
          size={24}
          className="sc-moon"
        />
        <McArt sym="mc-jack-o-lantern" fallback={PUMPKIN} size={40} />
        <McArt
          sym="mc-pumpkin"
          fallback={PUMPKIN}
          size={28}
          className="sc-small"
        />
      </span>
    );
  if (season === "christmas")
    return (
      <span className="season-corner christmas" aria-hidden="true">
        <Pixels {...GIFT2} size={27} />
        <McArt tex="block/spruce_sapling" fallback={TREE} size={42} />
        <Pixels {...GIFT} size={27} />
      </span>
    );
  if (season === "newyear") return <NewYearCountdown />;
  return null;
}

// The game's clock, telling the real time the way it does in the game: the sun
// on top at noon, the moon at midnight (it turns once a day, 64 positions).
function McClock({ date }) {
  useMcTextures();
  const turn = ((date.getHours() * 60 + date.getMinutes()) / 1440 + 0.5) % 1;
  const url = mcUrl(
    `item/clock_${String(Math.round(turn * 64) % 64).padStart(2, "0")}`,
  );
  if (!url) return null;
  return (
    <img
      className="mc-art ny-clock"
      src={url}
      width={26}
      height={26}
      alt=""
      draggable={false}
      style={{ imageRendering: "pixelated" }}
      data-tip={t("El reloj de Minecraft, con tu hora")}
    />
  );
}

function NewYearCountdown() {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const d = now();
  let text;
  if (d.getMonth() === 0) text = t("¡Feliz {year}!", { year: d.getFullYear() });
  else {
    const next = nextNewYear(d);
    const ms = next - d;
    const year = next.getFullYear();
    if (d.getDate() === 31) {
      const s = Math.max(0, Math.floor(ms / 1000));
      const hh = String(Math.floor(s / 3600)).padStart(2, "0");
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      text = t("{year} en {time}", { year, time: `${hh}:${mm}:${ss}` });
    } else {
      const days = Math.ceil(ms / 86400000);
      text =
        days === 1
          ? t("{year} llega mañana", { year })
          : t("{year} llega en {n} días", { year, n: days });
    }
  }
  return (
    <span className="season-corner newyear" role="timer">
      <McArt sym="mc-firework-rocket" fallback={SPARK} size={30} />
      <McClock date={d} />
      <span className="ny-chip">{text}</span>
    </span>
  );
}

// ------------------------------------------------------------------ ambient
function Bats() {
  useMcTextures();
  const [flocks, setFlocks] = useState([]);
  useEffect(() => {
    let timer;
    const next = (first) => {
      timer = setTimeout(
        () => {
          const id = Date.now();
          const top = 70 + Math.random() * 120;
          setFlocks((f) => [
            ...f,
            { id, top, dur: 7 + Math.random() * 3, rtl: Math.random() < 0.5 },
          ]);
          setTimeout(
            () => setFlocks((f) => f.filter((x) => x.id !== id)),
            11000,
          );
          next(false);
        },
        first ? 4000 : 40000 + Math.random() * 40000,
      );
    };
    next(true);
    return () => clearTimeout(timer);
  }, []);
  return flocks.map((f) => (
    <div
      key={f.id}
      className={`bat-flock ${f.rtl ? "rtl" : ""}`}
      style={{ top: f.top, animationDuration: `${f.dur}s` }}
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`bat ${mcUrl("entity/bat#up") ? "mc" : ""}`}
          style={{ "--i": i }}
        >
          <McArt
            tex="entity/bat#up"
            fallback={BAT_UP}
            size={30}
            className="bat-a"
          />
          <McArt
            tex="entity/bat#down"
            fallback={BAT_DOWN}
            size={30}
            className="bat-b"
          />
        </span>
      ))}
    </div>
  ));
}

// ------------------------------------------------------------------ the sleigh (Christmas)
// Now and then a sleigh crosses the window, pulled by four reindeer, the way
// the bats cross it at Halloween. The game has none of this, so it is drawn
// here in its style; the first reindeer lights the way with the game's lantern.
const DEER = {
  b: "#8a5a34",
  h: "#9b6a40",
  a: "#e2d2ab",
  l: "#5e3c22",
  n: "#2a1c12",
  e: "#141414",
  t: "#f4efe6",
};
const DEER_BODY = [
  "...........a.a..",
  "...........aaa..",
  "............hh..",
  "...........hehn.",
  ".bbbbbbbbbbhh...",
  "tbbbbbbbbbbb....",
  ".bbbbbbbbbbb....",
  ".bbbbbbbbbb.....",
];
const DEER_RUN = {
  rows: [
    ...DEER_BODY,
    ".l.l.....l.l....",
    "l...l...l...l...",
    "................",
  ],
  palette: DEER,
};
const DEER_LEAP = {
  rows: [
    ...DEER_BODY,
    "..ll....ll......",
    "..l.l...l.l.....",
    "................",
  ],
  palette: DEER,
};
const SLEIGH = {
  rows: [
    ".......w..............",
    "......rrr.............",
    ".....rrrrr............",
    ".....wwwww............",
    ".....fffff.....GG.....",
    ".....fwwwf....GGGG....",
    "....rrwwwrr..GGyGGG...",
    "SS..rrrwrrr..GGyGGG...",
    "SSSSSSSSSSSSSSSSSSSS..",
    "SsSSSSSSSSSSSSSSSSsS.k",
    ".SSSSSSSSSSSSSSSSSS.k.",
    "..k.............k..k..",
    "kkkkkkkkkkkkkkkkkkkk..",
  ],
  palette: {
    r: "#c8262c",
    w: "#f4f1ea",
    f: "#e9b98f",
    S: "#8c1d22",
    s: "#d8a640",
    G: "#2e7d4f",
    y: "#e9c64a",
    k: "#d8a640",
  },
};

function Sleigh() {
  useMcTextures();
  const [runs, setRuns] = useState([]);
  useEffect(() => {
    let timer;
    const next = (first) => {
      timer = setTimeout(
        () => {
          const id = Date.now();
          setRuns((f) => [
            ...f,
            {
              id,
              top: 64 + Math.random() * 90,
              dur: 9 + Math.random() * 3,
              rtl: Math.random() < 0.5,
            },
          ]);
          setTimeout(() => setRuns((f) => f.filter((x) => x.id !== id)), 13000);
          next(false);
        },
        first ? 6000 : 55000 + Math.random() * 50000,
      );
    };
    next(true);
    return () => clearTimeout(timer);
  }, []);
  const lantern = mcUrl("item/lantern");
  return runs.map((f) => (
    <div
      key={f.id}
      className={`sleigh-run ${f.rtl ? "rtl" : ""}`}
      style={{ top: f.top, animationDuration: `${f.dur}s` }}
      aria-hidden="true"
    >
      <div className="sleigh-train">
        <Pixels {...SLEIGH} size={66} className="sleigh" />
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`deer ${i === 3 ? "lead" : ""}`}
            style={{ "--i": i }}
          >
            <Pixels {...DEER_RUN} size={44} className="bat-a" />
            <Pixels {...DEER_LEAP} size={44} className="bat-b" />
            {i === 3 ? (
              lantern ? (
                <img
                  className="deer-light"
                  src={lantern}
                  width={18}
                  height={18}
                  alt=""
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <i className="deer-light plain" />
              )
            ) : null}
          </span>
        ))}
      </div>
    </div>
  ));
}

// square snowflakes, like the game's snow particles (computers without the game's files)
function FlakeSnow() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    const g = cv.getContext("2d");
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const flakes = Array.from({ length: 52 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      s: 3 + Math.floor(Math.random() * 3),
      v: 0.35 + Math.random() * 0.6,
      ph: Math.random() * 6.28,
    }));
    let raf = 0;
    let fall = 0;
    let last = performance.now();
    const loop = (ts) => {
      const dt = Math.min(3, (ts - last) / 16.7);
      last = ts;
      if (!isQuiet()) {
        g.clearRect(0, 0, w, h);
        g.fillStyle = "rgba(255,255,255,0.55)";
        for (const f of flakes) {
          f.y += f.v * dt;
          f.ph += 0.015 * dt;
          f.x += Math.sin(f.ph) * 0.25 * dt;
          if (f.y > h + 4) {
            f.y = -4;
            f.x = Math.random() * w;
          }
          g.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s);
        }
      }
      raf = requestFrame(loop);
    };
    raf = requestFrame(loop);
    return () => {
      cancelFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className="season-snow" aria-hidden="true" />;
}

// The game's own snowfall: its sheet of flakes sliding down, a near layer and a
// far one. Each layer is one picture moved by the graphics card (a CSS
// animation): nothing is redrawn and no code runs while it falls.
function GameSnow({ sheet }) {
  const W = sheet.canvas.width;
  const H = sheet.canvas.height;
  const layers = [
    [3, 1.5, 0.5, 14],
    [2, 0.9, 0.26, -9],
  ];
  return (
    <div className="season-snow" aria-hidden="true">
      {layers.map(([scale, speed, alpha, sway], i) => {
        const th = H * scale;
        return (
          <div key={i} className="snow-sway" style={{ "--sway": `${sway}px` }}>
            <div
              className="snow-layer"
              style={{
                backgroundImage: `url(${sheet.url})`,
                backgroundSize: `${W * scale}px ${th}px`,
                opacity: alpha,
                top: -th,
                "--fall": `${th}px`,
                animationDuration: `${(th / (speed * 60)).toFixed(2)}s`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function Snow() {
  useMcTextures();
  const sheet = mcTex("environment/snow#light");
  return sheet ? <GameSnow sheet={sheet} /> : <FlakeSnow />;
}

// a string of pixel lights along the top of the content area
export function Garland() {
  const { season } = useApp();
  if (season !== "christmas") return null;
  const colors = ["#e4322b", "#3fb950", "#ffd23a", "#4aa8ff"];
  const bulbs = Array.from({ length: 40 }, (_, i) => i);
  return (
    <div className="garland" aria-hidden="true">
      <svg
        className="garland-wire"
        viewBox="0 0 1000 20"
        preserveAspectRatio="none"
      >
        <path
          d={[
            "M0 4",
            ...bulbs.map((i) => `Q${i * 25 + 12.5} 12 ${(i + 1) * 25} 4`),
          ].join(" ")}
          fill="none"
          stroke="#3a4a3d"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {bulbs.map((i) => (
        <span
          key={i}
          className={`bulb ${i % 5 === 2 ? "blink" : ""}`}
          style={{
            "--c": colors[i % colors.length],
            "--d": `${(i % 7) * 0.4}s`,
            left: `${(i + 0.5) * 2.5}%`,
          }}
        />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ backdrop
// A blocky horizon along the bottom of the window, behind the content: hills
// with pumpkins, snowy hills with pines, or a village with lit windows.
const BD_W = 2400;
const BD_H = 190;
const B = 12; // one block

function hillHeights(seed, base, amp, cols) {
  const out = [];
  for (let i = 0; i < cols; i++) {
    const x = i / cols;
    const v =
      base +
      amp *
        (0.55 * Math.sin(x * 13.1 + seed) +
          0.3 * Math.sin(x * 29.7 + seed * 2.3) +
          0.15 * Math.sin(x * 61.3 + seed * 0.7));
    out.push(Math.max(1, Math.round(v)));
  }
  return out;
}

function backdropRects(season) {
  const cols = BD_W / B;
  const rects = [];
  const rect = (x, y, w, h, fill, extra) =>
    rects.push({ x, y, w, h, fill, ...extra });
  const pal = {
    halloween: { far: "#1c1326", near: "#261a33", top: "#2f2140" },
    christmas: { far: "#12201a", near: "#182a21", top: "#e7efe9" },
    newyear: { far: "#121833", near: "#182042", top: "#222b55" },
  }[season];
  const far = hillHeights(1.7, 7, 3.2, cols);
  const near = hillHeights(4.1, 4, 2.4, cols);
  far.forEach((h, i) => rect(i * B, BD_H - h * B, B, h * B, pal.far));
  near.forEach((h, i) => {
    rect(i * B, BD_H - h * B, B, h * B, pal.near);
    // the top block of each column
    if (season === "christmas")
      rect(i * B, BD_H - h * B, B, 5, pal.top, { o: 0.75 });
    else rect(i * B, BD_H - h * B, B, B, pal.top);
  });
  // things standing on the near hills, every so often
  const r = (i) => {
    let x = Math.sin(i * 91.7 + 13.1) * 43758.5;
    return x - Math.floor(x);
  };
  for (let i = 3; i < cols - 3; i += 7 + Math.floor(r(i) * 9)) {
    const gy = BD_H - near[i] * B;
    const x = i * B;
    if (season === "halloween") {
      // a pumpkin with a lit face
      rect(x - 2, gy - 12, 16, 12, "#c8641a");
      rect(x + 1, gy - 9, 3, 3, "#ffd23a");
      rect(x + 8, gy - 9, 3, 3, "#ffd23a");
      rect(x + 2, gy - 4, 8, 2, "#ffd23a");
      rect(x + 5, gy - 15, 2, 3, "#5d7a22");
      rect(x - 8, gy - 22, 28, 26, "#ff9a2e", { o: 0.08 });
    } else if (season === "christmas") {
      // a pine with snow on it
      const tall = 3 + Math.floor(r(i + 1) * 3);
      rect(x + 4, gy - 8, 4, 8, "#3d2a1a");
      for (let k = 0; k < tall; k++) {
        const w = (tall - k) * 6 + 4;
        rect(x + 6 - w / 2, gy - 8 - (k + 1) * 9, w, 9, "#1f4a2e");
        rect(x + 6 - w / 2, gy - 8 - (k + 1) * 9, w, 3, "#e7efe9", { o: 0.7 });
      }
    } else {
      // a little house with lit windows
      const w = 30 + Math.floor(r(i + 2) * 3) * 6;
      rect(x - 6, gy - 24, w, 24, "#1d2550");
      rect(x - 9, gy - 30, w + 6, 6, "#2a3366");
      for (let k = 0; k < w - 12; k += 10)
        if (r(i + k) > 0.35) rect(x + k, gy - 18, 5, 6, "#ffd36b", { o: 0.85 });
    }
  }
  if (season === "newyear") {
    for (let k = 0; k < 70; k++)
      rect(
        Math.floor(r(k + 300) * BD_W),
        Math.floor(r(k + 900) * 70),
        2,
        2,
        "#ffffff",
        { o: 0.25 + r(k + 50) * 0.4 },
      );
  }
  return rects;
}

export function SeasonBackdrop() {
  const { season } = useApp();
  const rects = useMemo(
    () => (season ? backdropRects(season) : null),
    [season],
  );
  if (!rects) return null;
  return (
    <svg
      className="season-backdrop"
      viewBox={`0 0 ${BD_W} ${BD_H}`}
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {rects.map((q, i) => (
        <rect
          key={i}
          x={q.x}
          y={q.y}
          width={q.w}
          height={q.h}
          fill={q.fill}
          opacity={q.o}
        />
      ))}
    </svg>
  );
}

// ------------------------------------------------------------------ fireworks
// window.dispatchEvent(new CustomEvent('havihub:fireworks', { detail: { ms } }))
export function playFireworks(ms = 15000) {
  window.dispatchEvent(new CustomEvent("havihub:fireworks", { detail: { ms } }));
}
export function triggerScare() {
  window.dispatchEvent(new CustomEvent("havihub:scare"));
}

let midnightShown = false;

function FireworksLayer({ season }) {
  const [show, setShow] = useState(null); // { ms, key }
  const ref = useRef(null);

  useEffect(() => {
    const on = (e) =>
      setShow({ ms: (e.detail && e.detail.ms) || 15000, key: Date.now() });
    window.addEventListener("havihub:fireworks", on);
    return () => window.removeEventListener("havihub:fireworks", on);
  }, []);

  // midnight on New Year's Eve, or right after it if the app opens then
  useEffect(() => {
    if (season !== "newyear") return undefined;
    const d = now();
    if (
      d.getMonth() === 0 &&
      d.getDate() === 1 &&
      d.getHours() === 0 &&
      !midnightShown
    ) {
      midnightShown = true;
      setShow({ ms: 60000, key: Date.now() });
      return undefined;
    }
    const ms = nextNewYear(d) - d;
    if (d.getMonth() !== 11 || ms > 26 * 3600 * 1000) return undefined;
    const id = setTimeout(() => {
      midnightShown = true;
      setShow({ ms: 60000, key: Date.now(), midnight: true });
    }, ms);
    return () => clearTimeout(id);
  }, [season]);

  useEffect(() => {
    if (!show || !ref.current) return undefined;
    const fw = new Fireworks(ref.current);
    fw.onEnd = () => setShow(null);
    fw.show(show.ms);
    return () => fw.destroy();
  }, [show]);

  if (!show) return null;
  return (
    <>
      <canvas ref={ref} className="fx-canvas" aria-hidden="true" />
      {show.midnight ? (
        <div className="ny-hello">
          {t("¡Feliz {year}!", { year: now().getFullYear() })}
        </div>
      ) : null}
    </>
  );
}

// ------------------------------------------------------------------ the scare
// About one start in 40 and one click in 1500, at most once a day, only while
// the Halloween theme is on (and never with "Reduce animations").
const START_CHANCE = 1 / 40;
const CLICK_CHANCE = 1 / 1500;

// The scare in 3D: the game's default player with blank white eyes (the figure
// of the old Minecraft legend) comes out of the dark and lunges at the screen.
// It is the game's own skin, read from this computer; the eyes are whitened here.
function LungeScare({ skin, onFail, onShown }) {
  const ref = useRef(null);
  useEffect(() => {
    const box = ref.current.parentElement;
    let viewer;
    try {
      viewer = new skinview3d.SkinViewer({
        canvas: ref.current,
        width: box.clientWidth,
        height: box.clientHeight,
        skin,
        fov: 62,
      });
    } catch {
      // no 3D on this computer right now: the flat face does the job
      onFail();
      return undefined;
    }
    viewer.controls.enabled = false;
    viewer.autoRotate = false;
    viewer.camera.position.set(0, 0, 60);
    viewer.camera.lookAt(0, 0, 0);
    viewer.globalLight.intensity = 1.7;
    viewer.cameraLight.intensity = 1.2;
    viewer.playerWrapper.rotation.set(0, 0, 0);
    viewer.playerWrapper.position.set(0, 0, 0);
    // where the head is on the model, to put the face right in front of the camera wherever the viewer keeps it
    viewer.playerObject.updateMatrixWorld(true);
    const off = new THREE.Box3()
      .setFromObject(viewer.playerObject.skin.head)
      .getCenter(new THREE.Vector3())
      .sub(viewer.playerObject.position);
    const dir = new THREE.Vector3();
    // the clock starts with the first picture (preparing 3D can take a moment on a slow computer)
    let start = 0;
    viewer.animation = new skinview3d.FunctionAnimation((player) => {
      if (!start) {
        start = performance.now();
        onShown();
      }
      const t = (performance.now() - start) / 1000;
      const k = 1 - (1 - Math.min(1, t / 0.2)) ** 3; // out of the dark in a fifth of a second
      const s = player.skin;
      // from far away to a hand from the glass (the face fills the window), and never holding still
      const cam = viewer.camera;
      cam.getWorldDirection(dir);
      const depth = 170 - k * 160.5 + Math.sin(t * 37) * 0.7;
      player.position.set(
        cam.position.x + dir.x * depth - off.x + Math.sin(t * 61) * 0.6 * k,
        cam.position.y +
          dir.y * depth -
          off.y +
          1.2 * k +
          Math.sin(t * 83) * 0.35 * k,
        cam.position.z + dir.z * depth - off.z,
      );
      player.rotation.set(
        0,
        Math.sin(t * 29) * 0.05,
        Math.sin(t * 47) * 0.06 * k,
      );
      s.head.rotation.set(
        Math.sin(t * 53) * 0.1,
        Math.sin(t * 71) * 0.12,
        Math.sin(t * 43) * 0.1,
      );
      s.rightArm.rotation.set(-1.75 * k + Math.sin(t * 40) * 0.22, 0, -0.3 * k);
      s.leftArm.rotation.set(
        -1.75 * k + Math.sin(t * 40 + 2) * 0.22,
        0,
        0.3 * k,
      );
      s.rightLeg.rotation.x = Math.sin(t * 31) * 0.35 * k;
      s.leftLeg.rotation.x = -Math.sin(t * 31) * 0.35 * k;
    });
    const resize = () => viewer.setSize(box.clientWidth, box.clientHeight);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      viewer.dispose();
      viewer.renderer.forceContextLoss();
    };
  }, [skin]);
  return <canvas ref={ref} className="scare-3d" />;
}

// When the Halloween week begins (not when Havi Hub starts, and not in the
// preview): it says plainly that the week brings a scare (a figure that jumps
// at the screen, with a loud sound), so that whoever could be harmed by it, or
// just dislikes it, turns it off right there. Once a year, before any scare.
export function scareNoticeKey(date = now()) {
  return String(seasonYear(date, "halloween"));
}
export function ScareNotice() {
  const app = useApp();
  const { config, season, seasonPreview } = app;
  const asked = useRef(false);
  const key = scareNoticeKey();
  useEffect(() => {
    // after the first-start welcome (which needs the instances to know whether it is due)
    if (season !== "halloween" || seasonPreview || !config || config.scareNotice === key || !config.layout || !app.instancesLoaded || needsWelcome(config, app.instances) || asked.current) return;
    if ((config.seasons || {}).scares === false) return;
    asked.current = true;
    const timer = setTimeout(async () => {
      // the button in front is the careful one; closing the notice leaves things as they were
      const off = await app.confirm({
        title: t("Aviso: sustos en la semana de Halloween"),
        message: t(
          "Del 25 de octubre al 1 de noviembre, Havi Hub puede dar un susto de vez en cuando: una figura salta a la pantalla, con un sonido fuerte y la imagen parpadeando. Si tienes epilepsia fotosensible, un problema del corazón, ansiedad, o simplemente no te gustan los sustos, desactívalos ahora. También se cambia después en Ajustes → Temas → Sustos ocultos.",
        ),
        confirmLabel: t("Desactivar los sustos"),
        cancelLabel: t("Dejarlos activados"),
        icon: "alert",
      });
      const patch = { scareNotice: key };
      if (off) patch.seasons = { ...(config.seasons || {}), scares: false };
      app.updateConfig(patch).catch(() => {});
      if (off) app.toast(t("Sustos desactivados"), { type: "success" });
    }, 1500);
    return () => clearTimeout(timer);
  }, [season, seasonPreview, key, config && config.scareNotice, config && config.layout, config && config.welcomeDone, app.instancesLoaded]);
  return null;
}

function Scare({ armed }) {
  const app = useApp();
  const [on, setOn] = useState(false);
  const [flat, setFlat] = useState(false); // the 3D figure could not be drawn: the flat face instead
  const busy = useRef(false);

  const timer = useRef(0);
  const end = useCallback((ms) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOn(false);
      busy.current = false;
    }, ms);
  }, []);

  const fire = useCallback(
    (test) => {
      if (busy.current) return;
      busy.current = true;
      setOn(true);
      scareSound().catch(() => {});
      if (!test) app.updateConfig({ lastScare: todayKey() }).catch(() => {});
      // with the 3D figure, the 1.7 seconds count from its first picture (see LungeScare)
      end(mcTex("entity/steve#blank-eyes") ? 6000 : 1700);
    },
    [app, end],
  );

  useEffect(() => {
    const onTest = () => fire(true);
    window.addEventListener("havihub:scare", onTest);
    return () => window.removeEventListener("havihub:scare", onTest);
  }, [fire]);

  const last = app.config ? app.config.lastScare : "";
  useEffect(() => {
    if (!armed) return undefined;
    if (last === todayKey()) return undefined;
    let done = false;
    const go = () => {
      if (done || document.hidden) return;
      done = true;
      fire(false);
    };
    const start = setTimeout(
      () => Math.random() < START_CHANCE && go(),
      2500 + Math.random() * 3500,
    );
    const onClick = () => {
      if (Math.random() < CLICK_CHANCE) setTimeout(go, 120);
    };
    document.addEventListener("pointerdown", onClick, true);
    return () => {
      clearTimeout(start);
      document.removeEventListener("pointerdown", onClick, true);
    };
  }, [armed, last, fire]);

  if (!on) return null;
  const figure = mcTex("entity/steve#blank-eyes");
  if (figure && !flat) {
    return (
      <div
        className="scare lunge"
        onPointerDown={() => end(0)}
        role="presentation"
      >
        <LungeScare
          skin={figure.canvas}
          onFail={() => {
            setFlat(true);
            end(1700);
          }}
          onShown={() => end(1700)}
        />
      </div>
    );
  }
  return (
    <div
      className="scare"
      onPointerDown={() => setOn(false)}
      role="presentation"
    >
      <div className="scare-face">
        <Pixels {...FACE} size={16} />
        <svg className="scare-eyes" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="2" y="5" width="3" height="2" fill="#fff" />
          <rect x="11" y="5" width="3" height="2" fill="#fff" />
        </svg>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the notice
const NOTICE = {
  halloween: {
    title: () => t("Llegó el tema de Halloween"),
    art: PUMPKIN,
    size: 48,
  },
  christmas: {
    title: () => t("Llegó el tema de Navidad"),
    art: TREE,
    size: 56,
  },
  newyear: {
    title: () => t("Llegó el tema de Año Nuevo"),
    art: SPARK,
    size: 45,
  },
};

function SeasonNotice({ season, onClose }) {
  const app = useApp();
  const end = seasonEnd(now(), season);
  const until = new Intl.DateTimeFormat(getLanguage() === "en" ? "en" : "es", {
    day: "numeric",
    month: "long",
  }).format(end);
  const n = NOTICE[season];
  return (
    <div className={`season-notice ${season}`} role="status">
      <Pixels {...n.art} size={n.size} className="sn-art" />
      <div className="sn-body">
        <strong>{n.title()}</strong>
        <p>
          {t(
            "Se quedará hasta el {date}. Si no lo quieres, apágalo en Ajustes → Temas → Temas de temporada.",
            { date: until },
          )}
        </p>
        <div className="sn-actions">
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              onClose();
              app.navigate({
                page: "settings",
                section: "themes",
                focus: "seasons",
              });
            }}
          >
            {t("Abrir Ajustes")}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t("Entendido")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ layer
export default function SeasonLayer() {
  const app = useApp();
  const { season, seasonPreview, config } = app;
  const reduce = Boolean(config && config.reduceMotion);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!season || seasonPreview || !config) return;
    const key = `${season}-${seasonYear(now(), season)}`;
    if (config.seasonNotices && config.seasonNotices[key]) return;
    setNotice({ season, key });
  }, [season, seasonPreview, config && config.seasonNotices]);

  // sounds need the audio engine up before the first effect
  useEffect(() => {
    if (season) audio();
  }, [season]);

  const closeNotice = () => {
    if (notice)
      app
        .updateConfig({ seasonNotices: { [notice.key]: true } })
        .catch(() => {});
    setNotice(null);
  };

  // only once this year's notice about them was answered (it waits for the
  // first-start welcome): nobody gets a scare before being told how to turn them off
  const scaresArmed = useMemo(
    () =>
      Boolean(
        config &&
        config.scareNotice === scareNoticeKey() &&
        season === "halloween" &&
        !seasonPreview &&
        !reduce &&
        (config.seasons || {}).scares !== false,
      ),
    [config, season, seasonPreview, reduce],
  );

  return (
    <>
      {season === "halloween" && !reduce ? <Bats /> : null}
      {season === "christmas" && !reduce ? <Snow /> : null}
      {season === "christmas" && !reduce ? <Sleigh /> : null}
      <FireworksLayer season={seasonPreview ? null : season} />
      <Scare armed={scaresArmed} />
      <ScareNotice />
      {seasonPreview ? (
        <div className="season-preview-bar">
          <Icon name="eye" size={18} />
          <span>{t("Vista previa del tema de temporada")}</span>
          <button
            className="link-btn"
            onClick={() => app.setSeasonPreview(null)}
          >
            {t("Salir de la vista previa")}
          </button>
        </div>
      ) : null}
      {notice && notice.season === season ? (
        <SeasonNotice season={season} onClose={closeNotice} />
      ) : null}
    </>
  );
}
