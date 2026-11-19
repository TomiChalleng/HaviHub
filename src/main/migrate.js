// Havi Hub's folders carry one name everywhere: "havihub" (settings and
// profiles, the downloaded engine, the installed app). Folders called
// "Havi Hub" or "havi-hub" (older names) are renamed on the first start, the
// absolute paths saved inside them are updated, and the links of synced
// profiles are pointed to the new place.
const fs = require('node:fs');
const path = require('node:path');

const DIR_NAME = 'havihub';
const LEGACY_NAMES = ['havi-hub', 'Havi Hub']; // newest first

const isFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};
const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const isEmptyDir = (p) => {
  try {
    return fs.readdirSync(p).length === 0;
  } catch {
    return false;
  }
};
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

// Renames `from` to `to` unless `to` already has content.
// 'moved' | 'skipped' | 'busy' (an old copy of the app still has files open)
function moveFolder(from, to) {
  if (!isDir(from) || same(from, to)) return 'skipped';
  if (isDir(to) && !isEmptyDir(to)) return 'skipped';
  try {
    if (isDir(to)) fs.rmdirSync(to);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
    return 'moved';
  } catch {
    return 'busy';
  }
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Replaces an old folder path inside a text file, in every spelling Prism and
// Havi Hub may have used (back slashes, forward slashes, escaped in JSON).
function replacePathInFile(file, from, to) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  let out = text;
  const pairs = [
    [from, to],
    [from.replace(/\\/g, '/'), to.replace(/\\/g, '/')],
    [from.replace(/\\/g, '\\\\'), to.replace(/\\/g, '\\\\')],
  ];
  for (const [a, b] of pairs) out = out.replace(new RegExp(escapeRe(a), 'gi'), () => b);
  if (out === text) return false;
  try {
    fs.writeFileSync(file, out);
    return true;
  } catch {
    return false;
  }
}

function fixPathsInside(root, from, to) {
  let n = 0;
  if (replacePathInFile(path.join(root, 'config.json'), from, to)) n++;
  const launcher = path.join(root, 'launcher');
  if (replacePathInFile(path.join(launcher, 'prismlauncher.cfg'), from, to)) n++;
  let entries = [];
  try {
    entries = fs.readdirSync(path.join(launcher, 'instances'), { withFileTypes: true });
  } catch {
    /* no instances */
  }
  for (const e of entries) {
    if (e.isDirectory() && replacePathInFile(path.join(launcher, 'instances', e.name, 'instance.cfg'), from, to)) n++;
  }
  return n;
}

// The profiles synced with other launchers are links (Windows junctions) to a
// shared folder inside Havi Hub's data folder, and a link keeps the full path:
// after the folder is renamed they point nowhere. Each link of a synced group
// that still points into an old folder is made again towards the group's
// folder. Only links are touched, never a real folder. Returns how many.
const cleanPath = (p) => path.resolve(String(p).replace(/^\\\\\?\\/, '')).replace(/[\\/]+$/, '');
const inside = (p, root) => {
  const a = cleanPath(p).toLowerCase();
  const b = cleanPath(root).toLowerCase();
  return a === b || a.startsWith(b + path.sep);
};
function relinkSynced(userData, oldRoots) {
  let groups = [];
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(userData, 'config.json'), 'utf8'));
    groups = (cfg.sync && cfg.sync.groups) || [];
  } catch {
    return 0;
  }
  let fixed = 0;
  for (const g of groups) {
    if (!g || !g.store || !isDir(g.store)) continue;
    for (const m of g.members || []) {
      if (!m || !m.dir) continue;
      try {
        if (!fs.lstatSync(m.dir).isSymbolicLink()) continue;
        const target = path.resolve(path.dirname(m.dir), fs.readlinkSync(m.dir));
        if (same(cleanPath(target), g.store) || !oldRoots.some((r) => inside(target, r))) continue;
        try {
          fs.unlinkSync(m.dir);
        } catch (e) {
          if (process.platform !== 'win32') throw e;
          fs.rmdirSync(m.dir); // a junction
        }
        fs.symlinkSync(g.store, m.dir, process.platform === 'win32' ? 'junction' : 'dir');
        fixed++;
      } catch {
        // not there, or not ours to change: the sync screen shows it as missing
      }
    }
  }
  return fixed;
}

// Linux lets a folder be renamed while programs use it, and they would go on
// writing to the old name: the engine and the game (started from that folder)
// or another copy of Havi Hub. True when a process that is not this app (or
// one of its own helpers) runs from the folder or was started with it.
function inUseOnLinux(dir, { ownPid = process.pid } = {}) {
  const ppid = (pid) => {
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      return Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]) || 0;
    } catch {
      return 0;
    }
  };
  const ours = (pid) => {
    for (let p = pid, i = 0; p > 1 && i < 64; p = ppid(p), i++) if (p === ownPid) return true;
    return false;
  };
  let pids = [];
  try {
    pids = fs.readdirSync('/proc').filter((n) => /^\d+$/.test(n)).map(Number);
  } catch {
    return false;
  }
  for (const pid of pids) {
    if (ours(pid)) continue;
    try {
      const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
      if (cwd === dir || cwd.startsWith(dir + '/')) return true;
    } catch {
      // another user's process, or it just ended
    }
    try {
      if (fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(dir)) return true;
    } catch {
      // same
    }
  }
  return false;
}

// Runs before anything reads the app folders. `userData` is the folder to end
// up with (…/havihub). Returns the folders to use instead when an old one is
// still in use (the rename is tried again on the next start).
function migrateLegacyFolders({ appData, userData, localAppData, busy = () => false }) {
  const out = { userData: null, localDir: null, moved: [], from: [] };
  if (!isFile(path.join(userData, 'config.json'))) {
    for (const name of LEGACY_NAMES) {
      const oldUser = path.join(appData, name);
      if (same(oldUser, userData) || !isFile(path.join(oldUser, 'config.json'))) continue;
      const r = busy(oldUser) ? 'busy' : moveFolder(oldUser, userData);
      if (r === 'moved') {
        out.moved.push(userData);
        out.from.push(oldUser);
        fixPathsInside(userData, oldUser, userData);
        relinkSynced(userData, [oldUser]);
      } else if (r === 'busy') out.userData = oldUser;
      break; // the newest one only: an older folder left behind is not this installation's data
    }
  }
  if (localAppData) {
    const newLocal = path.join(localAppData, path.basename(userData));
    if (!isFile(path.join(newLocal, 'engine', 'engine.json'))) {
      for (const name of LEGACY_NAMES) {
        const oldLocal = path.join(localAppData, name);
        if (same(oldLocal, newLocal) || !isFile(path.join(oldLocal, 'engine', 'engine.json'))) continue;
        const r = busy(oldLocal) ? 'busy' : moveFolder(oldLocal, newLocal);
        if (r === 'moved') {
          out.moved.push(newLocal);
          out.from.push(oldLocal);
          // a custom engine path or Java inside the old engine folder
          fixPathsInside(out.userData || userData, oldLocal, newLocal);
        } else if (r === 'busy') out.localDir = oldLocal;
        break;
      }
    }
  }
  return out;
}

// Windows: desktop shortcuts of profiles ("--launch <id>") made before the app
// moved to its new folder point to the old .exe (and to icons in the old data
// folder). Point them to this copy of Havi Hub. Returns how many were updated.
function repairShortcuts({ shell, dirs, exe, oldRoots = [], newRoot }) {
  let fixed = 0;
  for (const dir of dirs) {
    let names = [];
    try {
      names = fs.readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.lnk'));
    } catch {
      continue;
    }
    for (const n of names) {
      const file = path.join(dir, n);
      let link;
      try {
        link = shell.readShortcutLink(file);
      } catch {
        continue;
      }
      if (!link || !/--launch\s/.test(link.args || '')) continue;
      const base = path.basename(link.target || '').toLowerCase();
      const ours = base === 'havi hub.exe' || /^havihub-[\d.]+-portable\.exe$/.test(base);
      if (!ours) continue;
      // keep shortcuts that open another working copy of Havi Hub
      const target = !isFile(link.target) ? exe : link.target;
      let icon = link.icon || '';
      for (const r of oldRoots) if (icon && icon.toLowerCase().startsWith(r.toLowerCase())) icon = newRoot + icon.slice(r.length);
      if (target === link.target && icon === (link.icon || '')) continue;
      const ok = shell.writeShortcutLink(file, 'update', {
        target,
        cwd: path.dirname(target),
        args: link.args,
        description: link.description || '',
        ...(icon && isFile(icon) ? { icon, iconIndex: link.iconIndex || 0 } : {}),
      });
      if (ok) fixed++;
    }
  }
  return fixed;
}

module.exports = { migrateLegacyFolders, relinkSynced, inUseOnLinux, repairShortcuts, moveFolder, replacePathInFile, DIR_NAME, LEGACY_NAMES };
