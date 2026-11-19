// Where Havi Hub spends time, memory and processor: start-up, each page left
// idle, and what is left after walking through the pages.
//   xvfb-run -a -s "-screen 0 1920x1080x24" node scripts/profile.mjs [curseforge|modrinth] [label]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAYOUT = process.argv[2] || 'curseforge';
const label = process.argv[3] || '';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-profile-'));
const data = path.join(work, 'PrismLauncher');
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
const cfg = (extra = {}) => fs.writeFileSync(path.join(work, 'userdata', 'config.json'), JSON.stringify({ closeToTray: true, closeAsked: true, importPromptDone: true, layout: LAYOUT, themePreset: LAYOUT === 'modrinth' ? 'modrinth' : 'forge', ...extra }));
cfg();
const READY = LAYOUT === 'modrinth' ? '.mr-inst' : '.inst-card, .group-card';
const start = async (env = {}) => {
  const t0 = Date.now();
  const app = await electron.launch({
    // PROFILE_EXE: a packaged copy to measure instead of this source tree (to compare two versions)
    executablePath: process.env.PROFILE_EXE || require('electron'),
    args: [...(process.env.PROFILE_EXE ? [] : [path.join(root, 'dist/main.js')]), '--no-sandbox', '--lang=es-CL', '--force-device-scale-factor=1.25', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    env: { ...process.env, HAVIHUB_USER_DATA: path.join(work, 'userdata'), HAVIHUB_PRISM_DIR: data, HAVIHUB_PRISM_EXE: path.join(data, 'prismlauncher'), HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs'), HAVIHUB_TEST_CF_KEY: 'test-key', HAVIHUB_MC_ASSETS: process.env.HAVIHUB_MC_ASSETS || '', ...env },
  });
  const page = await app.firstWindow();
  await page.waitForSelector(READY, { timeout: 30000 });
  return { app, page, ms: Date.now() - t0 };
};
const sample = async (app, seconds) => {
  await app.evaluate(({ app }) => app.getAppMetrics());
  await new Promise((r) => setTimeout(r, seconds * 1000));
  const m = await app.evaluate(({ app }) => app.getAppMetrics().map((p) => ({ type: p.type, mem: p.memory.workingSetSize, cpu: p.cpu.percentCPUUsage })));
  const sum = (f) => m.filter(f).reduce((a, p) => ({ mb: a.mb + p.mem / 1024, cpu: a.cpu + p.cpu }), { mb: 0, cpu: 0 });
  const all = sum(() => true);
  const tab = sum((p) => p.type === 'Tab');
  const main = sum((p) => p.type === 'Browser');
  const gpu = sum((p) => p.type === 'GPU');
  return `${all.mb.toFixed(0)} MB, ${all.cpu.toFixed(1)}% CPU (ventana ${tab.mb.toFixed(0)} MB ${tab.cpu.toFixed(1)}%, principal ${main.mb.toFixed(0)} MB ${main.cpu.toFixed(1)}%, gráficos ${gpu.mb.toFixed(0)} MB ${gpu.cpu.toFixed(1)}%)`;
};
const tag = `[${LAYOUT}${label ? ' ' + label : ''}]`;
try {
  // ---- start-up: the first run, then two more (the later ones are what people get every day)
  const times = [];
  for (let i = 0; i < 3; i++) {
    const s = await start();
    times.push(s.ms);
    await s.page.waitForTimeout(1500);
    await s.app.close();
  }
  console.log(`${tag} start-up: first ${times[0]} ms, then ${times.slice(1).join(' / ')} ms`);
  // ---- pages left idle
  let { app, page } = await start();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1536, 864));
  await page.waitForTimeout(4000);
  console.log(`${tag} library, idle     : ${await sample(app, 6)}`);
  const go = async (name) => {
    if (LAYOUT === 'modrinth') await page.evaluate((n) => { location.hash = n; }, name).catch(() => {});
  };
  const open = async (what) => {
    if (what === 'skins') {
      if (LAYOUT === 'modrinth') await page.locator('.mr-navbtn[aria-label="Skins"]').first().click();
      else {
        await page.locator('.side-game').click();
        await page.locator('.top-tab', { hasText: 'Skins' }).click();
      }
      await page.waitForSelector('.skin-stage canvas, .skins canvas', { timeout: 15000 }).catch(() => {});
    } else if (what === 'browse') {
      if (LAYOUT === 'modrinth') await page.locator('.mr-navbtn[aria-label="Descubrir contenido"], .mr-navbtn[aria-label="Descubrir"]').first().click();
      else {
        await page.locator('.side-game').click();
        await page.locator('.top-tab', { hasText: 'Descubrir' }).click();
      }
      await page.waitForTimeout(2500);
    } else if (what === 'library') {
      if (LAYOUT === 'modrinth') await page.locator('.mr-navbtn[aria-label="Inicio"]').first().click();
      else {
        await page.locator('.side-game').click();
        await page.locator('.top-tab', { hasText: 'Mis modpacks' }).click();
      }
      await page.waitForTimeout(1500);
    }
  };
  void go;
  await open('skins');
  await page.waitForTimeout(3000);
  console.log(`${tag} skins, idle       : ${await sample(app, 6)}`);
  await open('browse');
  console.log(`${tag} discover, idle    : ${await sample(app, 6)}`);
  for (let i = 0; i < 4; i++) {
    await open('skins');
    await page.waitForTimeout(1200);
    await open('browse');
    await open('library');
  }
  await page.waitForTimeout(3000);
  console.log(`${tag} after 4 rounds    : ${await sample(app, 6)}  (JS ${await page.evaluate(() => Math.round(performance.memory.usedJSHeapSize / 1048576))} MB)`);
  await app.close();
  // ---- a festive theme on (snow, lights)
  cfg({ seasons: { enabled: true, scares: false } });
  ({ app, page } = await start({ HAVIHUB_FAKE_DATE: '2026-12-24T20:00:00' }));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1536, 864));
  await page.waitForTimeout(5000);
  console.log(`${tag} Christmas, idle   : ${await sample(app, 6)}`);
  await app.close();
} catch (e) {
  console.error('FAILED', e.message.slice(0, 300));
}
fs.rmSync(work, { recursive: true, force: true });
process.exit(0);
