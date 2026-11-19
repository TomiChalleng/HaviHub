// Profiles synced between Havi Hub, CurseForge and the Modrinth App: one
// shared folder, links from every launcher, nothing lost when joining or
// leaving.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const { Importer } = require('../src/main/importer');
const { PrismContext } = require('../src/main/prism/paths');
const { AppConfig } = require('../src/main/appconfig');
const { Instances } = require('../src/main/prism/instances');
const { TaskManager } = require('../src/main/tasks');
const { SyncManager, linkTarget } = require('../src/main/sync');

let tmp;
let sync;
let ctx;
let cfg;
let cfDir;
let mrDir;

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s);
};

test.before(async () => {
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'havihub-sync-test-'));
  const fx = path.join(tmp, 'fx');
  execFileSync(process.execPath, ['--no-warnings', path.join(ROOT, 'scripts', 'make-import-fixtures.mjs'), fx]);
  const cfInstances = path.join(fx, 'curseforge', 'minecraft', 'Instances');
  // a CurseForge profile that is the same pack as the Modrinth one
  cfDir = path.join(cfInstances, 'Fabric 1.21.1');
  write(path.join(cfDir, 'minecraftinstance.json'), JSON.stringify({ name: 'Fabric 1.21.1', gameVersion: '1.21.1', baseModLoader: { name: 'fabric-0.16.5-1.21.1', minecraftVersion: '1.21.1', type: 4 }, installedAddons: [], lastPlayed: '2026-11-01T10:00:00' }));
  write(path.join(cfDir, 'mods', 'sodium-fabric-0.5.0+mc1.21.1.jar'), 'old sodium');
  write(path.join(cfDir, 'saves', 'Hardcore', 'level.dat'), 'cf hardcore');
  write(path.join(cfDir, 'saves', 'Isla', 'level.dat'), 'cf isla');
  write(path.join(cfDir, 'screenshots', 'cf.png'), 'shot');
  write(path.join(cfDir, 'options.txt'), 'fov:1');
  process.env.HAVIHUB_IMPORT_CF_DIRS = cfInstances;
  process.env.HAVIHUB_IMPORT_MR_DIRS = path.join(fx, 'ModrinthApp');
  mrDir = path.join(fx, 'ModrinthApp', 'profiles', 'Fabric 1.21.1');
  const own = path.join(tmp, 'havi');
  await fsp.mkdir(path.join(own, 'instances'), { recursive: true });
  ctx = new PrismContext(own, null);
  cfg = new AppConfig(path.join(tmp, 'ud'));
  await cfg.load();
  const tasks = new TaskManager(() => {});
  const importer = new Importer({ ctxProvider: () => ctx, appConfig: cfg, tasks, emit: () => {} });
  sync = new SyncManager({ appConfig: cfg, tasks, ctxProvider: () => ctx, importer, emit: () => {} });
  sync.running = async () => [];
});
test.after(() => fsp.rm(tmp, { recursive: true, force: true }));

test('finds the same profile in two launchers', async () => {
  const s = await sync.scan();
  assert.ok(s.profiles.some((p) => p.launcher === 'curseforge' && p.name === 'All the Mods 9'));
  assert.ok(s.profiles.some((p) => p.launcher === 'modrinth' && p.name === 'Fabric 1.21.1'));
  const sug = s.suggestions.find((x) => x.name === 'Fabric 1.21.1');
  assert.ok(sug, 'suggested match');
  assert.deepEqual(sug.profiles.map((p) => p.launcher).sort(), ['curseforge', 'modrinth']);
});

test('refuses profiles of different versions', async () => {
  const atm = path.join(path.dirname(cfDir), 'All the Mods 9');
  await assert.rejects(() => sync.link({ main: { dir: mrDir }, others: [{ dir: atm }] }), /otra versión/);
});

test('joins Modrinth and CurseForge into one folder', async () => {
  const r = await sync.link({ main: { dir: mrDir }, others: [{ dir: cfDir }] });
  const store = r.group.store;
  assert.equal(r.problems.length, 0);
  assert.equal(path.resolve(await linkTarget(mrDir)), path.resolve(store));
  assert.equal(path.resolve(await linkTarget(cfDir)), path.resolve(store));
  // the main profile's mods win; the other one's go to the backup
  assert.ok(fs.existsSync(path.join(store, 'mods', 'sodium-fabric-0.6.0+mc1.21.1.jar')));
  assert.ok(!fs.existsSync(path.join(store, 'mods', 'sodium-fabric-0.5.0+mc1.21.1.jar')));
  const backups = fs.readdirSync(path.join(store, '.havihub'));
  assert.equal(backups.length, 1);
  assert.ok(fs.existsSync(path.join(store, '.havihub', backups[0], 'curseforge', 'mods', 'sodium-fabric-0.5.0+mc1.21.1.jar')));
  // worlds of both: the same name is kept twice
  assert.equal(read(path.join(store, 'saves', 'Hardcore', 'level.dat')), 'level');
  assert.ok(fs.readdirSync(path.join(store, 'saves')).some((n) => n.startsWith('Hardcore (') && n !== 'Hardcore'));
  assert.equal(read(path.join(store, 'saves', 'Isla', 'level.dat')), 'cf isla');
  assert.ok(fs.existsSync(path.join(store, 'screenshots', 'cf.png')));
  // CurseForge still finds its profile
  assert.ok(fs.existsSync(path.join(cfDir, 'minecraftinstance.json')));
  // a world saved from one launcher is there for the other
  write(path.join(cfDir, 'saves', 'Nuevo', 'level.dat'), 'nuevo');
  assert.equal(read(path.join(mrDir, 'saves', 'Nuevo', 'level.dat')), 'nuevo');
  assert.ok(!fs.existsSync(`${cfDir}.havihub-merge`));
});

test('brings a synced profile into Havi Hub', async () => {
  const r = await sync.bringToHavi({ dir: mrDir });
  const inst = new Instances(ctx, cfg);
  const list = (await inst.list()).instances;
  const mine = list.find((i) => i.id === r.id);
  assert.ok(mine);
  assert.equal(mine.mcVersion, '1.21.1');
  assert.equal(mine.loader.id, 'fabric');
  assert.equal(read(path.join(mine.gameDir, 'saves', 'Nuevo', 'level.dat')), 'nuevo');
  assert.equal(sync.groups()[0].members.length, 3);
  const s = await sync.scan();
  assert.ok(s.groups[0].members.every((m) => m.ok));
});

test('leaving the sync gives each one its own full copy', async () => {
  const g = sync.groups()[0];
  await sync.detach(g.id, cfDir);
  assert.equal(await linkTarget(cfDir), null);
  assert.equal(read(path.join(cfDir, 'saves', 'Nuevo', 'level.dat')), 'nuevo');
  assert.ok(fs.existsSync(path.join(cfDir, 'minecraftinstance.json')));
  assert.equal(sync.groups()[0].members.length, 2);
  // deleting the Havi Hub instance only removes its link
  const havi = sync.groups()[0].members.find((m) => m.launcher === 'havi');
  const inst = new Instances(ctx, cfg);
  await sync.forgetInstance(havi.instanceId, havi.dir);
  await inst.remove(havi.instanceId);
  assert.ok(fs.existsSync(path.join(g.store, 'saves', 'Nuevo', 'level.dat')));
  // the last one takes the shared folder back
  await sync.detach(g.id, mrDir);
  assert.equal(await linkTarget(mrDir), null);
  assert.equal(read(path.join(mrDir, 'saves', 'Nuevo', 'level.dat')), 'nuevo');
  assert.equal(sync.groups().length, 0);
  assert.ok(!fs.existsSync(g.store));
});
