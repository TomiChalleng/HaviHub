// Havi Hub's name on its engine. The engine is an official Prism Launcher
// portable build, and the few names it shows are compiled in as plain strings
// (Prism's BuildConfig). Right after Havi Hub downloads it (and on start, for
// an engine installed by an older Havi Hub) they are replaced in place, padded
// with zeros to the same length so nothing else in the program moves:
//
//   "Prism Launcher"                              -> "Havi Hub"   (window titles,
//                                                     dialogs, the game log header)
//   "https://prismlauncher.org/successful-login"  -> Havi Hub's own page, served
//                                                     on this computer (loginpage.js):
//                                                     the browser tab after signing in
//   "org.prismlauncher.PrismLauncher" (Linux)     -> "havihub"    (the desktop shows
//                                                     Havi Hub's name and icon;
//                                                     formerly "havi-hub")
//
// On Windows the program's description (what the Task Manager shows) changes
// too, and its digital signature, no longer valid once the file changed, is
// removed. The engine's own updater is deleted: Havi Hub keeps it up to date.
// Prism Launcher is free software (GPL-3.0): changing and using a copy this
// way is allowed; its source is at https://github.com/PrismLauncher/PrismLauncher
// and this file is the whole change.
const fsp = require('node:fs/promises');
const path = require('node:path');

const BRAND_VERSION = 2; // raise when the list below changes: engines get patched again
// Linux engines are patched once more: the desktop name "havi-hub" became
// "havihub" (the name of Havi Hub's menu entry)
const BRAND_VERSION_LINUX = 3;
const brandVersion = (platform) => (platform === 'linux' ? BRAND_VERSION_LINUX : BRAND_VERSION);
const LOGIN_PAGE_PORT = 47219;
// The engine keeps this address together with its length, so ours must be
// exactly as long as the one it replaces (42 characters). A shorter one ends
// in padding that the browser shows as junk and the page is "not found".
const LOGIN_PAGE_PATH = '/cuenta-conectada-ok';
const LOGIN_PAGE_URL = `http://127.0.0.1:${LOGIN_PAGE_PORT}${LOGIN_PAGE_PATH}`;
const LOGIN_PAGE_ORIGINAL = 'https://prismlauncher.org/successful-login';
const LOGIN_PAGE_V1 = `http://127.0.0.1:${LOGIN_PAGE_PORT}/havihub`; // the first address used (too short)

// An engine patched with that short address: it (and its padding) becomes the full one.
function repairLoginUrl(buf) {
  const room = LOGIN_PAGE_ORIGINAL.length;
  const needle = Buffer.concat([Buffer.from([0]), Buffer.from(LOGIN_PAGE_V1), Buffer.alloc(room - LOGIN_PAGE_V1.length + 1)]);
  const full = Buffer.from(LOGIN_PAGE_URL);
  let count = 0;
  let at = buf.indexOf(needle);
  while (at !== -1) {
    full.copy(buf, at + 1);
    count++;
    at = buf.indexOf(needle, at + 1 + room);
  }
  return count;
}
const MARKER = 'havihub-brand.json';

function cStringPatches(platform) {
  const list = [
    { id: 'name', from: 'Prism Launcher', to: 'Havi Hub' },
    { id: 'loginPage', from: LOGIN_PAGE_ORIGINAL, to: LOGIN_PAGE_URL },
  ];
  if (platform === 'linux') {
    list.push({ id: 'appId', from: 'org.prismlauncher.PrismLauncher', to: 'havihub' });
    list.push({ id: 'appIdRename', from: 'havi-hub', to: 'havihub' }); // an engine patched with the old name
  }
  return list;
}

// Havi Hub's logo for the engine's windows (their title bar and taskbar
// icon): small enough to take the place of each copy of the engine's own.
const LOGO_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2f93"/><stop offset=".55" stop-color="#231b62"/><stop offset="1" stop-color="#140f3c"/></linearGradient><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f89b4a"/><stop offset="1" stop-color="#e1551c"/></linearGradient></defs><rect x="16" y="16" width="480" height="480" rx="108" fill="url(#s)"/><path fill="#fff" fill-opacity=".8" d="M92 104h12v12H92zM438 214h8v8h-8zM150 62h6v6h-6zM404 84h10v30h-10zM394 94h30v10h-30z"/><path fill="url(#f)" d="M100 152h79v118h118V152h79v276h-79V310H179v118h-79z"/><path fill="#ffc37f" d="M100 152l24-24h79l-24 24zM297 152l24-24h79l-24 24zM179 270l24-24h118l-24 24z"/><path fill="#a43b13" d="M179 152l24-24v118l-24 24zM179 310l24-24v118l-24 24zM376 152l24-24v276l-24 24z"/></svg>',
  'utf8',
);

// The engine's logo is stored as plain SVG files inside the program (a
// 4-byte length, then the file). Each copy is replaced by Havi Hub's logo,
// padded with spaces to the same length.
function patchLogos(buf, svg = LOGO_SVG) {
  const mark = Buffer.from('Prism Launcher Logo', 'utf8');
  const open = Buffer.from('<?xml', 'utf8');
  const close = Buffer.from('</svg>', 'utf8');
  let count = 0;
  let at = buf.indexOf(mark);
  while (at !== -1) {
    const start = buf.lastIndexOf(open, at);
    if (start >= 4 && at - start < 8192) {
      const len = buf.readUInt32BE(start - 4);
      const end = start + len;
      const closeAt = buf.indexOf(close, at);
      if (len >= svg.length + 1 && len < 65536 && end <= buf.length && closeAt !== -1 && closeAt + close.length <= end) {
        buf.fill(0x20, start, end);
        svg.copy(buf, start);
        buf[end - 1] = 0x0a;
        count++;
      }
    }
    at = buf.indexOf(mark, at + mark.length);
  }
  return count;
}

// Texts that name the launcher in the middle of a sentence (settings and
// notes of screens Havi Hub doesn't open; changed all the same). "Havi Hub"
// plus two zero-width spaces takes the same 14 bytes. The copyright line and
// the credits keep the original name: they are the authors' notices.
const SENTENCES = ['where Prism Launcher stores', 'tools like Prism Launcher', 'if Prism Launcher should', 'the Prism Launcher updater log'];
function patchSentences(buf) {
  const from = Buffer.from('Prism Launcher', 'utf8');
  const to = Buffer.concat([Buffer.from('Havi Hub', 'utf8'), Buffer.from([0xe2, 0x80, 0x8b, 0xe2, 0x80, 0x8b])]);
  let count = 0;
  for (const s of SENTENCES) {
    const needle = Buffer.from(s, 'utf8');
    const rel = needle.indexOf(from);
    let at = buf.indexOf(needle);
    while (at !== -1) {
      to.copy(buf, at + rel);
      count++;
      at = buf.indexOf(needle, at + needle.length);
    }
  }
  return count;
}

// Every NUL-terminated copy of `from` (a whole C string, not part of a longer
// text) becomes `to` followed by zeros. Returns how many were changed.
function patchCString(buf, from, to) {
  const f = Buffer.from(from, 'utf8');
  const tb = Buffer.from(to, 'utf8');
  if (tb.length > f.length) throw new Error(`"${to}" no cabe en lugar de "${from}"`);
  const needle = Buffer.concat([Buffer.from([0]), f, Buffer.from([0])]);
  let count = 0;
  let at = buf.indexOf(needle);
  while (at !== -1) {
    const start = at + 1;
    buf.fill(0, start, start + f.length);
    tb.copy(buf, start);
    count++;
    at = buf.indexOf(needle, start + f.length);
  }
  return count;
}

// Windows version info ("FileDescription", "ProductName"): UTF-16 strings in
// the program's resources. The value keeps its room; its length is updated.
function patchVersionInfo(buf, from, to) {
  const u16 = (s) => Buffer.from(s, 'utf16le');
  const fromValue = Buffer.concat([u16(from), Buffer.alloc(2)]);
  let count = 0;
  for (const key of ['FileDescription', 'ProductName']) {
    const keyBytes = Buffer.concat([u16(key), Buffer.alloc(2)]);
    let at = buf.indexOf(keyBytes);
    while (at !== -1) {
      // String { WORD wLength; WORD wValueLength; WORD wType; WCHAR szKey[]; padding; WCHAR Value[] }
      let value = at + keyBytes.length;
      while (value % 4) value++;
      if (at >= 6 && buf.readUInt16LE(at - 2) === 1 && buf.compare(fromValue, 0, fromValue.length, value, value + fromValue.length) === 0) {
        buf.fill(0, value, value + fromValue.length);
        u16(to).copy(buf, value);
        buf.writeUInt16LE(to.length + 1, at - 4);
        count++;
      }
      at = buf.indexOf(keyBytes, at + keyBytes.length);
    }
  }
  return count;
}

// Windows: the program's own icon (what the Task Manager and Explorer show).
// Each size is stored as an uncompressed 32-bit image; it's replaced by Havi
// Hub's icon at the same size, so nothing moves.
function peIconResources(buf) {
  if (buf.length < 0x40 || buf.readUInt16LE(0) !== 0x5a4d) return [];
  const pe = buf.readUInt32LE(0x3c);
  if (pe + 24 > buf.length || buf.readUInt32LE(pe) !== 0x4550) return [];
  const sectionCount = buf.readUInt16LE(pe + 6);
  const optSize = buf.readUInt16LE(pe + 20);
  const opt = pe + 24;
  const dirs = opt + (buf.readUInt16LE(opt) === 0x20b ? 112 : 96);
  const rsrcRva = buf.readUInt32LE(dirs + 2 * 8); // IMAGE_DIRECTORY_ENTRY_RESOURCE
  if (!rsrcRva) return [];
  const sections = [];
  for (let i = 0; i < sectionCount; i++) {
    const o = opt + optSize + i * 40;
    sections.push({ va: buf.readUInt32LE(o + 12), size: Math.max(buf.readUInt32LE(o + 8), buf.readUInt32LE(o + 16)), raw: buf.readUInt32LE(o + 20) });
  }
  const fileOffset = (rva) => {
    const s = sections.find((x) => rva >= x.va && rva < x.va + x.size);
    return s ? rva - s.va + s.raw : -1;
  };
  const root = fileOffset(rsrcRva);
  if (root < 0) return [];
  const entries = (dir) => {
    const out = [];
    if (dir + 16 > buf.length) return out;
    const n = buf.readUInt16LE(dir + 12) + buf.readUInt16LE(dir + 14);
    for (let i = 0; i < n && dir + 24 + i * 8 <= buf.length; i++) out.push({ id: buf.readUInt32LE(dir + 16 + i * 8), to: buf.readUInt32LE(dir + 20 + i * 8) });
    return out;
  };
  const isDir = (to) => (to & 0x80000000) !== 0;
  const sub = (to) => root + (to & 0x7fffffff);
  const out = [];
  for (const type of entries(root)) {
    if (type.id !== 3 || !isDir(type.to)) continue; // RT_ICON
    for (const name of entries(sub(type.to))) {
      if (!isDir(name.to)) continue;
      for (const lang of entries(sub(name.to))) {
        if (isDir(lang.to)) continue;
        const d = root + lang.to;
        const at = fileOffset(buf.readUInt32LE(d));
        const size = buf.readUInt32LE(d + 4);
        if (at >= 0 && at + size <= buf.length) out.push({ at, size });
      }
    }
  }
  return out;
}

// iconBitmap(size) -> Buffer of size*size BGRA pixels (straight alpha, top row first), or null
function patchPeIcons(buf, iconBitmap) {
  if (typeof iconBitmap !== 'function') return 0;
  let count = 0;
  for (const { at, size } of peIconResources(buf)) {
    if (size < 40 || buf.readUInt32LE(at) !== 40) continue; // PNG-compressed or unknown: left as it is
    const w = buf.readInt32LE(at + 4);
    const maskRow = Math.ceil(w / 32) * 4;
    if (w <= 0 || w > 1024 || buf.readInt32LE(at + 8) !== w * 2 || buf.readUInt16LE(at + 14) !== 32 || size !== 40 + w * w * 4 + w * maskRow) continue;
    const px = iconBitmap(w);
    if (!px || px.length !== w * w * 4) continue;
    const xor = at + 40;
    const and = xor + w * w * 4;
    buf.fill(0, and, and + w * maskRow);
    for (let y = 0; y < w; y++) {
      const src = (w - 1 - y) * w * 4; // rows are stored bottom-up
      px.copy(buf, xor + y * w * 4, src, src + w * 4);
      for (let x = 0; x < w; x++) if (px[src + x * 4 + 3] === 0) buf[and + y * maskRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
    count++;
  }
  return count;
}

// A PE file's digital signature ("certificate table") lives at its end; after
// any change it would only say "invalid signature", so it's removed and the
// header checksum recomputed. Returns the (possibly shorter) buffer.
function stripSignature(buf) {
  if (buf.length < 0x40 || buf.readUInt16LE(0) !== 0x5a4d) return buf;
  const pe = buf.readUInt32LE(0x3c);
  if (buf.readUInt32LE(pe) !== 0x4550) return buf;
  const opt = pe + 24;
  const magic = buf.readUInt16LE(opt);
  const dirs = opt + (magic === 0x20b ? 112 : 96);
  const secEntry = dirs + 4 * 8; // IMAGE_DIRECTORY_ENTRY_SECURITY
  const certAt = buf.readUInt32LE(secEntry);
  const certSize = buf.readUInt32LE(secEntry + 4);
  let out = buf;
  if (certAt && certSize && certAt + certSize >= buf.length - 8 && certAt <= buf.length) {
    out = buf.subarray(0, certAt);
    out.writeUInt32LE(0, secEntry);
    out.writeUInt32LE(0, secEntry + 4);
  }
  out.writeUInt32LE(peChecksum(out, opt + 64), opt + 64);
  return out;
}

// The standard PE checksum: 16-bit words summed with carry (skipping the
// checksum field itself), plus the file length.
function peChecksum(buf, checksumAt) {
  let sum = 0;
  const words = Math.floor(buf.length / 2);
  for (let i = 0; i < words; i++) {
    const off = i * 2;
    if (off === checksumAt || off === checksumAt + 2) continue;
    sum += buf.readUInt16LE(off);
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  if (buf.length % 2) {
    sum += buf[buf.length - 1];
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  sum = (sum & 0xffff) + (sum >>> 16);
  return (sum + buf.length) >>> 0;
}

// Linux (x86-64): Qt adds the program's display name to every window title,
// and the engine builds it as "%1 %2" (name, version): "Agregar cuenta — Havi
// Hub 11.1.1". The one instruction that loads that format right before
// QGuiApplication::setApplicationDisplayName is pointed at a plain "%1"
// instead, so titles say "— Havi Hub". Found by symbol, not by address: if a
// future engine is built differently nothing matches and nothing changes.
function elfSections(buf) {
  if (buf.length < 64 || buf.readUInt32BE(0) !== 0x7f454c46 || buf[4] !== 2 || buf[5] !== 1 || buf.readUInt16LE(0x12) !== 0x3e) return null;
  const shoff = Number(buf.readBigUInt64LE(0x28));
  const shentsize = buf.readUInt16LE(0x3a);
  const shnum = buf.readUInt16LE(0x3c);
  const shstrndx = buf.readUInt16LE(0x3e);
  if (!shoff || shoff + shnum * shentsize > buf.length) return null;
  const raw = [];
  for (let i = 0; i < shnum; i++) {
    const o = shoff + i * shentsize;
    raw.push({ name: buf.readUInt32LE(o), type: buf.readUInt32LE(o + 4), addr: Number(buf.readBigUInt64LE(o + 16)), offset: Number(buf.readBigUInt64LE(o + 24)), size: Number(buf.readBigUInt64LE(o + 32)), link: buf.readUInt32LE(o + 40) });
  }
  const strtab = raw[shstrndx];
  const nameOf = (n) => {
    const s = strtab.offset + n;
    return buf.toString('latin1', s, buf.indexOf(0, s));
  };
  const out = {};
  for (const s of raw) out[nameOf(s.name)] = s;
  return out;
}

function patchLinuxDisplayNameFormat(buf) {
  const sec = elfSections(buf);
  if (!sec || !sec['.dynsym'] || !sec['.dynstr'] || !sec['.rela.plt'] || !sec['.text'] || !sec['.rodata']) return 0;
  const SYMBOL = '_ZN15QGuiApplication25setApplicationDisplayNameERK7QString';
  const dynsym = sec['.dynsym'];
  const dynstr = sec['.dynstr'];
  let symIndex = -1;
  for (let i = 0; i * 24 < dynsym.size; i++) {
    const o = dynsym.offset + i * 24;
    const n = dynstr.offset + buf.readUInt32LE(o);
    if (buf.toString('latin1', n, buf.indexOf(0, n)) === SYMBOL) {
      symIndex = i;
      break;
    }
  }
  if (symIndex < 0) return 0;
  let got = -1;
  const rela = sec['.rela.plt'];
  for (let o = rela.offset; o < rela.offset + rela.size; o += 24) {
    if (Number(buf.readBigUInt64LE(o + 8) >> 32n) === symIndex) got = Number(buf.readBigUInt64LE(o));
  }
  if (got < 0) return 0;
  // the PLT stub that jumps through that GOT slot: "jmp *disp32(%rip)" (ff 25)
  let stub = -1;
  for (const name of ['.plt.sec', '.plt']) {
    const s = sec[name];
    if (!s) continue;
    for (let o = s.offset; o + 16 <= s.offset + s.size && stub < 0; o += 16) {
      for (let k = 0; k < 10; k++) {
        if (buf[o + k] === 0xff && buf[o + k + 1] === 0x25) {
          const at = s.addr + (o - s.offset) + k;
          if (at + 6 + buf.readInt32LE(o + k + 2) === got) stub = s.addr + (o - s.offset);
          break;
        }
      }
    }
  }
  if (stub < 0) return 0;
  // the two formats in .rodata, as whole C strings
  const ro = sec['.rodata'];
  const rodata = buf.subarray(ro.offset, ro.offset + ro.size);
  const find = (str) => {
    const i = rodata.indexOf(Buffer.from(`\0${str}\0`, 'latin1'));
    return i < 0 ? -1 : ro.addr + i + 1;
  };
  const twoArgs = find('%1 %2');
  // "%1" alone: the end of any text that ends in "%1" will do (the compiler
  // keeps short strings only as the tail of longer ones)
  const tail = rodata.indexOf(Buffer.from('%1\0', 'latin1'));
  const oneArg = tail < 0 ? -1 : ro.addr + tail;
  if (twoArgs < 0 || oneArg < 0) return 0;
  const text = sec['.text'];
  let patched = 0;
  for (let o = text.offset; o + 5 <= text.offset + text.size; o++) {
    if (buf[o] !== 0xe8) continue;
    const addr = text.addr + (o - text.offset);
    if (addr + 5 + buf.readInt32LE(o + 1) !== stub) continue;
    // the closest "lea disp32(%rip), %reg" before the call that loads "%1 %2"
    for (let b = o - 7; b >= o - 160 && b >= text.offset; b--) {
      if ((buf[b] & 0xf8) !== 0x48 || buf[b + 1] !== 0x8d || (buf[b + 2] & 0xc7) !== 0x05) continue;
      const lea = text.addr + (b - text.offset);
      if (lea + 7 + buf.readInt32LE(b + 3) !== twoArgs) continue;
      buf.writeInt32LE(oneArg - (lea + 7), b + 3);
      patched++;
      break;
    }
  }
  return patched;
}

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

// The engine's program inside an extracted portable build
async function engineBinaries(versionDir, platform) {
  const candidates = platform === 'win32' ? ['prismlauncher.exe'] : [path.join('shared', 'bin', 'prismlauncher'), path.join('bin', 'prismlauncher')];
  const out = [];
  for (const rel of candidates) if (await exists(path.join(versionDir, rel))) out.push(path.join(versionDir, rel));
  return out;
}

async function isBranded(versionDir, platform = process.platform) {
  try {
    const m = JSON.parse(await fsp.readFile(path.join(versionDir, MARKER), 'utf8'));
    return m.version >= brandVersion(platform);
  } catch {
    return false;
  }
}

// Patches the engine in versionDir. Throws if its program can't be written
// (for example while it's running); the caller tries again later.
async function brandEngine(versionDir, { platform = process.platform, iconBitmap } = {}) {
  const report = { version: brandVersion(platform), at: Date.now(), files: {} };
  for (const file of await engineBinaries(versionDir, platform)) {
    let buf = Buffer.from(await fsp.readFile(file));
    const counts = {};
    for (const p of cStringPatches(platform)) counts[p.id] = patchCString(buf, p.from, p.to);
    counts.loginPage += repairLoginUrl(buf);
    if (platform === 'linux') counts.titleVersion = patchLinuxDisplayNameFormat(buf);
    counts.sentences = patchSentences(buf);
    counts.logos = patchLogos(buf);
    if (platform === 'win32') {
      counts.versionInfo = patchVersionInfo(buf, 'Prism Launcher', 'Havi Hub');
      counts.icons = patchPeIcons(buf, iconBitmap);
    }
    report.files[path.relative(versionDir, file)] = counts;
    // not the engine's program (e.g. the portable build's small starter): left as it is
    if (!Object.values(counts).some(Boolean)) continue;
    if (platform === 'win32') buf = stripSignature(buf);
    // write next to it, then swap: a half-written engine never stays behind
    const tmp = `${file}.havihub-tmp`;
    const mode = (await fsp.stat(file)).mode;
    await fsp.writeFile(tmp, buf, { mode });
    try {
      await fsp.rename(tmp, file);
    } catch (e) {
      await fsp.rm(tmp, { force: true }).catch(() => {});
      throw e;
    }
  }
  // Havi Hub updates the engine itself: without its updater, the engine
  // never offers ("Havi Hub 11.2 is available") updates on its own
  for (const rel of ['prismlauncher_updater.exe', 'prismlauncher_updater', path.join('shared', 'bin', 'prismlauncher_updater'), path.join('bin', 'prismlauncher_updater')]) {
    await fsp.rm(path.join(versionDir, rel), { force: true }).catch(() => {});
  }
  await fsp.writeFile(path.join(versionDir, MARKER), JSON.stringify(report, null, 2));
  return report;
}

module.exports = { repairLoginUrl, brandEngine, isBranded, patchCString, patchPeIcons, patchLogos, patchSentences, LOGO_SVG, patchVersionInfo, stripSignature, peChecksum, patchLinuxDisplayNameFormat, BRAND_VERSION, LOGIN_PAGE_PORT, LOGIN_PAGE_PATH, LOGIN_PAGE_URL };
