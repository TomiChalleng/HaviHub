// Small filesystem helpers used across the main process.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { throwIfCancelled } = require('./cancel');

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

function existsSync(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

async function isDir(p) {
  try {
    return (await fsp.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function readJson(p, fallback = undefined) {
  try {
    const txt = await fsp.readFile(p, 'utf8');
    return JSON.parse(stripBom(txt));
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw e;
  }
}

function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

// Lenient JSON parse: tolerates comments, trailing commas and control characters
// inside strings (some mod metadata files contain those).
function parseLenientJson(text) {
  text = stripBom(String(text));
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  let out = '';
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inStr) {
      if (c === '\\') {
        out += c + (n ?? '');
        i++;
        continue;
      }
      if (c === '"') inStr = false;
      if (c === '\n') {
        out += '\\n';
        continue;
      }
      if (c === '\r') continue;
      if (c === '\t') {
        out += '\\t';
        continue;
      }
      out += c;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      continue;
    }
    if (c === '/' && n === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
      continue;
    }
    out += c;
  }
  out = out.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(out);
}

// Atomic write: write to a temp file next to the destination, then rename.
async function writeFileAtomic(p, data) {
  await fsp.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, data);
  try {
    await fsp.rename(tmp, p);
  } catch (e) {
    // On Windows rename can fail if the target is locked; fall back to copy.
    await fsp.copyFile(tmp, p);
    await fsp.rm(tmp, { force: true });
  }
}

async function writeJson(p, obj, indent = 4) {
  await writeFileAtomic(p, JSON.stringify(obj, null, indent) + '\n');
}

async function listDir(p) {
  try {
    return await fsp.readdir(p, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function statSafe(p) {
  try {
    return await fsp.stat(p);
  } catch {
    return null;
  }
}

async function dirSize(p) {
  let total = 0;
  const stack = [p];
  while (stack.length) {
    const cur = stack.pop();
    for (const ent of await listDir(cur)) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else {
        const st = await statSafe(full);
        if (st) total += st.size;
      }
    }
  }
  return total;
}

async function copyDir(src, dest, filter) {
  await fsp.cp(src, dest, {
    recursive: true,
    errorOnExist: false,
    force: true,
    // a cancelled task stops copying at the next file
    filter: (s) => {
      throwIfCancelled();
      return filter ? filter(s) : true;
    },
  });
}

// Make a string safe to use as a folder/file name (similar to Prism's
// FS::DirNameFromString / RemoveInvalidFilenameChars).
function safeName(name, fallback = 'instance') {
  let s = String(name || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  const reserved = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
  if (!s || reserved.test(s)) s = fallback;
  if (s.length > 64) s = s.slice(0, 64).trim();
  return s;
}

async function uniqueDirName(parent, base) {
  let candidate = base;
  let n = 1;
  while (await exists(path.join(parent, candidate))) {
    n++;
    candidate = `${base} (${n})`;
  }
  return candidate;
}

function isInside(child, parent) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

module.exports = {
  exists,
  existsSync,
  isDir,
  readJson,
  parseLenientJson,
  writeFileAtomic,
  writeJson,
  listDir,
  statSafe,
  dirSize,
  copyDir,
  safeName,
  uniqueDirName,
  isInside,
  stripBom,
};
