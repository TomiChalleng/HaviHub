// Import from the CurseForge app and the Modrinth App, sharing the profiles
// folder with Prism Launcher, and key bindings written into options.txt.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const { Importer } = require('../src/main/importer');
const cf = require('../src/main/importers/curseforge');
const mr = require('../src/main/importers/modrinth');
const { PrismContext } = require('../src/main/prism/paths');
const { AppConfig } = require('../src/main/appconfig');
const { Instances } = require('../src/main/prism/instances');
const { readMetadata } = require('../src/main/prism/content');
const groups = require('../src/main/prism/groups');
const { IniFile } = require('../src/main/util/ini');
const { TaskManager } = require('../src/main/tasks');
const { Sharing } = require('../src/main/sharing');
const { keyForOptions, usesLegacyKeys } = require('../src/shared/mckeys-legacy');
const { prepareData } = require('../src/main/engine');

let tmp;
let fx;
let fxOld;

function fixtures(out, old) {
  const args = [path.join(ROOT, 'scripts', 'make-import-fixtures.mjs'), out];
  if (old) args.push('--old-modrinth');
  execFileSync(process.execPath, ['--no-warnings', ...args]);
}

async function freshTarget(name) {
  const own = path.join(tmp, name);
  await fsp.mkdir(path.join(own, 'instances'), { recursive: true });
  const ctx = new PrismContext(own, null);
  const cfg = new AppConfig(path.join(tmp, `${name}-ud`));
  await cfg.load();
  const imp = new Importer({ ctxProvider: () => ctx, appConfig: cfg, tasks: new TaskManager(() => {}), emit: () => {} });
  return { own, ctx, cfg, imp };
}

test.before(async () => {
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'havihub-import-test-'));
  fx = path.join(tmp, 'fx');
  fxOld = path.join(tmp, 'fx-old');
  fixtures(fx, false);
  fixtures(fxOld, true);
});
test.after(() => fsp.rm(tmp, { recursive: true, force: true }));

test('curseforge: loader names and profile folders', async () => {
  assert.deepEqual(cf.parseLoader({ name: 'fabric-0.15.11-1.20.1', minecraftVersion: '1.20.1', type: 4 }), { id: 'fabric', version: '0.15.11' });
  assert.deepEqual(cf.parseLoader({ name: 'forge-47.2.0', type: 1 }, '1.20.1'), { id: 'forge', version: '47.2.0' });
  assert.deepEqual(cf.parseLoader({ name: 'forge-1.12.2-14.23.5.2860', minecraftVersion: '1.12.2', type: 1 }), { id: 'forge', version: '14.23.5.2860' });
  assert.deepEqual(cf.parseLoader({ name: 'neoforge-21.1.73', type: 6 }), { id: 'neoforge', version: '21.1.73' });
  assert.deepEqual(cf.parseLoader({ name: 'quilt-0.26.0-1.20.4', minecraftVersion: '1.20.4', type: 5 }), { id: 'quilt', version: '0.26.0' });
  assert.equal(cf.parseLoader(null), null);

  const inst = path.join(fx, 'curseforge', 'minecraft', 'Instances');
  // the modding folder, the Instances folder and one profile all resolve the same
  assert.equal(await cf.resolveRoot(path.join(fx, 'curseforge', 'minecraft')), inst);
  assert.equal(await cf.resolveRoot(inst), inst);
  assert.equal(await cf.resolveRoot(path.join(inst, 'All the Mods 9')), inst);

  const list = await cf.listProfiles(inst);
  assert.equal(list.length, 3);
  const atm = list.find((p) => p.id === 'All the Mods 9');
  assert.deepEqual(atm.loader, { id: 'forge', version: '47.2.0' });
  assert.equal(atm.mcVersion, '1.20.1');
  assert.equal(atm.memory, 8192);
  assert.equal(atm.jvmArgs, '-XX:+UseG1GC');
  assert.equal(atm.modpack.projectId, 715572);
  assert.equal(atm.addons.length, 3);
  assert.ok(atm.image && atm.image.endsWith('atm9.png'));
  assert.equal(list.find((p) => p.id === 'Vanilla 1.21').loader, null);
  assert.equal(list.find((p) => p.id === 'Fabulously Optimized').lastPlayed, 0, 'year 1 means never played');
});

test('curseforge: import converts the profile and keeps what each mod is', async () => {
  const { own, ctx, cfg, imp } = await freshTarget('HaviCF');
  const inst = path.join(fx, 'curseforge', 'minecraft', 'Instances');
  const listed = await imp.listFrom('curseforge', path.join(fx, 'curseforge'));
  assert.equal(listed.instances.length, 3);
  assert.equal(listed.label, 'CurseForge');
  const atmRow = listed.instances.find((i) => i.id === 'All the Mods 9');
  assert.equal(atmRow.loader.name, 'Forge');
  assert.ok(atmRow.icon, 'profile image shown');
  const sizes = await imp.sizesFrom('curseforge', inst, ['All the Mods 9']);
  assert.ok(sizes['All the Mods 9'] > 0);

  const r = await imp.runFrom({ source: 'curseforge', srcDir: inst, ids: ['All the Mods 9', 'Vanilla 1.21'], groups: true, shared: true });
  assert.deepEqual(r.failed, []);
  assert.equal(r.imported.length, 2);
  const dest = path.join(own, 'instances', 'All the Mods 9');
  const game = path.join(dest, 'minecraft');
  assert.ok(fs.existsSync(path.join(game, 'mods', 'jei-1.20.1-forge-15.2.0.27.jar')));
  assert.ok(fs.existsSync(path.join(game, 'saves', 'Mi mundo', 'level.dat')));
  assert.equal(fs.existsSync(path.join(game, 'minecraftinstance.json')), false, 'CurseForge file not copied');
  assert.equal(fs.existsSync(path.join(game, 'logs')), false, 'logs not copied');

  const pack = JSON.parse(await fsp.readFile(path.join(dest, 'mmc-pack.json'), 'utf8'));
  assert.deepEqual(
    pack.components.map((c) => [c.uid, c.version]),
    [
      ['net.minecraft', '1.20.1'],
      ['net.minecraftforge', '47.2.0'],
    ],
  );
  const icfg = await IniFile.load(path.join(dest, 'instance.cfg'));
  assert.equal(icfg.get('name'), 'All the Mods 9');
  assert.equal(icfg.get('MaxMemAlloc'), '8192');
  assert.equal(icfg.get('OverrideMemory'), 'true');
  assert.equal(icfg.get('JvmArgs'), '-XX:+UseG1GC');
  assert.equal(icfg.get('ManagedPackType'), 'flame');
  assert.equal(icfg.get('ManagedPackID'), '715572');
  assert.equal(icfg.get('ManagedPackVersionID'), '5123456');
  assert.equal(icfg.get('ManagedPackVersionName'), '0.2.60');
  assert.equal(icfg.get('lastLaunchTime'), String(Date.parse('2026-10-20T18:30:00.000Z')));

  // mods remember their CurseForge project (also the disabled one)
  const meta = await readMetadata(path.join(game, 'mods', '.index'));
  const jei = [...meta.values()].find((m) => m.filename === 'jei-1.20.1-forge-15.2.0.27.jar');
  assert.ok(jei, 'jei metadata written');
  assert.equal(jei.provider, 'curseforge');
  assert.equal(Number(jei.projectId), 238222);
  assert.equal(Number(jei.fileId), 4712866);
  assert.ok(/^[0-9a-f]{40}$/.test(jei.download.hash), 'sha1 computed from the file');
  assert.equal(jei.download['hash-format'], 'sha1');
  assert.ok([...meta.values()].some((m) => m.filename === 'create-1.20.1-0.5.1.f.jar'), 'disabled mod keeps its project');
  const rp = await readMetadata(path.join(game, 'resourcepacks', '.index'));
  assert.ok([...rp.values()].some((m) => m.filename === 'Faithful 32x.zip'));

  const mine = (await new Instances(ctx, cfg).list()).instances;
  const atm = mine.find((i) => i.id === 'All the Mods 9');
  assert.ok(atm.icon, 'profile image copied');
  assert.equal(atm.loader && atm.loader.id, 'forge');
  assert.equal(mine.find((i) => i.id === 'Vanilla 1.21').loader, null);

  // game files the CurseForge app already downloaded are linked, not copied
  const a1 = fs.statSync(path.join(fx, 'curseforge', 'minecraft', 'Install', 'assets', 'objects', 'ab', 'abcdef'));
  const a2 = fs.statSync(path.join(own, 'assets', 'objects', 'ab', 'abcdef'));
  assert.equal(a1.ino, a2.ino);
  assert.ok(fs.existsSync(path.join(inst, 'All the Mods 9', 'minecraftinstance.json')), 'the original stays');

  // the same profile again becomes a copy, never an overwrite
  const r2 = await imp.runFrom({ source: 'curseforge', srcDir: inst, ids: ['All the Mods 9'] });
  assert.equal(r2.imported[0].id, 'All the Mods 9 (2)');
  const again = await imp.listFrom('curseforge', inst);
  assert.equal(again.instances.find((i) => i.id === 'All the Mods 9').exists, true);
});

for (const [label, old] of [
  ['current', false],
  ['older', true],
]) {
  test(`modrinth (${label} database): profiles, groups, overrides and import`, async () => {
    const root = path.join(old ? fxOld : fx, old ? 'ModrinthAppOld' : 'ModrinthApp');
    assert.equal(await mr.isApp(root), true);
    assert.equal(await mr.resolveRoot(path.join(root, 'profiles', 'Cobblemon')), root);
    const { profiles, launch } = await mr.readApp(root);
    assert.equal(profiles.length, 2);
    // what the app uses for every instance (only what was changed from its defaults)
    assert.equal(launch.memory, 3072);
    assert.deepEqual(launch.env, { GLOBAL_VAR: '1', SHARED: 'global' });
    assert.equal(launch.hooks.wrapper, 'gamemoderun');
    assert.equal(launch.resolution, null);
    const fab = profiles.find((p) => p.id === 'Fabric 1.21.1');
    assert.deepEqual(fab.loader, { id: 'fabric', version: '0.16.5' });
    assert.equal(fab.mcVersion, '1.21.1');
    assert.equal(fab.group, 'Optimizados');
    assert.equal(fab.memory, 6144);
    assert.equal(fab.jvmArgs, '-Dfoo=1');
    assert.equal(fab.javaPath, '/opt/jdk21/bin/java');
    assert.deepEqual(fab.env, { SHARED: 'mine' });
    assert.deepEqual(fab.resolution, [1280, 720]);
    assert.equal(fab.hooks.pre, 'echo hi');
    assert.equal(fab.lastPlayed, 1760000000 * 1000);
    assert.equal(fab.played, 3720);
    const cob = profiles.find((p) => p.id === 'Cobblemon');
    assert.equal(cob.name, 'Cobblemon Official');
    assert.equal(cob.group, '', 'Favorites is not a group');
    assert.deepEqual(cob.loader, { id: 'neoforge', version: '21.1.66' });
    assert.deepEqual(cob.modpack, { projectId: 'MdwFAVRL', versionId: 'abc123' });
    assert.ok(cob.image && cob.image.endsWith('cobblemon.png'));

    const { own, ctx, cfg, imp } = await freshTarget(`HaviMR-${label}`);
    const listed = await imp.listFrom('modrinth', root);
    assert.deepEqual(listed.groups, ['Optimizados']);
    const r = await imp.runFrom({ source: 'modrinth', srcDir: root, ids: ['Fabric 1.21.1', 'Cobblemon'], groups: true, shared: true });
    assert.deepEqual(r.failed, []);
    const fabDir = path.join(own, 'instances', 'Fabric 1.21.1');
    assert.ok(fs.existsSync(path.join(fabDir, 'minecraft', 'mods', 'iris-1.8.0.jar.disabled')));
    assert.ok(fs.existsSync(path.join(fabDir, 'minecraft', 'shaderpacks', 'Complementary.zip')));
    assert.equal(fs.existsSync(path.join(fabDir, 'minecraft', 'logs')), false);
    const pack = JSON.parse(await fsp.readFile(path.join(fabDir, 'mmc-pack.json'), 'utf8'));
    assert.deepEqual(pack.components[1], { uid: 'net.fabricmc.fabric-loader', version: '0.16.5' });
    const icfg = await IniFile.load(path.join(fabDir, 'instance.cfg'));
    assert.equal(icfg.get('MaxMemAlloc'), '6144');
    assert.equal(icfg.get('JavaPath'), '/opt/jdk21/bin/java');
    assert.equal(icfg.get('OverrideJavaLocation'), 'true');
    assert.deepEqual(JSON.parse(icfg.get('Env')), { GLOBAL_VAR: '1', SHARED: 'mine' }, 'the profile\'s own value wins');
    assert.equal(String(icfg.get('MinecraftWinWidth')), '1280');
    assert.equal(icfg.get('PreLaunchCommand'), 'echo hi');
    assert.equal(icfg.get('WrapperCommand'), 'gamemoderun', 'the app-wide wrapper');
    assert.equal(icfg.get('totalTimePlayed'), '3720');
    const cobId = r.imported.find((x) => x.from === 'Cobblemon').id;
    assert.equal(cobId, 'Cobblemon Official');
    const ccfg = await IniFile.load(path.join(own, 'instances', cobId, 'instance.cfg'));
    assert.equal(ccfg.get('ManagedPackType'), 'modrinth');
    assert.equal(String(ccfg.get('MaxMemAlloc')), '3072', 'the app-wide memory');
    assert.deepEqual(JSON.parse(ccfg.get('Env')), { GLOBAL_VAR: '1', SHARED: 'global' });
    assert.equal(ccfg.has('JavaPath'), false);
    assert.equal(ccfg.get('ManagedPackID'), 'MdwFAVRL');
    assert.equal(ccfg.get('ManagedPackVersionID'), 'abc123');
    const mine = (await new Instances(ctx, cfg).list()).instances;
    assert.equal(mine.find((i) => i.id === 'Fabric 1.21.1').group, 'Optimizados');
    assert.ok(mine.find((i) => i.id === cobId).icon, 'icon copied');
    assert.ok(fs.existsSync(path.join(own, 'libraries', 'org', 'x', 'x.jar')), 'libraries reused');
  });
}

test('modrinth: the database is read from a copy, also while the app has it open', async () => {
  const root = path.join(fx, 'ModrinthApp');
  const { DatabaseSync } = require('node:sqlite');
  const open = new DatabaseSync(path.join(root, 'app.db'));
  open.exec('BEGIN IMMEDIATE');
  try {
    const { profiles } = await mr.readApp(root);
    assert.equal(profiles.length, 2);
  } finally {
    open.exec('ROLLBACK');
    open.close();
  }
  assert.equal(fs.readdirSync(os.tmpdir()).some((n) => n.startsWith('havihub-mr-')), false, 'temporary copy removed');
});

test('detectAll finds the three launchers; a wrong folder is reported clearly', async () => {
  const prismData = path.join(tmp, 'SomePrism');
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-fixtures.mjs'), prismData]);
  const env = { ...process.env };
  process.env.HAVIHUB_IMPORT_DIRS = prismData;
  process.env.HAVIHUB_IMPORT_CF_DIRS = path.join(fx, 'curseforge', 'minecraft', 'Instances');
  process.env.HAVIHUB_IMPORT_MR_DIRS = path.join(fx, 'ModrinthApp');
  try {
    const { imp } = await freshTarget('HaviDetect');
    const all = await imp.detectAll();
    assert.ok(all.prism.some((p) => p.dataDir === prismData && p.count > 0));
    assert.ok(all.curseforge.some((p) => p.count === 3));
    assert.ok(all.modrinth.some((p) => p.count === 2));
    await assert.rejects(imp.listFrom('curseforge', tmp), (e) => e.code === 'BAD_SOURCE');
    await assert.rejects(imp.listFrom('modrinth', path.join(fx, 'curseforge')), (e) => e.code === 'BAD_SOURCE');
  } finally {
    process.env = env;
  }
});

test('sharing with Prism Launcher: profiles move over and both use one folder', async () => {
  const prismData = path.join(tmp, 'RealPrism');
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-fixtures.mjs'), prismData]);
  const own = path.join(tmp, 'HaviShare');
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-fixtures.mjs'), own]);
  // a Havi Hub profile with its own image and group, and one with a name Prism already uses
  const cfg = new AppConfig(path.join(tmp, 'share-ud'));
  await cfg.load();
  const ownCtx = new PrismContext(own, null);
  const ownInst = new Instances(ownCtx, cfg);
  const first = (await ownInst.list()).instances[0];
  const soloId = await ownInst.clone(first.id, { name: 'Solo de Havi', group: 'Mis perfiles' });
  const png = fs.readFileSync(path.join(fx, 'ModrinthApp', 'caches', 'icons', 'cobblemon.png'));
  const iconKey = await ownInst.setImage(soloId, png);
  const mineBefore = (await ownInst.list()).instances;
  const withGroup = mineBefore.find((i) => i.id === soloId);
  assert.equal(withGroup.group, 'Mis perfiles');
  assert.equal(fs.existsSync(path.join(prismData, 'instances', soloId)), false);
  const clash = mineBefore.find((i) => fs.existsSync(path.join(prismData, 'instances', i.id)));
  assert.ok(clash, 'fixture has a profile that Prism also has');

  const sharing = new Sharing({ dataDir: () => own, appConfig: cfg, tasks: new TaskManager(() => {}), isRunning: () => false });
  const pv = await sharing.preview(prismData);
  assert.ok(pv.prismCount > 0);
  assert.ok(pv.own.find((i) => i.id === clash.id).inPrism);
  await assert.rejects(sharing.preview(tmp), (e) => e.code === 'BAD_SOURCE');

  const r = await sharing.enable({ prismDir: prismData, move: [withGroup.id, clash.id] });
  assert.deepEqual(r.failed, []);
  const renamed = r.moved.find((m) => m.from === clash.id);
  assert.equal(renamed.renamed, true);
  assert.equal(renamed.id, `${clash.id} (Havi Hub)`);
  assert.equal(fs.existsSync(path.join(own, 'instances', withGroup.id)), false, 'moved, not copied');
  assert.ok(fs.existsSync(path.join(prismData, 'instances', withGroup.id, 'instance.cfg')));
  assert.equal(r.moved.find((m) => m.from === soloId).renamed, false);
  const prismGroups = await groups.loadGroups(new PrismContext(prismData, null));
  assert.equal(prismGroups.map.get(soloId), 'Mis perfiles', 'group goes along');
  assert.equal((await groups.loadGroups(ownCtx)).map.has(soloId), false);
  assert.ok(fs.readdirSync(path.join(prismData, 'icons')).some((n) => n.startsWith(`${iconKey}.`)), 'image goes along');
  const renamedCfg = await IniFile.load(path.join(prismData, 'instances', renamed.id, 'instance.cfg'));
  assert.match(renamedCfg.get('name'), / \(Havi Hub\)$/);

  const st = await sharing.status();
  assert.equal(st.enabled, true);
  assert.equal(st.active, true);
  assert.equal(path.resolve(st.instancesDir), path.resolve(path.join(prismData, 'instances')));

  // the engine uses Prism's folders; everything else stays Havi Hub's own
  const engineData = path.join(tmp, 'engine-data');
  await prepareData(engineData, { folders: await sharing.activeDirs() });
  const ecfg = await IniFile.load(path.join(engineData, 'prismlauncher.cfg'));
  assert.equal(path.resolve(ecfg.get('InstanceDir')), path.resolve(path.join(prismData, 'instances')));
  assert.equal(path.resolve(ecfg.get('IconsDir')), path.resolve(path.join(prismData, 'icons')));
  assert.equal(fs.existsSync(path.join(prismData, 'accounts.json.havihub')), false);

  await sharing.disable();
  assert.equal((await sharing.status()).active, false);
  await prepareData(engineData, { folders: await sharing.activeDirs() });
  const back = await IniFile.load(path.join(engineData, 'prismlauncher.cfg'));
  assert.equal(back.get('InstanceDir'), 'instances');
  assert.equal(back.get('IconsDir'), 'icons');

  // Prism's folder disappears: Havi Hub falls back to its own and says so
  await cfg.update({ sharedInstances: { enabled: true, prismDir: path.join(tmp, 'gone') } });
  const missing = await sharing.status();
  assert.equal(missing.missing, true);
  assert.equal(missing.active, false);
});

test('key bindings: modern names, LWJGL 2 codes for 1.12 and older', async () => {
  assert.equal(usesLegacyKeys('1.12.2'), true);
  assert.equal(usesLegacyKeys('b1.7.3'), true);
  assert.equal(usesLegacyKeys('17w42a'), true);
  assert.equal(usesLegacyKeys('17w43a'), false);
  assert.equal(usesLegacyKeys('1.13'), false);
  assert.equal(usesLegacyKeys('1.21.1'), false);
  assert.equal(usesLegacyKeys('26.2'), false);
  assert.equal(keyForOptions('key.keyboard.left.shift', '1.20.1'), 'key.keyboard.left.shift');
  assert.equal(keyForOptions('key.keyboard.left.shift', '1.8.9'), '42');
  assert.equal(keyForOptions('key.keyboard.r', '1.7.10'), '19');
  assert.equal(keyForOptions('key.mouse.left', '1.12.2'), '-100');
  assert.equal(keyForOptions('key.mouse.right', '1.12.2'), '-99');
  assert.equal(keyForOptions('key.mouse.4', '1.12.2'), '-97');
  assert.equal(keyForOptions('key.keyboard.world.1', '1.12.2'), null, 'no old code: left alone');

  const data = path.join(tmp, 'KeysPrism');
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-fixtures.mjs'), data]);
  const cfg = new AppConfig(path.join(tmp, 'keys-ud'));
  await cfg.load();
  const d = cfg.get().inGameDefaults;
  await cfg.update({ inGameDefaults: { ...d, keys: { ...d.keys, 'key.drop': 'key.keyboard.x', 'key.inventory': '' } } });
  const ctx = new PrismContext(data, null);
  const inst = new Instances(ctx, cfg);
  const list = (await inst.list()).instances.filter((i) => !i.broken);
  const target = list[0];
  const gameDir = fs.existsSync(path.join(target.root, 'minecraft')) ? path.join(target.root, 'minecraft') : path.join(target.root, '.minecraft');
  await fsp.mkdir(gameDir, { recursive: true });
  await fsp.writeFile(path.join(gameDir, 'options.txt'), 'fov:0.25\nkey_key.drop:key.keyboard.q\nkey_key.inventory:key.keyboard.e\n');
  const running = list[1] ? list[1].id : null;
  const r = await inst.applyKeys((id) => id === running);
  assert.ok(r.count >= 1);
  if (running) assert.ok(r.skipped.length === 1);
  const text = await fsp.readFile(path.join(gameDir, 'options.txt'), 'utf8');
  assert.match(text, /^fov:0\.25$/m, 'other settings kept');
  assert.match(text, /^key_key\.inventory:key\.keyboard\.e$/m, 'not customized: untouched');
  const drop = /^key_key\.drop:(.+)$/m.exec(text)[1];
  assert.equal(drop, keyForOptions('key.keyboard.x', target.mcVersion));
  assert.match(text, /^key_key\.sneak:/m, 'sneak default from Havi Hub written');
});
