// The contents follow the size of the window: full size when it fills the
// screen, smaller (never under 60 %) when it is smaller; off in Settings.
// Also: the "Saved" mark shows when a setting is changed.
//   xvfb-run -a -s "-screen 0 1920x1080x24" node scripts/e2e-scale.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-scale-'));
const data = path.join(work, 'PrismLauncher');
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
fs.writeFileSync(path.join(work, 'userdata', 'config.json'), JSON.stringify({ closeToTray: false, importPromptDone: true, layout: 'curseforge', themePreset: 'forge' }));
const app = await electron.launch({
  executablePath: require('electron'),
  args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--force-device-scale-factor=1.25', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  env: { ...process.env, HAVIHUB_USER_DATA: path.join(work, 'userdata'), HAVIHUB_PRISM_DIR: data, HAVIHUB_PRISM_EXE: path.join(data, 'prismlauncher'), HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs'), HAVIHUB_TEST_CF_KEY: 'test-key', HAVIHUB_AUTOSCALE: '1' },
});
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const page = await app.firstWindow();
  await page.waitForSelector('.inst-card, .group-card', { timeout: 20000 });
  const size = async (w, h) => {
    await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setContentSize(w, h), [w, h]);
    await wait(500);
    return app.evaluate(({ BrowserWindow, screen }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return { zoom: Math.round(win.webContents.getZoomFactor() * 1000) / 1000, area: screen.getPrimaryDisplay().workAreaSize, content: win.getContentSize(), min: win.getMinimumSize() };
    });
  };
  const area = (await size(900, 600)).area;
  const full = await size(area.width, area.height);
  check('a window that fills the screen: full size', full.zoom === 0.8, `zoom ${full.zoom}`);
  // on this screen (125 %), comfortable text is 14 real pixels: 87.5 % of the full size
  const floor = 14 / (16 * 1.25 * 0.8);
  const real = (zoom) => Math.round(16 * zoom * 1.25 * 10) / 10;
  const most = await size(Math.round(area.width * 0.8), Math.round(area.height * 0.8));
  check('a somewhat smaller window: contents a little smaller', most.zoom < 0.8 && most.zoom > 0.8 * floor, `zoom ${most.zoom}, text ${real(most.zoom)} px`);
  const half = await size(Math.round(area.width * 0.5), Math.round(area.height * 0.55));
  check('a small window: contents at their comfortable minimum, no smaller', Math.abs(half.zoom - 0.8 * floor) < 0.006, `zoom ${half.zoom}, text ${real(half.zoom)} px`);
  const tiny = await size(300, 200);
  check('the window stops shrinking where the layout still fits', Math.abs(tiny.zoom - 0.8 * floor) < 0.006 && tiny.content[0] >= tiny.min[0] && tiny.content[0] > 700, `window ${tiny.content.join('×')}, text ${real(tiny.zoom)} px`);
  const css = await page.evaluate(() => [innerWidth, innerHeight]);
  check('the layout fits at the smallest size', css[0] >= 1030 && css[1] >= 650, `layout ${css.join('×')}`);
  const btn = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.side-btn, .tabs button, .toolbar .btn')].map((b) => b.getBoundingClientRect().height).filter(Boolean)));
  check('buttons stay easy to hit', btn * tiny.zoom * 1.25 >= 30, `smallest of the main buttons: ${Math.round(btn * tiny.zoom * 1.25)} real px tall`);
  // the setting, and the "Saved" mark
  await size(Math.round(area.width * 0.6), Math.round(area.height * 0.6));
  await page.evaluate(() => document.querySelector('[aria-label="Ajustes"]').click());
  await page.waitForSelector('.settings');
  await page.evaluate(() => window.havihub.call('app.updateConfig', { autoScale: false }));
  await wait(400);
  check('turned off in Settings: back to the fixed size', (await size(Math.round(area.width * 0.7), Math.round(area.height * 0.7))).zoom === 0.8);
  check('changes made behind the scenes show no mark', (await page.locator('.saved-mark').count()) === 0);
  // a setting changed by hand in the page
  const toggle = page.locator('.settings .toggle').nth(1); // "Al cerrar con la X, dejar Havi Hub en la bandeja"
  await toggle.click();
  const mark = await page.waitForSelector('.saved-mark', { timeout: 4000 }).catch(() => null);
  check('changing a setting shows "Guardado"', Boolean(mark) && /Guardado/.test(await page.locator('.saved-mark').innerText()));
  await wait(1900);
  check('…and it goes away by itself', (await page.locator('.saved-mark').count()) === 0);
} catch (e) {
  console.error('FAILED', e.message.slice(0, 400));
  failed++;
}
await app.close().catch(() => {});
fs.rmSync(work, { recursive: true, force: true });
console.log(failed ? `${failed} failed` : 'all ok');
process.exit(failed ? 1 : 0);
