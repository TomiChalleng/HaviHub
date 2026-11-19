// Sleeping in the tray: after a while hidden, the window is put away (its
// memory is freed); it comes back on the same page. A game that crashes while
// the window is put away brings Havi Hub back by itself, on that game's log.
//   xvfb-run -a node scripts/e2e-sleep.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-sleep-'));
const data = path.join(work, 'PrismLauncher');
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
fs.writeFileSync(path.join(work, 'userdata', 'config.json'), JSON.stringify({ closeToTray: true, closeAsked: true, importPromptDone: true, trayHintShown: true, layout: process.argv[2] || 'curseforge', themePreset: process.argv[2] === 'modrinth' ? 'modrinth' : 'forge' }));
const app = await electron.launch({
  executablePath: require('electron'),
  args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  env: { ...process.env, HAVIHUB_USER_DATA: path.join(work, 'userdata'), HAVIHUB_PRISM_DIR: data, HAVIHUB_PRISM_EXE: path.join(data, 'prismlauncher'), HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs'), HAVIHUB_TEST_CF_KEY: 'test-key', HAVIHUB_SLEEP_MS: '1500' },
});
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const state = () =>
  app.evaluate(({ app, BrowserWindow }) => ({
    windows: BrowserWindow.getAllWindows().map((w) => ({ visible: w.isVisible(), bounds: w.getBounds(), max: w.isMaximized() })),
    tabs: app.getAppMetrics().filter((p) => p.type === 'Tab').length,
    mb: Math.round(app.getAppMetrics().reduce((a, p) => a + p.memory.workingSetSize, 0) / 1024),
  }));
// run something in the (current) window's page
const inPage = (code) => app.evaluate(({ BrowserWindow }, c) => { const w = BrowserWindow.getAllWindows()[0]; return w ? w.webContents.executeJavaScript(c, true) : null; }, code);
const until = async (fn, ms = 15000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await wait(250);
  }
};
try {
  const page = await app.firstWindow();
  await page.waitForSelector('.inst-card, .group-card, .mr-inst', { timeout: 20000 });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 40, y: 30, width: 1300, height: 800 }));
  // go to Settings, so "the same page" means something
  await inPage(`document.querySelector('[aria-label="Ajustes"]').click()`);
  await page.waitForSelector('.settings, .mr-settings-window', { timeout: 8000 });
  const routeBefore = await inPage(`localStorage.getItem('havihub.route')`);
  check('page remembers its route', /settings/.test(routeBefore || ''), routeBefore);
  const before = await state();

  // 1. a dialog open: it must not be put away
  await inPage(`window.__test_was = window.__havihubCanSleep()`);
  check('idle page says it may sleep', (await inPage(`window.__test_was`)) === true);
  let s = await state();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await until(async () => !(await state()).windows[0].visible, 5000);
  s = await state();
  check('X hides to the tray', s.windows.length === 1 && !s.windows[0].visible);

  // 2. asleep after the delay
  const slept = await until(async () => (await state()).windows.length === 0, 10000);
  await until(async () => (await state()).tabs === 0, 8000);
  await wait(1000);
  s = await state();
  check('window put away after the delay', Boolean(slept) && s.tabs === 0, `${before.mb} MB → ${s.mb} MB`);
  check('memory went down', s.mb < before.mb - 60, `-${before.mb - s.mb} MB`);
  await wait(1500);
  check('app still running with no window', (await state()).windows.length === 0);

  // 3. wake up as the tray icon / second launch does
  await app.evaluate(({ app }) => app.emit('second-instance', {}, []));
  const woke = await until(async () => { const x = await state(); return x.windows.length === 1 && x.windows[0].visible; }, 15000);
  check('window is back', Boolean(woke));
  const onSettings = await until(() => inPage(`Boolean(document.querySelector('.settings, .mr-settings-window'))`), 15000);
  check('back on the same page (Settings)', Boolean(onSettings));
  s = await state();
  const b = s.windows[0].bounds;
  check('same place and size', b.x === 40 && b.y === 30 && b.width === 1300 && b.height === 800, JSON.stringify(b));
  check('instances loaded after waking', (await inPage(`window.havihub.call('instances.list').then(r => r.ok)`)) === true);
  const inst = await inPage(`window.havihub.call('instances.list').then(r => { const l = Array.isArray(r.value) ? r.value : r.value.instances; return { id: l[0].id, name: l[0].name }; })`);

  // 4. a game crashes while the window is put away: Havi Hub comes back by itself, on its log
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  const sleptAgain = await until(async () => (await state()).windows.length === 0, 12000);
  check('put away again', Boolean(sleptAgain));
  await app.evaluate((_, id) => {
    // same path the launcher uses to tell the page
    process.emit('havihub-test-emit', 'instance:running', { id, running: false, code: 1, crashed: true, crash: { file: 'logs/latest.log' }, failed: false });
  }, inst.id);
  const back = await until(async () => { const x = await state(); return x.windows.length === 1 && x.windows[0].visible; }, 15000);
  check('the crash brings the window back by itself', Boolean(back));
  const onLog = await until(() => inPage(`Boolean(document.querySelector('.logs-tab'))`), 15000);
  check('…on the log of that game', Boolean(onLog));
  const toast = await until(() => inPage(`(document.querySelector('.toasts')||{}).innerText || ''`), 8000);
  check('…saying it closed because of an error', (toast || '').includes(`${inst.name} se cerró por un error`), JSON.stringify((toast || '').slice(0, 80)));

  // 5. with the option off it stays loaded
  await inPage(`window.havihub.call('app.updateConfig', { sleepInTray: false })`);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await wait(4500);
  s = await state();
  check('option off: hidden but not put away', s.windows.length === 1 && !s.windows[0].visible && s.tabs === 1);
} catch (e) {
  console.error('FAILED', e.message.slice(0, 400));
  failed++;
}
await app.close().catch(() => {});
fs.rmSync(work, { recursive: true, force: true });
console.log(failed ? `${failed} failed` : 'all ok');
process.exit(failed ? 1 : 0);
