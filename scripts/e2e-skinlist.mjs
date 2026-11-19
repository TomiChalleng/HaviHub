// The skins page keeps every skin in one list: the one the account wears is
// saved into it when it is not there yet (no temporary "Current" card), the
// game's default skins come after (from the game files: set HAVIHUB_MC_ASSETS
// to a folder with block/dirt.png and entity/player/wide|slim/*.png to see them),
// and the capes list blurs the 3D view behind it.
//   xvfb-run -a -s "-screen 0 1920x1080x24" node scripts/e2e-skinlist.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const { encodePng } = require('./png.cjs');
const { paintSkin } = require('../src/shared/skinpaint.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'havihub-skinlist'));
fs.mkdirSync(out, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-skinlist-'));
const data = path.join(work, 'PrismLauncher');
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
// the account now wears a skin put on somewhere else, not in the library
const worn = paintSkin({ skin: '#8d5524', hair: '#2b1b10', shirt: '#7a3fbf', pants: '#1f2a44', eyes: '#3d9b4f' });
const wornPng = encodePng(worn.w, worn.h, worn.data);
const accFile = path.join(data, 'accounts.json');
const acc = JSON.parse(fs.readFileSync(accFile, 'utf8'));
acc.accounts[0].profile.skin = { id: 'skin-9', url: 'https://textures.minecraft.net/texture/elsewhere', variant: 'CLASSIC', data: wornPng.toString('base64') };
fs.writeFileSync(accFile, JSON.stringify(acc, null, 4));
fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
fs.writeFileSync(path.join(work, 'userdata', 'config.json'), JSON.stringify({ closeToTray: false, importPromptDone: true, layout: 'curseforge' }));
const assets = process.env.HAVIHUB_MC_ASSETS || '';
const app = await electron.launch({
  executablePath: require('electron'),
  args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--force-device-scale-factor=1.25', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  env: { ...process.env, HAVIHUB_USER_DATA: path.join(work, 'userdata'), HAVIHUB_PRISM_DIR: data, HAVIHUB_PRISM_EXE: path.join(data, 'prismlauncher'), HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs'), HAVIHUB_TEST_CF_KEY: 'test-key', HAVIHUB_MC_ASSETS: assets },
});
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};
const index = () => JSON.parse(fs.readFileSync(path.join(data, 'skins', 'index.json'), 'utf8')).skins;
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1536, 864));
  await page.waitForSelector('.top-tab', { timeout: 20000 });
  await page.locator('.top-tab', { hasText: 'Skins' }).click();
  await page.waitForSelector('.skin-card .skin-in-use', { timeout: 20000 });
  await page.waitForTimeout(1200);
  const labels = await page.locator('.skin-grid .skin-card:not(.upload) .skin-card-label').allTextContents();
  check('there is no temporary "Actual" card', !labels.some((l) => /^Actual$|^Por defecto$/.test(l.trim())), labels.join(' | '));
  const kept = index().find((s) => s.url === 'https://textures.minecraft.net/texture/elsewhere');
  check('the skin the account wears was saved into the list', Boolean(kept) && fs.existsSync(path.join(data, 'skins', `${kept.name}.png`)), kept ? kept.name : 'none');
  const inUse = await page.locator('.skin-card.in-use .skin-card-label').allTextContents();
  check('and it is the one marked "En uso", shown in the viewer', inUse.length === 1 && kept && inUse[0].includes(kept.name) && (await page.locator('.skin-card.in-use').getAttribute('class')).includes('selected'));
  check('the other skins are still there', ['havikun', 'rojo', 'verde slim'].every((n) => labels.some((l) => l.includes(n))));
  if (assets) {
    const defaults = await page.locator('.skin-grid-head ~ .skin-card .skin-card-label').allTextContents();
    check('the default skins of the game follow, in the same list', (await page.locator('.skin-grid-head').innerText()) === 'Skins por defecto' && ['Steve', 'Alex', 'Ari', 'Efe', 'Kai', 'Makena', 'Noor', 'Sunny', 'Zuri'].every((n) => defaults.some((d) => d.includes(n))), defaults.join(' | '));
    await page.locator('.skin-card', { hasText: 'Kai' }).click();
    await page.waitForTimeout(500);
    check('a default skin can be chosen (Apply turns on)', await page.locator('.skin-bottom .btn-primary').isEnabled());
    check('default skins cannot be deleted or renamed', (await page.locator('.skin-card', { hasText: 'Kai' }).evaluate((el) => el.oncontextmenu)) === null);
  }
  await page.screenshot({ path: path.join(out, 'skins-list.png') });
  // the in-use skin cannot be deleted from its menu
  await page.locator('.skin-card.in-use').click({ button: 'right' });
  check('the skin in use has no Delete in its menu', (await page.locator('.menu-item', { hasText: 'Eliminar' }).count()) === 0);
  await page.keyboard.press('Escape');
  await page.locator('.skin-card', { hasText: 'rojo' }).click({ button: 'right' });
  check('the others do', (await page.locator('.menu-item', { hasText: 'Eliminar' }).count()) === 1);
  await page.keyboard.press('Escape');
  // the capes list: frosted glass over the 3D view
  await page.locator('.skin-tool.wide').click();
  await page.waitForSelector('.popover.cape-menu');
  const glass = await page.locator('.popover.cape-menu').evaluate((el) => getComputedStyle(el).backdropFilter);
  check('the capes list blurs what is behind it', /blur\(14px\)/.test(glass), glass);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, 'capes-blur.png') });
  await page.keyboard.press('Escape');
  // reopening the page does not save it twice
  await page.locator('.top-tab', { hasText: 'Mis modpacks' }).click();
  await page.locator('.top-tab', { hasText: 'Skins' }).click();
  await page.waitForSelector('.skin-card .skin-in-use');
  await page.waitForTimeout(1200);
  check('opening the page again saves nothing twice', index().filter((s) => s.url === 'https://textures.minecraft.net/texture/elsewhere').length === 1 && fs.readdirSync(path.join(data, 'skins')).filter((f) => f.endsWith('.png')).length === 4);
} catch (e) {
  console.error(e);
  failed++;
} finally {
  await app.close();
}
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
