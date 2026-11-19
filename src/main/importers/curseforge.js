// Reading profiles of the CurseForge app (Minecraft): one folder per profile
// inside "<modding folder>/Instances", with minecraftinstance.json describing
// it. The profile folder itself is the game folder (mods, saves, config…).
const os = require('node:os');
const path = require('node:path');
const fsp = require('node:fs/promises');
const { exists, listDir } = require('../util/fsx');

const LOADER_BY_TYPE = { 1: 'forge', 4: 'fabric', 5: 'quilt', 6: 'neoforge' };
const RELEASE = { 1: 'Release', 2: 'Beta', 3: 'Alpha' };

// Time played, when the CurseForge app keeps it (newer versions of the app):
// seconds, or milliseconds when the number is too big to be seconds.
function playedSeconds(j) {
  for (const k of ['totalTimePlayed', 'timePlayed', 'playTime', 'totalPlayTime']) {
    const n = Number(j && j[k]);
    if (Number.isFinite(n) && n > 0) return n > 50 * 365 * 24 * 3600 ? Math.round(n / 1000) : Math.round(n);
  }
  return 0;
}

function candidates() {
  const home = os.homedir();
  const extra = (process.env.HAVIHUB_IMPORT_CF_DIRS || '').split(path.delimiter).filter(Boolean);
  const docs = path.join(home, 'Documents');
  const list = [...extra];
  if (process.platform === 'win32') {
    list.push(path.join(home, 'curseforge', 'minecraft', 'Instances'), path.join(docs, 'curseforge', 'minecraft', 'Instances'), path.join(docs, 'Curse', 'Minecraft', 'Instances'), path.join(docs, 'Twitch', 'Minecraft', 'Instances'), path.join(home, 'Twitch', 'Minecraft', 'Instances'));
  } else {
    list.push(path.join(docs, 'curseforge', 'minecraft', 'Instances'), path.join(home, 'curseforge', 'minecraft', 'Instances'));
  }
  return list;
}

// Accepts the Instances folder, the modding folder or one profile's folder
async function resolveRoot(dir) {
  if (!dir) return null;
  const abs = path.resolve(dir);
  if (await exists(path.join(abs, 'minecraftinstance.json'))) return path.dirname(abs);
  if (await exists(path.join(abs, 'Instances'))) return path.join(abs, 'Instances');
  if (await exists(path.join(abs, 'minecraft', 'Instances'))) return path.join(abs, 'minecraft', 'Instances');
  return abs;
}

async function readJsonFile(file) {
  const text = (await fsp.readFile(file, 'utf8')).replace(/^﻿/, '');
  return JSON.parse(text);
}

// "fabric-0.15.11-1.20.1" / "forge-47.2.0" / "neoforge-21.1.73"
function parseLoader(bml, mcVersion) {
  if (!bml || typeof bml !== 'object') return null;
  const name = String(bml.name || '');
  const m = /^(forge|fabric|quilt|neoforge)-(.+)$/i.exec(name);
  const id = m ? m[1].toLowerCase() : LOADER_BY_TYPE[bml.type];
  if (!id) return null;
  let version = m ? m[2] : String(bml.forgeVersion || '');
  const mc = String(bml.minecraftVersion || mcVersion || '');
  if (mc && version.endsWith(`-${mc}`)) version = version.slice(0, -(mc.length + 1));
  if (id === 'forge' && mc && version.startsWith(`${mc}-`)) version = version.slice(mc.length + 1);
  return version ? { id, version } : null;
}

function sha1Of(file) {
  const list = file && (file.hashes || file.Hashes);
  if (!Array.isArray(list)) return '';
  for (const h of list) {
    const type = h.type ?? h.Type ?? h.algo ?? h.Algorithm;
    const value = h.value ?? h.Value ?? '';
    if ((type === 1 || type === undefined) && /^[0-9a-f]{40}$/i.test(value)) return value.toLowerCase();
  }
  return '';
}

async function readProfile(root, folder) {
  const dir = path.join(root, folder);
  const file = path.join(dir, 'minecraftinstance.json');
  const j = await readJsonFile(file);
  const mcVersion = String(j.gameVersion || (j.baseModLoader && j.baseModLoader.minecraftVersion) || '');
  const loader = parseLoader(j.baseModLoader, mcVersion);
  const image = j.profileImagePath && (await exists(j.profileImagePath)) ? j.profileImagePath : null;
  const addons = Array.isArray(j.installedAddons) ? j.installedAddons : [];
  return {
    id: folder,
    dir,
    name: String(j.name || folder),
    mcVersion,
    loader,
    image,
    // never played = "0001-01-01T00:00:00"
    lastPlayed: Math.max(0, Date.parse(j.lastPlayed || '') || 0),
    played: playedSeconds(j),
    memory: j.isMemoryOverride && Number(j.allocatedMemory) > 0 ? Math.round(Number(j.allocatedMemory)) : 0,
    jvmArgs: typeof j.javaArgsOverride === 'string' ? j.javaArgsOverride : '',
    modpack: Number(j.projectID) > 0 ? { projectId: Number(j.projectID), fileId: Number(j.fileID) || 0, name: (j.installedModpack && j.installedModpack.name) || (j.manifest && j.manifest.name) || '', version: (j.manifest && j.manifest.version) || '' } : null,
    addons: addons
      .map((a) => {
        const f = a.installedFile || {};
        const fileName = a.fileNameOnDisk || f.fileNameOnDisk || f.fileName || '';
        if (!fileName || !a.addonID || !f.id) return null;
        const site = String(a.webSiteURL || '');
        return {
          projectId: Number(a.addonID),
          fileId: Number(f.id),
          fileName,
          name: String(a.name || fileName),
          slug: site.split('/').filter(Boolean).pop() || '',
          sha1: sha1Of(f),
          releaseType: RELEASE[f.releaseType] || 'Release',
          versionNumber: String(f.displayName || f.fileName || ''),
          gameVersions: Array.isArray(f.gameVersion) ? f.gameVersion : [],
        };
      })
      .filter(Boolean),
  };
}

async function listProfiles(root) {
  const out = [];
  for (const e of await listDir(root)) {
    // a profile synced by Havi Hub is a link (junction) to the shared folder
    if (!e.isDirectory() && !e.isSymbolicLink()) continue;
    if (!(await exists(path.join(root, e.name, 'minecraftinstance.json')))) continue;
    try {
      out.push(await readProfile(root, e.name));
    } catch {
      /* unreadable profile */
    }
  }
  return out;
}

// Game files the CurseForge app already downloaded (same layout as ours)
function sharedDirs(root) {
  const install = path.join(path.dirname(root), 'Install');
  return [
    [path.join(install, 'assets'), 'assets'],
    [path.join(install, 'libraries'), 'libraries'],
  ];
}

const SKIP = new Set(['minecraftinstance.json', 'logs']);

module.exports = { candidates, resolveRoot, listProfiles, readProfile, parseLoader, sharedDirs, SKIP };
