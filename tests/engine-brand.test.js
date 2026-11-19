// Havi Hub's name, logo and sign-in page on its game engine (engine-brand.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const brand = require('../src/main/engine-brand');
const { page } = require('../src/main/loginpage');

const z = (s) => Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]);

test('whole names are replaced in place; longer texts and other names are left alone', () => {
  const buf = Buffer.concat([z('x'), z('Prism Launcher'), z('Prism Launcher Contributors'), z('PrismLauncher'), z('Prism Launcher')]);
  const before = buf.length;
  assert.equal(brand.patchCString(buf, 'Prism Launcher', 'Havi Hub'), 2);
  assert.equal(buf.length, before);
  const parts = buf.toString('utf8').split('\0');
  assert.equal(parts[1], 'Havi Hub');
  assert.equal(parts.filter((p) => p === 'Prism Launcher Contributors').length, 1, 'the copyright line keeps its name');
  assert.ok(parts.includes('PrismLauncher'));
  assert.throws(() => brand.patchCString(buf, 'abc', 'longer than that'));
});

test('sentences keep their length: the name plus two zero-width spaces', () => {
  const text = 'Folder where Prism Launcher stores automatically downloaded Java versions.';
  const buf = Buffer.concat([z(text), z('- Prism Launcher, PolyMC or MultiMC exported instances (ZIP)')]);
  assert.equal(brand.patchSentences(buf), 1);
  const [a, b] = buf.toString('utf8').split('\0');
  assert.equal(Buffer.byteLength(a), Buffer.byteLength(text));
  assert.equal(a.replace(/​/g, ''), 'Folder where Havi Hub stores automatically downloaded Java versions.');
  assert.match(b, /Prism Launcher, PolyMC/, 'the export format of the other launcher keeps its name');
});

test('every copy of the logo becomes Havi Hub\'s, padded to the same length', () => {
  const old = Buffer.from(`<?xml version="1.0"?>\n<svg><title>Prism Launcher Logo</title>${'<path d="M0 0"/>'.repeat(80)}</svg>\n`, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(old.length);
  const small = Buffer.from('<?xml version="1.0"?>\n<svg><title>Prism Launcher Logo</title></svg>\n', 'utf8');
  const smallLen = Buffer.alloc(4);
  smallLen.writeUInt32BE(small.length);
  const buf = Buffer.concat([Buffer.from('head'), len, old, Buffer.from('mid!'), smallLen, small, Buffer.from('tail')]);
  assert.equal(brand.patchLogos(buf), 1, 'a copy too small for the new logo is left as it was');
  const out = buf.subarray(8, 8 + old.length).toString('utf8');
  assert.ok(out.startsWith('<svg xmlns='));
  assert.ok(out.endsWith('\n'));
  assert.equal(out.trimEnd(), brand.LOGO_SVG.toString('utf8'));
  assert.equal(buf.subarray(8 + old.length, 12 + old.length).toString(), 'mid!');
  assert.ok(buf.toString('utf8').endsWith('tail'));
});

// a tiny PE (64-bit) with one .rsrc section holding a 16x16 icon and the version texts
function fakeExe({ signed = true } = {}) {
  const w = 16;
  const iconSize = 40 + w * w * 4 + w * 4;
  const icon = Buffer.alloc(iconSize);
  icon.writeUInt32LE(40, 0);
  icon.writeInt32LE(w, 4);
  icon.writeInt32LE(w * 2, 8);
  icon.writeUInt16LE(1, 12);
  icon.writeUInt16LE(32, 14);
  icon.fill(0x11, 40);
  const u16 = (s) => Buffer.from(`${s}\0`, 'utf16le');
  const str = (key, value) => {
    const k = u16(key);
    const pad = Buffer.alloc((4 - ((6 + k.length) % 4)) % 4);
    const v = u16(value);
    const head = Buffer.alloc(6);
    head.writeUInt16LE(6 + k.length + pad.length + v.length, 0);
    head.writeUInt16LE(value.length + 1, 2);
    head.writeUInt16LE(1, 4);
    const all = Buffer.concat([head, k, pad, v]);
    return Buffer.concat([all, Buffer.alloc((4 - (all.length % 4)) % 4)]);
  };
  const versionInfo = Buffer.concat([str('FileDescription', 'Prism Launcher'), str('ProductName', 'Prism Launcher'), str('CompanyName', 'Prism Launcher Contributors')]);
  // resource directory: root -> type 3 (RT_ICON) -> name 1 -> language -> data entry
  const dir = (id, to) => {
    const b = Buffer.alloc(24);
    b.writeUInt16LE(1, 14);
    b.writeUInt32LE(id, 16);
    b.writeUInt32LE(to, 20);
    return b;
  };
  const rva = 0x1000;
  const dataEntry = Buffer.alloc(16);
  const rsrcHead = Buffer.concat([dir(3, 0x80000000 + 24), dir(1, 0x80000000 + 48), dir(0x409, 72), dataEntry]);
  dataEntry.writeUInt32LE(rva + rsrcHead.length, 0);
  dataEntry.writeUInt32LE(iconSize, 4);
  const rsrc = Buffer.concat([dir(3, 0x80000000 + 24), dir(1, 0x80000000 + 48), dir(0x409, 72), dataEntry, icon, versionInfo]);
  const headers = Buffer.alloc(0x200);
  headers.writeUInt16LE(0x5a4d, 0);
  headers.writeUInt32LE(0x80, 0x3c);
  headers.writeUInt32LE(0x4550, 0x80);
  headers.writeUInt16LE(0x8664, 0x84);
  headers.writeUInt16LE(1, 0x86); // one section
  headers.writeUInt16LE(240, 0x94); // optional header size
  const opt = 0x98;
  headers.writeUInt16LE(0x20b, opt);
  const dirs = opt + 112;
  headers.writeUInt32LE(rva, dirs + 2 * 8);
  headers.writeUInt32LE(rsrc.length, dirs + 2 * 8 + 4);
  const sec = opt + 240;
  headers.write('.rsrc', sec, 'latin1');
  headers.writeUInt32LE(rsrc.length, sec + 8);
  headers.writeUInt32LE(rva, sec + 12);
  headers.writeUInt32LE(rsrc.length, sec + 16);
  headers.writeUInt32LE(0x200, sec + 20);
  let exe = Buffer.concat([headers, rsrc, Buffer.concat([z('Prism Launcher'), z('https://prismlauncher.org/successful-login')])]);
  exe = Buffer.concat([exe, Buffer.alloc((8 - (exe.length % 8)) % 8)]);
  if (signed) {
    const cert = Buffer.alloc(64, 0xcc);
    exe.writeUInt32LE(exe.length, dirs + 4 * 8);
    exe.writeUInt32LE(cert.length, dirs + 4 * 8 + 4);
    exe = Buffer.concat([exe, cert]);
  }
  return { exe, iconAt: 0x200 + rsrcHead.length, w, dirs, checksumAt: opt + 64 };
}

test('Windows: description, icon and signature of the engine program', async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'havihub-brand-'));
  try {
    const { exe, iconAt, w, dirs, checksumAt } = fakeExe();
    await fsp.writeFile(path.join(tmp, 'prismlauncher.exe'), exe);
    await fsp.writeFile(path.join(tmp, 'prismlauncher_updater.exe'), 'x');
    const px = Buffer.alloc(w * w * 4);
    for (let i = 0; i < w * w; i++) px.writeUInt32LE(i < w ? 0x00000000 : 0xff3c83f0, i * 4); // top row transparent
    assert.equal(await brand.isBranded(tmp, 'win32'), false);
    const report = await brand.brandEngine(tmp, { platform: 'win32', iconBitmap: (n) => (n === w ? px : null) });
    assert.deepEqual(report.files['prismlauncher.exe'], { name: 1, loginPage: 1, sentences: 0, logos: 0, versionInfo: 2, icons: 1 });
    assert.equal(await brand.isBranded(tmp, 'win32'), true);
    assert.equal(fs.existsSync(path.join(tmp, 'prismlauncher_updater.exe')), false, 'the engine\'s own updater is removed');
    const out = await fsp.readFile(path.join(tmp, 'prismlauncher.exe'));
    assert.equal(out.length, exe.length - 64, 'the signature is gone');
    assert.equal(out.readUInt32LE(dirs + 4 * 8), 0);
    assert.equal(out.readUInt32LE(checksumAt), brand.peChecksum(out, checksumAt));
    const text16 = out.toString('utf16le');
    assert.ok(text16.includes('FileDescription\0Havi Hub\0') || /FileDescription\0+Havi Hub\0/.test(text16));
    assert.ok(/CompanyName\0+Prism Launcher Contributors/.test(text16), 'the authors stay named');
    assert.ok(out.includes(z(brand.LOGIN_PAGE_URL)));
    // the icon: bottom-up rows, the transparent top row marked in the mask (stored last)
    const xor = iconAt + 40;
    assert.equal(out.readUInt32LE(xor), 0xff3c83f0);
    assert.equal(out.readUInt32LE(xor + (w - 1) * w * 4), 0);
    const mask = xor + w * w * 4;
    assert.equal(out.readUInt16LE(mask), 0);
    assert.equal(out.readUInt16BE(mask + (w - 1) * 4), 0xffff);
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true });
  }
});

test('the sign-in page is Havi Hub\'s own, in the app language', () => {
  assert.match(page('es', null), /Cuenta conectada/);
  assert.match(page('en', null), /Account connected/);
  assert.ok(!/prism/i.test(page('es', Buffer.from('png'))));
  // exactly as long as the address it replaces: the engine keeps that address
  // with its length, so anything shorter ends in junk (a "404" page)
  assert.equal(brand.LOGIN_PAGE_URL.length, 'https://prismlauncher.org/successful-login'.length);
});

// With a real engine at hand (not shipped with the code), the whole patch
const REAL = [
  ['linux', process.env.HAVIHUB_TEST_ENGINE_LINUX || '/tmp/prism-engine-linux', path.join('shared', 'bin', 'prismlauncher')],
  ['win32', process.env.HAVIHUB_TEST_ENGINE_WIN || '/tmp/realprism/engine/versions/11.1.1', 'prismlauncher.exe'],
];
for (const [platform, dir, rel] of REAL) {
  test(`a real ${platform} engine gets every change`, { skip: !fs.existsSync(path.join(dir, rel)) }, async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'havihub-brand-real-'));
    try {
      await fsp.mkdir(path.dirname(path.join(tmp, rel)), { recursive: true });
      await fsp.copyFile(path.join(dir, rel), path.join(tmp, rel));
      const report = await brand.brandEngine(tmp, { platform, iconBitmap: (n) => Buffer.alloc(n * n * 4, 0x80) });
      const c = report.files[rel];
      assert.equal(c.name, 1);
      assert.equal(c.loginPage, 1);
      assert.ok(c.logos >= 10, JSON.stringify(c));
      assert.ok(c.sentences >= 3);
      if (platform === 'linux') {
        assert.equal(c.appId, 1);
        assert.equal(c.titleVersion, 1);
      } else {
        assert.equal(c.versionInfo, 2);
        assert.equal(c.icons, 7);
      }
      const out = await fsp.readFile(path.join(tmp, rel));
      assert.equal(out.includes(z('Prism Launcher')), false);
      assert.equal(out.includes(Buffer.from('Prism Launcher Logo')), false);
      assert.ok(out.includes(Buffer.from('Prism Launcher Contributors')), 'the copyright notice stays');
    } finally {
      await fsp.rm(tmp, { recursive: true, force: true });
    }
  });
}

test('an engine patched with the short address (+ padding) gets the full-length address', () => {
  const old = 'http://127.0.0.1:47219/havihub';
  const room = 'https://prismlauncher.org/successful-login'.length;
  const buf = Buffer.concat([Buffer.from('xx\0'), Buffer.from(old), Buffer.alloc(room - old.length), Buffer.from('\0tail\0')]);
  assert.equal(brand.repairLoginUrl(buf), 1);
  assert.ok(buf.includes(Buffer.from(`\0${brand.LOGIN_PAGE_URL}\0tail`)));
  assert.equal(brand.repairLoginUrl(buf), 0);
});

test('Linux: an engine patched with the old name ("havi-hub") is patched again with the new desktop name', async () => {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'havihub-brand-linux-'));
  try {
    const bin = path.join(tmp, 'shared', 'bin', 'prismlauncher');
    await fsp.mkdir(path.dirname(bin), { recursive: true });
    const room = 'org.prismlauncher.PrismLauncher'.length;
    const before = Buffer.concat([Buffer.from('ELF?\0'), Buffer.from('havi-hub'), Buffer.alloc(room - 'havi-hub'.length + 1), Buffer.from('tail\0')]);
    await fsp.writeFile(bin, before);
    await fsp.writeFile(path.join(tmp, 'havihub-brand.json'), JSON.stringify({ version: 2 }));
    assert.equal(await brand.isBranded(tmp, 'linux'), false, 'a Linux engine patched with the old name is patched again');
    assert.equal(await brand.isBranded(tmp, 'win32'), true, 'a Windows one is left as it is');
    const report = await brand.brandEngine(tmp, { platform: 'linux' });
    assert.equal(report.files[path.join('shared', 'bin', 'prismlauncher')].appIdRename, 1);
    const out = await fsp.readFile(bin);
    assert.equal(out.length, before.length, 'nothing else in the program moves');
    assert.ok(out.includes(Buffer.from('\0havihub\0')));
    assert.ok(!out.includes(Buffer.from('havi-hub')));
    assert.equal(await brand.isBranded(tmp, 'linux'), true);
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true });
  }
});
