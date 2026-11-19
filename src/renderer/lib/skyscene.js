// The stage of the 3D skin viewer: a piece of Minecraft world to stand on.
// Grass blocks at the game's scale (the player is 1.875 blocks tall), small
// hills, grass, flowers and oak trees, the game's sky colours, sun, moon and
// its flat cloud layer. Walking or running, the world goes by under the feet.
// Textures are the game's own (lib/mc-textures.js); without the game on this
// computer, plain stand-ins are painted so there is always ground to stand on.
import * as THREE from 'three';
import { isQuiet, requestFrame, cancelFrame } from './quiet.js';
import { mcTex, onMcTextures } from './mc-textures.js';

export const BLOCK = 32 / 1.875; // one block, in the viewer's units (the player model is 32 units tall)
const R = 24; // blocks drawn around the player
const PATH = 2; // the strip the player walks on stays flat this many blocks to each side
// blocks per second, as in the game
export const SPEED = { walk: 4.317, run: 5.612, fly: 14 };

const SKY = {
  day: { top: '#78a7ff', horizon: '#c0d8ff', light: [1, 1, 1], cloud: [1, 1, 1] },
  night: { top: '#02030a', horizon: '#0a0f1f', light: [0.3, 0.34, 0.5], cloud: [0.16, 0.19, 0.3] },
};
// how lit each face of a block is, as the game shades them: +x, -x, top, bottom, +z, -z
const FACE = [0.6, 0.6, 1, 0.5, 0.8, 0.8];

// ---- small helpers
function hash(x, z, salt = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(salt | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smooth(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi, 3);
  const b = hash(xi + 1, zi, 3);
  const c = hash(xi, zi + 1, 3);
  const d = hash(xi + 1, zi + 1, 3);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// ground height (in blocks) at a place of the world; flat along the path
function heightAt(x, z) {
  const ax = Math.abs(x);
  if (ax <= PATH) return 0;
  const n = smooth(x * 0.17, z * 0.17) * 0.7 + smooth(x * 0.41 + 9, z * 0.41) * 0.3;
  return Math.max(0, Math.min(3, Math.round(n * 4.4 * Math.min(1, (ax - PATH) / 6) - 0.8)));
}
const isTree = (x, z) => Math.abs(x) >= 5 && hash(x, z, 7) < 0.014 && hash(x - 1, z, 7) >= 0.014 && hash(x, z - 1, 7) >= 0.014;

function gradientTexture(top, horizon) {
  const cv = document.createElement('canvas');
  cv.width = 4;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(0.5, horizon);
  g.addColorStop(1, horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}

// a 16×16 stand-in painted with a little noise (used only without the game's textures)
function painted(base, spread, extra) {
  const cv = document.createElement('canvas');
  cv.width = 16;
  cv.height = 16;
  const g = cv.getContext('2d');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const k = 1 + (hash(x, y, base[0]) - 0.5) * spread;
      g.fillStyle = `rgb(${Math.round(base[0] * k)},${Math.round(base[1] * k)},${Math.round(base[2] * k)})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  if (extra) extra(g);
  return cv;
}

function pixelTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export class SkyScene {
  constructor(viewer) {
    this.viewer = viewer;
    this.mode = 'none';
    this.motion = 'idle';
    this.paused = false;
    this.scroll = 0; // blocks walked
    this.cell = null; // the whole block the terrain was last laid out for
    this.cloudDrift = 0;
    this.last = performance.now();
    this.saved = { far: viewer.camera.far, near: viewer.camera.near, polar: viewer.controls.maxPolarAngle, global: viewer.globalLight.intensity };
    // where the feet are (the model at rest)
    viewer.playerObject.updateMatrixWorld(true);
    this.feet = new THREE.Box3().setFromObject(viewer.playerObject.skin).min.y;
    this.build();
    this.offTextures = onMcTextures(() => this.rebuild());
    const tick = (now) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (this.mode !== 'none' && !isQuiet() && !viewer.renderPaused) this.step(this.paused ? 0 : dt);
      this.raf = requestFrame(tick);
    };
    this.raf = requestFrame(tick);
  }

  tex(name, fallback) {
    const t = mcTex(name);
    return pixelTexture(t ? t.canvas : fallback());
  }

  // one material per face of a block, shaded as the game does
  blockMaterials(faces, opts = {}) {
    return faces.map((map, i) => {
      const m = new THREE.MeshBasicMaterial({ map, ...opts });
      m.userData.shade = FACE[i];
      this.lit.push(m);
      return m;
    });
  }

  instanced(geometry, material, max) {
    const mesh = new THREE.InstancedMesh(geometry, material, max);
    mesh.count = 0;
    mesh.frustumCulled = false;
    this.world.add(mesh);
    return mesh;
  }

  build() {
    this.group = new THREE.Group(); // sky: does not turn with the player
    this.world = new THREE.Group(); // ground: laid along the way the player faces
    this.viewer.scene.add(this.group);
    this.viewer.scene.add(this.world);
    this.lit = [];
    const real = Boolean(mcTex('block/dirt'));
    this.real = real;

    // ---- textures
    const dirt = this.tex('block/dirt', () => painted([134, 96, 67], 0.22));
    const top = this.tex('block/grass_block_top#tint', () => painted([124, 176, 78], 0.2));
    const side = this.tex('block/grass_block_side#grass', () =>
      painted([134, 96, 67], 0.22, (g) => {
        for (let x = 0; x < 16; x++) {
          g.fillStyle = `rgb(${110 + Math.round(hash(x, 1, 5) * 30)},${165 + Math.round(hash(x, 2, 5) * 25)},70)`;
          g.fillRect(x, 0, 1, 2 + Math.round(hash(x, 3, 5) * 2));
        }
      }),
    );
    const log = this.tex('block/oak_log', () => painted([102, 81, 50], 0.2));
    const logTop = this.tex('block/oak_log_top', () => painted([160, 130, 78], 0.15));
    const leaves = this.tex('block/oak_leaves#tint', () => painted([72, 130, 40], 0.45));

    // ---- blocks
    const cube = new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK);
    const columns = (2 * R + 1) ** 2;
    this.grass = this.instanced(cube, this.blockMaterials([side, side, top, dirt, side, side]), columns);
    this.dirt = this.instanced(cube, this.blockMaterials([dirt, dirt, dirt, dirt, dirt, dirt]), columns * 2);
    this.logs = this.instanced(cube, this.blockMaterials([log, log, logTop, logTop, log, log]), 400);
    this.leaves = this.instanced(cube, this.blockMaterials([leaves, leaves, leaves, leaves, leaves, leaves], { alphaTest: 0.5 }), 6000);

    // ---- grass and flowers: two crossed squares, as the game draws them
    const cross = new THREE.BufferGeometry();
    const h = BLOCK / 2;
    const d = h * 0.9;
    cross.setAttribute('position', new THREE.Float32BufferAttribute([-d, 0, -d, d, 0, d, d, BLOCK, d, -d, BLOCK, -d, -d, 0, d, d, 0, -d, d, BLOCK, -d, -d, BLOCK, d], 3));
    cross.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1], 2));
    cross.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    this.plants = [];
    for (const name of ['block/short_grass#tint', 'block/poppy', 'block/dandelion', 'block/oxeye_daisy', 'block/cornflower', 'block/azure_bluet']) {
      const t = mcTex(name);
      if (!t) continue;
      const m = new THREE.MeshBasicMaterial({ map: pixelTexture(t.canvas), alphaTest: 0.5, side: THREE.DoubleSide });
      m.userData.shade = 1;
      this.lit.push(m);
      this.plants.push(this.instanced(cross, m, 1400));
    }

    // ---- everything beyond the blocks: the same ground, lost in the distance
    this.far = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK * 400, BLOCK * 400), new THREE.MeshBasicMaterial({ color: 0x6f9f4c }));
    this.far.material.userData.shade = 1;
    this.far.material.userData.base = new THREE.Color(0x6f9f4c);
    this.lit.push(this.far.material);
    this.far.rotation.x = -Math.PI / 2;
    this.far.position.y = this.feet - 1;
    this.world.add(this.far);

    // ---- the shadow under the player
    const shadowTex = mcTex('misc/shadow');
    let shadowMap;
    if (shadowTex) {
      shadowMap = new THREE.CanvasTexture(shadowTex.canvas);
    } else {
      const cv = document.createElement('canvas');
      cv.width = 64;
      cv.height = 64;
      const g = cv.getContext('2d');
      const rg = g.createRadialGradient(32, 32, 4, 32, 32, 32);
      rg.addColorStop(0, 'rgba(0,0,0,.9)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 64, 64);
      shadowMap = new THREE.CanvasTexture(cv);
    }
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, BLOCK), new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, opacity: 0.55, depthWrite: false, color: 0x000000, alphaMap: shadowMap }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = this.feet + 0.15;
    this.shadow.renderOrder = 2;
    this.world.add(this.shadow);

    // ---- sun and moon (drawn added to the sky, as the game does)
    const body = (name, old, size, paint) => {
      let canvas = (mcTex(name) || {}).canvas;
      const atlas = !canvas && (mcTex(old) || {}).canvas;
      if (atlas) {
        // older versions keep the eight moon phases in one picture: the full moon is the first
        const cell = atlas.width >= atlas.height * 2 ? atlas.height / 2 : atlas.width;
        canvas = document.createElement('canvas');
        canvas.width = cell;
        canvas.height = cell;
        canvas.getContext('2d').drawImage(atlas, 0, 0, cell, cell, 0, 0, cell, cell);
      }
      if (!canvas) canvas = paint();
      const map = new THREE.CanvasTexture(canvas);
      map.magFilter = THREE.NearestFilter;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
      this.group.add(mesh);
      return mesh;
    };
    const square = (color, inset) => () => {
      const cv = document.createElement('canvas');
      cv.width = 32;
      cv.height = 32;
      const g = cv.getContext('2d');
      g.fillStyle = '#000';
      g.fillRect(0, 0, 32, 32);
      g.fillStyle = color;
      g.fillRect(inset, inset, 32 - inset * 2, 32 - inset * 2);
      return cv;
    };
    const DIST = 5200;
    const place = (mesh, elevation, azimuth) => {
      mesh.position.set(Math.sin(azimuth) * Math.cos(elevation) * DIST, Math.sin(elevation) * DIST, -Math.cos(azimuth) * Math.cos(elevation) * DIST);
      mesh.lookAt(0, 0, 0);
    };
    this.sun = body('environment/celestial/sun', 'environment/sun', DIST * 0.6, square('#fff6c8', 10));
    this.moon = body('environment/celestial/moon/full_moon', 'environment/moon_phases', DIST * 0.4, square('#d8dde8', 10));
    // behind the player and a little to the left, low enough to be in the picture
    place(this.sun, 0.3, -0.2);
    place(this.moon, 0.3, -0.2);

    // ---- stars
    const r = (() => {
      let s = 42;
      return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    })();
    const pos = [];
    for (let i = 0; i < 1500; i++) {
      const u = r();
      const th = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos.push(Math.cos(th) * s * 6000, u * 6000 + 60, Math.sin(th) * s * 6000);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, fog: false }));
    this.group.add(this.stars);

    // ---- clouds: the game's cloud map, one flat slab per dot of it
    const CELL = BLOCK * 12;
    const N = 40;
    const cloudMap = (mcTex('environment/clouds') || {}).canvas;
    let filled;
    if (cloudMap) {
      const px = cloudMap.getContext('2d').getImageData(0, 0, Math.min(N, cloudMap.width), Math.min(N, cloudMap.height));
      filled = (x, z) => px.data[(z * px.width + x) * 4 + 3] > 127;
    } else filled = (x, z) => smooth(x * 0.35, z * 0.35) > 0.56;
    const slab = new THREE.BoxGeometry(CELL, BLOCK * 4, CELL);
    const cloudMats = [0.9, 0.9, 1, 0.7, 0.8, 0.8].map((shade) => {
      const m = new THREE.MeshBasicMaterial({ fog: false });
      m.userData.cloud = shade;
      return m;
    });
    this.cloudMats = cloudMats;
    const spots = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (filled(x, z)) spots.push([x, z]);
    this.clouds = new THREE.InstancedMesh(slab, cloudMats, spots.length * 2);
    this.clouds.frustumCulled = false;
    const m4 = new THREE.Matrix4();
    let n = 0;
    // twice side by side, so the layer can drift and wrap without a seam
    for (const copy of [0, 1]) for (const [x, z] of spots) this.clouds.setMatrixAt(n++, m4.makeTranslation((x - N / 2 + copy * N) * CELL, 0, (z - N / 2) * CELL));
    this.clouds.userData.span = N * CELL;
    this.clouds.position.y = this.feet + BLOCK * 46;
    this.group.add(this.clouds);

    this.skyTex = { day: gradientTexture(SKY.day.top, SKY.day.horizon), night: gradientTexture(SKY.night.top, SKY.night.horizon) };
    this.cell = null;
    this.setMode(this.mode, this.noneColor);
  }

  // lay the blocks out for the part of the world around the player
  layout(cell) {
    const m = new THREE.Matrix4();
    const base = this.feet - BLOCK / 2;
    let g = 0;
    let dn = 0;
    let lg = 0;
    let lv = 0;
    const counts = this.plants.map(() => 0);
    const put = (mesh, i, x, y, z) => mesh.setMatrixAt(i, m.makeTranslation(x * BLOCK, base + y * BLOCK, z * BLOCK));
    for (let iz = -R; iz <= R; iz++) {
      const wz = iz + cell;
      for (let ix = -R; ix <= R; ix++) {
        const top = heightAt(ix, wz);
        put(this.grass, g++, ix, top, iz);
        // no holes on a slope: earth down to the lowest neighbour
        const low = Math.min(heightAt(ix - 1, wz), heightAt(ix + 1, wz), heightAt(ix, wz - 1), heightAt(ix, wz + 1));
        for (let y = top - 1; y >= low && dn < this.dirt.instanceMatrix.count; y--) put(this.dirt, dn++, ix, y, iz);
        if (isTree(ix, wz)) {
          const trunk = 4 + Math.floor(hash(ix, wz, 11) * 2);
          for (let y = 1; y <= trunk && lg < 400; y++) put(this.logs, lg++, ix, top + y, iz);
          // an oak's crown: two wide layers, two narrow ones
          for (let ly = trunk - 2; ly <= trunk + 1; ly++) {
            const wide = ly <= trunk - 1 ? 2 : 1;
            for (let dx = -wide; dx <= wide; dx++) {
              for (let dz = -wide; dz <= wide; dz++) {
                const corner = Math.abs(dx) === wide && Math.abs(dz) === wide;
                if (corner && (wide === 1 || hash(ix + dx, wz + dz, ly) < 0.6)) continue;
                if (dx === 0 && dz === 0 && ly <= trunk) continue;
                if (lv < 6000) put(this.leaves, lv++, ix + dx, top + ly, iz + dz);
              }
            }
          }
        } else if (this.plants.length && Math.abs(ix) > 1) {
          const p = hash(ix, wz, 1);
          const kind = p < 0.2 ? 0 : p < 0.235 && this.plants.length > 1 ? 1 + Math.floor(hash(ix, wz, 2) * (this.plants.length - 1)) : -1;
          if (kind >= 0 && counts[kind] < 1400) {
            this.plants[kind].setMatrixAt(counts[kind]++, m.makeTranslation(ix * BLOCK, base + top * BLOCK + BLOCK / 2, iz * BLOCK));
          }
        }
      }
    }
    const done = (mesh, count) => {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    };
    done(this.grass, g);
    done(this.dirt, dn);
    done(this.logs, lg);
    done(this.leaves, lv);
    this.plants.forEach((mesh, i) => done(mesh, counts[i]));
  }

  step(dt) {
    const speed = SPEED[this.motion] || 0;
    this.scroll += speed * dt;
    const cell = Math.floor(this.scroll);
    if (cell !== this.cell) {
      this.cell = cell;
      this.layout(cell);
    }
    // the ground follows the way the player faces, and slides back under the feet
    const yaw = this.viewer.playerWrapper.rotation.y;
    const back = (this.scroll - cell) * BLOCK;
    this.world.rotation.y = yaw;
    this.world.position.set(-Math.sin(yaw) * back, this.motion === 'fly' ? -BLOCK * 7 : 0, -Math.cos(yaw) * back);
    this.shadow.position.z = back;
    this.shadow.visible = this.motion !== 'fly';
    // clouds drift west, slowly (0.6 blocks per second in the game)
    const span = this.clouds.userData.span;
    this.cloudDrift = (this.cloudDrift + dt * BLOCK * 0.6) % span;
    this.clouds.position.x = -this.cloudDrift;
  }

  // 'idle' | 'walk' | 'run' | 'fly': how fast the world goes by
  setMotion(motion) {
    this.motion = SPEED[motion] ? motion : 'idle';
  }

  setMode(mode, noneColor) {
    this.mode = mode;
    this.noneColor = noneColor;
    const v = this.viewer;
    const sky = SKY[mode];
    const on = Boolean(sky);
    this.group.visible = on;
    this.world.visible = on;
    if (!on) {
      v.scene.background = new THREE.Color(noneColor || '#101010');
      v.scene.fog = null;
      v.camera.far = this.saved.far;
      v.camera.near = this.saved.near;
      v.controls.maxPolarAngle = this.saved.polar;
      v.globalLight.intensity = this.saved.global;
      v.camera.updateProjectionMatrix();
      return;
    }
    v.scene.background = this.skyTex[mode];
    v.scene.fog = new THREE.Fog(sky.horizon, BLOCK * 8, BLOCK * (R - 5));
    // the sky is far away; and the camera stays above the ground
    v.camera.far = 14000;
    v.camera.near = 1;
    v.camera.updateProjectionMatrix();
    v.controls.maxPolarAngle = Math.PI / 2 + 0.06;
    v.globalLight.intensity = this.saved.global * (mode === 'night' ? 0.55 : 1);
    const [lr, lg, lb] = sky.light;
    for (const m of this.lit) {
      const s = m.userData.shade;
      if (m.userData.base) m.color.copy(m.userData.base).multiply(new THREE.Color(lr * s, lg * s, lb * s));
      else m.color.setRGB(lr * s, lg * s, lb * s);
    }
    for (const m of this.cloudMats) m.color.setRGB(sky.cloud[0] * m.userData.cloud, sky.cloud[1] * m.userData.cloud, sky.cloud[2] * m.userData.cloud);
    this.sun.visible = mode === 'day';
    this.moon.visible = mode === 'night';
    this.stars.visible = mode === 'night';
    this.step(0);
  }

  // the game's textures arrived (or changed): build the stage again with them
  rebuild() {
    this.clear();
    this.build();
  }

  clear() {
    for (const root of [this.group, this.world]) {
      this.viewer.scene.remove(root);
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        for (const m of [].concat(o.material || [])) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      });
    }
  }

  dispose() {
    cancelFrame(this.raf);
    if (this.offTextures) this.offTextures();
    this.setMode('none', this.noneColor);
    this.clear();
  }
}
