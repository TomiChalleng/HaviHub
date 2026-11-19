// Log diagnosis, Java version per Minecraft version, service deadlines and world backups.
const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { diagnoseLog } = require('../src/shared/logdiag');
const { requiredJavaMajor } = require('../src/main/javainstall');
const { withDeadline } = require('../src/main/platforms/unified');
const { Worlds } = require('../src/main/prism/worlds');

test('log diagnosis: missing dependency, wrong Java and out of memory', () => {
  const ids = (t) => diagnoseLog(t).map((f) => f.id);
  assert.deepEqual(ids("Mod 'Sodium Extra' (sodium-extra) 0.5.4 requires any version of 'sodium', which is missing!"), ['missing-dependency']);
  assert.deepEqual(diagnoseLog("Mod ID: 'jei', Requested by: 'emi', Expected range: '[19,)'")[0].vars.list, 'jei (emi)');
  const java = diagnoseLog('java.lang.UnsupportedClassVersionError: a/B has been compiled by a more recent version of the Java Runtime (class file version 65.0), this version of the Java Runtime only recognizes class file versions up to 61.0');
  assert.deepEqual([java[0].id, java[0].vars.need, java[0].vars.have], ['java', 21, 17]);
  assert.deepEqual(ids('Exception in thread "main" java.lang.OutOfMemoryError: Java heap space'), ['memory']);
  assert.deepEqual(ids('Error occurred during initialization of VM\nCould not reserve enough space for 8388608KB object heap'), ['memory']);
  assert.deepEqual(ids('[12:00:00] [main/INFO]: Loading 120 mods'), []);
});

test('Java major for each Minecraft version', () => {
  assert.equal(requiredJavaMajor('1.12.2'), 8);
  assert.equal(requiredJavaMajor('1.16.5'), 8);
  assert.equal(requiredJavaMajor('1.17.1'), 17);
  assert.equal(requiredJavaMajor('1.20.4'), 17);
  assert.equal(requiredJavaMajor('1.20.5'), 21);
  assert.equal(requiredJavaMajor('1.21.4'), 21);
  assert.equal(requiredJavaMajor('24w14a'), 21);
  assert.equal(requiredJavaMajor('23w45a'), 17);
  assert.equal(requiredJavaMajor(''), 0);
});

test('a slow service is given up after its deadline', async () => {
  const slow = new Promise((r) => setTimeout(() => r('late'), 500));
  await assert.rejects(withDeadline(slow, 20), (e) => e.code === 'SLOW');
  assert.equal(await withDeadline(Promise.resolve('ok'), 20), 'ok');
});

test('world backup before updating: one zip of saves/, the last 3 kept', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'havihub-bk-'));
  const game = path.join(root, 'minecraft');
  await fsp.mkdir(path.join(game, 'saves', 'World'), { recursive: true });
  await fsp.writeFile(path.join(game, 'saves', 'World', 'level.dat'), 'x');
  await fsp.writeFile(path.join(root, 'instance.cfg'), '');
  const worlds = new Worlds({ locate: async () => root });
  worlds.savesDir = async () => path.join(game, 'saves');
  const backups = path.join(game, 'backups');
  await fsp.mkdir(backups, { recursive: true });
  for (const d of ['2020-01-01', '2020-01-02', '2020-01-03']) await fsp.writeFile(path.join(backups, `havihub-saves_${d}.zip`), '');
  const dest = await worlds.backupAll('x', { keep: 3 });
  const left = (await fsp.readdir(backups)).sort();
  assert.equal(left.length, 3);
  assert.ok(left.includes(path.basename(dest)));
  assert.ok(!left.includes('havihub-saves_2020-01-01.zip'));
  await fsp.rm(root, { recursive: true, force: true });
});
