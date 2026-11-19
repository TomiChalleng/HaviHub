// Smoke test with the REAL engine: Havi Hub downloads a real Prism Launcher
// build (served from a local archive through the network mock), installs it,
// starts a game through it and runs the Microsoft sign-in flow up to the
// sign-in page. Screenshots of the whole X screen show every engine window.
// Must run as a normal user (Prism's Linux start script refuses root):
//   HAVIHUB_MOCK_ENGINE_ASSET=/path/PrismLauncher-Linux-Qt6-Portable-11.1.1.tar.gz \
//   xvfb-run -a -s "-screen 0 1920x1080x24" node scripts/engine-smoke.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'havihub-engine'));
fs.mkdirSync(out, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-engine-'));
const data = path.join(work, 'data');
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
// accounts signed in through Havi Hub carry its Microsoft app's client id
const acc = JSON.parse(fs.readFileSync(path.join(data, 'accounts.json'), 'utf8'));
for (const a of acc.accounts) a['msa-client-id'] = '10ba024d-897d-422d-bf41-2f818b9a1468';
fs.writeFileSync(path.join(data, 'accounts.json'), JSON.stringify(acc, null, 4));

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const xshot = (name) => {
  try {
    execFileSync('import', ['-window', 'root', path.join(out, `${name}.png`)]);
    const wins = execFileSync('python3', ['/tmp/xwins.py']).toString();
    fs.writeFileSync(path.join(out, `${name}.txt`), wins);
    log('xshot', name, '\n' + wins.trim());
  } catch (e) {
    log('xshot failed', e.message);
  }
};

const app = await electron.launch({
  executablePath: require('electron'),
  args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--force-device-scale-factor=1.25', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  env: {
    ...process.env,
    HAVIHUB_USER_DATA: path.join(work, 'userdata'),
    HAVIHUB_PRISM_DIR: data,
    HAVIHUB_ENGINE_DIR: path.join(work, 'engine'),
    HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs'),
    HAVIHUB_TEST_CF_KEY: 'test-key',
  },
});
const page = await app.firstWindow();
await app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows()[0];
  w.setSize(1200, 760);
  w.setPosition(0, 0);
});
const call = (m, ...a) => page.evaluate(async ([m2, a2]) => window.havihub.call(m2, ...a2), [m, a]);
let failed = false;
try {
  await page.waitForSelector('.inst-card', { timeout: 30000 });
  // 1) the engine is downloaded and installed in the background at start
  let st;
  for (let i = 0; i < 180; i++) {
    st = (await call('engine.status')).value;
    if (st && st.version && !st.installing) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  log('engine status', JSON.stringify(st));
  if (!st || !st.version) throw new Error('engine not installed');
  const exe = path.join(work, 'engine', 'versions', st.version, 'PrismLauncher');
  if (!fs.existsSync(exe)) throw new Error('engine exe missing: ' + exe);
  if (fs.existsSync(path.join(work, 'engine', 'versions', st.version, 'bin', 'prismlauncher_updater'))) throw new Error('updater should be removed');
  const cfg = fs.readFileSync(path.join(data, 'prismlauncher.cfg'), 'utf8');
  log('engine cfg:\n' + cfg.split(/\r?\n/).filter((l) => /Language|Theme|Java|Console|Wizard|InstanceDir/.test(l)).join('\n'));

  // 2) start a game through the engine (no network to Mojang here: it fails
  // while downloading, which is fine — we look at what the user would see)
  await page.locator('.group-card', { hasText: 'Vanilla' }).click();
  const card = page.locator('.inst-card', { hasText: '[26.2] Vanilla' });
  await card.hover();
  await card.locator('.card-play').click();
  const t0 = Date.now();
  for (const t of [3, 6, 10, 16]) {
    await new Promise((r) => setTimeout(r, Math.max(0, t0 + t * 1000 - Date.now())));
    xshot(`launch-${t}s`);
  }
  let running = (await call('instances.running')).value;
  log('running after 16s', JSON.stringify(running));
  for (let i = 0; i < 60 && running.length; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    running = (await call('instances.running')).value;
  }
  xshot('launch-end');
  log('running at end', JSON.stringify(running));
  if (running.length) {
    log('stopping');
    await call('instances.stop', running[0]);
    await new Promise((r) => setTimeout(r, 1500));
  }

  // 3) Microsoft sign-in: only the engine's sign-in page should appear
  await page.evaluate(() => {
    window.__login = window.havihub.call('accounts.addMicrosoft');
  });
  await new Promise((r) => setTimeout(r, 9000));
  xshot('login-9s');
  await call('accounts.cancelLogin');
  const res = await page.evaluate(() => window.__login);
  log('login result', JSON.stringify(res));
  await new Promise((r) => setTimeout(r, 1500));
  xshot('login-after-cancel');

  // 4) the user closes the sign-in window without signing in: Havi Hub notices
  await page.evaluate(() => {
    window.__login2 = window.havihub.call('accounts.addMicrosoft');
  });
  await new Promise((r) => setTimeout(r, 8000));
  log(execFileSync('python3', ['/tmp/xclose.py', 'Quick Setup']).toString().trim());
  const t1 = Date.now();
  const res2 = await page.evaluate(() => Promise.race([window.__login2, new Promise((r) => setTimeout(() => r('TIMEOUT'), 15000))]));
  log('login closed by the user ->', JSON.stringify(res2), `${Date.now() - t1} ms`);
  if (res2 === 'TIMEOUT') throw new Error('closing the sign-in window was not detected');
  xshot('login-closed');
} catch (e) {
  failed = true;
  log('SMOKE FAILED', e.stack || e.message);
  xshot('failure');
} finally {
  await app.close().catch(() => {});
}
process.exit(failed ? 1 : 0);
