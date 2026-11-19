const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { McAssets, newest, currentNames } = require('../src/main/mcassets');
const { writeZip } = require('../src/main/util/zip');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-mc-'));

async function makeJar(file, names) {
  const items = names.map((n) => ({ buffer: PNG, name: `assets/minecraft/textures/${n}.png` }));
  // a real client .jar is tens of MB; anything tiny is not taken for one
  items.push({ buffer: require('node:crypto').randomBytes(1300 * 1024), name: 'pad.bin' });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await writeZip(file, items);
}

test('newest version first; snapshots last', () => {
  assert.deepEqual(newest(['1.20.1', '26.2', '25w14a', '1.21.8', '1.9']), ['26.2', '1.21.8', '1.20.1', '1.9', '25w14a']);
});

test('textures come from the newest game the launcher installed', async () => {
  const data = tmp();
  const lib = path.join(data, 'libraries', 'com', 'mojang', 'minecraft');
  await makeJar(path.join(lib, '1.20.1', 'minecraft-1.20.1-client.jar'), ['block/dirt']);
  await makeJar(path.join(lib, '26.2', 'minecraft-26.2-client.jar'), ['block/dirt', 'item/mace', 'environment/celestial/sun']);
  const mc = new McAssets({ dataDir: () => data, cacheDir: path.join(data, 'cache'), allowDownload: false });
  const r = await mc.textures(['block/dirt', 'item/mace', 'item/nope', '../../etc/passwd', 'environment/celestial/sun']);
  assert.match(r.source, /26\.2-client\.jar/);
  assert.deepEqual(Object.keys(r.textures).sort(), ['block/dirt', 'environment/celestial/sun', 'item/mace']);
  assert.ok(r.textures['block/dirt'].startsWith('data:image/png;base64,iVBOR'));
});

test('versions that name their textures as asked (1.13 and later, snapshot 17w43a on)', () => {
  for (const v of ['1.13', '1.13.2', '1.13-pre1', '1.21.10', '26.1', '26.1-snapshot-2', '17w43a', '25w14a']) assert.equal(currentNames(v), true, v);
  for (const v of ['1.12.2', '1.8.9', '1.7.10', '17w31a', 'b1.7.3', 'rd-132211', '']) assert.equal(currentNames(v), false, v);
});

test('the newest copy of the game wins, installed or fetched', async () => {
  const data = tmp();
  const cache = path.join(data, 'cache');
  const lib = path.join(data, 'libraries', 'com', 'mojang', 'minecraft');
  await makeJar(path.join(lib, '1.20.1', 'minecraft-1.20.1-client.jar'), ['block/dirt']);
  await makeJar(path.join(cache, 'client-1.21.10.jar'), ['block/dirt']);
  const mc = new McAssets({ dataDir: () => data, cacheDir: cache, allowDownload: false });
  assert.match((await mc.textures(['block/dirt'])).source, /client-1\.21\.10\.jar/);
  await makeJar(path.join(lib, '1.21.10', 'minecraft-1.21.10-client.jar'), ['block/dirt']);
  assert.match((await mc.textures(['block/dirt'])).source, /minecraft-1\.21\.10-client\.jar/, 'the installed game first for the same version');
  await mc.saving;
});

test('only a game from before 1.13: its pictures meanwhile, and the latest release is fetched', async () => {
  const data = tmp();
  const cache = path.join(data, 'cache');
  const lib = path.join(data, 'libraries', 'com', 'mojang', 'minecraft');
  await makeJar(path.join(lib, '1.8.9', 'minecraft-1.8.9-client.jar'), ['blocks/grass_top', 'gui/title/minecraft']);
  const jar = path.join(tmp(), 'served.jar');
  await makeJar(jar, ['block/grass_block_top', 'gui/title/minecraft']);
  const events = [];
  let release;
  const served = new Promise((resolve) => (release = resolve)); // the download ends when the test says so
  const http = {
    getJson: async (url) => (/version_manifest/.test(url) ? { latest: { release: '26.2' }, versions: [{ id: '26.2', url: 'https://meta.example/26.2.json' }] } : { downloads: { client: { url: 'https://data.example/client.jar' } } }),
    download: async (url, dest) => {
      await served;
      fs.copyFileSync(jar, dest);
    },
  };
  const mc = new McAssets({ dataDir: () => data, cacheDir: cache, http, emit: (c, p) => events.push([c, p]) });
  const first = await mc.textures(['block/grass_block_top', 'gui/title/minecraft']);
  assert.match(first.source, /1\.8\.9-client\.jar/);
  assert.deepEqual(Object.keys(first.textures), ['gui/title/minecraft']);
  assert.deepEqual({ active: mc.status().active, ready: mc.status().ready }, { active: true, ready: false }, 'not ready with an old game alone');
  release();
  await mc.downloading;
  assert.equal(events.filter(([c]) => c === 'mc:assets').length, 1);
  assert.equal(mc.status().ready, true);
  const second = await mc.textures(['block/grass_block_top', 'gui/title/minecraft']);
  assert.match(second.source, /client-26\.2\.jar/);
  assert.deepEqual(Object.keys(second.textures).sort(), ['block/grass_block_top', 'gui/title/minecraft']);
  clearTimeout(mc.retryTimer);
  await mc.saving;
});

test('a folder of extracted assets works too (either layout)', async () => {
  for (const sub of [['assets', 'minecraft', 'textures'], ['textures']]) {
    const dir = tmp();
    fs.mkdirSync(path.join(dir, ...sub, 'block'), { recursive: true });
    fs.writeFileSync(path.join(dir, ...sub, 'block', 'dirt.png'), PNG);
    process.env.HAVIHUB_MC_ASSETS = dir;
    const mc = new McAssets({ dataDir: () => tmp(), cacheDir: tmp(), allowDownload: false });
    const r = await mc.textures(['block/dirt', 'block/stone']);
    delete process.env.HAVIHUB_MC_ASSETS;
    assert.deepEqual(Object.keys(r.textures), ['block/dirt']);
  }
});

test('no game yet: nothing now, the client .jar is fetched once from Mojang and announced', async () => {
  const data = tmp();
  const cache = path.join(data, 'cache');
  const jar = path.join(tmp(), 'served.jar');
  await makeJar(jar, ['block/dirt', 'item/apple']);
  const asked = [];
  const events = [];
  const http = {
    getJson: async (url) => {
      asked.push(url);
      if (/version_manifest/.test(url)) return { latest: { release: '26.2' }, versions: [{ id: '26.2', url: 'https://meta.example/26.2.json' }] };
      return { downloads: { client: { url: 'https://data.example/client.jar' } } };
    },
    download: async (url, dest) => {
      asked.push(url);
      fs.copyFileSync(jar, dest);
    },
  };
  const mc = new McAssets({ dataDir: () => data, cacheDir: cache, http, emit: (c, p) => events.push([c, p]) });
  const first = await mc.textures(['block/dirt']);
  assert.equal(first.source, null);
  assert.deepEqual(first.textures, {});
  await mc.downloading;
  assert.deepEqual(asked, ['https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', 'https://meta.example/26.2.json', 'https://data.example/client.jar']);
  const announced = events.filter(([c]) => c === 'mc:assets');
  assert.equal(announced.length, 1);
  const progress = events.filter(([c]) => c === 'mc:fetch').map(([, p]) => p);
  assert.equal(progress[0].active, true, 'the download is announced when it starts');
  assert.deepEqual({ active: progress.at(-1).active, ready: progress.at(-1).ready, error: progress.at(-1).error }, { active: false, ready: true, error: null });
  const second = await mc.textures(['block/dirt', 'item/apple']);
  assert.match(second.source, /client-26\.2\.jar/);
  assert.equal(Object.keys(second.textures).length, 2);
});

test('offline: no textures and no error', async () => {
  const http = { getJson: async () => { throw new Error('offline'); } };
  const mc = new McAssets({ dataDir: () => tmp(), cacheDir: tmp(), http });
  assert.deepEqual((await mc.textures(['block/dirt'])).textures, {});
  await mc.downloading;
  assert.deepEqual({ ...mc.status() }, { active: false, received: 0, total: 0, error: 'offline', ready: false, canFetch: true });
});

test('a failed download waits before trying alone again, but can be retried at once', async () => {
  let online = false;
  const data = tmp();
  const jar = path.join(tmp(), 'served.jar');
  await makeJar(jar, ['block/dirt']);
  const http = {
    getJson: async (url) => {
      if (!online) throw new Error('offline');
      if (/version_manifest/.test(url)) return { latest: { release: '26.2' }, versions: [{ id: '26.2', url: 'https://meta.example/26.2.json' }] };
      return { downloads: { client: { url: 'https://data.example/client.jar', size: 1234 } } };
    },
    download: async (url, dest, opts) => {
      opts.onProgress(600, 1234);
      fs.copyFileSync(jar, dest);
    },
  };
  const mc = new McAssets({ dataDir: () => data, cacheDir: path.join(data, 'cache'), http });
  await mc.textures(['block/dirt']);
  await mc.downloading;
  assert.equal(mc.status().error, 'offline');
  online = true;
  const again = mc.fetchLatest();
  await again;
  assert.equal(mc.status().ready, false, 'without force, the failed try is not repeated yet');
  await mc.fetchLatest({ force: true });
  assert.deepEqual({ active: mc.status().active, ready: mc.status().ready, error: mc.status().error, total: mc.status().total }, { active: false, ready: true, error: null, total: 1234 });
  assert.match((await mc.textures(['block/dirt'])).source, /client-26\.2\.jar/);
  clearTimeout(mc.retryTimer);
});

test('what was read from the game is kept on disk: the next start does not open the .jar again', async () => {
  const data = tmp();
  const cacheDir = path.join(data, 'cache');
  const jar = path.join(data, 'libraries', 'com', 'mojang', 'minecraft', '26.2', 'minecraft-26.2-client.jar');
  await makeJar(jar, ['block/dirt', 'item/mace']);
  const first = new McAssets({ dataDir: () => data, cacheDir, allowDownload: false });
  const a = await first.textures(['block/dirt', 'item/nope']);
  await first.saving;
  // a new start
  const second = new McAssets({ dataDir: () => data, cacheDir, allowDownload: false });
  let reads = 0;
  const readFrom = second.readFrom.bind(second);
  second.readFrom = (...args) => {
    reads++;
    return readFrom(...args);
  };
  const b = await second.textures(['block/dirt', 'item/nope']);
  assert.equal(reads, 0);
  assert.deepEqual(b, a);
  // a texture not asked for before is read (and that one only)
  const c = await second.textures(['block/dirt', 'item/mace']);
  assert.equal(reads, 1);
  assert.deepEqual(Object.keys(c.textures).sort(), ['block/dirt', 'item/mace']);
  await second.saving;
  // another game file (an update): what was kept is not used for it
  await makeJar(jar, ['block/dirt', 'item/mace', 'block/stone']);
  fs.appendFileSync(jar, Buffer.alloc(0));
  const third = new McAssets({ dataDir: () => data, cacheDir, allowDownload: false });
  third.readFrom = (...args) => {
    reads++;
    return McAssets.prototype.readFrom.apply(third, args);
  };
  const before = reads;
  const d = await third.textures(['block/dirt', 'block/stone']);
  if (d.source !== a.source) assert.equal(reads, before + 1);
  assert.ok(d.textures['block/dirt']);
  // a damaged file is ignored
  await third.saving;
  fs.writeFileSync(path.join(cacheDir, 'textures.json'), '{not json');
  const fourth = new McAssets({ dataDir: () => data, cacheDir, allowDownload: false });
  assert.ok((await fourth.textures(['block/dirt'])).textures['block/dirt']);
});
