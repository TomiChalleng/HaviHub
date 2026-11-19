// Whether Havikun's channels on the Home page load on their own.
//   E: a new installation: nothing connects to them while the welcome is open,
//      until its question is answered; answered "on their own", they load.
//   F: turned off, nothing connects to YouTube, Twitch or Linktree (nor do the
//      embedded pages start loading on hover) until a channel is opened; the
//      channels stay on the Home page. Turned back on in Ajustes → Privacidad,
//      they load on their own again.
//   G: an update from a version that never asked: a dialog asks, and nothing
//      connects before the answer.
//   xvfb-run -a -s "-screen 0 1920x1080x24" node scripts/e2e-socials.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'havihub-socials'));
fs.mkdirSync(out, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-socials-'));
const data = path.join(work, 'PrismLauncher');
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);

let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};

// stand-in for the networks' embeddable pages (X, Instagram, TikTok)
const embedsAsked = [];
const socialSite = http.createServer((req, res) => {
  embedsAsked.push(new URL(req.url, 'http://x').searchParams.get('u') || '');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<body style="margin:0;background:#fff;font:14px sans-serif"><p style="padding:12px">perfil</p></body>');
});
await new Promise((r) => socialSite.listen(0, '127.0.0.1', r));
const socialOrigin = `http://127.0.0.1:${socialSite.address().port}`;

const SOCIAL_HOSTS = /^(www\.youtube\.com|youtube\.com|gql\.twitch\.tv|www\.twitch\.tv|linktr\.ee)\//;
const asked = (log) => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter((l) => SOCIAL_HOSTS.test(l)) : []);
const configOf = (userData) => JSON.parse(fs.readFileSync(path.join(userData, 'config.json'), 'utf8'));

async function launch(userData, log) {
  const app = await electron.launch({
    executablePath: require('electron'),
    args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--force-device-scale-factor=1.25', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    // HAVIHUB_SOCIAL_ASK: the question is asked here (the other tests start answered)
    env: { ...process.env, HAVIHUB_USER_DATA: userData, HAVIHUB_PRISM_DIR: data, HAVIHUB_PRISM_EXE: path.join(data, 'prismlauncher'), HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs'), HAVIHUB_MOCK_LOG: log, HAVIHUB_SOCIAL_TEST: socialOrigin, HAVIHUB_TEST_CF_KEY: 'test-key', HAVIHUB_IMPORT_DIRS: '', HAVIHUB_SOCIAL_ASK: '1' },
  });
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.setSize(1536, 864);
    w.center();
  });
  const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`), clip: { x: 0, y: 0, width: 1536, height: 864 } });
  return { app, page, shot };
}

// ---------------------------------------------------------------- E: a new installation
{
  const userData = path.join(work, 'E-userdata');
  const log = path.join(work, 'E.log');
  const { app, page, shot } = await launch(userData, log);
  try {
    await page.waitForSelector('.welcome-hello', { timeout: 30000 });
    await page.locator('.welcome .lp-go', { hasText: 'Empezar' }).click();
    // the Modrinth layout: its column of channels is already there behind the welcome
    await page.locator('.lp-choice', { hasText: 'Estilo Modrinth' }).click();
    await page.locator('.welcome .lp-go', { hasText: 'Continuar' }).click();
    await page.locator('.welcome .cb-option', { hasText: 'Cerrarlo del todo' }).click();
    await page.locator('.welcome .lp-go', { hasText: 'Continuar' }).click();
    await page.waitForSelector('.welcome-socials .cb-option');
    check('E: the channels are there behind the welcome', (await page.locator('.mr-socials .mr-social').count()) === 6);
    // long enough for anything automatic to have started (the live check runs 4 s after the panel shows)
    await page.waitForTimeout(7000);
    const before = asked(log);
    check('E: while the question waits, nothing connected to the channels', before.length === 0, before.join(', '));
    await page.locator('.welcome .lp-go', { hasText: 'Continuar' }).click();
    // the fixtures already have instances: the welcome ends here
    await page.waitForSelector('.welcome', { state: 'detached', timeout: 30000 });
    check('E: answered "on their own"', configOf(userData).privacy.socialAutoload === true && configOf(userData).privacy.socialAsked === true);
    for (let i = 0; i < 50 && !asked(log).length; i++) await page.waitForTimeout(200);
    check('E: then they load on their own, without the hint', asked(log).length > 0 && (await page.locator('.mr-socials .mr-social-hint').count()) === 0);
    await page.waitForTimeout(500);
    await shot('E1-modrinth-home');
  } catch (e) {
    check(`E: ${e.message.split('\n')[0]}`, false);
    await shot('E-failure').catch(() => {});
  } finally {
    await app.close();
  }
}

// ---------------------------------------------------------------- F: off, then on again
{
  const userData = path.join(work, 'F-userdata');
  const log = path.join(work, 'F.log');
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ closeToTray: false, importPromptDone: true, welcomeDone: true, layout: 'modrinth', themePreset: 'modrinth', privacy: { socialAutoload: false, socialAsked: true } }));
  const { app, page, shot } = await launch(userData, log);
  try {
    await page.waitForSelector('.mr-socials .mr-social', { timeout: 30000 });
    // the live check would have run 4 s after the panel showed
    await page.waitForTimeout(7000);
    const before = asked(log);
    check('F: nothing connected to the channels on its own', before.length === 0, before.join(', '));
    check('F: the channels stay, saying they load when opened', (await page.locator('.mr-socials .mr-social').count()) === 6 && (await page.locator('.mr-socials .mr-social-hint').count()) === 1);
    check('F: no live mark without loading', (await page.locator('.mr-social-livedot').count()) === 0);
    // hovering over a network shown through its own page doesn't start it
    const row = (name) => page.locator('.mr-social', { has: page.locator('.mr-social-name strong', { hasText: name }) });
    await row('Instagram').scrollIntoViewIfNeeded();
    await row('Instagram').hover();
    await page.waitForTimeout(1500);
    check('F: hovering does not load a page', embedsAsked.length === 0 && (await page.locator('.mr-socials webview').count()) === 0, embedsAsked.join(', '));
    await shot('F1-off');
    // opening YouTube: now it connects
    await row('YouTube').locator('.mr-social-toggle').click();
    await page.waitForSelector('.mr-social-clip', { timeout: 15000 });
    check('F: opening YouTube loads it', asked(log).some((l) => l.startsWith('www.youtube.com/')));
    await page.waitForTimeout(400);
    await shot('F2-youtube-opened');
    // opening Instagram loads its page
    await row('Instagram').locator('.mr-social-toggle').click();
    for (let i = 0; i < 50 && !embedsAsked.length; i++) await page.waitForTimeout(200);
    check('F: opening Instagram loads its page', embedsAsked.some((u) => /instagram\.com/.test(u)), embedsAsked.join(', '));
    check('F: Twitch and Linktree still untouched', !asked(log).some((l) => /^(gql\.twitch\.tv|linktr\.ee)\//.test(l)));
    // Ajustes → Privacidad: back on
    await page.locator('.mr-navbtn[aria-label="Ajustes"]').click();
    await page.waitForSelector('.mr-settings-window');
    await page.locator('.settings-item', { hasText: 'Privacidad' }).click();
    const field = page.locator('.field', { hasText: 'Cargarlas automáticamente' });
    await field.waitFor();
    check('F: the setting shows off, with what turning it off does', (await field.locator('[role="switch"]').getAttribute('aria-checked')) === 'false' && (await page.locator('.set-section', { hasText: 'Redes de Havikun en Inicio' }).locator('p', { hasText: 'solo dejan de cargarse solas' }).count()) === 1);
    await page.waitForTimeout(300);
    await shot('F3-settings');
    await field.locator('[role="switch"]').click();
    for (let i = 0; i < 30 && configOf(userData).privacy.socialAutoload !== true; i++) await page.waitForTimeout(100);
    check('F: turned back on and saved', configOf(userData).privacy.socialAutoload === true && !fs.existsSync(path.join(userData, 'social-autoload-off')));
    await page.locator('.mr-settings-close').click();
    await page.waitForSelector('.mr-social-livedot', { timeout: 15000 }); // Twitch is live in the mock
    check('F: on again, the channels load on their own (the live mark is back)', asked(log).some((l) => l.startsWith('gql.twitch.tv/')) && (await page.locator('.mr-socials .mr-social-hint').count()) === 0);
    await shot('F4-on-again');
  } catch (e) {
    check(`F: ${e.message.split('\n')[0]}`, false);
    await shot('F-failure').catch(() => {});
  } finally {
    await app.close();
  }
}

// ---------------------------------------------------------------- G: an update that was never asked
{
  const userData = path.join(work, 'G-userdata');
  const log = path.join(work, 'G.log');
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ closeToTray: false, importPromptDone: true, welcomeDone: true, layout: 'modrinth', themePreset: 'modrinth' }));
  const { app, page, shot } = await launch(userData, log);
  try {
    await page.waitForSelector('.socials-ask .cb-option', { timeout: 30000 });
    check('G: no welcome, only the question in a dialog', (await page.locator('.welcome').count()) === 0 && (await page.locator('.socials-ask .cb-option[aria-checked="true"]', { hasText: 'Cargarlas solas' }).count()) === 1);
    await page.waitForTimeout(7000);
    const before = asked(log);
    check('G: nothing connected before the answer', before.length === 0 && (await page.locator('.mr-social-livedot').count()) === 0, before.join(', '));
    await shot('G1-dialog');
    await page.locator('.socials-ask .cb-option', { hasText: 'Solo cuando abra una' }).click();
    await page.locator('.socials-ask .btn-primary').click();
    await page.waitForSelector('.socials-ask', { state: 'detached' });
    for (let i = 0; i < 30 && configOf(userData).privacy?.socialAsked !== true; i++) await page.waitForTimeout(100);
    check('G: the answer is saved', configOf(userData).privacy.socialAutoload === false && configOf(userData).privacy.socialAsked === true);
    await page.waitForTimeout(2000);
    check('G: and still nothing connects', asked(log).length === 0 && (await page.locator('.mr-socials .mr-social-hint').count()) === 1);
  } catch (e) {
    check(`G: ${e.message.split('\n')[0]}`, false);
    await shot('G-failure').catch(() => {});
  } finally {
    await app.close();
  }
}

socialSite.close();
console.log(failed ? `\n${failed} FAILED` : '\nall ok');
process.exit(failed ? 1 : 0);
