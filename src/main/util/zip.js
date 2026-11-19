// Zip helpers built on yauzl (read) and yazl (write).
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const yauzl = require('yauzl');
const yazl = require('yazl');
const { safeRelPath, assertInside, isPlainFileName, tomlFileName } = require('./safepath');

function openZip(file) {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true, autoClose: false, strictFileNames: false, decodeStrings: true }, (err, zip) => {
      if (err) reject(err);
      else resolve(zip);
    });
  });
}

function readEntryBuffer(zip, entry) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err) return reject(err);
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  });
}

function streamEntryTo(zip, entry, target) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err) return reject(err);
      const ws = fs.createWriteStream(target);
      stream.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
      stream.on('error', reject);
    });
  });
}

// Iterate entries sequentially. visitor(entry, helpers) may return true to stop.
// helpers.read() -> Buffer, helpers.extractTo(path)
async function walk(file, visitor) {
  const zip = await openZip(file);
  try {
    await new Promise((resolve, reject) => {
      zip.on('entry', async (entry) => {
        try {
          const stop = await visitor(entry, {
            read: () => readEntryBuffer(zip, entry),
            extractTo: (target) => streamEntryTo(zip, entry, target),
          });
          if (stop === true) {
            resolve();
            return;
          }
          zip.readEntry();
        } catch (e) {
          reject(e);
        }
      });
      zip.on('end', resolve);
      zip.on('error', reject);
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
}

async function listEntries(file) {
  const names = [];
  await walk(file, (e) => {
    names.push(e.fileName);
  });
  return names;
}

// Read a set of entries by name (case-insensitive). Returns Map(name -> Buffer).
async function readEntries(file, wanted, { maxSize = 16 * 1024 * 1024 } = {}) {
  const want = new Map(wanted.map((w) => [w.toLowerCase(), w]));
  const out = new Map();
  await walk(file, async (entry, h) => {
    const key = want.get(entry.fileName.toLowerCase());
    if (key && entry.uncompressedSize <= maxSize) {
      out.set(key, await h.read());
      want.delete(entry.fileName.toLowerCase());
    }
    return want.size === 0;
  });
  return out;
}

async function readEntry(file, name, opts) {
  const m = await readEntries(file, [name], opts);
  return m.get(name) || null;
}

// Extract entries whose name starts with `prefix` into destDir (prefix stripped).
async function extractPrefix(file, prefix, destDir, { onFile } = {}) {
  const root = path.resolve(destDir);
  let count = 0;
  await walk(file, async (entry, h) => {
    if (!entry.fileName.startsWith(prefix)) return;
    const raw = entry.fileName.slice(prefix.length);
    if (!raw) return;
    // zip-slip guard: ../, absolute, drive and UNC paths, device names and links
    const rel = safeRelPath(raw);
    if (!rel) return;
    const target = path.join(root, ...rel.split('/'));
    try {
      await assertInside(root, target);
    } catch {
      return;
    }
    if (/[/\\]$/.test(entry.fileName)) {
      await fsp.mkdir(target, { recursive: true });
      return;
    }
    // metadata (.index/*.pw.toml) must name a file of its own folder
    if (/\.pw\.toml$/i.test(rel)) {
      if (entry.uncompressedSize > 256 * 1024) return;
      const buf = await h.read();
      const fn = tomlFileName(buf.toString('utf8'));
      if (fn !== null && !isPlainFileName(fn)) return;
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await assertInside(root, target);
      await fsp.writeFile(target, buf);
      count++;
      if (onFile) onFile(rel);
      return;
    }
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await assertInside(root, target);
    await h.extractTo(target);
    count++;
    if (onFile) onFile(rel);
  });
  return count;
}

// Create a zip from items: { abs, name } (file on disk), { name, buffer }, { name, dir: true }
function writeZip(dest, items) {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    for (const it of items) {
      if (it.buffer) zip.addBuffer(it.buffer, it.name);
      else if (it.dir) zip.addEmptyDirectory(it.name);
      else zip.addFile(it.abs, it.name);
    }
    zip.end();
    const ws = fs.createWriteStream(dest);
    zip.outputStream.pipe(ws);
    ws.on('close', resolve);
    ws.on('error', reject);
    zip.outputStream.on('error', reject);
  });
}

// Recursively collect files under dir as zip items (names relative to dir).
async function collectFiles(dir, prefix = '', exclude = () => false) {
  const items = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let ents = [];
    try {
      ents = await fsp.readdir(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of ents) {
      const abs = path.join(cur, e.name);
      const rel = path.relative(dir, abs).split(path.sep).join('/');
      if (exclude(rel, e)) continue;
      if (e.isDirectory()) stack.push(abs);
      else if (e.isFile()) items.push({ abs, name: prefix + rel });
    }
  }
  return items;
}

module.exports = { openZip, walk, listEntries, readEntries, readEntry, extractPrefix, writeZip, collectFiles };
