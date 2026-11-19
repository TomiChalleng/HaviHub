// Integration tests for search/install/update/modpacks against the offline API mock.
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

const { PrismContext } = require('../src/main/prism/paths');
const { AppConfig } = require('../src/main/appconfig');
const { Instances } = require('../src/main/prism/instances');
const { Content, readMetadata } = require('../src/main/prism/content');
const { TaskManager } = require('../src/main/tasks');
const { Platforms } = require('../src/main/platforms/unified');
const { Modpacks } = require('../src/main/platforms/modpacks');
const { Meta } = require('../src/main/platforms/meta');
const { setKeyProvider } = require('../src/main/platforms/curseforge');
const { IniFile } = require('../src/main/util/ini');

let tmp, data, ctx, cfg, instances, content, platforms, modpacks, tasks;
let cfKey = 'test-key';
setKeyProvider(() => cfKey);

test.before(async () => {
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'havihub-plat-'));
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

test('search: modrinth, curseforge and both (deduplicated)', async () => {
  const mr = await platforms.search({ source: 'modrinth', type: 'mod', query: '' });
  assert.ok(mr.hits.length > 5);
  assert.ok(mr.hits.every((h) => h.source === 'modrinth'));
  const cf = await platforms.search({ source: 'curseforge', type: 'mod' });
  assert.ok(cf.hits.every((h) => h.source === 'curseforge'));
  const both = await platforms.search({ source: 'both', type: 'mod', limit: 40 });
  const sodium = both.hits.filter((h) => h.title === 'Sodium');
  assert.equal(sodium.length, 1, 'Sodium appears once');
  // CurseForge copy was updated 1 day ago vs 6 days on Modrinth -> CurseForge wins
  assert.equal(sodium[0].source, 'curseforge');
  assert.equal(sodium[0].alsoOn.source, 'modrinth');
  const fapi = both.hits.filter((h) => h.title === 'Fabric API');
  assert.equal(fapi.length, 1);
  assert.equal(fapi[0].source, 'modrinth'); // 2 days vs 9 days
  assert.deepEqual(both.errors, {});
});

test('search without CurseForge key reports it but still returns Modrinth', async () => {
  cfKey = '';
  const both = await platforms.search({ source: 'both', type: 'modpack' });
  assert.equal(both.errors.curseforge.code, 'CF_NO_KEY');
  assert.ok(both.hits.length > 0);
  cfKey = 'test-key';
});

test('project details from both sources', async () => {
  const p = await platforms.project('modrinth', 'iris');
  assert.equal(p.title, 'Iris Shaders');
  assert.equal(p.bodyFormat, 'markdown');
  assert.equal(p.author, 'coderbot');
  assert.equal(p.gallery.length, 3);
  const c = await platforms.project('curseforge', '238222');
  assert.equal(c.bodyFormat, 'html');
  assert.ok(c.body.includes('<h2>'));
});

test('install a mod with its required dependency detection', async () => {
  const r = await platforms.install({ source: 'modrinth', projectId: 'gvQqBUqZ', instanceId: '26.2 Vanilla', type: 'mod', title: 'Lithium' });
  assert.equal(r.installed.length, 1, JSON.stringify(r));
  assert.equal(r.installed[0].title, 'Lithium');
  // fabric-api already installed (detected by mod id even without matching metadata)
  assert.equal(r.installed.filter((i) => i.isDep).length, 0);
  const meta = await readMetadata(path.join(data, 'instances', '26.2 Vanilla', 'minecraft', 'mods', '.index'));
  const m = [...meta.values()].find((x) => x.projectId === 'gvQqBUqZ');
  assert.ok(m);
  assert.equal(m.provider, 'modrinth');
  assert.equal(m.download['hash-format'], 'sha512');
  assert.deepEqual(m.mcVersions, ['26.2']);
  // installing again is skipped
  const again = await platforms.install({ source: 'modrinth', projectId: 'gvQqBUqZ', instanceId: '26.2 Vanilla', type: 'mod' });
  assert.equal(again.skipped.length, 1);
});

test('install into an instance without the dependency installs it too', async () => {
  const id = await instances.create({ name: 'Deps test', mcVersion: '26.2', loader: 'fabric', loaderVersion: '0.20.1' });
  const r = await platforms.install({ source: 'modrinth', projectId: 'mOgUt4GM', instanceId: id, type: 'mod', title: 'Mod Menu' });
  const titles = r.installed.map((i) => i.title).sort();
  assert.deepEqual(titles, ['Fabric API', 'Mod Menu']);
  const files = fs.readdirSync(path.join(data, 'instances', id, 'minecraft', 'mods')).filter((f) => f.endsWith('.jar'));
  assert.equal(files.length, 2);
});

test('update check and update', async () => {
  const id = await instances.create({ name: 'Update test', mcVersion: '26.2', loader: 'fabric', loaderVersion: '0.20.1' });
  const versions = mock.mrVersions(mock.MR.find((x) => x[1] === 'appleskin'), { game_versions: ['26.2'] });
  const older = versions[versions.length - 1];
  const r = await platforms.install({ source: 'modrinth', projectId: 'EsAfCjCV', versionId: older.id, instanceId: id, type: 'mod' });
  assert.equal(r.installed[0].version, older.version_number);
  const upd = await platforms.checkUpdates(id, 'mods');
  const entries = Object.entries(upd.updates);
  const apple = entries.find(([f]) => f.startsWith('appleskin'));
  assert.ok(apple, JSON.stringify(upd));
  assert.equal(apple[1].versionId, versions[0].id);
  // disable it, then update: stays disabled
  await content.setEnabled(id, 'mods', apple[0], false);
  await platforms.checkUpdates(id, 'mods');
  const all = await platforms.updateAll(id, 'mods');
  assert.ok(all.installed.some((i) => i.title === 'AppleSkin'));
  const files = fs.readdirSync(path.join(data, 'instances', id, 'minecraft', 'mods'));
  assert.ok(files.some((f) => f.startsWith('appleskin-1.4.0') && f.endsWith('.disabled')), files.join(','));
  assert.ok(!files.some((f) => f.startsWith('appleskin-1.3.0')));
});

test('curseforge install with blocked file reported', async () => {
  const id = await instances.create({ name: 'CF test', mcVersion: '26.2', loader: 'fabric', loaderVersion: '0.20.1' });
  const ok = await platforms.install({ source: 'curseforge', projectId: '238222', instanceId: id, type: 'mod' });
  assert.equal(ok.installed.length, 1);
  const meta = await readMetadata(path.join(data, 'instances', id, 'minecraft', 'mods', '.index'));
  assert.equal([...meta.values()][0].provider, 'curseforge');
  const blocked = await platforms.install({ source: 'curseforge', projectId: '711228', instanceId: id, type: 'mod' });
  assert.equal(blocked.blocked.length, 1);
  assert.ok(blocked.blocked[0].url.includes('curseforge.com'));
});

test('curseforge world goes into saves (twice = two worlds)', async () => {
  const id = await instances.create({ name: 'World test', mcVersion: '26.2' });
  const r = await platforms.install({ source: 'curseforge', projectId: '530100', instanceId: id, type: 'world', title: 'SkyBlock Clásico' });
  assert.deepEqual(r.failed, []);
  assert.equal(r.installed.length, 1);
  const saves = path.join(data, 'instances', id, 'minecraft', 'saves');
  assert.ok(fs.existsSync(path.join(saves, r.installed[0].fileName, 'level.dat')));
  assert.ok(fs.existsSync(path.join(saves, r.installed[0].fileName, 'region', 'r.0.0.mca')));
  const r2 = await platforms.install({ source: 'curseforge', projectId: '530100', instanceId: id, type: 'world' });
  assert.notEqual(r2.installed[0].fileName, r.installed[0].fileName, 'a second copy, never over the first');
  const { Worlds } = require('../src/main/prism/worlds');
  const list = await new Worlds(instances).list(id);
  assert.equal(list.filter((w) => w.levelName === 'SkyBlock Clásico').length, 2);
  await assert.rejects(platforms.install({ source: 'modrinth', projectId: 'x', instanceId: id, type: 'world' }));
});

test('install Modrinth modpack creates a managed instance', async () => {
  const r = await modpacks.install({ source: 'modrinth', projectId: '1KVo5zza', name: 'Fabulously Optimized', group: 'Packs', icon: null });
  const inst = await instances.get(r.id);
  assert.equal(inst.mcVersion, '26.2');
  assert.equal(inst.loader.id, 'fabric');
  assert.equal(inst.group, 'Packs');
  assert.equal(inst.managed.type, 'modrinth');
  assert.equal(inst.managed.id, '1KVo5zza');
  const mods = fs.readdirSync(path.join(inst.gameDir, 'mods'));
  assert.equal(mods.length, 3);
  assert.ok(fs.existsSync(path.join(inst.gameDir, 'config', 'sample.json5')));
  // overrides options.txt wins over defaults
  assert.match(fs.readFileSync(path.join(inst.gameDir, 'options.txt'), 'utf8'), /renderDistance:12/);
});

test('install CurseForge modpack resolves files and reports blocked ones', async () => {
  const r = await modpacks.install({ source: 'curseforge', projectId: '925200', name: 'All the Mods 10' });
  const inst = await instances.get(r.id);
  assert.equal(inst.mcVersion, '1.21.1');
  assert.equal(inst.loader.id, 'neoforge');
  assert.equal(inst.loader.version, '21.1.200');
  assert.equal(inst.managed.type, 'flame');
  assert.equal(r.blocked.length, 1);
  const mods = fs.readdirSync(path.join(inst.gameDir, 'mods')).filter((f) => f.endsWith('.jar'));
  assert.equal(mods.length, 1);
  assert.ok(fs.existsSync(path.join(inst.gameDir, 'config', 'pack.toml')));
});

test('export mrpack and re-import it', async () => {
  const src = (await instances.list()).instances.find((i) => i.name === 'Fabulously Optimized');
  const dest = path.join(tmp, 'fo.mrpack');
  await modpacks.exportMrpack(src.id, dest, { name: 'FO export' });
  const r = await modpacks.importArchive(dest, {});
  const inst = await instances.get(r.id);
  assert.equal(inst.name, 'FO export');
  assert.equal(fs.readdirSync(path.join(inst.gameDir, 'mods')).filter((f) => f.endsWith('.jar')).length, 3);
  // prism zip export/import
  const zipDest = path.join(tmp, 'inst.zip');
  await modpacks.exportZip('26.2 Vanilla', zipDest, { includeWorlds: false });
  const r2 = await modpacks.importArchive(zipDest, { group: 'Importadas' });
  const i2 = await instances.get(r2.id);
  assert.equal(i2.group, 'Importadas');
  assert.ok(!fs.existsSync(path.join(i2.gameDir, 'saves')));
  const cfgFile = await IniFile.load(path.join(i2.root, 'instance.cfg'));
  assert.equal(cfgFile.get('uuid', ''), '');
});

test('meta: versions and loaders from Prism meta', async () => {
  const meta = new Meta(path.join(tmp, 'cache'), () => '');
  const mc = await meta.minecraftVersions();
  assert.ok(mc.find((v) => v.version === '26.2' && v.type === 'release'));
  const fabric = await meta.loaderVersions('fabric', '26.2');
  assert.ok(fabric.length > 10);
  assert.ok(fabric.some((v) => v.recommended));
  const neo = await meta.loaderVersions('neoforge', '26.3');
  assert.ok(neo.length > 0);
  assert.ok(neo.every((v) => v.version.startsWith('26.3')));
  const loaders = await meta.loadersFor('26.2');
  assert.ok(loaders.includes('fabric'));
});
