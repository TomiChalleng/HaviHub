// A CurseForge mod whose author doesn't allow other apps to download it:
// Havi Hub opens "CurseForge's" download page (a local stand-in here) in a
// window, takes the download it starts and installs it. Then the same through
// the Downloads folder.
//   xvfb-run -s "-screen 0 1920x1080x24" node scripts/e2e-blocked.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const mock = require('./mock-net.cjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'havihub-blocked'));
fs.mkdirSync(out, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-blocked-'));
const data = path.join(work, 'PrismLauncher');
const downloads = path.join(work, 'Downloads');
fs.mkdirSync(downloads, { recursive: true });
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
fs.writeFileSync(path.join(work, 'userdata', 'config.json'), JSON.stringify({ closeToTray: false, importPromptDone: true, layout: 'curseforge' }));

// the blocked mod of the mock network, and its files
const project = mock.CF.find((x) => x[1] === 'the-horror-pack');
const files = mock.cfFiles(project);
const bytesOf = (f) => mock.jarBytes(f.fileName, project[1], project[2]);
const pagesServed = [];
const site = http.createServer((req, res) => {
  const page = req.url.match(/^\/minecraft\/[^/]+\/[^/]+\/download\/(\d+)/);
  const dl = req.url.match(/^\/dl\/(\d+)/);
  if (page) {
    pagesServed.push(Number(page[1]));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><title>CurseForge (prueba)</title><body style="background:#111;color:#eee;font:20px sans-serif;padding:40px"><h1>Tu descarga empieza en unos segundos…</h1><script>setTimeout(()=>{location.href='/dl/${page[1]}'},700)</script></body>`);
  } else if (dl) {
    const f = files.find((x) => x.id === Number(dl[1]));
    const body = bytesOf(f);
    res.writeHead(200, { 'Content-Type': 'application/java-archive', 'Content-Length': body.length, 'Content-Disposition': `attachment; filename="${f.fileName}"` });
    res.end(body);
  } else res.writeHead(404).end();
});
await new Promise((r) => site.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${site.address().port}`;

const app = await electron.launch({
  executablePath: require('electron'),
  args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--force-device-scale-factor=1.25', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  env: { ...process.env, HAVIHUB_USER_DATA: path.join(work, 'userdata'), HAVIHUB_PRISM_DIR: data, HAVIHUB_PRISM_EXE: path.join(data, 'prismlauncher'), HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs'), HAVIHUB_TEST_CF_KEY: 'test-key', HAVIHUB_CF_SITE: origin, HAVIHUB_DOWNLOADS_DIR: downloads },
});
const page = await app.firstWindow();
await app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows()[0];
  w.setSize(1536, 864);
  w.center();
});
const cap = async (n, wait = 300) => {
  await page.waitForTimeout(wait);
  const b64 = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'Havi Hub' || !w.getParentWindow()).webContents.capturePage()).toPNG().toString('base64'));
  fs.writeFileSync(path.join(out, `${n}.png`), Buffer.from(b64, 'base64'));
  console.log('cap', n);
};
const api = (method, ...args) => page.evaluate(([m, a]) => window.havihub.call(m, ...a), [method, args]);
const modsDir = (id) => path.join(data, 'instances', id, 'minecraft', 'mods');
const listMods = (id) => (fs.existsSync(modsDir(id)) ? fs.readdirSync(modsDir(id)) : []);
let ok = true;
try {
  await page.waitForSelector('.inst-card, .group-card', { timeout: 20000 });

  // 1) through the app: Explorar → CurseForge → the mod → Instalar
  await page.locator('.top-tab', { hasText: 'Explorar' }).click();
  await page.locator('.tabs .tab', { hasText: /^Mods$/ }).click();
  await page.locator('.pills .pill, .pill', { hasText: 'CurseForge' }).first().click();
  await page.locator('input.search, .search input').first().fill('From The Fog');
  await page.waitForSelector('.proj-row:has-text("From The Fog")', { timeout: 15000 });
  await page.locator('.proj-row', { hasText: 'From The Fog' }).first().locator('.btn', { hasText: 'Instalar' }).click();
  await page.waitForSelector('.target-list', { timeout: 10000 });
  const target = (await page.locator('.target-row:not(.disabled) strong').first().textContent()).trim();
  console.log('installing into:', target);
  await page.locator('.target-row:not(.disabled)').first().click();
  await page.locator('.modal-foot .btn-primary').click();
  // the dialog explains and follows the download; a second window shows "CurseForge"
  await page.waitForSelector('.blocked-files', { timeout: 20000 });
  await cap('1-blocked-dialog', 500);
  // the window opens a moment after the dialog (longer on a busy computer): wait for it, up to 15 s
  let titles = [];
  for (let i = 0; i < 60; i++) {
    titles = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => w.getTitle()));
    if (titles.some((x) => /CurseForge/.test(x))) break;
    await page.waitForTimeout(250);
  }
  console.log('windows:', titles.join(' | '));
  if (!titles.some((x) => /CurseForge/.test(x))) throw new Error('the CurseForge window did not open');
  await page.waitForSelector('.blocked-files', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(800);
  const left = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
  if (left !== 1) throw new Error(`the CurseForge window should close by itself (${left} windows)`);
  const listed = (await api('instances.list')).value;
  const instances = Array.isArray(listed) ? listed : listed.instances;
  const inst = instances.find((i) => i.name === target);
  const got = listMods(inst.id).filter((f) => f.startsWith('the-horror-pack'));
  const index = fs.existsSync(path.join(modsDir(inst.id), '.index')) ? fs.readdirSync(path.join(modsDir(inst.id), '.index')).filter((f) => /horror|fog/i.test(f)) : [];
  console.log('installed:', got.join(', '), '| metadata:', index.join(', '), '| pages opened:', pagesServed.join(','));
  if (got.length !== 1) throw new Error('the blocked mod was not installed');
  if (!index.length) throw new Error('the installed mod has no metadata');
  await cap('2-after-install', 600);

  // 2) through the Downloads folder: the person's browser saved the file there
  const make = async (name) => {
    const r = await api('instances.create', { name, mcVersion: '26.2', loader: 'fabric', loaderVersion: '0.20.1' });
    if (!r.ok) throw new Error('create: ' + JSON.stringify(r.error));
    return { id: typeof r.value === 'string' ? r.value : r.value.id, name };
  };
  const other = await make('Bloqueados 2');
  const first = await api('platforms.install', { source: 'curseforge', projectId: String(project[0]), instanceId: other.id, type: 'mod' });
  const entries = first.value.blocked;
  if (!entries.length) console.log('second install:', other.name, JSON.stringify(first.value).slice(0, 400));
  console.log('blocked entry:', JSON.stringify({ fileName: entries[0].fileName, page: entries[0].page.replace(origin, ''), sha1: entries[0].sha1.slice(0, 8), resume: entries[0].resume.kind }));
  if (entries.length !== 1 || !entries[0].page.startsWith(origin)) throw new Error('unexpected blocked entries');
  const wanted = files.find((f) => f.fileName === entries[0].fileName);
  const before = pagesServed.length;
  const pending = api('platforms.resolveBlocked', entries, 'browser');
  await page.waitForTimeout(1200);
  fs.writeFileSync(path.join(downloads, 'otro-archivo.jar'), 'nope');
  fs.writeFileSync(path.join(downloads, wanted.fileName.replace(/\.jar$/, ' (1).jar')), bytesOf(wanted));
  const r = (await pending).value;
  console.log('from Downloads:', r.done.length, 'done,', r.pending.length, 'pending; pages opened in the window:', pagesServed.length - before);
  if (r.done.length !== 1) throw new Error('the file in Downloads was not picked up');
  if (!listMods(other.id).some((f) => f === wanted.fileName)) throw new Error('the file from Downloads was not installed');

  // 3) stopping leaves the files pending (and the old manual list still shows them)
  for (const f of fs.readdirSync(downloads)) fs.rmSync(path.join(downloads, f));
  const third = await make('Bloqueados 3');
  if (third) {
    const e3 = (await api('platforms.install', { source: 'curseforge', projectId: String(project[0]), instanceId: third.id, type: 'mod' })).value.blocked;
    const p3 = api('platforms.resolveBlocked', e3.map((e) => ({ ...e, page: `${origin}/nothing-here` })), 'window');
    await page.waitForTimeout(1500);
    await api('platforms.cancelBlocked');
    const r3 = (await p3).value;
    console.log('stopped:', r3.done.length, 'done,', r3.pending.length, 'pending');
    if (r3.pending.length !== 1) throw new Error('a stopped download should stay pending');
  }
} catch (e) {
  ok = false;
  console.error('FAILED:', e.message);
  await cap('zz-failure', 0).catch(() => {});
} finally {
  await app.close().catch(() => {});
  site.close();
  fs.rmSync(work, { recursive: true, force: true });
}
process.exit(ok ? 0 : 1);
