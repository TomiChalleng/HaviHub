// Havi Hub signs in with its own Microsoft app. An account signed in
// with another app (the engine's, or one brought from Prism Launcher) is
// marked in Settings → Cuentas, and playing with it asks for the sign-in first
// instead of reaching the engine.
//   xvfb-run -a -s "-screen 0 1920x1080x24" node scripts/e2e-relogin.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'havihub-relogin'));
fs.mkdirSync(out, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-relogin-'));
const data = path.join(work, 'PrismLauncher');
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
// signed in with the engine's own Microsoft app
const accFile = path.join(data, 'accounts.json');
const acc = JSON.parse(fs.readFileSync(accFile, 'utf8'));
for (const a of acc.accounts) if (a.type === 'MSA') a['msa-client-id'] = 'c36a9fb6-4f2a-41ff-90bd-ae7cc92031eb';
fs.writeFileSync(accFile, JSON.stringify(acc, null, 4));
fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
fs.writeFileSync(path.join(work, 'userdata', 'config.json'), JSON.stringify({ closeToTray: false, importPromptDone: true, layout: 'curseforge', themePreset: 'forge' }));

const app = await electron.launch({
  executablePath: require('electron'),
  args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  env: { ...process.env, HAVIHUB_USER_DATA: path.join(work, 'userdata'), HAVIHUB_PRISM_DIR: data, HAVIHUB_PRISM_EXE: path.join(data, 'prismlauncher'), HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs'), HAVIHUB_TEST_CF_KEY: 'test-key' },
});
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};
const launchLog = path.join(data, 'launch.log');
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1536, 864));
  await page.waitForSelector('.inst-card, .group-card', { timeout: 20000 });

  // ---- Settings → Cuentas
  await page.locator('.side-btn[aria-label="Ajustes"]').click();
  await page.locator('.settings-item', { hasText: 'Cuentas' }).click();
  const item = page.locator('.account-item', { hasText: 'havikun' });
  await item.waitFor();
  check('the account says it has to sign in again', (await item.innerText()).includes('tiene que iniciar sesión de nuevo'));
  await page.screenshot({ path: path.join(out, '1-accounts.png') });
  await item.locator('.btn', { hasText: 'Iniciar sesión' }).click();
  const modal = page.locator('.modal', { hasText: 'Iniciar sesión de nuevo' });
  await modal.waitFor();
  check('the sign-in dialog explains why, naming the account', (await modal.innerText()).includes('havikun tiene que entrar una vez más'));
  await page.screenshot({ path: path.join(out, '2-relogin-dialog.png') });
  await modal.locator('.btn', { hasText: 'Cancelar' }).click();
  await modal.waitFor({ state: 'detached' });
  await page.locator('.settings-close').click();

  // ---- playing with it asks for the sign-in and does not reach the engine
  await page.locator('.top-tab', { hasText: 'Mis modpacks' }).click();
  await page.locator('.group-card', { hasText: 'Vanilla' }).click();
  await page.locator('.inst-card', { hasText: '[26.2] Vanilla' }).click();
  await page.locator('.play-btn').click();
  await page.locator('.modal', { hasText: 'Iniciar sesión de nuevo' }).waitFor();
  check('playing opens the sign-in first', true);
  check('the engine was not started', !fs.existsSync(launchLog) || !fs.readFileSync(launchLog, 'utf8').includes('--launch 26.2 Vanilla'));
  await page.screenshot({ path: path.join(out, '3-play-asks.png') });
  await page.locator('.modal .btn', { hasText: 'Cancelar' }).click();

  // ---- the engine signs in with Havi Hub's app
  const cfg = fs.readFileSync(path.join(data, 'prismlauncher.cfg'), 'utf8');
  check("the engine uses Havi Hub's Microsoft app", /^MSAClientIDOverride=10ba024d-897d-422d-bf41-2f818b9a1468$/m.test(cfg));

  // ---- signed in with Havi Hub's app: nothing is asked
  for (const a of acc.accounts) if (a.type === 'MSA') a['msa-client-id'] = '10ba024d-897d-422d-bf41-2f818b9a1468';
  fs.writeFileSync(accFile, JSON.stringify(acc, null, 4));
  await page.waitForTimeout(1500); // accounts.json is watched
  await page.locator('.play-btn').click();
  await page.waitForTimeout(2500);
  check('the same account plays once signed in with Havi Hub', fs.existsSync(launchLog) && fs.readFileSync(launchLog, 'utf8').includes('--launch 26.2 Vanilla --profile havikun'));
  check('no sign-in was asked', (await page.locator('.modal', { hasText: 'Iniciar sesión de nuevo' }).count()) === 0);
} catch (e) {
  console.log('FAIL', e.message);
  failed++;
} finally {
  await app.close().catch(() => {});
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
