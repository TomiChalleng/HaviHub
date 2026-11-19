// Minimal .tar.gz extractor (ustar/GNU/pax headers, files, folders, symlinks)
// used for the Linux build of the engine. Streams the archive, so large files
// never sit in memory at once.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');

function parseOctal(buf, start, len) {
  const s = buf.toString('ascii', start, start + len).replace(/\0.*$/, '').trim();
  return s ? parseInt(s, 8) : 0;
}

function parseString(buf, start, len) {
  const end = buf.indexOf(0, start);
  return buf.toString('utf8', start, end === -1 || end > start + len ? start + len : end);
}

function parsePax(data) {
  const out = {};
  let i = 0;
  while (i < data.length) {
    const sp = data.indexOf(0x20, i);
    if (sp === -1) break;
    const len = parseInt(data.toString('ascii', i, sp), 10);
    if (!len) break;
    const rec = data.toString('utf8', sp + 1, i + len - 1);
    const eq = rec.indexOf('=');
    if (eq > 0) out[rec.slice(0, eq)] = rec.slice(eq + 1);
    i += len;
  }
  return out;
}

// Extract every entry of `file` into `destDir`. `strip` removes leading path
// components (like tar --strip-components).
async function extractTarGz(file, destDir, { strip = 0, onEntry } = {}) {
  const root = path.resolve(destDir);
  await fsp.mkdir(root, { recursive: true });
  const symlinks = [];
  const hardlinks = [];
  let count = 0;

  const resolveTarget = (name) => {
    let parts = name.split('/').filter((p) => p && p !== '.');
    if (parts.length <= strip) return null;
    parts = parts.slice(strip);
    if (parts.some((p) => p === '..')) return null;
    const target = path.resolve(root, ...parts);
    if (target !== root && !target.startsWith(root + path.sep)) return null;
    return target;
  };

  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(file).pipe(zlib.createGunzip());
    let buffer = Buffer.alloc(0);
    let state = 'header';
    let entry = null;
    let remaining = 0;
    let padding = 0;
    let out = null;
    let collect = null;
    let pax = {};
    let longName = null;
    let longLink = null;
    let pending = Promise.resolve();

    const fail = (e) => {
      input.destroy();
      reject(e);
    };

    const startEntry = (header) => {
      const name = parseString(header, 0, 100);
      const mode = parseOctal(header, 100, 8);
      const size = parseOctal(header, 124, 12);
      const type = String.fromCharCode(header[156] || 48);
      const linkName = parseString(header, 157, 100);
      const prefix = header.toString('ascii', 257, 263).startsWith('ustar') ? parseString(header, 345, 155) : '';
      let fullName = prefix ? `${prefix}/${name}` : name;
      if (longName) fullName = longName;
      if (pax.path) fullName = pax.path;
      let link = longLink || pax.linkpath || linkName;
      longName = null;
      longLink = null;
      pax = {};
      return { name: fullName, mode, size, type, link };
    };

    const handleData = async (chunk) => {
      buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk;
      while (true) {
        if (state === 'header') {
          if (buffer.length < 512) return;
          const header = buffer.subarray(0, 512);
          buffer = buffer.subarray(512);
          if (header.every((b) => b === 0)) continue; // end blocks
          const raw = { type: String.fromCharCode(header[156] || 48), size: parseOctal(header, 124, 12) };
          if (raw.type === 'x' || raw.type === 'g' || raw.type === 'L' || raw.type === 'K') {
            entry = { meta: raw.type };
            remaining = raw.size;
            padding = (512 - (raw.size % 512)) % 512;
            collect = [];
            state = 'data';
            continue;
          }
          entry = startEntry(header);
          remaining = entry.type === '0' || entry.type === '\0' || entry.type === '7' ? entry.size : 0;
          padding = (512 - (remaining % 512)) % 512;
          const target = resolveTarget(entry.name);
          entry.target = target;
          if (target) {
            if (entry.type === '5') {
              await fsp.mkdir(target, { recursive: true });
            } else if (entry.type === '2') {
              symlinks.push({ target, link: entry.link });
            } else if (entry.type === '1') {
              const from = resolveTarget(entry.link);
              if (from) hardlinks.push({ target, from });
            } else if (entry.type === '0' || entry.type === '\0' || entry.type === '7') {
              await fsp.mkdir(path.dirname(target), { recursive: true });
              await fsp.rm(target, { force: true });
              out = fs.createWriteStream(target, { mode: entry.mode & 0o777 || 0o644 });
              count++;
              if (onEntry) onEntry(entry.name);
            }
          }
          state = remaining > 0 ? 'data' : padding > 0 ? 'pad' : 'header';
          if (state === 'header' && out) {
            await new Promise((r) => out.end(r));
            out = null;
          }
          continue;
        }
        if (state === 'data') {
          if (!buffer.length) return;
          const take = Math.min(remaining, buffer.length);
          const part = buffer.subarray(0, take);
          buffer = buffer.subarray(take);
          remaining -= take;
          if (collect) collect.push(Buffer.from(part));
          else if (out && !out.write(part)) await new Promise((r) => out.once('drain', r));
          if (remaining === 0) {
            if (collect) {
              const data = Buffer.concat(collect);
              collect = null;
              if (entry.meta === 'x') pax = parsePax(data);
              else if (entry.meta === 'L') longName = data.toString('utf8').replace(/\0+$/, '');
              else if (entry.meta === 'K') longLink = data.toString('utf8').replace(/\0+$/, '');
            } else if (out) {
              await new Promise((r) => out.end(r));
              if (entry && entry.target) await fsp.chmod(entry.target, entry.mode & 0o777 || 0o644).catch(() => {});
              out = null;
            }
            state = padding > 0 ? 'pad' : 'header';
          }
          continue;
        }
        if (state === 'pad') {
          if (buffer.length < padding) {
            padding -= buffer.length;
            buffer = Buffer.alloc(0);
            return;
          }
          buffer = buffer.subarray(padding);
          padding = 0;
          state = 'header';
          continue;
        }
      }
    };

    input.on('data', (chunk) => {
      input.pause();
      pending = pending.then(() => handleData(chunk)).then(
        () => input.resume(),
        (e) => fail(e)
      );
    });
    input.on('end', () => {
      pending.then(() => {
        if (out) out.end();
        resolve();
      }, fail);
    });
    input.on('error', fail);
  });

  for (const h of hardlinks) {
    await fsp.mkdir(path.dirname(h.target), { recursive: true });
    await fsp.rm(h.target, { force: true });
    try {
      await fsp.link(h.from, h.target);
    } catch {
      await fsp.copyFile(h.from, h.target);
      const st = await fsp.stat(h.from);
      await fsp.chmod(h.target, st.mode & 0o777);
    }
    count++;
  }
  for (const s of symlinks) {
    await fsp.rm(s.target, { force: true, recursive: true }).catch(() => {});
    await fsp.mkdir(path.dirname(s.target), { recursive: true });
    await fsp.symlink(s.link, s.target).catch(() => {});
  }
  return count;
}

module.exports = { extractTarGz };
