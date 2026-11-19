// Tests for the Prism data layer (run with: npm test)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const { IniFile, parseValue, formatValue } = require('../src/main/util/ini');
const nbt = require('../src/main/util/nbt');
const { murmur2, curseFingerprintBuffer } = require('../src/main/util/hash');
const { PrismContext } = require('../src/main/prism/paths');
const { AppConfig } = require('../src/main/appconfig');
const { Instances } = require('../src/main/prism/instances');
const { Content, readMetadata, writeMetadata } = require('../src/main/prism/content');
const { Worlds } = require('../src/main/prism/worlds');
const { Logs, Screenshots } = require('../src/main/prism/logs');
const { Accounts } = require('../src/main/prism/accounts');
const { Skins } = require('../src/main/prism/skins');
const groups = require('../src/main/prism/groups');
const { mergeResults } = require('../src/main/platforms/unified');
const { pngToIco } = require('../src/main/prism/shortcuts');

let tmp;
let data;
let ctx;
let cfg;
let instances;

test.before(async () => {
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'havihub-test-'));
  data = path.join(tmp, 'PrismLauncher');
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'make-fixtures.mjs'), data]);
  ctx = new PrismContext(data, path.join(data, 'prismlauncher'));
  cfg = new AppConfig(path.join(tmp, 'userdata'));
  await cfg.load();
  instances = new Instances(ctx, cfg);
});

test.after(async () => {
  await fsp.rm(tmp, { recursive: true, force: true });
});

test('ini: parse and format like QSettings', () => {
  assert.equal(parseValue('"-XX:+UseG1GC -Dfoo=bar"'), '-XX:+UseG1GC -Dfoo=bar');
  assert.deepEqual(parseValue('a, b, c'), ['a', 'b', 'c']);
  assert.equal(parseValue('line1\\nline2'), 'line1\nline2');
  assert.equal(parseValue('C:\\\\Users\\\\x'), 'C:\\Users\\x');
  assert.equal(formatValue('a=b'), '"a=b"');
  assert.equal(formatValue('x\ny'), 'x\\ny');
  assert.equal(formatValue(true), 'true');
  assert.equal(formatValue([]), '@Invalid()');
  const ini = new IniFile('[General]\nname=Hola\nnotes=a\\nb\n\n[UI]\nfoo\\bar=1\n');
  assert.equal(ini.get('name'), 'Hola');
  assert.equal(ini.get('notes'), 'a\nb');
  assert.equal(ini.get('UI/foo/bar'), '1');
  ini.set('name', 'Nuevo; nombre');
  ini.set('MaxMemAlloc', 4096);
  ini.set('UI/other', 'x');
  const text = ini.toString();
  assert.match(text, /name="Nuevo; nombre"/);
  assert.match(text, /\[General\][\s\S]*MaxMemAlloc=4096[\s\S]*\[UI\]/);
  const re = new IniFile(text);
  assert.equal(re.get('name'), 'Nuevo; nombre');
  assert.equal(re.get('UI/other'), 'x');
});

test('nbt: round trip', () => {
  const { tag, T } = nbt;
  const value = { a: tag.string('hola ñ'), b: tag.int(5), c: tag.long(1700000000000), l: tag.list(T.Compound, [{ x: tag.byte(1) }]) };
  const buf = nbt.serialize({ name: '', value }, { gzip: true });
  const back = nbt.parse(buf);
  const s = nbt.simplify(back.value);
  assert.equal(s.a, 'hola ñ');
  assert.equal(s.b, 5);
  assert.equal(s.c, 1700000000000);
  assert.equal(s.l[0].x, 1);
});

test('CurseForge fingerprint matches Prism Launcher reference values', () => {
  // values computed with Prism Launcher's own C++ MurmurHash2 implementation
  const cases = [
    ['', 1540447798],
    ['a', 626045324],
    ['abcd', 3376380438],
    ['Hello, world! This is a fingerprint test.\n\twith whitespace', 3547728728],
    ['0123456789abcdefghij', 3510898753],
  ];
  for (const [input, expected] of cases) assert.equal(curseFingerprintBuffer(Buffer.from(input)), expected);
  assert.equal(curseFingerprintBuffer(Buffer.from('a b\tc\n')), curseFingerprintBuffer(Buffer.from('abc')));
  assert.equal(typeof murmur2(Buffer.from('x'), 1), 'number');
});

test('instances: list with groups, loaders and icons', async () => {
  const { instances: list, groups: g } = await instances.list();
  assert.equal(list.length, 5);
  const v = list.find((i) => i.id === '26.2 Vanilla');
  assert.equal(v.name, '[26.2] Vanilla');
  assert.equal(v.mcVersion, '26.2');
  assert.equal(v.loader.id, 'fabric');
  assert.equal(v.loader.version, '0.20.1');
  assert.equal(v.group, 'Vanilla');
  assert.ok(v.icon && v.icon.startsWith('havihub://local/'));
  assert.equal(v.totalPlayed, 13 * 3600 + 120);
  assert.equal(v.notes, 'Mundo principal\ncon amigos');
  assert.deepEqual(g.sort(), ['Horror', 'Vanilla']);
  const pvp = list.find((i) => i.id === '1.21.8 PVP');
  assert.equal(pvp.loader, null);
  assert.equal(pvp.group, '');
});

test('instances: create, rename, group, image, version, clone, remove', async () => {
  const id = await instances.create({ name: 'Mi: Instancia/Nueva', mcVersion: '26.2', loader: 'neoforge', loaderVersion: '26.2.0.10', group: 'Pruebas' });
  assert.equal(id, 'Mi_ Instancia_Nueva');
  const got = await instances.get(id);
  assert.equal(got.name, 'Mi: Instancia/Nueva');
  assert.equal(got.loader.id, 'neoforge');
  assert.equal(got.group, 'Pruebas');
  const opts = await fsp.readFile(path.join(got.gameDir, 'options.txt'), 'utf8');
  assert.match(opts, /fov:0.5/);
  assert.match(opts, /soundCategory_music:0.0/);
  assert.match(opts, /key_key.sneak:key.keyboard.left.control/);

  await instances.rename(id, 'Renombrada');
  await instances.setGroup(id, 'Horror');
  const png = fs.readFileSync(path.join(data, 'icons', 'havihub-pvp.png'));
  await instances.setImage(id, png);
  await instances.setVersion(id, { mcVersion: '1.21.8', loader: 'fabric', loaderVersion: '0.20.1' });
  const after = await instances.get(id);
  assert.equal(after.name, 'Renombrada');
  assert.equal(after.group, 'Horror');
  assert.equal(after.mcVersion, '1.21.8');
  assert.equal(after.loader.id, 'fabric');
  assert.ok(after.icon);
  assert.ok(after.iconKey.startsWith('havihub-'));

  const cloneId = await instances.clone('26.2 Vanilla', { name: 'Copia vanilla', copyWorlds: false });
  const c = await instances.get(cloneId);
  assert.equal(c.group, 'Vanilla');
  assert.equal(c.totalPlayed, 0);
  assert.ok(!fs.existsSync(path.join(c.gameDir, 'saves')));
  assert.ok(fs.existsSync(path.join(c.gameDir, 'mods')));

  await instances.remove(cloneId);
  await assert.rejects(() => instances.get(cloneId));
  const g = await groups.loadGroups(ctx);
  assert.ok(!g.map.has(cloneId));

  // instance.cfg stays readable as QSettings INI
  const cfgText = fs.readFileSync(path.join(data, 'instances', id, 'instance.cfg'), 'utf8');
  assert.match(cfgText, /^\[General\]/);
  assert.match(cfgText, /InstanceType=OneSix/);
});

test('content: mods with metadata, icons, env and disabled state', async () => {
  const content = new Content(instances, path.join(tmp, 'cache'));
  const { items } = await content.list('26.2 Vanilla', 'mods');
  assert.equal(items.length, 10);
  const sodium = items.find((i) => i.name === 'Sodium Extra');
  assert.equal(sodium.env, 'client');
  assert.deepEqual(sodium.authors, ['FlashyReese']);
  assert.ok(sodium.icon);
  assert.equal(sodium.meta.provider, 'modrinth');
  const clumps = items.find((i) => i.name === 'Clumps');
  assert.equal(clumps.meta.provider, 'curseforge');
  assert.equal(clumps.meta.projectId, '256717');
  const bad = items.find((i) => i.name === 'BadOptimizations');
  assert.equal(bad.icon, null);
  const ench = items.find((i) => i.name === 'Enchantment Descriptions');
  assert.equal(ench.enabled, false);

  await content.setEnabled('26.2 Vanilla', 'mods', ench.fileName, true);
  await content.setEnabled('26.2 Vanilla', 'mods', sodium.fileName, false);
  const again = (await content.list('26.2 Vanilla', 'mods')).items;
  assert.equal(again.find((i) => i.name === 'Enchantment Descriptions').enabled, true);
  assert.equal(again.find((i) => i.name === 'Sodium Extra').enabled, false);

  const rp = await content.list('26.2 Vanilla', 'resourcepacks');
  assert.equal(rp.items.length, 2);
  assert.ok(rp.items.find((i) => i.isDir && i.name === 'Dark UI'));
  assert.equal(rp.items.find((i) => !i.isDir).description, 'Sombras suaves y colores cálidos');

  // remove deletes metadata too
  await content.remove('26.2 Vanilla', 'mods', 'cloth-config-26.2.155.jar');
  const meta = await readMetadata(path.join(data, 'instances', '26.2 Vanilla', 'minecraft', 'mods', '.index'));
  assert.ok(!meta.has('cloth-config-26.2.155.jar'));
});

test('metadata writer produces files Prism (and we) can read', async () => {
  const dir = path.join(tmp, 'idx');
  await writeMetadata(dir, { slug: 'sodium', name: "Sodium's", filename: 'sodium.jar', side: 'client', loaders: ['fabric'], mcVersions: ['26.2'], releaseType: 'Release', versionNumber: '0.6', hash: 'abc', hashFormat: 'sha512', provider: 'modrinth', url: 'https://cdn.modrinth.com/x.jar', projectId: 'AANobbMI', fileId: 'v1', dependencies: [{ addonId: 'P7dR8mSH', type: 'REQUIRED' }] });
  await writeMetadata(dir, { slug: 'jei', name: 'JEI', filename: 'jei.jar', side: 'both', loaders: ['forge'], mcVersions: ['1.20.1'], releaseType: 'Beta', versionNumber: '15', hash: 'def', hashFormat: 'sha1', provider: 'curseforge', projectId: '238222', fileId: '5101366', dependencies: [] });
  const m = await readMetadata(dir);
  assert.equal(m.get('sodium.jar').projectId, 'AANobbMI');
  assert.equal(m.get('sodium.jar').name, "Sodium's");
  assert.equal(m.get('jei.jar').provider, 'curseforge');
  assert.equal(m.get('jei.jar').fileId, '5101366');
});

test('worlds and servers', async () => {
  const worlds = new Worlds(instances);
  const list = await worlds.list('26.2 Vanilla');
  assert.equal(list.length, 3);
  assert.equal(list[0].folder, 'Creativo');
  assert.equal(list[0].gameMode, 'creative');
  assert.equal(list.find((w) => w.folder === 'Hardcore').hardcore, true);
  const servers = await worlds.listServers('26.2 Vanilla');
  assert.equal(servers.length, 2);
  assert.equal(servers[0].ip, '203.0.113.151');
  assert.ok(servers[0].icon.startsWith('data:image/png;base64,'));
  await worlds.addServer('26.2 Vanilla', { name: 'Nuevo', ip: 'mc.example.org' });
  await worlds.editServer('26.2 Vanilla', 1, { name: 'Renombrado' });
  await worlds.removeServer('26.2 Vanilla', 0);
  const s2 = await worlds.listServers('26.2 Vanilla');
  assert.deepEqual(
    s2.map((s) => s.name),
    ['Renombrado', 'Nuevo'],
  );
  const dup = await worlds.duplicate('26.2 Vanilla', 'Creativo');
  assert.ok((await worlds.list('26.2 Vanilla')).some((w) => w.folder === dup));
  const backup = await worlds.backup('26.2 Vanilla', 'Creativo');
  assert.ok(fs.existsSync(backup));
});

test('logs and screenshots', async () => {
  const logs = new Logs(instances, () => {});
  const list = await logs.list('26.2 Vanilla');
  assert.equal(list[0].name, 'latest.log');
  assert.ok(list.some((l) => l.name.endsWith('.gz')));
  assert.ok(list.some((l) => l.kind === 'crash'));
  const gz = list.find((l) => l.name.endsWith('.gz'));
  const r = await logs.read('26.2 Vanilla', gz.rel);
  assert.match(r.text, /Stopping!/);
  await assert.rejects(() => logs.read('26.2 Vanilla', '../../instance.cfg'));
  const zipPath = await logs.createZip('26.2 Vanilla');
  assert.ok(fs.statSync(zipPath).size > 100);
  const shots = new Screenshots(instances);
  const s = await shots.list('26.2 Vanilla');
  assert.equal(s.length, 7);
  assert.ok(s[0].mtime >= s[1].mtime);
});

test('accounts signed in with another Microsoft app have to sign in again', async () => {
  const { HAVIHUB_MSA_CLIENT_ID } = require('../src/main/engine');
  const ours = await new Accounts(ctx, { msaClientId: () => HAVIHUB_MSA_CLIENT_ID }).list();
  assert.equal(ours[0].needsLogin, false);
  const other = await new Accounts(ctx, { msaClientId: () => 'c36a9fb6-4f2a-41ff-90bd-ae7cc92031eb' }).list();
  assert.equal(other[0].needsLogin, true);
  // no app known: nothing is flagged
  assert.equal((await new Accounts(ctx).list())[0].needsLogin, false);
});

test('accounts and skins', async () => {
  const acc = new Accounts(ctx);
  const list = await acc.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'havikun');
  assert.equal(list[0].capes.length, 3);
  assert.ok(list[0].skin.data.startsWith('data:image/png'));
  assert.equal(list[0].tokenValid, true);
  await acc.setActive(list[0].id);
  const skins = new Skins(ctx);
  const sl = await skins.list();
  assert.equal(sl.length, 3);
  assert.equal(sl.find((s) => s.name === 'verde slim').model, 'SLIM');
  await assert.rejects(() => skins.add(Buffer.from('nope')), /skin válida/);
  const name = await skins.add(fs.readFileSync(path.join(data, 'skins', 'rojo.png')), { name: 'rojo', model: 'SLIM' });
  assert.equal(name, 'rojo (2)');
  await skins.update(name, { newName: 'rojo slim', capeId: 'cape-2' });
  const after = await skins.list();
  assert.ok(after.find((s) => s.name === 'rojo slim' && s.capeId === 'cape-2' && s.model === 'SLIM'));
});

test('dedupe keeps the most recently updated project', () => {
  const mr = [
    { source: 'modrinth', id: 'AANobbMI', slug: 'sodium', title: 'Sodium', author: 'jellysquid3', description: 'The fastest rendering optimization mod', updated: '2026-10-01T00:00:00Z', downloads: 100 },
    { source: 'modrinth', id: 'x1', slug: 'only-mr', title: 'Only Modrinth', author: 'a', description: 'x', updated: '2026-01-01T00:00:00Z', downloads: 5 },
  ];
  const cf = [
    { source: 'curseforge', id: '394468', slug: 'sodium', title: 'Sodium', author: 'JellySquid', description: 'Rendering engine replacement', updated: '2026-10-20T00:00:00Z', downloads: 300 },
    { source: 'curseforge', id: '9', slug: 'only-cf', title: 'Only CurseForge', author: 'b', description: 'y', updated: '2026-02-01T00:00:00Z', downloads: 7 },
    { source: 'curseforge', id: '10', slug: 'other', title: 'Only Modrinth', author: 'someone else', description: 'completely different text here', updated: '2026-02-01T00:00:00Z', downloads: 7 },
  ];
  const merged = mergeResults(mr, cf, 'relevance');
  const sod = merged.filter((m) => m.title === 'Sodium');
  assert.equal(sod.length, 1);
  assert.equal(sod[0].source, 'curseforge');
  assert.equal(sod[0].alsoOn.source, 'modrinth');
  assert.equal(sod[0].downloads, 300);
  // same title but different author/slug/description: not merged
  assert.equal(merged.filter((m) => m.title === 'Only Modrinth').length, 2);
  assert.equal(merged.length, 4);
});

test('ico wraps png', () => {
  const png = fs.readFileSync(path.join(data, 'icons', 'havihub-pvp.png'));
  const ico = pngToIco(png);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt32LE(14), png.length);
});

test('groups: unreadable file is never overwritten; old location is migrated', async () => {
  const file = await groups.groupsFile(ctx);
  assert.equal(file, path.join((await ctx.dirs()).primaryInstanceDir, 'instgroups.json'));
  const original = await fsp.readFile(file, 'utf8');
  try {
    await fsp.writeFile(file, '{"formatVersion": "1", "groups": {"Vani');
    // read-only listing still works (just without groups)
    const listed = await instances.list();
    assert.ok(listed.instances.length > 0);
    // writes refuse instead of replacing the file with partial data
    await assert.rejects(groups.setInstanceGroup(ctx, 'x', 'y'), (e) => e.code === 'GROUPS_UNREADABLE');
    assert.equal(await fsp.readFile(file, 'utf8'), '{"formatVersion": "1", "groups": {"Vani');
  } finally {
    await fsp.writeFile(file, original);
  }
  // a copy left next to prismlauncher.cfg: read once, then moved
  const old = ctx.groupsFile();
  await fsp.rename(file, old);
  try {
    const before = await groups.loadGroups(ctx);
    assert.equal(before.map.get('26.2 Vanilla'), 'Vanilla');
    await groups.setInstanceGroup(ctx, '26.2 Vanilla', 'Prueba');
    const a = JSON.parse(await fsp.readFile(file, 'utf8'));
    assert.ok(a.groups.Prueba.instances.includes('26.2 Vanilla'));
    assert.ok(a.groups.Horror.instances.includes('Cave Dread'));
    assert.ok(!fs.existsSync(old));
  } finally {
    await fsp.writeFile(file, original);
    await fsp.rm(old, { force: true });
  }
});

test('instance images keep their real format', () => {
  const { imageExt } = require('../src/main/prism/instances');
  assert.equal(imageExt(Buffer.from('89504e470d0a1a0a0000', 'hex')), 'png');
  assert.equal(imageExt(Buffer.from('ffd8ffe000104a464946', 'hex')), 'jpg');
  assert.equal(imageExt(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'binary')), 'webp');
  assert.equal(imageExt(Buffer.from('GIF89a......', 'binary')), 'gif');
});

test('accounts.json is not rewritten when it cannot be parsed', async () => {
  const file = ctx.accountsFile();
  const original = await fsp.readFile(file, 'utf8');
  const accounts = new Accounts(ctx);
  try {
    await fsp.writeFile(file, '{"accounts": [');
    await assert.rejects(accounts.setActive('whatever'));
    assert.equal(await fsp.readFile(file, 'utf8'), '{"accounts": [');
  } finally {
    await fsp.writeFile(file, original);
  }
});
