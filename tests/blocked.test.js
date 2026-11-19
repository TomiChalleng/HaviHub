// CurseForge files their authors only hand out from CurseForge's own page (platforms/blocked.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const http = require('../src/main/util/http');
const mock = require('../scripts/mock-net.cjs');
http.setFetch(mock.fetch);
const blocked = require('../src/main/platforms/blocked');

const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const BYTES = Buffer.from('the real jar of the mod');
const entryFor = (name = 'cool-mod-1.0.jar', bytes = BYTES) => ({ key: `10:${name}`, title: 'Cool Mod', fileName: name, page: 'https://www.curseforge.com/minecraft/mc-mods/cool-mod/download/20', sha1: sha1(bytes), size: bytes.length, resume: { kind: 'content', args: {} } });

// what a browser window gives the app when a page starts a download
function fakeItem(name, bytes, result = 'completed') {
  const item = new EventEmitter();
  item.getFilename = () => name;
  item.getTotalBytes = () => bytes.length;
  item.getReceivedBytes = () => bytes.length;
  item.cancel = () => {
    item.cancelled = true;
  };
  item.setSavePath = (p) => {
    setTimeout(() => {
      fs.writeFileSync(p, bytes);
      item.emit('updated');
      item.emit('done', {}, result);
    }, 20);
  };
  return item;
}

async function setup(pageBehavior) {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'havihub-blocked-test-'));
  const downloads = path.join(tmp, 'Downloads');
  await fsp.mkdir(downloads);
  const log = { loaded: [], external: [], completed: [], closed: 0, statuses: [] };
  const bd = new blocked.BlockedDownloads({
    pollMs: 40,
    downloadsDir: () => downloads,
    emit: (ch, s) => log.statuses.push(s.items.map((i) => i.state).join(',')),
    openExternal: (url) => log.external.push(url),
    complete: async (entry) => {
      const url = await blocked.alternativeUrl({ projectId: entry.key.split(':')[0], id: entry.key.split(':')[1] }, { hashes: {} });
      log.completed.push({ key: entry.key, bytes: fs.readFileSync(new URL(url)) });
    },
    openBrowser: ({ onDownload, onClosed }) => ({
      load: (url) => {
        log.loaded.push(url);
        pageBehavior({ url, onDownload, onClosed });
      },
      setTitle: () => {},
      close: () => {
        log.closed++;
      },
    }),
  });
  return { bd, log, downloads, tmp, done: () => fsp.rm(tmp, { recursive: true, force: true }) };
}

test('the download started by CurseForge\'s page is taken and installed; other files are ignored', async () => {
  const a = entryFor('a-1.0.jar', Buffer.from('file a'));
  const b = entryFor('b-1.0.jar', Buffer.from('file b'));
  const t = await setup(({ url, onDownload }) => {
    // an unrelated download first (wrong content), then the real one
    onDownload(fakeItem('ad-installer.exe', Buffer.from('nope')));
    setTimeout(() => onDownload(fakeItem(url.includes('/20') ? 'x.jar' : 'y.jar', log.loaded.length === 1 ? Buffer.from('file a') : Buffer.from('file b'))), 60);
  });
  const { log } = t;
  try {
    b.page = b.page.replace('/20', '/21');
    const r = await t.bd.resolve([a, b], 'window');
    assert.deepEqual(r.done.map((e) => e.key), [a.key, b.key]);
    assert.equal(r.pending.length, 0);
    assert.deepEqual(log.loaded, [a.page, b.page], 'one page after the other, in the same window');
    assert.deepEqual(log.completed.map((c) => c.bytes.toString()), ['file a', 'file b']);
    assert.equal(log.closed, 1, 'the window closes when everything is in');
    assert.match(log.statuses.join(' '), /downloading/);
    assert.match(log.statuses.at(-1), /^done,done$/);
    assert.equal(await blocked.alternativeUrl({ projectId: '10', id: 'a-1.0.jar' }, { hashes: {} }), null, 'nothing is kept after installing');
  } finally {
    await t.done();
  }
});

test('a file already in Downloads (even as "name (1).jar") needs no page at all', async () => {
  const e = entryFor();
  const t = await setup(() => assert.fail('no page should be opened'));
  try {
    fs.writeFileSync(path.join(t.downloads, 'cool-mod-1.0.jar'), 'an older, different file');
    fs.writeFileSync(path.join(t.downloads, 'cool-mod-1.0 (1).jar'), BYTES);
    const r = await t.bd.resolve([e], 'window');
    assert.equal(r.done.length, 1);
    assert.equal(t.log.completed[0].bytes.toString(), BYTES.toString());
    assert.deepEqual(t.log.loaded, []);
  } finally {
    await t.done();
  }
});

test('with their own browser: the page opens there and the Downloads folder is watched', async () => {
  const e = entryFor();
  const t = await setup(() => assert.fail('the window is not used in this mode'));
  try {
    const p = t.bd.resolve([e], 'browser');
    await new Promise((r) => setTimeout(r, 120));
    assert.deepEqual(t.log.external, [e.page]);
    fs.writeFileSync(path.join(t.downloads, 'cool-mod-1.0.jar.crdownload'), BYTES); // still downloading: not taken
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(t.log.completed.length, 0);
    fs.renameSync(path.join(t.downloads, 'cool-mod-1.0.jar.crdownload'), path.join(t.downloads, 'cool-mod-1.0.jar'));
    const r = await p;
    assert.equal(r.done.length, 1);
  } finally {
    await t.done();
  }
});

test('closing the window or stopping leaves the rest pending', async () => {
  const a = entryFor('a-1.0.jar', Buffer.from('file a'));
  const b = entryFor('b-1.0.jar', Buffer.from('file b'));
  const c = { ...entryFor('c-1.0.jar', Buffer.from('file c')), page: '' }; // no page known: can't be automated
  const t = await setup(({ onDownload, onClosed }) => {
    if (t.log.loaded.length === 1) onDownload(fakeItem('a-1.0.jar', Buffer.from('file a')));
    else setTimeout(onClosed, 30); // the person closes the window on the second file
  });
  try {
    const r = await t.bd.resolve([c, a, b], 'window');
    assert.deepEqual(r.done.map((e) => e.key), [a.key]);
    assert.deepEqual(r.pending.map((e) => e.key).sort(), [b.key, c.key].sort());
    assert.match(t.log.statuses.at(-1), /^pending,done,pending$/);
  } finally {
    await t.done();
  }
});

test('the same file published on Modrinth is taken from there', async () => {
  const mr = mock.mrVersions(mock.MR.find((x) => x[1] === 'sodium'), { game_versions: ['26.2'] })[0];
  const file = mr.files[0];
  const url = await blocked.alternativeUrl({ projectId: '1', id: '2' }, { hashes: { sha1: file.hashes.sha1 } });
  assert.equal(url, file.url);
  assert.equal(await blocked.alternativeUrl({ projectId: '1', id: '2' }, { hashes: { sha1: 'f'.repeat(40) } }), null);
  assert.equal(await blocked.alternativeUrl({ projectId: '1', id: '2' }, { hashes: {} }), null);
});

test('the entry points at CurseForge\'s own download page', () => {
  const e = blocked.blockedEntry({ version: { projectId: '238222', id: '5846880' }, file: { filename: 'jei.jar', hashes: { sha1: 'abc' }, size: 5 }, mod: { url: 'https://www.curseforge.com/minecraft/mc-mods/jei' }, title: 'JEI', folder: '/x/mods', resume: { kind: 'content' } });
  assert.equal(e.page, 'https://www.curseforge.com/minecraft/mc-mods/jei/download/5846880');
  assert.equal(e.url, 'https://www.curseforge.com/minecraft/mc-mods/jei/files/5846880');
  assert.equal(e.key, '238222:5846880');
  assert.equal(blocked.blockedEntry({ version: { projectId: '1', id: '2' }, file: { filename: 'a.jar', hashes: {} }, mod: null, folder: '/x' }).page, '');
});
