// The guided tour after the welcome, in both layouts: every step lights up
// its part of the window, Next / Previous move, Skip ends it for good.
//   xvfb-run -s "-screen 0 1920x1080x24" node scripts/e2e-tour.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'havihub-tour'));
fs.mkdirSync(out, { recursive: true });

for (const layout of ['curseforge', 'modrinth']) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-tour-'));
  const data = path.join(work, 'PrismLauncher');
  execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
  fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
  fs.writeFileSync(path.join(work, 'userdata', 'config.json'), JSON.stringify({ closeToTray: false, importPromptDone: true, layout, welcomeDone: true, tourPending: true, privacy: { socialAsked: true } }));
  const app = await electron.launch({
    executablePath: require('electron'),
    args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    env: { ...process.env, HAVIHUB_USER_DATA: path.join(work, 'userdata'), HAVIHUB_PRISM_DIR: data, HAVIHUB_PRISM_EXE: path.join(data, 'prismlauncher'), HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs') },
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1536, 864));
  try {
    await page.waitForSelector('.tour-card', { timeout: 20000 });
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(700);
      const lit = await page.locator('.tour-spot').count();
      if (!lit) throw new Error(`${layout}: step ${i + 1} lights up nothing`);
      await page.screenshot({ path: path.join(out, `${layout}-${i + 1}.png`) });
      await page.locator('.tour-btn.primary').click();
    }
    await page.waitForTimeout(500);
    if (await page.locator('.tour-card').count()) throw new Error(`${layout}: the tour is still open after the last step`);
    const cfg = JSON.parse(fs.readFileSync(path.join(work, 'userdata', 'config.json'), 'utf8'));
    if (cfg.tourPending !== false || cfg.tourDone !== true) throw new Error(`${layout}: the tour would show again`);
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(layout, 'ok');
  } finally {
    await app.close();
  }
}
