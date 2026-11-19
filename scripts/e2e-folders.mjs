// The data folder is "havihub". A folder with the old name ("havi-hub") is
// renamed on the first start, with its profiles, settings and synced links.
//   xvfb-run -a -s "-screen 0 1920x1080x24" node scripts/e2e-folders.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-folders-'));
const cfgHome = path.join(work, 'config');
const oldUser = path.join(cfgHome, 'havi-hub');
const newUser = path.join(cfgHome, 'havihub');
const data = path.join(oldUser, 'launcher');
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
// a profile synced with another launcher: both game folders are links to one shared folder
const store = path.join(data, 'synced', 'Compartido');
const haviGame = path.join(data, 'instances', '26.2 Vanilla', 'minecraft');
const other = path.join(work, 'otro-launcher', 'Vanilla');
fs.mkdirSync(path.dirname(store), { recursive: true });
fs.renameSync(haviGame, store);
fs.symlinkSync(store, haviGame, 'dir');
fs.mkdirSync(path.dirname(other), { recursive: true });
fs.symlinkSync(store, other, 'dir');
fs.writeFileSync(
  path.join(oldUser, 'config.json'),
  JSON.stringify({ closeToTray: false, importPromptDone: true, layout: 'curseforge', themePreset: 'forge', sync: { groups: [{ id: 'g1', name: 'Vanilla', store, mcVersion: '26.2', loader: 'fabric', members: [{ launcher: 'havi', dir: haviGame, name: 'Vanilla', instanceId: '26.2 Vanilla' }, { launcher: 'curseforge', dir: other, name: 'Vanilla' }] }] } }),
);
const env = { ...process.env, XDG_CONFIG_HOME: cfgHome, XDG_DATA_HOME: path.join(work, 'share'), HAVIHUB_PRISM_EXE: path.join(data, 'prismlauncher'), HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs'), HAVIHUB_TEST_CF_KEY: 'test-key' };
delete env.HAVIHUB_USER_DATA;
const launch = () =>
  electron.launch({ executablePath: require('electron'), args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], env });
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};
try {
  let app = await launch();
  let page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  await page.waitForSelector('.inst-card, .group-card', { timeout: 30000 });
  const dir = await app.evaluate(({ app }) => app.getPath('userData'));
  check('the app uses the "havihub" folder', dir === newUser, dir);
  check('the old "havi-hub" folder was renamed, not copied', !fs.existsSync(oldUser) && fs.existsSync(path.join(newUser, 'config.json')), fs.readdirSync(cfgHome).join(', '));
  const list = await page.evaluate(async () => (await window.havihub.call('instances.list')).value.instances.map((i) => i.name));
  check('the profiles are all there', list.length >= 5 && list.includes('[26.2] Vanilla'), `${list.length} profiles`);
  const cfg = JSON.parse(fs.readFileSync(path.join(newUser, 'config.json'), 'utf8'));
  const newStore = path.join(newUser, 'launcher', 'synced', 'Compartido');
  check('saved paths point to the new folder', cfg.sync.groups[0].store === newStore && cfg.layout === 'curseforge');
  check('the synced links reach the shared folder again (Havi Hub\'s and the other launcher\'s)', fs.realpathSync(path.join(newUser, 'launcher', 'instances', '26.2 Vanilla', 'minecraft')) === fs.realpathSync(newStore) && fs.realpathSync(other) === fs.realpathSync(newStore) && fs.existsSync(path.join(other, 'mods')));
  // the profile's mods are read through the link
  await page.locator('.group-card', { hasText: 'Vanilla' }).click();
  await page.locator('.inst-card', { hasText: '[26.2] Vanilla' }).click();
  await page.waitForSelector('.kebab');
  await page.waitForTimeout(1200);
  check('the synced profile shows its mods', /Mods \((\d+)\)/.test(await page.locator('body').innerText()) && Number(/Mods \((\d+)\)/.exec(await page.locator('body').innerText())[1]) >= 8);
  await app.close();
  check('nothing created the old folder again', !fs.existsSync(oldUser), fs.readdirSync(cfgHome).join(', '));
  // ---- a second start: same folder, nothing to move
  app = await launch();
  page = await app.firstWindow();
  await page.waitForSelector('.inst-card, .group-card', { timeout: 30000 });
  check('second start: still "havihub", still the same profiles', (await app.evaluate(({ app }) => app.getPath('userData'))) === newUser && !fs.existsSync(oldUser));
  await app.close();
  // ---- a fresh computer: the folder is made with the new name
  const fresh = path.join(work, 'fresh');
  fs.mkdirSync(fresh);
  const app2 = await electron.launch({ executablePath: require('electron'), args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], env: { ...env, XDG_CONFIG_HOME: fresh, HAVIHUB_PRISM_EXE: '' } });
  const p2 = await app2.firstWindow();
  await p2.waitForTimeout(2500);
  await app2.close();
  check('a first install makes only "havihub"', fs.readdirSync(fresh).join(',') === 'havihub', fs.readdirSync(fresh).join(', '));
} catch (e) {
  console.error('FAILED', e.message.slice(0, 500));
  failed++;
}
fs.rmSync(work, { recursive: true, force: true });
console.log(failed ? `${failed} failed` : 'all ok');
process.exit(failed ? 1 : 0);
