// When Havi Hub is not the window in use for a while, it stands still
// (snow, lights, the 3D skin view, spinners) and moves again on coming back.
//   xvfb-run -a -s "-screen 0 1920x1080x24" node scripts/e2e-quiet.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-quiet-'));
const data = path.join(work, 'PrismLauncher');
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
fs.writeFileSync(path.join(work, 'userdata', 'config.json'), JSON.stringify({ closeToTray: false, importPromptDone: true, layout: 'curseforge', themePreset: 'forge', seasons: { enabled: true, scares: false } }));
const app = await electron.launch({
  executablePath: require('electron'),
  args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  env: { ...process.env, HAVIHUB_USER_DATA: path.join(work, 'userdata'), HAVIHUB_PRISM_DIR: data, HAVIHUB_PRISM_EXE: path.join(data, 'prismlauncher'), HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs'), HAVIHUB_TEST_CF_KEY: 'test-key', HAVIHUB_FAKE_DATE: '2026-12-24T20:00:00', HAVIHUB_MC_ASSETS: process.env.HAVIHUB_MC_ASSETS || '' },
});
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  await page.waitForSelector('.inst-card, .group-card', { timeout: 30000 });
  await page.locator('.side-game').click();
  await page.locator('.top-tab', { hasText: 'Skins' }).click();
  await page.waitForSelector('canvas');
  await page.waitForSelector('.season-snow');
  await page.waitForTimeout(1500);
  // count what the 3D view draws (each frame starts with a clear)
  await page.evaluate(() => {
    window.__clears = 0;
    for (const P of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
      const c = P.clear;
      P.clear = function (...a) {
        window.__clears++;
        return c.apply(this, a);
      };
    }
  });
  const draws = async (ms) => {
    const a = await page.evaluate(() => window.__clears);
    await page.waitForTimeout(ms);
    return (await page.evaluate(() => window.__clears)) - a;
  };
  const state = () =>
    page.evaluate(() => ({
      quiet: document.documentElement.hasAttribute('data-quiet'),
      snow: [...document.querySelectorAll('.snow-layer, .snow-sway, .flake')].map((e) => getComputedStyle(e).animationPlayState).join(','),
    }));
  check('in use: the 3D view draws and nothing is quiet', (await draws(2000)) > 0 && !(await state()).quiet);
  // another window becomes the one in use (the wait is shortened for the test)
  await page.evaluate(() => {
    window.__havihubQuietAfterMs = 1500;
    document.hasFocus = () => false;
    window.dispatchEvent(new Event('blur'));
  });
  await page.waitForTimeout(400);
  check('just after leaving, everything still moves', !(await state()).quiet);
  await page.waitForTimeout(1600);
  const q = await state();
  check('after a while out of use, Havi Hub is quiet and the snow stands still', q.quiet && (!q.snow || !/running/.test(q.snow)), JSON.stringify(q));
  check('…and the 3D view stops drawing', (await draws(2000)) === 0);
  // back
  await page.evaluate(() => {
    delete document.hasFocus;
    window.dispatchEvent(new Event('focus'));
  });
  await page.waitForTimeout(300);
  const b = await state();
  check('coming back, everything moves again at once', !b.quiet && (await draws(2000)) > 0 && (!b.snow || !/paused/.test(b.snow)), JSON.stringify(b));
  // a quick look at another window does not stop anything
  await page.evaluate(() => {
    document.hasFocus = () => false;
    window.dispatchEvent(new Event('blur'));
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    delete document.hasFocus;
    window.dispatchEvent(new Event('focus'));
  });
  await page.waitForTimeout(1500);
  check('a short visit elsewhere does not make it quiet', !(await state()).quiet);
} catch (e) {
  console.error('FAILED', e.message.slice(0, 500));
  failed++;
}
await app.close().catch(() => {});
fs.rmSync(work, { recursive: true, force: true });
console.log(failed ? `${failed} failed` : 'all ok');
process.exit(failed ? 1 : 0);
