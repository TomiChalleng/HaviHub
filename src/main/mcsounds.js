// Minecraft's own sounds, read from the game assets already on this computer
// (the folders the launchers download them to). Nothing is bundled: if the
// game was never started, the app falls back to its own synthesized sounds.
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const SOUNDS = {
  launch: 'minecraft/sounds/fireworks/launch1.ogg',
  blast: 'minecraft/sounds/fireworks/blast1.ogg',
  blastFar: 'minecraft/sounds/fireworks/blast_far1.ogg',
  largeBlast: 'minecraft/sounds/fireworks/largeblast1.ogg',
  largeBlastFar: 'minecraft/sounds/fireworks/largeblast_far1.ogg',
  twinkle: 'minecraft/sounds/fireworks/twinkle1.ogg',
  twinkleFar: 'minecraft/sounds/fireworks/twinkle_far1.ogg',
  scream: 'minecraft/sounds/mob/ghast/scream3.ogg',
  // the Halloween scare: an enderman dying, over one of the eeriest cave noises
  endermanDeath: 'minecraft/sounds/mob/endermen/death.ogg',
  cave2: 'minecraft/sounds/ambient/cave/cave2.ogg',
  cave13: 'minecraft/sounds/ambient/cave/cave13.ogg',
  cave14: 'minecraft/sounds/ambient/cave/cave14.ogg',
  cave19: 'minecraft/sounds/ambient/cave/cave19.ogg',
};

function assetRoots(dataDirs) {
  const home = os.homedir();
  const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const roots = [...dataDirs.filter(Boolean).map((d) => path.join(d, 'assets'))];
  if (process.platform === 'win32') {
    roots.push(path.join(appData, '.minecraft', 'assets'), path.join(appData, 'PrismLauncher', 'assets'), path.join(appData, 'ModrinthApp', 'meta', 'assets'), path.join(home, 'curseforge', 'minecraft', 'Install', 'assets'));
  } else if (process.platform === 'darwin') {
    roots.push(path.join(home, 'Library', 'Application Support', 'minecraft', 'assets'), path.join(home, 'Library', 'Application Support', 'PrismLauncher', 'assets'));
  } else {
    roots.push(path.join(home, '.minecraft', 'assets'), path.join(home, '.local', 'share', 'PrismLauncher', 'assets'));
  }
  return [...new Set(roots)];
}

class McSounds {
  constructor(getDataDirs) {
    this.getDataDirs = getDataDirs;
    this.found = null; // name -> file
  }

  async locate() {
    const found = {};
    for (const root of assetRoots(this.getDataDirs())) {
      let indexes = [];
      try {
        const dir = path.join(root, 'indexes');
        const names = (await fsp.readdir(dir)).filter((n) => n.endsWith('.json'));
        const withTime = await Promise.all(names.map(async (n) => ({ n, t: (await fsp.stat(path.join(dir, n))).mtimeMs })));
        indexes = withTime.sort((a, b) => b.t - a.t).map((x) => path.join(dir, x.n));
      } catch {
        continue;
      }
      for (const idx of indexes.slice(0, 4)) {
        let objects;
        try {
          objects = JSON.parse(await fsp.readFile(idx, 'utf8')).objects || {};
        } catch {
          continue;
        }
        for (const [name, key] of Object.entries(SOUNDS)) {
          if (found[name] || !objects[key]) continue;
          const hash = objects[key].hash;
          const file = path.join(root, 'objects', hash.slice(0, 2), hash);
          try {
            await fsp.access(file);
            found[name] = file;
          } catch {
            // not downloaded
          }
        }
        if (Object.keys(found).length === Object.keys(SOUNDS).length) return found;
      }
    }
    return found;
  }

  async get(name) {
    if (!SOUNDS[name]) return null;
    if (!this.found) this.found = await this.locate().catch(() => ({}));
    const file = this.found[name];
    if (!file) return null;
    try {
      return await fsp.readFile(file);
    } catch {
      return null;
    }
  }
}

module.exports = { McSounds, SOUNDS };
