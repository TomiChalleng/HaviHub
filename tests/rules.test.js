// Compatibility rules, cancellable tasks, text limits, offline
// accounts, .desktop escaping, switching versions and the CurseForge export.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const http = require('../src/main/util/http');
const mock = require('../scripts/mock-net.cjs');
http.setFetch(mock.fetch);

const compat = require('../src/shared/compat');
const { cleanText, LIMITS } = require('../src/shared/limits');
const { TaskManager } = require('../src/main/tasks');
const { currentSignal, throwIfCancelled } = require('../src/main/util/cancel');
const { offlineUuid } = require('../src/main/prism/accounts');
const shortcuts = require('../src/main/prism/shortcuts');
const { PrismContext } = require('../src/main/prism/paths');
const { AppConfig } = require('../src/main/appconfig');
const { Instances } = require('../src/main/prism/instances');
const { Content } = require('../src/main/prism/content');
const { Platforms } = require('../src/main/platforms/unified');
const { Modpacks } = require('../src/main/platforms/modpacks');
const { setKeyProvider } = require('../src/main/platforms/curseforge');
const zip = require('../src/main/util/zip');

setKeyProvider(() => 'test-key');

// ------------------------------------------------------------------ compat
const vanilla = { mcVersion: '1.21.8', loader: null };
const fabric = { mcVersion: '26.2', loader: { id: 'fabric', version: '0.17' } };
const quilt = { mcVersion: '1.21.1', loader: { id: 'quilt', version: '0.26' } };
const neo1201 = { mcVersion: '1.20.1', loader: { id: 'neoforge', version: '47.1' } };

test('compat: a vanilla profile offers no mods or shaders', () => {
  assert.deepEqual(compat.typesFor(vanilla), ['resourcepack', 'datapack', 'world']);
  assert.deepEqual(compat.typesFor(fabric), ['mod', 'shader', 'resourcepack', 'datapack', 'world']);
  assert.equal(compat.typeAllowed(vanilla, 'mod'), false);
  assert.equal(compat.typeAllowed(vanilla, 'shader'), false);
  assert.equal(compat.typeAllowed(vanilla, 'resourcepack'), true);
});

test('compat: mods need the exact version and a loader that runs them', () => {
  const ok = { gameVersions: ['26.2'], loaders: ['fabric'] };
  assert.equal(compat.versionCompatible(ok, fabric, 'mod'), true);
  assert.equal(compat.versionCompatible({ gameVersions: ['26.1'], loaders: ['fabric'] }, fabric, 'mod'), false);
  assert.equal(compat.versionCompatible({ gameVersions: ['26.2'], loaders: ['forge'] }, fabric, 'mod'), false);
  assert.equal(compat.versionCompatible(ok, vanilla, 'mod'), false);
  // quilt runs fabric mods; neoforge 1.20.1 runs forge mods
  assert.equal(compat.versionCompatible({ gameVersions: ['1.21.1'], loaders: ['fabric'] }, quilt, 'mod'), true);
  assert.equal(compat.versionCompatible({ gameVersions: ['1.20.1'], loaders: ['forge'] }, neo1201, 'mod'), true);
  const f = compat.searchFiltersFor(fabric, 'mod');
  assert.equal(f.gameVersion, '26.2');
  assert.deepEqual(f.loaders, ['fabric']);
  // these are the filters a profile starts with, and they can be removed
  assert.equal(f.locked, undefined);
  // what can't go in is refused (and explained) instead
  assert.equal(compat.compatIssue({ gameVersions: ['26.2'], loaders: ['fabric'] }, vanilla, 'mod').code, 'vanilla');
  assert.equal(compat.compatIssue({ gameVersions: ['26.1'], loaders: ['fabric'] }, fabric, 'mod').code, 'version-loader');
  assert.equal(compat.compatIssue(ok, fabric, 'mod'), null);
});

test('compat: data packs by version, shaders by loader, resource packs anywhere, maps up to the profile', () => {
  assert.equal(compat.versionCompatible({ gameVersions: ['1.21.8'] }, vanilla, 'datapack'), true);
  assert.equal(compat.versionCompatible({ gameVersions: ['1.20.1'] }, vanilla, 'datapack'), false);
  assert.equal(compat.versionCompatible({ gameVersions: ['1.12.2'] }, fabric, 'shader'), true);
  assert.equal(compat.versionCompatible({ gameVersions: ['1.12.2'] }, vanilla, 'shader'), false);
  assert.equal(compat.versionCompatible({ gameVersions: ['1.8.9'] }, vanilla, 'resourcepack'), true);
  assert.equal(compat.versionCompatible({ gameVersions: ['1.20.1'] }, vanilla, 'world'), true);
  assert.equal(compat.versionCompatible({ gameVersions: ['26.1'] }, vanilla, 'world'), false);
  assert.equal(compat.versionCompatible({ gameVersions: ['1.21.8'] }, vanilla, 'world'), true);
  assert.ok(compat.cmpVersion('1.20.4', '1.21') < 0);
  assert.ok(compat.cmpVersion('26.1', '1.21.8') > 0);
  assert.equal(compat.cmpVersion('1.21', '1.21.0'), 0);
});

// ------------------------------------------------------------------ text limits
test('limits: long or broken names are cleaned and cut', () => {
  assert.equal(cleanText('  Mi\u0000 perfil\n\tnuevo\u2028 '), 'Mi perfil nuevo');
  const huge = 'a'.repeat(5_000_000);
  assert.equal(cleanText(huge, LIMITS.instanceName).length, LIMITS.instanceName);
  // emoji count as one character and are never cut in half
  const emoji = '😀'.repeat(70);
  const cut = cleanText(emoji, LIMITS.instanceName);
  assert.equal(Array.from(cut).length, LIMITS.instanceName);
  assert.ok(!/[\ud800-\udbff]$/.test(cut));
  assert.equal(cleanText(null), '');
});

// ------------------------------------------------------------------ tasks
test('tasks: cancelling stops the work, runs its cleanups and marks it cancelled', async () => {
  const events = [];
  const tm = new TaskManager((ch, list) => events.push(list));
  let cleaned = false;
  let sawSignal = null;
  const work = tm.run('Descarga larga', { kind: 'modpack' }, async (task) => {
    task.onCancel(() => {
      cleaned = true;
    });
    sawSignal = currentSignal();
    for (;;) {
      await new Promise((r) => setTimeout(r, 10));
      throwIfCancelled();
    }
  });
  await new Promise((r) => setTimeout(r, 30));
  const [running] = tm.running();
  assert.equal(running.title, 'Descarga larga');
  assert.equal(await tm.cancel(running.id), true);
  await assert.rejects(work, (e) => e.code === 'CANCELLED');
  assert.ok(sawSignal && sawSignal.aborted, 'the work saw the task signal');
  assert.ok(cleaned, 'cleanup ran');
  assert.equal(tm.list()[0].status, 'cancelled');
  assert.equal(tm.running().length, 0);
});

test('tasks: work that must not stop half way is never cancelled', async () => {
  const tm = new TaskManager(() => {});
  let finish;
  const work = tm.run('Moviendo perfiles', { kind: 'sync', cancelable: false }, () => new Promise((r) => (finish = r)));
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(await tm.cancelAll(), 0);
  const [t] = tm.running();
  assert.equal(await tm.cancel(t.id), false);
  let waited = false;
  const wait = tm.waitForUncancelable().then(() => (waited = true));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(waited, false);
  finish('ok');
  assert.equal(await work, 'ok');
  await wait;
  assert.equal(tm.list()[0].status, 'done');
});

test('tasks: a cancelled task stops its downloads', async () => {
  const tm = new TaskManager(() => {});
  const realFetch = mock.fetch;
  http.setFetch((url, opts) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(realFetch(url, opts)), 5000);
    if (opts && opts.signal) opts.signal.addEventListener('abort', () => {
      clearTimeout(timer);
      const e = new Error('aborted');
      e.name = 'AbortError';
      reject(e);
    });
  }));
  try {
    const work = tm.run('Buscando', {}, () => http.getJson('https://api.modrinth.com/v2/search?query=sodium'));
    await new Promise((r) => setTimeout(r, 20));
    const started = Date.now();
    await tm.cancel(tm.running()[0].id);
    await assert.rejects(work, (e) => e.code === 'CANCELLED' || e.name === 'AbortError');
    assert.ok(Date.now() - started < 2000, 'the request ended right away');
  } finally {
    http.setFetch(mock.fetch);
  }
});

// ------------------------------------------------------------------ offline accounts
test('offline accounts use the same UUID as the game (OfflinePlayer:name)', () => {
  assert.equal(offlineUuid('Notch'), 'b50ad385829d3141a2167e7d7539ba7f');
  assert.match(offlineUuid('Perro_99'), /^[0-9a-f]{12}3[0-9a-f]{3}[89ab][0-9a-f]{15}$/);
  assert.notEqual(offlineUuid('a'), offlineUuid('A'));
});

// ------------------------------------------------------------------ .desktop files
test('desktop entries quote and escape every argument', () => {
  assert.equal(shortcuts.desktopArg('havihub'), 'havihub');
  assert.equal(shortcuts.desktopArg('/home/u/Havi Hub.AppImage'), '"/home/u/Havi Hub.AppImage"');
  assert.equal(shortcuts.desktopArg('100%'), '100%%');
  // $ ` " get a backslash, then every backslash is doubled (key-file escape)
  assert.equal(shortcuts.desktopArg('a$b'), '"a\\\\$b"');
  assert.equal(shortcuts.desktopArg('say "hi"'), '"say \\\\"hi\\\\""');
  assert.equal(shortcuts.desktopArg('C:\\x'), '"C:\\\\\\\\x"');
  assert.equal(shortcuts.desktopArg(''), '""');
  const entry = shortcuts.desktopEntry({ name: 'Mi\nperfil', comment: 'Jugar', exec: 'havihub --launch x', icon: '/tmp/i.png' });
  assert.match(entry, /^\[Desktop Entry\]\n/);
  assert.match(entry, /\nName=Mi\\nperfil\n/);
  assert.match(entry, /\nExec=havihub --launch x\n/);
});

// ------------------------------------------------------------------ platforms
let tmp, data, ctx, cfg, instances, content, platforms, modpacks, tasks;

test.before(async () => {
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'havihub-rules-'));
  data = path.join(tmp, 'PrismLauncher');
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-fixtures.mjs'), data]);
  ctx = new PrismContext(data, null);
  cfg = new AppConfig(path.join(tmp, 'ud'));
  await cfg.load();
  tasks = new TaskManager(() => {});
  instances = new Instances(ctx, cfg);
  content = new Content(instances, path.join(tmp, 'cache'));
  platforms = new Platforms({ instances, content, tasks, appConfig: cfg, emit: () => {} });
  modpacks = new Modpacks({ ctxProvider: () => ctx, instances, tasks, appConfig: cfg, emit: () => {} });
});

test.after(() => fsp.rm(tmp, { recursive: true, force: true }));

test('updating remembers the version used before, and switching goes back to it', async () => {
  const id = await instances.create({ name: 'Switch test', mcVersion: '26.2', loader: 'fabric', loaderVersion: '0.20.1' });
  const versions = mock.mrVersions(mock.MR.find((x) => x[1] === 'appleskin'), { game_versions: ['26.2'] });
  const older = versions[versions.length - 1];
  await platforms.install({ source: 'modrinth', projectId: 'EsAfCjCV', versionId: older.id, instanceId: id, type: 'mod' });
  await platforms.checkUpdates(id, 'mods');
  await platforms.updateAll(id, 'mods');
  const prev = await platforms.previousVersions(id);
  const entry = Object.entries(prev).find(([k]) => k.startsWith('modrinth:'));
  assert.ok(entry, JSON.stringify(prev));
  assert.equal(entry[1].versionId, older.id);
  assert.equal(entry[1].reason, 'update');
  // the version list for the installed file, newest first, with the current one marked
  const fileName = fs.readdirSync(path.join(data, 'instances', id, 'minecraft', 'mods')).find((f) => f.startsWith('appleskin'));
  const list = await platforms.versionsFor(id, 'mods', fileName);
  assert.ok(list.versions.length >= 2, JSON.stringify(list).slice(0, 300));
  assert.ok(list.versions.every((v) => compat.versionCompatible(v, { mcVersion: '26.2', loader: { id: 'fabric' } }, 'mod')));
  // back to the old one
  const target = list.versions.find((v) => v.id === older.id);
  assert.ok(target);
  await platforms.switchVersion(id, 'mods', fileName, { source: list.source, projectId: list.projectId, versionId: target.id });
  const files = fs.readdirSync(path.join(data, 'instances', id, 'minecraft', 'mods'));
  assert.ok(files.some((f) => f.startsWith(`appleskin-${older.version_number}`)), files.join(','));
  assert.equal(files.filter((f) => f.startsWith('appleskin')).length, 1, files.join(','));
});

test('export as a CurseForge zip: manifest with the CurseForge files, the rest in overrides', async () => {
  const dest = path.join(tmp, 'vanilla-cf.zip');
  await modpacks.exportCurseZip('26.2 Vanilla', dest, { name: 'Mi pack', version: '2.0', author: 'Havikun' });
  const names = await zip.listEntries(dest);
  assert.ok(names.includes('manifest.json'));
  assert.ok(names.includes('modlist.html'));
  const manifest = JSON.parse((await zip.readEntry(dest, 'manifest.json')).toString('utf8'));
  assert.equal(manifest.manifestType, 'minecraftModpack');
  assert.equal(manifest.manifestVersion, 1);
  assert.equal(manifest.name, 'Mi pack');
  assert.equal(manifest.version, '2.0');
  assert.equal(manifest.author, 'Havikun');
  assert.equal(manifest.minecraft.version, '26.2');
  assert.match(manifest.minecraft.modLoaders[0].id, /^fabric-/);
  assert.equal(manifest.minecraft.modLoaders[0].primary, true);
  assert.equal(manifest.overrides, 'overrides');
  const clumps = manifest.files.find((f) => f.projectID === 256717);
  assert.deepEqual(clumps, { projectID: 256717, fileID: 5551234, required: true });
  // a CurseForge file is listed, not copied; everything else travels in overrides
  assert.ok(!names.some((n) => /^overrides\/mods\/Clumps/i.test(n)), names.filter((n) => n.includes('mods/')).join(','));
  assert.ok(names.some((n) => n.startsWith('overrides/mods/')), 'other mods are in overrides');
  assert.ok(!names.some((n) => n.startsWith('overrides/saves/')), 'no worlds unless asked');
  assert.ok(!names.some((n) => n.includes('/.index/') || n.endsWith('.pw.toml')));
  const modlist = (await zip.readEntry(dest, 'modlist.html')).toString('utf8');
  assert.match(modlist, /curseforge\.com\/projects\/256717/);
});
