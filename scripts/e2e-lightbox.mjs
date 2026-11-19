// The screenshot viewer: its bar sits under the window's title bar (which is a
// drag area that swallows clicks), nothing of the title bar shows through, and
// its buttons say what they do.
//   xvfb-run -a node scripts/e2e-lightbox.mjs [outDir] [curseforge|modrinth]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'havihub-lightbox'));
const LAYOUT = process.argv[3] || 'curseforge';
fs.mkdirSync(out, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-lb-'));
const data = path.join(work, 'PrismLauncher');
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
fs.writeFileSync(path.join(work, 'userdata', 'config.json'), JSON.stringify({ closeToTray: false, importPromptDone: true, layout: LAYOUT, themePreset: LAYOUT === 'modrinth' ? 'modrinth' : 'forge' }));
const app = await electron.launch({
  executablePath: require('electron'),
  args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--force-device-scale-factor=1.25', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  env: { ...process.env, HAVIHUB_USER_DATA: path.join(work, 'userdata'), HAVIHUB_PRISM_DIR: data, HAVIHUB_PRISM_EXE: path.join(data, 'prismlauncher'), HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs'), HAVIHUB_TEST_CF_KEY: 'test-key' },
});
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};
try {
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1536, 864));
  await page.waitForSelector(LAYOUT === 'modrinth' ? '.mr-inst' : '.inst-card, .group-card', { timeout: 20000 });
  if (LAYOUT === 'modrinth') await page.evaluate(() => document.querySelector('[aria-label="Capturas"]').click());
  else await page.locator('button, a', { hasText: /^Capturas$/ }).first().click();
  await page.waitForSelector('.gallery-shot', { timeout: 15000 });
  await page.locator('.gallery-shot').first().click();
  await page.waitForSelector('.lightbox-img');
  await page.waitForTimeout(500);
  const g = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) }; };
    const title = document.querySelector('.titlebar, .mr-titlebar');
    const bar = document.querySelector('.lightbox-top');
    const buttons = [...bar.querySelectorAll('button')].map((b) => {
      const box = r(b);
      const hit = document.elementFromPoint(box.left + box.w / 2, box.top + box.h / 2);
      return { text: b.innerText.trim(), ...box, hit: b === hit || b.contains(hit) };
    });
    // is the title bar's drag area (and its logo) still under the viewer's bar?
    const titleHit = document.elementFromPoint(40, r(title).top + r(title).h / 2);
    return { title: r(title), box: r(document.querySelector('.lightbox')), bar: r(bar), buttons, titleFree: title.contains(titleHit), img: r(document.querySelector('.lightbox-img')), win: innerWidth };
  });
  check('the viewer starts under the title bar', g.box.top >= g.title.bottom, `title bar ends at ${g.title.bottom}, viewer starts at ${g.box.top}`);
  check('the title bar stays usable (window buttons, dragging)', g.titleFree);
  check('every button is under the title bar and can be clicked', g.buttons.every((b) => b.top >= g.title.bottom && b.hit));
  const labels = g.buttons.map((b) => b.text).filter(Boolean);
  check('buttons say what they do', ['Copiar', 'Carpeta', 'Abrir', 'Eliminar', 'Cerrar'].every((l) => labels.some((x) => x.includes(l))), labels.join(' | '));
  check('buttons are big enough', g.buttons.filter((b) => /Copiar|Carpeta|Abrir|Eliminar|Cerrar/.test(b.text)).every((b) => b.h >= 36), g.buttons.map((b) => b.h).join(','));
  check('the picture is under the bar', g.img.top >= g.bar.bottom - 1, `bar ends ${g.bar.bottom}, picture starts ${g.img.top}`);
  check('the bar fits the window', g.buttons.every((b) => b.right <= g.win));
  await page.screenshot({ path: path.join(out, `lightbox-${LAYOUT}.png`) });
  // buttons work: copy says so, the arrow moves on, Cerrar closes
  await app.evaluate(({ clipboard }) => clipboard.clear());
  await page.locator('.lightbox-top button', { hasText: 'Copiar' }).click();
  await page.waitForSelector('.toast', { timeout: 5000 }).catch(() => {});
  check('"Copiar" puts the picture on the clipboard', await app.evaluate(({ clipboard }) => clipboard.has('image/png')));
  check('"Copiar" works', /copiada/i.test(await page.locator('.toasts').innerText()));
  const before = await page.locator('.lightbox-pos').innerText();
  await page.locator('.lb-nav.next').click();
  check('next picture', (await page.locator('.lightbox-pos').innerText()) !== before, `${before} → ${await page.locator('.lightbox-pos').innerText()}`);
  await page.locator('.lightbox-top button', { hasText: 'Cerrar' }).click();
  await page.waitForTimeout(300);
  check('"Cerrar" closes it', (await page.locator('.lightbox').count()) === 0);
} catch (e) {
  console.error('FAILED', e.message.slice(0, 500));
  failed++;
}
await app.close().catch(() => {});
fs.rmSync(work, { recursive: true, force: true });
console.log(failed ? `${failed} failed` : 'all ok');
process.exit(failed ? 1 : 0);
