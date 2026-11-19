// Tests build/helper/havihub-windows.exe under Wine (Linux) or on Windows:
// a fake engine (prismlauncher.exe inside the engine folder) must get "Havi Hub"
// titles and an icon; the same program outside the engine folder must not.
// The helper must end by itself once its parent and the engine are gone.
//   node scripts/build-helper.mjs --test && node scripts/helper-test.mjs
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helperDir = path.join(root, 'build', 'helper');
const onWindows = process.platform === 'win32';
const run = (exe, args) => (onWindows ? spawn(exe, args, { stdio: 'ignore' }) : spawn('wine', [exe, ...args], { stdio: 'ignore', env: { ...process.env, WINEDEBUG: '-all' } }));
const winPath = (p) => (onWindows ? p : execFileSync('winepath', ['-w', p], { env: { ...process.env, WINEDEBUG: '-all' } }).toString().trim());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exited = (child) => new Promise((r) => (child.exitCode !== null ? r(child.exitCode) : child.once('exit', r)));

// a profile folder with accents and spaces, given to the helper in another case
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-helper Ñandú '));
const engineExe = path.join(work, 'engine', 'versions', '11.1.1', 'prismlauncher.exe');
const otherExe = path.join(work, 'other', 'prismlauncher.exe');
for (const f of [engineExe, otherExe]) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.copyFileSync(path.join(helperDir, 'test', 'prismlauncher.exe'), f);
}
const engineReport = path.join(work, 'engine.txt');
const otherReport = path.join(work, 'other.txt');

let failed = 0;
const expect = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed++;
};

// Wine: start its server first, so every program of the test runs in the same one
if (!onWindows) {
  const env = { ...process.env, WINEDEBUG: '-all' };
  // a clean server: nothing left over from an earlier run (old display, old helper)
  try {
    execFileSync('wineserver', ['-k'], { env, stdio: 'ignore', timeout: 30000 });
  } catch {
    /* none running */
  }
  // (the server runs in the background: do not wait for its output)
  spawn('wineserver', ['-p', '20'], { env, stdio: 'ignore', detached: true }).unref();
  execFileSync('wine', ['cmd', '/c', 'echo', 'ready'], { env, stdio: 'ignore', timeout: 120000 });
}

try {
  const fakeEngine = run(engineExe, [winPath(engineReport)]);
  const fakeOther = run(otherExe, [winPath(otherReport)]);
  let pid = '';
  for (let i = 0; i < 100 && !pid; i++) {
    await sleep(100);
    pid = fs.existsSync(`${engineReport}.pid`) ? fs.readFileSync(`${engineReport}.pid`, 'utf8').trim() : '';
  }
  expect(Boolean(pid), `fake engine started (pid ${pid})`);
  const helper = run(path.join(helperDir, 'havihub-windows.exe'), ['--dir', winPath(path.join(work, 'engine')).toUpperCase(), '--icon', winPath(path.join(root, 'build', 'icon.ico')), '--aumid', 'io.github.havihub', '--title', 'Havi Hub', '--parent', pid, '--log', winPath(path.join(work, 'helper.log'))]);
  await Promise.all([exited(fakeEngine), exited(fakeOther)]);
  const lines = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').trim().split(/\r?\n/).map((l) => l.split('|')).map(([n, ...rest]) => [n, rest]));
  const e = lines(engineReport);
  const o = lines(otherReport);
  console.log('engine windows:', JSON.stringify(e));
  console.log('other windows: ', JSON.stringify(o));
  expect(e.main[0] === 'Havi Hub', 'main window renamed (also after the app set its name again)');
  expect(e.console[0] === 'Consola - Havi Hub', 'window that appears later renamed');
  expect(e.later[0] === 'Havi Hub', 'window shown later renamed');
  const iconOk = e.main[1] === 'icon' && e.main[2] === 'small' && e.console[1] === 'icon';
  // Wine keeps icons inside the process that made them, so another program
  // cannot give a window its icon there (Windows can)
  if (onWindows) expect(iconOk, 'engine windows got the Havi Hub icon');
  else console.log(`info ${iconOk ? 'icons set' : 'icons not set (expected under Wine: icons cannot cross processes there)'}`);
  expect(o.main[0] === 'Prism Launcher 11.1.1' && o.main[1] === 'noicon', 'a program outside the engine folder is left alone');
  const t0 = Date.now();
  const code = await Promise.race([exited(helper), sleep(15000).then(() => 'timeout')]);
  expect(code !== 'timeout', `helper ended by itself after its parent and the engine closed (${Date.now() - t0} ms)`);
  if (code === 'timeout') helper.kill();
} finally {
  const log = path.join(work, 'helper.log');
  if (fs.existsSync(log)) console.log('--- helper log ---\n' + fs.readFileSync(log, 'utf8'));
  fs.rmSync(work, { recursive: true, force: true });
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
