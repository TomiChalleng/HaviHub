// Havi Hub's folders under their earlier names ("Havi Hub", "havi-hub") move to "havihub"
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { migrateLegacyFolders, replacePathInFile } = require('../src/main/migrate');

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-migrate-'));
}

test('moves the old data and engine folders and fixes saved paths', () => {
  const root = tmpdir();
  const appData = path.join(root, 'Roaming');
  const local = path.join(root, 'Local');
  const oldUser = path.join(appData, 'Havi Hub');
  const newUser = path.join(appData, 'havihub');
  fs.mkdirSync(path.join(oldUser, 'launcher', 'instances', 'Vanilla'), { recursive: true });
  fs.writeFileSync(path.join(oldUser, 'config.json'), JSON.stringify({ dataDir: path.join(oldUser, 'launcher'), engineExe: '' }));
  const javaOld = `${oldUser.replace(/\\/g, '/')}/launcher/java/java-runtime-delta/bin/javaw.exe`;
  fs.writeFileSync(path.join(oldUser, 'launcher', 'prismlauncher.cfg'), `[General]\nJavaPath=${javaOld}\n`);
  fs.writeFileSync(path.join(oldUser, 'launcher', 'instances', 'Vanilla', 'instance.cfg'), `[General]\nJavaPath=${javaOld}\nname=Vanilla\n`);
  fs.mkdirSync(path.join(local, 'Havi Hub', 'engine', 'versions', '11.1.1'), { recursive: true });
  fs.writeFileSync(path.join(local, 'Havi Hub', 'engine', 'engine.json'), '{"version":"11.1.1"}');

  const r = migrateLegacyFolders({ appData, userData: newUser, localAppData: local });
  assert.equal(r.userData, null);
  assert.equal(r.localDir, null);
  assert.ok(!fs.existsSync(oldUser));
  assert.ok(fs.existsSync(path.join(newUser, 'config.json')));
  assert.ok(fs.existsSync(path.join(local, 'havihub', 'engine', 'engine.json')));
  const cfg = JSON.parse(fs.readFileSync(path.join(newUser, 'config.json'), 'utf8'));
  assert.equal(cfg.dataDir, path.join(newUser, 'launcher'));
  const javaNew = `${newUser.replace(/\\/g, '/')}/launcher/java/java-runtime-delta/bin/javaw.exe`;
  assert.match(fs.readFileSync(path.join(newUser, 'launcher', 'prismlauncher.cfg'), 'utf8'), new RegExp(javaNew.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(fs.readFileSync(path.join(newUser, 'launcher', 'instances', 'Vanilla', 'instance.cfg'), 'utf8').includes(javaNew));

  // a second start changes nothing
  const again = migrateLegacyFolders({ appData, userData: newUser, localAppData: local });
  assert.deepEqual(again.moved, []);
});

test('leaves an existing havihub folder alone', () => {
  const root = tmpdir();
  const appData = path.join(root, 'Roaming');
  fs.mkdirSync(path.join(appData, 'havi-hub'), { recursive: true });
  fs.writeFileSync(path.join(appData, 'havi-hub', 'config.json'), '{"a":1}');
  fs.mkdirSync(path.join(appData, 'havihub'), { recursive: true });
  fs.writeFileSync(path.join(appData, 'havihub', 'config.json'), '{"b":2}');
  const r = migrateLegacyFolders({ appData, userData: path.join(appData, 'havihub'), localAppData: '' });
  assert.deepEqual(r.moved, []);
  assert.ok(fs.existsSync(path.join(appData, 'havi-hub', 'config.json')));
  assert.equal(fs.readFileSync(path.join(appData, 'havihub', 'config.json'), 'utf8'), '{"b":2}');
});

test('replaces paths written with back slashes, forward slashes or JSON escapes', () => {
  const dir = tmpdir();
  const f = path.join(dir, 'x.txt');
  fs.writeFileSync(f, 'a=C:\\Users\\J\\AppData\\Roaming\\Havi Hub\\launcher\nb=C:/Users/J/AppData/Roaming/havi hub/launcher\nc="C:\\\\Users\\\\J\\\\AppData\\\\Roaming\\\\Havi Hub"\n');
  assert.ok(replacePathInFile(f, 'C:\\Users\\J\\AppData\\Roaming\\Havi Hub', 'C:\\Users\\J\\AppData\\Roaming\\havihub'));
  const out = fs.readFileSync(f, 'utf8');
  assert.ok(!/havi hub/i.test(out), out);
  assert.match(out, /a=C:\\Users\\J\\AppData\\Roaming\\havihub\\launcher/);
  assert.match(out, /b=C:\/Users\/J\/AppData\/Roaming\/havihub\/launcher/);
  assert.match(out, /c="C:\\\\Users\\\\J\\\\AppData\\\\Roaming\\\\havihub"/);
});

// ---- every folder carries one name: "havihub" (formerly "havi-hub") ----
const { relinkSynced, inUseOnLinux, DIR_NAME, LEGACY_NAMES } = require('../src/main/migrate');

test('"Havi Hub" folders become "havihub": data, engine, saved paths and synced links', () => {
  assert.equal(DIR_NAME, 'havihub');
  assert.deepEqual(LEGACY_NAMES, ['havi-hub', 'Havi Hub']);
  const root = tmpdir();
  const appData = path.join(root, 'Roaming');
  const local = path.join(root, 'Local');
  const oldUser = path.join(appData, 'Havi Hub');
  const newUser = path.join(appData, 'havihub');
  const store = path.join(oldUser, 'launcher', 'synced', 'Vanilla');
  const haviGame = path.join(oldUser, 'launcher', 'instances', 'Vanilla', 'minecraft');
  const other = path.join(root, 'curseforge', 'Instances', 'Vanilla'); // another launcher's profile, linked to the shared folder
  fs.mkdirSync(path.join(store, 'mods'), { recursive: true });
  fs.writeFileSync(path.join(store, 'mods', 'a.jar'), 'x');
  fs.mkdirSync(path.dirname(haviGame), { recursive: true });
  fs.mkdirSync(path.dirname(other), { recursive: true });
  const kind = process.platform === 'win32' ? 'junction' : 'dir';
  fs.symlinkSync(store, haviGame, kind);
  fs.symlinkSync(store, other, kind);
  fs.writeFileSync(
    path.join(oldUser, 'config.json'),
    JSON.stringify({ dataDir: '', sync: { groups: [{ id: 'g1', name: 'Vanilla', store, members: [{ launcher: 'havi', dir: haviGame }, { launcher: 'curseforge', dir: other }] }] } }),
  );
  fs.writeFileSync(path.join(oldUser, 'launcher', 'prismlauncher.cfg'), `[General]\nJavaPath=${oldUser.replace(/\\/g, '/')}/launcher/java/x/bin/java\n`);
  fs.mkdirSync(path.join(local, 'Havi Hub', 'engine'), { recursive: true });
  fs.writeFileSync(path.join(local, 'Havi Hub', 'engine', 'engine.json'), '{"version":"11.2"}');

  const r = migrateLegacyFolders({ appData, userData: newUser, localAppData: local });
  assert.equal(r.userData, null);
  assert.equal(r.localDir, null);
  assert.ok(!fs.existsSync(oldUser));
  assert.ok(!fs.existsSync(path.join(local, 'Havi Hub')));
  assert.ok(fs.existsSync(path.join(local, 'havihub', 'engine', 'engine.json')));
  const cfg = JSON.parse(fs.readFileSync(path.join(newUser, 'config.json'), 'utf8'));
  const newStore = path.join(newUser, 'launcher', 'synced', 'Vanilla');
  assert.equal(cfg.sync.groups[0].store, newStore);
  assert.equal(cfg.sync.groups[0].members[0].dir, path.join(newUser, 'launcher', 'instances', 'Vanilla', 'minecraft'));
  assert.equal(cfg.sync.groups[0].members[1].dir, other);
  assert.ok(!/Havi Hub/.test(fs.readFileSync(path.join(newUser, 'launcher', 'prismlauncher.cfg'), 'utf8')));
  // both links reach the mods again (they pointed into the old folder name)
  assert.equal(fs.readFileSync(path.join(newUser, 'launcher', 'instances', 'Vanilla', 'minecraft', 'mods', 'a.jar'), 'utf8'), 'x');
  assert.equal(fs.readFileSync(path.join(other, 'mods', 'a.jar'), 'utf8'), 'x');
  assert.equal(fs.realpathSync(other), fs.realpathSync(newStore));
  // a second start changes nothing
  assert.deepEqual(migrateLegacyFolders({ appData, userData: newUser, localAppData: local }).moved, []);
});

test('folders with the old name ("havi-hub") become "havihub"; an older "Havi Hub" left behind is not touched', () => {
  const root = tmpdir();
  const appData = path.join(root, 'Roaming');
  const local = path.join(root, 'Local');
  const oldUser = path.join(appData, 'havi-hub');
  const newUser = path.join(appData, 'havihub');
  fs.mkdirSync(path.join(oldUser, 'launcher', 'instances', 'A'), { recursive: true });
  fs.writeFileSync(path.join(oldUser, 'config.json'), JSON.stringify({ engineExe: path.join(local, 'havi-hub', 'engine', 'custom', 'prism.exe') }));
  fs.writeFileSync(path.join(oldUser, 'launcher', 'instances', 'A', 'instance.cfg'), `[General]\nJavaPath=${path.join(oldUser, 'launcher', 'java', 'bin', 'java')}\n`);
  fs.mkdirSync(path.join(local, 'havi-hub', 'engine'), { recursive: true });
  fs.writeFileSync(path.join(local, 'havi-hub', 'engine', 'engine.json'), '{"version":"11.2"}');
  fs.mkdirSync(path.join(appData, 'Havi Hub'), { recursive: true });
  fs.writeFileSync(path.join(appData, 'Havi Hub', 'config.json'), '{"old":true}');

  const r = migrateLegacyFolders({ appData, userData: newUser, localAppData: local });
  assert.deepEqual(r.from, [oldUser, path.join(local, 'havi-hub')]);
  assert.ok(!fs.existsSync(oldUser));
  assert.ok(fs.existsSync(path.join(newUser, 'config.json')));
  assert.ok(fs.existsSync(path.join(local, 'havihub', 'engine', 'engine.json')));
  assert.ok(fs.existsSync(path.join(appData, 'Havi Hub', 'config.json')), 'the older folder is not this installation\'s data');
  const cfg = JSON.parse(fs.readFileSync(path.join(newUser, 'config.json'), 'utf8'));
  assert.equal(cfg.engineExe, path.join(local, 'havihub', 'engine', 'custom', 'prism.exe'));
  const inst = fs.readFileSync(path.join(newUser, 'launcher', 'instances', 'A', 'instance.cfg'), 'utf8');
  assert.ok(inst.includes(path.join(newUser, 'launcher', 'java', 'bin', 'java')), inst);
  assert.deepEqual(migrateLegacyFolders({ appData, userData: newUser, localAppData: local }).moved, []);
});

test('links are repaired on a later start too (the first try could not reach them)', () => {
  const root = tmpdir();
  const oldUser = path.join(root, 'havi-hub');
  const newUser = path.join(root, 'havihub');
  const newStore = path.join(newUser, 'launcher', 'synced', 'P');
  fs.mkdirSync(newStore, { recursive: true });
  const other = path.join(root, 'modrinth', 'P');
  fs.mkdirSync(path.dirname(other), { recursive: true });
  fs.symlinkSync(path.join(oldUser, 'launcher', 'synced', 'P'), other, process.platform === 'win32' ? 'junction' : 'dir'); // dangling: the folder moved
  const real = path.join(root, 'real');
  fs.mkdirSync(real);
  fs.writeFileSync(path.join(real, 'keep.txt'), '1');
  fs.writeFileSync(path.join(newUser, 'config.json'), JSON.stringify({ sync: { groups: [{ id: 'g', store: newStore, members: [{ dir: other }, { dir: real }, { dir: path.join(root, 'gone') }] }] } }));
  assert.equal(relinkSynced(newUser, [oldUser]), 1);
  assert.equal(fs.realpathSync(other), fs.realpathSync(newStore));
  assert.equal(fs.readFileSync(path.join(real, 'keep.txt'), 'utf8'), '1'); // a real folder is never replaced
  assert.equal(relinkSynced(newUser, [oldUser]), 0);
});

test('the folders stay where they are while a game or another copy uses them', () => {
  const root = tmpdir();
  const appData = path.join(root, 'cfg');
  const oldUser = path.join(appData, 'Havi Hub');
  fs.mkdirSync(oldUser, { recursive: true });
  fs.writeFileSync(path.join(oldUser, 'config.json'), '{}');
  const r = migrateLegacyFolders({ appData, userData: path.join(appData, 'havihub'), localAppData: '', busy: (dir) => dir === oldUser });
  assert.equal(r.userData, oldUser);
  assert.ok(fs.existsSync(path.join(oldUser, 'config.json')));
  assert.ok(!fs.existsSync(path.join(appData, 'havihub')));
});

test('Linux: a process started from the folder counts as using it; this app and its helpers do not', { skip: process.platform !== 'linux' }, async () => {
  const { spawn } = require('node:child_process');
  const dir = path.join(tmpdir(), 'Havi Hub');
  fs.mkdirSync(path.join(dir, 'launcher'), { recursive: true });
  assert.equal(inUseOnLinux(dir), false);
  const child = spawn('sleep', ['30'], { cwd: path.join(dir, 'launcher'), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 200));
  try {
    assert.equal(inUseOnLinux(dir, { ownPid: 1 }), true); // someone else's
    assert.equal(inUseOnLinux(dir), false); // started by this process: one of its own helpers
  } finally {
    child.kill();
  }
});
