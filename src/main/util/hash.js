// Hash helpers: sha1 / sha512 (Modrinth) and the CurseForge "fingerprint"
// (32-bit MurmurHash2, seed 1, computed over the file with whitespace bytes removed).
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');

function hashFile(file, algo = 'sha1') {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash(algo);
    const s = fs.createReadStream(file);
    s.on('data', (d) => h.update(d));
    s.on('end', () => resolve(h.digest('hex')));
    s.on('error', reject);
  });
}

async function hashFileMulti(file, algos = ['sha1', 'sha512']) {
  const hs = algos.map((a) => crypto.createHash(a));
  await new Promise((resolve, reject) => {
    const s = fs.createReadStream(file);
    s.on('data', (d) => hs.forEach((h) => h.update(d)));
    s.on('end', resolve);
    s.on('error', reject);
  });
  const out = {};
  algos.forEach((a, i) => (out[a] = hs[i].digest('hex')));
  return out;
}

function hashBuffer(buf, algo = 'sha1') {
  return crypto.createHash(algo).update(buf).digest('hex');
}

const M = 0x5bd1e995;

function murmur2(data, seed = 1) {
  let len = data.length;
  let h = (seed ^ len) >>> 0;
  let i = 0;
  while (len >= 4) {
    let k = data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24);
    k = Math.imul(k, M);
    k ^= k >>> 24;
    k = Math.imul(k, M);
    h = Math.imul(h, M) ^ k;
    i += 4;
    len -= 4;
  }
  switch (len) {
    case 3:
      h ^= data[i + 2] << 16;
    // fallthrough
    case 2:
      h ^= data[i + 1] << 8;
    // fallthrough
    case 1:
      h ^= data[i];
      h = Math.imul(h, M);
  }
  h ^= h >>> 13;
  h = Math.imul(h, M);
  h ^= h >>> 15;
  return h >>> 0;
}

function curseFingerprintBuffer(buf) {
  const filtered = Buffer.allocUnsafe(buf.length);
  let n = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 9 || b === 10 || b === 13 || b === 32) continue;
    filtered[n++] = b;
  }
  return murmur2(filtered.subarray(0, n), 1);
}

async function curseFingerprint(file) {
  return curseFingerprintBuffer(await fsp.readFile(file));
}

module.exports = { hashFile, hashFileMulti, hashBuffer, murmur2, curseFingerprint, curseFingerprintBuffer };
