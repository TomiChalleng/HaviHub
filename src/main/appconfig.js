// Havi Hub's own settings (palette, language, sources, defaults...). Stored as
// JSON in Electron's userData folder. Prism's own settings stay in prismlauncher.cfg.
const path = require('node:path');
const { readJson, writeJson } = require('./util/fsx');
const { seasonYear } = require('../shared/seasons.js');

const DEFAULTS = {
  dataDir: '', // Havi Hub's own launcher data ('' = <app data>/launcher)
  engineExe: '', // advanced: use this Prism Launcher executable instead of the managed engine
  legacyPrismDir: '', // Prism Launcher folder Havi Hub once worked on directly (offered for import)
  importPromptDone: false,
  welcomeDone: false, // the first-start welcome was finished (renderer/components/Welcome.jsx)
  language: '', // '' = auto (system)
  themePreset: 'forge',
  palette: {}, // overrides on top of the preset
  uiScale: 100, // 100 = same size as CurseForge
  autoScale: true, // a smaller window draws its contents smaller too
  reduceMotion: false,
  discoverSource: 'both', // 'modrinth' | 'curseforge' | 'both'
  curseforgeApiKey: '', // the person's own key ('' = the one Havi Hub is built with)
  engineCfKeyMark: '', // fingerprint of the CurseForge key Havi Hub last wrote into the engine's settings
  preferredRelease: 'release', // release | beta | alpha
  autoInstallDependencies: true,
  tourPending: false, // the guided tour after the welcome is due
  tourDone: false,
  hideInstalledContent: true, // "Hide already downloaded" in a profile's Add content, for every profile
  autoJava: true, // download Eclipse Temurin when a profile needs a Java that isn't installed
  backupWorldsBeforeUpdate: false, // zip saves/ before updating mods or a modpack (3 per profile)
  writePrismMetadata: true,
  checkUpdatesOnOpen: true,
  libraryView: 'grid',
  libraryTileSize: 236, // width of the profile and group cards in My modpacks
  librarySort: 'lastPlayed',
  extraGroups: [], // groups created here that have no instances yet
  groupImages: {}, // group name -> { file, recipe }: the picture of its card (files in <dataDir>/group-pictures)
  closeOnLaunch: false,
  minimizeOnLaunch: true,
  trayOnLaunch: false, // hide to the system tray while a game is open
  sleepInTray: true, // put the window away (free its memory) after a minute hidden in the tray
  closeToTray: null, // the window's X keeps Havi Hub in the tray (null: not asked yet)
  layout: null, // 'curseforge' | 'modrinth' (null: not chosen yet, asked in the welcome)
  linuxMenu: true, // Linux: Havi Hub in ~/.local/share/applications
  msaClientId: '', // the person's own Microsoft app ID for the sign-in (empty: the engine's)
  previousVersions: {}, // instanceId -> { fileKey -> version used before the last update }
  trayHintShown: false,
  iconStyle: 0, // 2: the pictures of editor-made icons were redrawn with the game's textures
  iconRecents: [], // last generated instance icons saved ("background/symbol")
  // seasonal themes (each one turns itself on during its week) and the
  // hidden Halloween scare
  seasons: { halloween: true, christmas: true, newyear: true, scares: true },
  scareNotice: '', // the year whose Halloween-week notice about the scare was answered
  seasonNotices: {}, // "halloween-2026": true once its notice was shown
  lastScare: '', // day of the last scare (one per day at most)
  sync: { groups: [] }, // profiles synced with CurseForge / Modrinth (sync.js)
  sharedInstances: { enabled: false, prismDir: '' }, // use Prism Launcher's profiles folder
  privacy: {
    maskServerIps: true,
    streamerMode: false,
    // Havikun's channels on the Home page load on their own (YouTube, Twitch and
    // Linktree when Havi Hub opens). Off: they stay there and load only when one
    // is opened. Asked in the first-start welcome (or a dialog, for someone
    // updating); until then nothing loads on its own.
    socialAutoload: true,
    socialAsked: false,
  },
  skins: { background: 'night', paused: false, animation: 'walk' },
  inGameDefaults: {
    enabled: true,
    fullscreen: true,
    bobView: true,
    guiScale: 2,
    gamma: 1.0,
    renderDistance: 16,
    fov: 90,
    autoJump: false,
    invertYMouse: false,
    mouseSensitivity: 50,
    sound: {
      master: 100,
      music: 0,
      record: 100,
      weather: 100,
      block: 100,
      hostile: 100,
      neutral: 100,
      player: 100,
      ambient: 100,
      voice: 100,
    },
    // options.txt key bindings the user changed ('' = Minecraft's default)
    keys: { 'key.sneak': 'key.keyboard.left.control', 'key.sprint': 'key.keyboard.left.shift' },
    lang: '',
  },
};

class AppConfig {
  constructor(dir) {
    this.file = path.join(dir, 'config.json');
    this.data = structuredClone(DEFAULTS);
    this.listeners = new Set();
  }

  async load() {
    const saved = await readJson(this.file, {});
    // A config that pointed Havi Hub at Prism Launcher's own folder: Havi Hub
    // now has its own folder and offers to import from that one.
    if (saved && saved.prismDataDir) {
      if (!saved.legacyPrismDir) saved.legacyPrismDir = saved.prismDataDir;
      this.migrated = true;
    }
    if (saved) {
      delete saved.prismDataDir;
      delete saved.prismExe;
      // an older config kept only two keys, by short name
      const keys = saved.inGameDefaults && saved.inGameDefaults.keys;
      if (keys && typeof keys === 'object') {
        for (const short of ['sneak', 'sprint']) {
          if (short in keys) {
            if (!(`key.${short}` in keys)) keys[`key.${short}`] = keys[short];
            delete keys[short];
            this.migrated = true;
          }
        }
      }
    }
    this.data = deepMerge(structuredClone(DEFAULTS), saved || {});
    // the tests start from an empty config every time: the yearly notice about the scare is tested on its own
    if (process.env.HAVIHUB_MOCK_NET && !process.env.HAVIHUB_SCARE_NOTICE) {
      const fake = Date.parse(process.env.HAVIHUB_FAKE_DATE || '');
      this.data.scareNotice = String(seasonYear(Number.isFinite(fake) ? new Date(fake) : new Date(), 'halloween'));
    }
    // the same for the question about Havikun's channels (scripts/e2e-socials.mjs, e2e-welcome.mjs)
    if (process.env.HAVIHUB_MOCK_NET && !process.env.HAVIHUB_SOCIAL_ASK && !(saved && saved.privacy && 'socialAsked' in saved.privacy)) this.data.privacy.socialAsked = true;
    if (this.migrated) await writeJson(this.file, this.data, 2);
    return this.data;
  }

  get() {
    return this.data;
  }

  // the config plus a revision number: replies and change events travel on
  // different IPC channels, so the renderer keeps only the newest one
  snapshot() {
    return { ...this.data, _rev: this.rev || 0 };
  }

  async update(patch) {
    this.rev = (this.rev || 0) + 1;
    this.data = deepMerge(this.data, patch);
    await writeJson(this.file, this.data, 2);
    for (const l of this.listeners) l(this.data);
    return this.data;
  }

  async replaceKey(key, value) {
    this.rev = (this.rev || 0) + 1;
    this.data[key] = value;
    await writeJson(this.file, this.data, 2);
    for (const l of this.listeners) l(this.data);
    return this.data;
  }

  onChange(fn) {
    this.listeners.add(fn);
  }
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch === undefined ? base : patch;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base && typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null) {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

module.exports = { AppConfig, DEFAULTS, deepMerge };
