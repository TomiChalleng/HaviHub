// Path guards for anything named by untrusted data: the `filename` of a
// mods/.index/*.pw.toml, the files listed by a .mrpack or CurseForge pack,
// zip entries in overrides/ and file names returned by the platform APIs.
// A name that could leave its folder (../, absolute, drive, UNC, a link)
// is refused instead of being cleaned up, so nothing outside is touched.
const fsp = require('node:fs/promises');
const path = require('node:path');

const WIN_RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$|clock\$)(\..*)?$/i;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

class UnsafePathError extends Error {
  constructor(what) {
    super(`Ruta inválida: ${String(what).slice(0, 120)}`);
    this.code = 'EUNSAFEPATH';
  }
}

// One plain file name: no folders, no drive, no "." / "..", nothing Windows
// would read as a device or rewrite (trailing dot or space, ":" streams).
function isPlainFileName(name) {
  if (typeof name !== 'string' || !name || name.length > 255) return false;
  if (CONTROL.test(name)) return false;
  if (/[/\\:*?"<>|]/.test(name)) return false;
  if (name === '.' || name === '..') return false;
  if (/[. ]$/.test(name)) return false;
  if (path.posix.basename(name) !== name || path.win32.basename(name) !== name) return false;
  if (WIN_RESERVED.test(name)) return false;
  return true;
}

// A relative path inside a pack ("mods/x.jar", "config/a/b.json"), with "/"
// or "\" as separator. Returns it normalized with "/" or null if unsafe.
function safeRelPath(p) {
  if (typeof p !== 'string' || !p || p.length > 1024 || CONTROL.test(p)) return null;
  const s = p.replace(/\\/g, '/');
  if (s.startsWith('/') || /^[a-zA-Z]:/.test(s) || s.startsWith('//')) return null;
  const parts = s.split('/').filter((x, i, a) => x !== '' || i === a.length - 1);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    if (seg === '' && i === parts.length - 1) break; // trailing slash (folder entry)
    if (seg === '.') continue;
    if (seg === '..' || !isPlainFileName(seg)) return null;
    out.push(seg);
  }
  return out.length ? out.join('/') : null;
}

function isInside(child, parent) {
  const c = path.resolve(child);
  const p = path.resolve(parent);
  if (process.platform === 'win32') return c.toLowerCase().startsWith(p.toLowerCase() + path.sep);
  return c.startsWith(p + path.sep);
}

async function realOrSelf(p) {
  try {
    return await fsp.realpath(p);
  } catch {
    return path.resolve(p);
  }
}

// The deepest part of `p` that exists, resolved through links.
async function realAncestor(p) {
  let cur = path.resolve(p);
  for (;;) {
    try {
      return { real: await fsp.realpath(cur), rest: path.relative(cur, p) };
    } catch {
      const up = path.dirname(cur);
      if (up === cur) return { real: cur, rest: path.relative(cur, p) };
      cur = up;
    }
  }
}

async function isLink(p) {
  try {
    return (await fsp.lstat(p)).isSymbolicLink(); // junctions too on Windows
  } catch {
    return false;
  }
}

// `target` must stay strictly inside `root` after following any link in
// between, and must not itself be a link.
async function assertInside(root, target) {
  const rootReal = await realOrSelf(root);
  if (!isInside(target, root)) throw new UnsafePathError(target);
  const { real, rest } = await realAncestor(path.dirname(target));
  const parentReal = path.join(real, rest);
  if (parentReal !== rootReal && !isInside(parentReal, rootReal)) throw new UnsafePathError(target);
  if (await isLink(target)) throw new UnsafePathError(target);
  return target;
}

// dir + one plain file name, checked to resolve inside dir.
async function resolveInside(dir, name) {
  if (!isPlainFileName(name)) throw new UnsafePathError(name);
  return assertInside(dir, path.join(path.resolve(dir), name));
}

// dir + relative pack path, checked to resolve inside dir.
async function resolveRelInside(dir, rel) {
  const s = safeRelPath(rel);
  if (!s) throw new UnsafePathError(rel);
  return assertInside(dir, path.join(path.resolve(dir), ...s.split('/')));
}

// The `filename = "…"` of a .pw.toml, without a full TOML parser: used to
// refuse metadata files that point outside their folder while extracting.
function tomlFileName(text) {
  const m = /^\s*filename\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')\s*$/m.exec(String(text));
  if (!m) return null;
  if (m[1].startsWith("'")) return m[1].slice(1, -1);
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

module.exports = { isPlainFileName, safeRelPath, isInside, assertInside, resolveInside, resolveRelInside, tomlFileName, UnsafePathError };
