// Closing Havi Hub with the X while a modpack is installing: it asks first,
// "Seguir aquí" keeps everything going, "Detener y cerrar" stops the install,
// removes the half-installed profile and closes the app.
//   xvfb-run -s "-screen 0 1920x1080x24" node scripts/e2e-close.mjs [outDir] [curseforge|modrinth]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'havihub-close'));
const LAYOUT = process.argv[3] || 'curseforge';
fs.mkdirSync(out, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-close-'));
const data = path.join(work, 'PrismLauncher');
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
fs.writeFileSync(path.join(work, 'userdata', 'config.json'), JSON.stringify({ closeToTray: false, importPromptDone: true, layout: LAYOUT, themePreset: LAYOUT === 'modrinth' ? 'modrinth' : 'forge' }));
const app = await electron.launch({
  executablePath: require('electron'),
  args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--force-device-scale-factor=1.25', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  env: { ...process.env, HAVIHUB_USER_DATA: path.join(work, 'userdata'), HAVIHUB_PRISM_DIR: data, HAVIHUB_PRISM_EXE: path.join(data, 'prismlauncher'), HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs'), HAVIHUB_MOCK_SLOW_FILES: '120000' },
});
const proc = app.process();
let exited = false;
proc.on('exit', () => (exited = true));
const page = await app.firstWindow();
await app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows()[0];
  w.setSize(1536, 864);
  w.center();
});
const cap = async (n, wait = 300) => {
  await page.waitForTimeout(wait);
  const b64 = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
  fs.writeFileSync(path.join(out, `${LAYOUT}-${n}.png`), Buffer.from(b64, 'base64'));
  console.log('cap', `${LAYOUT}-${n}`);
};
const closeWindow = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
const profiles = () => fs.readdirSync(path.join(data, 'instances')).filter((d) => !d.startsWith('.') && !d.startsWith('_'));
let ok = true;
try {
  await page.waitForSelector(LAYOUT === 'modrinth' ? '.mr-inst' : '.inst-card', { timeout: 20000 });
  const before = profiles();
  // install a modpack; its files download very slowly
  page.evaluate(() => window.havihub.call('platforms.installModpack', { source: 'modrinth', projectId: '1KVo5zza', name: 'Fabulously Optimized' })).catch(() => {});
  // wait until the profile folder exists (the pack is being filled in)
  for (let i = 0; i < 100 && profiles().length === before.length; i++) await page.waitForTimeout(200);
  const added = profiles().filter((d) => !before.includes(d));
  console.log('installing into:', added.join(', ') || '(nothing yet)');
  if (!added.length) throw new Error('the modpack install did not start');

  // 1) the X asks; "Seguir aquí" keeps going
  await closeWindow();
  await page.waitForSelector('.modal', { timeout: 10000 });
  const title = (await page.locator('.modal-head h2').textContent()).trim();
  console.log('dialog:', title);
  if (!/tarea/.test(title)) throw new Error(`unexpected dialog: ${title}`);
  await cap('1-close-question', 1500);
  const bar = await page.evaluate(() => {
    const b = document.querySelector('.close-task .progress-bar');
    const track = b.parentElement;
    return { cls: track.className, inline: b.style.width, ratio: b.getBoundingClientRect().width / track.getBoundingClientRect().width, label: document.querySelector('.close-task-top .muted').textContent };
  });
  console.log('progress bar:', JSON.stringify(bar));
  await page.locator('.modal-foot .btn', { hasText: 'Seguir aquí' }).click();
  await page.waitForSelector('.modal', { state: 'detached', timeout: 5000 });
  await page.waitForTimeout(800);
  if (exited) throw new Error('the app closed after "Seguir aquí"');
  const running = (await page.evaluate(() => window.havihub.call('tasks.list'))).value || [];
  console.log('tasks after "Seguir aquí":', running.map((t) => `${t.title}: ${t.status}`).join(', '));
  if (!running.some((t) => t.status === 'running')) throw new Error('the install stopped after "Seguir aquí"');

  // 2) the X again; "Detener y cerrar" stops it, cleans up and quits
  await closeWindow();
  await page.waitForSelector('.modal', { timeout: 10000 });
  // the app closes right away, sometimes before the click has finished
  await page
    .locator('.modal-foot .btn', { hasText: 'Detener y cerrar' })
    .click({ noWaitAfter: true })
    .catch((e) => {
      if (!/closed/i.test(e.message)) throw e;
    });
  for (let i = 0; i < 100 && !exited; i++) await new Promise((r) => setTimeout(r, 100));
  console.log('app exited:', exited);
  if (!exited) throw new Error('the app did not close after "Detener y cerrar"');
  const left = profiles().filter((d) => !before.includes(d));
  console.log('half-installed profiles left:', left.length ? left.join(', ') : 'none');
  if (left.length) throw new Error('the half-installed profile was not removed');
} catch (e) {
  ok = false;
  console.error('FAILED:', e.message);
  if (!exited) await cap('zz-failure', 0).catch(() => {});
} finally {
  if (!exited) await app.close().catch(() => {});
  fs.rmSync(work, { recursive: true, force: true });
}
process.exit(ok ? 0 : 1);
