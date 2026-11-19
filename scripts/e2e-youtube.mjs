// The YouTube player inside a project page (mods, shaders, data packs…) showed
// "Error 153": YouTube refuses an embedded player whose request does not say
// which app or site it comes from (no Referer). Here a local HTTPS server
// stands in for www.youtube.com and records the Referer the app sends.
//   xvfb-run -a -s "-screen 0 1920x1080x24" node scripts/e2e-youtube.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-yt-'));
const data = path.join(work, 'PrismLauncher');
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
fs.writeFileSync(path.join(work, 'userdata', 'config.json'), JSON.stringify({ closeToTray: false, importPromptDone: true, layout: 'curseforge' }));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(work, 'k.pem'), '-out', path.join(work, 'c.pem'), '-days', '1', '-subj', '/CN=www.youtube.com'], { stdio: 'ignore' });
const seen = [];
const server = https.createServer({ key: fs.readFileSync(path.join(work, 'k.pem')), cert: fs.readFileSync(path.join(work, 'c.pem')) }, (req, res) => {
  seen.push({ host: req.headers.host, url: req.url, referer: req.headers.referer || null });
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><title>player</title><p>player</p>');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const env = { ...process.env, HAVIHUB_USER_DATA: path.join(work, 'userdata'), HAVIHUB_PRISM_DIR: data, HAVIHUB_PRISM_EXE: path.join(data, 'prismlauncher'), HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs'), HAVIHUB_TEST_CF_KEY: 'test-key' };
for (const k of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) delete env[k];
const app = await electron.launch({
  executablePath: require('electron'),
  args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=MAP www.youtube.com 127.0.0.1:${port}, MAP www.youtube-nocookie.com 127.0.0.1:${port}`],
  env,
});
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  await page.waitForSelector('.inst-card, .group-card');
  const frame = async (src) => {
    const before = seen.length;
    await page.evaluate((s) => {
      const f = document.createElement('iframe');
      f.src = s;
      f.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:180px;z-index:99999';
      document.body.appendChild(f);
    }, src);
    for (let i = 0; i < 60 && seen.length === before; i++) await page.waitForTimeout(100);
    return seen[seen.length - 1] && seen.length > before ? seen[seen.length - 1] : null;
  };
  const a = await frame('https://www.youtube.com/embed/dQw4w9WgXcQ');
  check('the player request says where it comes from', !!a && /^https:\/\/[a-z0-9.-]+\/$/.test(a.referer || ''), JSON.stringify(a));
  const b = await frame('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0');
  check('…also on youtube-nocookie.com', !!b && !!b.referer, JSON.stringify(b));
  // the control: a request the fix does not touch goes out without it, which is what YouTube rejected
  const c = await frame('https://www.youtube.com/other/page');
  check('control: without the fix, the same page sends no Referer', !!c && !c.referer, JSON.stringify(c));
} catch (e) {
  console.error('FAILED', e.message.slice(0, 400));
  failed++;
}
await app.close().catch(() => {});
server.close();
fs.rmSync(work, { recursive: true, force: true });
console.log(failed ? `${failed} failed` : 'all ok');
process.exit(failed ? 1 : 0);
