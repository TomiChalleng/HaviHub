// Sounds for the seasonal effects. The fireworks use Minecraft's own sounds
// when the game assets are on this computer (they are read, never bundled);
// otherwise they are synthesized here to sound close to them.
import { call } from './api.js';

let ctx = null;
let master = null;
const buffers = new Map();

export function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -10;
    master.ratio.value = 6;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// decoded game sound (AudioBuffer) or null
export function gameSound(name) {
  if (!buffers.has(name)) {
    buffers.set(
      name,
      call('season.sound', name)
        .then((bytes) => (bytes && bytes.length ? audio().decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)) : null))
        .catch(() => null),
    );
  }
  return buffers.get(name);
}

function out(gain = 1, pan = 0) {
  const a = audio();
  const g = a.createGain();
  g.gain.value = gain;
  if (pan && a.createStereoPanner) {
    const p = a.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(master);
  } else g.connect(master);
  return g;
}

function playBuffer(buf, { gain = 1, rate = 1, pan = 0, at = 0 } = {}) {
  const a = audio();
  const src = a.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  src.connect(out(gain, pan));
  src.start(a.currentTime + at);
}

let noiseBuf = null;
function noise() {
  const a = audio();
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  return src;
}

// ---- synthesized stand-ins
const SYNTH = {
  launch({ gain, pan, at }) {
    const a = audio();
    const t = a.currentTime + at;
    const n = noise();
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.8);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    n.connect(bp).connect(g).connect(out(gain, pan));
    n.start(t);
    n.stop(t + 1.05);
  },
  blast({ gain, pan, at, large = false, far = false }) {
    const a = audio();
    const t = a.currentTime + at;
    const len = large ? 1.5 : 0.8;
    const n = noise();
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(far ? 700 : 2400, t);
    lp.frequency.exponentialRampToValueAtTime(far ? 200 : 400, t + len);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(far ? 0.5 : 0.9, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(lp).connect(g).connect(out(gain, pan));
    n.start(t);
    n.stop(t + len + 0.05);
    // the low thump
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(large ? 90 : 120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.35);
    const og = a.createGain();
    og.gain.setValueAtTime(far ? 0.25 : 0.7, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(og).connect(out(gain, pan));
    o.start(t);
    o.stop(t + 0.45);
  },
  twinkle({ gain, pan, at, far = false }) {
    const a = audio();
    const t0 = a.currentTime + at;
    for (let i = 0; i < 26; i++) {
      const t = t0 + Math.random() * 1.1;
      const n = noise();
      const hp = a.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = far ? 1800 : 3200;
      const g = a.createGain();
      const peak = (far ? 0.18 : 0.35) * (0.4 + Math.random() * 0.6);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.03);
      n.connect(hp).connect(g).connect(out(gain, pan));
      n.start(t);
      n.stop(t + 0.07);
    }
  },
};

// name: launch | blast | blastFar | largeBlast | largeBlastFar | twinkle | twinkleFar
export async function fireworkSound(name, { gain = 1, pan = 0, at = 0 } = {}) {
  audio();
  const buf = await gameSound(name);
  if (buf) {
    // like the game, each one plays a little higher or lower
    playBuffer(buf, { gain, pan, at, rate: 0.9 + Math.random() * 0.25 });
    return;
  }
  const far = /Far$/.test(name);
  if (name === 'launch') SYNTH.launch({ gain, pan, at });
  else if (name.startsWith('twinkle')) SYNTH.twinkle({ gain, pan, at, far });
  else SYNTH.blast({ gain, pan, at, far, large: name.startsWith('large') });
}

// The scare: a loud electronic screech (and the game's ghast scream when the
// game is installed), about 1.3 seconds long
// The Halloween scare: with the game on this computer, an enderman dying over
// one of its eeriest cave noises (a different one each time); without it, a
// synthesized scream.
const CAVES = ['cave14', 'cave13', 'cave2', 'cave19'];
export async function scareSound() {
  const [death, cave] = await Promise.all([gameSound('endermanDeath'), gameSound(CAVES[Math.floor(Math.random() * CAVES.length)])]);
  if (death || cave) {
    if (cave) playBuffer(cave, { gain: 1 });
    if (death) playBuffer(death, { gain: 1, rate: 0.92 });
    return;
  }
  const a = audio();
  const t = a.currentTime + 0.01;
  const len = 1.3;
  const shaper = a.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    curve[i] = Math.tanh(x * 6);
  }
  shaper.curve = curve;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.75, t + 0.03);
  g.gain.setValueAtTime(0.75, t + len - 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  shaper.connect(g).connect(out(1));
  const lfo = a.createOscillator();
  lfo.frequency.value = 28;
  const lfoGain = a.createGain();
  lfoGain.gain.value = 140;
  lfo.connect(lfoGain);
  for (const [f, type] of [
    [880, 'sawtooth'],
    [1245, 'sawtooth'],
    [1760, 'square'],
  ]) {
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f * 0.8, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.1, t + len);
    lfoGain.connect(o.frequency);
    const og = a.createGain();
    og.gain.value = 0.22;
    o.connect(og).connect(shaper);
    o.start(t);
    o.stop(t + len);
  }
  const n = noise();
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2500;
  bp.Q.value = 0.7;
  const ng = a.createGain();
  ng.gain.value = 0.35;
  n.connect(bp).connect(ng).connect(shaper);
  n.start(t);
  n.stop(t + len);
  lfo.start(t);
  lfo.stop(t + len);
}
