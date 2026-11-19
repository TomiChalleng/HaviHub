// Seasonal themes end to end: starts the app on Halloween, Christmas Eve and a
// few seconds before New Year (HAVIHUB_FAKE_DATE) and saves screenshots.
//   xvfb-run -s "-screen 0 1920x1080x24" node scripts/e2e-seasons.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'havihub-seasons'));
fs.mkdirSync(out, { recursive: true });
const W = 1536;
const H = 864;
// HAVIHUB_E2E_LAYOUT=modrinth runs the same seasons in the Modrinth layout
const LAYOUT = process.env.HAVIHUB_E2E_LAYOUT || 'curseforge';
const CARD = LAYOUT === 'modrinth' ? '.mr-inst' : '.inst-card';
const PREFIX = LAYOUT === 'modrinth' ? 'mr-' : '';
const SETTINGS_BTN = LAYOUT === 'modrinth' ? '.mr-navbtn[aria-label="Ajustes"]' : '.side-btn[aria-label="Ajustes"]';
const SETTINGS_CLOSE = LAYOUT === 'modrinth' ? '.mr-settings-close' : '.settings-close';

async function run(name, fakeDate, steps) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-season-'));
  const data = path.join(work, 'PrismLauncher');
  execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
  fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
  fs.writeFileSync(path.join(work, 'userdata', 'config.json'), JSON.stringify({ closeToTray: false, importPromptDone: true, layout: LAYOUT, themePreset: LAYOUT === 'modrinth' ? 'modrinth' : 'forge' }));
  const app = await electron.launch({
    executablePath: require('electron'),
    args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--force-device-scale-factor=1.25', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
    env: { ...process.env, HAVIHUB_USER_DATA: path.join(work, 'userdata'), HAVIHUB_PRISM_DIR: data, HAVIHUB_PRISM_EXE: path.join(data, 'prismlauncher'), HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs'), HAVIHUB_FAKE_DATE: fakeDate || '' },
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await app.evaluate(({ BrowserWindow }, [w, h]) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(w, h);
    win.center();
  }, [W, H]);
  const cap = async (n, wait = 300) => {
    await page.waitForTimeout(wait);
    const b64 = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
    fs.writeFileSync(path.join(out, `${PREFIX}${name}-${n}.png`), Buffer.from(b64, 'base64'));
    console.log('cap', `${PREFIX}${name}-${n}`);
  };
  try {
    await page.waitForSelector(CARD, { timeout: 20000 });
    await steps({ page, app, cap, work });
  } catch (e) {
    console.error(`${name} failed:`, e.message);
    await cap('zz-failure', 0);
    process.exitCode = 1;
  } finally {
    if (errors.length) console.log(`--- ${name} renderer errors ---\n` + [...new Set(errors)].join('\n'));
    await app.close();
    fs.rmSync(work, { recursive: true, force: true });
  }
}

await run('halloween', '2026-10-31T20:00:00', async ({ page, cap }) => {
  await page.waitForSelector('.season-notice');
  const season = await page.evaluate(() => document.documentElement.dataset.season);
  if (season !== 'halloween') throw new Error(`season is ${season}`);
  await cap('1-library', 800);
  await page.waitForSelector('.bat-flock', { timeout: 15000 });
  await cap('2-bats', 2500);
  await page.locator('.season-notice .btn', { hasText: 'Abrir Ajustes' }).click();
  await page.waitForSelector('.season-list');
  await cap('3-settings', 1200);
  await page.locator('.season-sub .btn', { hasText: 'Probar' }).click();
  await page.waitForSelector('.scare');
  await cap('4-scare', 450);
  await page.waitForSelector('.scare', { state: 'detached', timeout: 5000 });
});

await run('christmas', '2026-12-24T19:00:00', async ({ page, cap }) => {
  await page.waitForSelector('.garland');
  await cap('1-library', 1500);
  await page.locator('.season-notice .btn', { hasText: 'Entendido' }).click();
  await page.locator(CARD).first().click();
  await cap('2-instance', 1500);
});

await run('newyear', '2026-12-31T23:59:51', async ({ page, cap }) => {
  await page.waitForSelector('.ny-chip');
  await cap('1-countdown', 600);
  const txt = await page.locator('.ny-chip').textContent();
  console.log('countdown:', txt);
  await page.locator('.season-notice .btn', { hasText: 'Entendido' }).click();
  await page.waitForSelector('.fx-canvas', { timeout: 20000 });
  await cap('2-midnight', 2600);
  await cap('3-fireworks', 2200);
  await cap('4-fireworks', 2400);
  await cap('5-fireworks', 2600);
  const chip = await page.locator('.ny-chip').textContent();
  if (!/2027/.test(chip)) throw new Error(`after midnight the chip says ${chip}`);
});

await run('preview', '', async ({ page, cap }) => {
  const season = await page.evaluate(() => document.documentElement.dataset.season);
  if (season) throw new Error(`no season expected today, got ${season}`);
  await page.locator(SETTINGS_BTN).click();
  await page.locator('.settings-item', { hasText: 'Temas' }).click();
  await page.locator('.season-row', { hasText: 'Navidad' }).locator('.btn', { hasText: 'Vista previa' }).click();
  await cap('1-christmas-preview', 800);
  await page.locator('.season-preview-bar .link-btn').click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.documentElement.dataset.season);
  if (after) throw new Error('preview did not end');
  await page.locator('.season-row', { hasText: 'Año Nuevo' }).locator('.btn', { hasText: 'Vista previa' }).click();
  await page.locator(SETTINGS_CLOSE).click();
  await page.waitForSelector('.fx-canvas', { timeout: 5000 });
  await cap('2-newyear-preview', 3500);
});
