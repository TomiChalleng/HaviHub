// Group pictures and bigger group cards, the three views of a profile's
// content (tiles, table, list), updates first and the sliding search box.
//   xvfb-run -a -s "-screen 0 1920x1080x24" node scripts/e2e-views.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'havihub-views'));
fs.mkdirSync(out, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-views-'));
const data = path.join(work, 'PrismLauncher');
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
fs.writeFileSync(path.join(work, 'userdata', 'config.json'), JSON.stringify({ closeToTray: false, importPromptDone: true, layout: 'curseforge' }));
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
const config = () => JSON.parse(fs.readFileSync(path.join(work, 'userdata', 'config.json'), 'utf8'));
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1536, 864));
  await page.waitForSelector('.group-card', { timeout: 20000 });

  // ---- group cards: bigger, with the pictures of their profiles
  const box = await page.locator('.group-card').first().boundingBox();
  check('group cards are big tiles', box.width >= 230 && box.height >= 220, `${Math.round(box.width)}x${Math.round(box.height)}`);
  check('without a picture of its own, a group shows its profiles', (await page.locator('.group-card', { hasText: 'Vanilla' }).locator('.group-mosaic .inst-image').count()) === 2);
  await page.screenshot({ path: path.join(out, 'groups.png') });
  // a picture made in the icon editor
  const vanilla = page.locator('.group-card', { hasText: 'Vanilla' });
  await vanilla.locator('.group-more').click();
  await page.locator('.menu-item', { hasText: 'Cambiar imagen…' }).click();
  await page.waitForSelector('.modal .ie-sym');
  await page.locator('.modal .ie-sym').nth(3).click();
  await page.locator('.modal .btn', { hasText: 'Guardar' }).click();
  await page.waitForSelector('.group-card .group-card-img > .gen-icon');
  const saved = config().groupImages || {};
  check('the picture is kept for the group', Boolean(saved.Vanilla && saved.Vanilla.file && saved.Vanilla.recipe) && fs.existsSync(path.join(data, 'group-pictures', saved.Vanilla.file)), JSON.stringify(saved));
  await page.screenshot({ path: path.join(out, 'groups-picture.png') });
  // renaming the group keeps it; removing it brings back the profiles
  await vanilla.locator('.group-more').click();
  await page.locator('.menu-item', { hasText: 'Renombrar grupo' }).click();
  await page.locator('.modal input').fill('Vanilla y más');
  await page.locator('.modal .btn', { hasText: 'Renombrar' }).click();
  await page.waitForSelector('.group-card:has-text("Vanilla y más") .gen-icon');
  check('renaming the group keeps its picture', Boolean((config().groupImages || {})['Vanilla y más']) && !(config().groupImages || {}).Vanilla);
  const renamed = page.locator('.group-card', { hasText: 'Vanilla y más' });
  await renamed.locator('.group-more').click();
  await page.locator('.menu-item', { hasText: 'Quitar imagen' }).click();
  await page.waitForSelector('.group-card:has-text("Vanilla y más") .group-mosaic');
  check('removing the picture deletes its file', !(config().groupImages || {})['Vanilla y más'] && fs.readdirSync(path.join(data, 'group-pictures')).length === 0);

  // ---- the sliding search box
  const xs = page.locator('.toolbar .xsearch');
  check('the search box starts closed', (await xs.locator('.xsearch-field').evaluate((el) => el.getBoundingClientRect().width)) < 2);
  const btnRight = (await xs.locator('.xsearch-btn').boundingBox()).x;
  // the widths it goes through while it opens
  const widths = page.evaluate(
    () =>
      new Promise((resolve) => {
        const el = document.querySelector('.toolbar .xsearch-field');
        const seen = [];
        const t0 = performance.now();
        const step = () => {
          seen.push(Math.round(el.getBoundingClientRect().width));
          if (performance.now() - t0 < 700) requestAnimationFrame(step);
          else resolve(seen);
        };
        requestAnimationFrame(step);
      }),
  );
  await xs.locator('.xsearch-btn').click();
  const seen = await widths;
  const end = seen[seen.length - 1];
  const between = seen.filter((w) => w > 5 && w < end - 5).length;
  const btnAfter = (await xs.locator('.xsearch-btn').boundingBox()).x;
  check('it slides open to the left of the magnifier, which stays where it was', between >= 1 && end > 200 && Math.abs(btnAfter - btnRight) < 2, `${between} steps to ${end}px`);
  check('and the cursor is in it', await page.evaluate(() => document.activeElement && document.activeElement.closest('.xsearch') !== null));
  await page.keyboard.type('vanilla');
  await page.waitForTimeout(200);
  check('it searches', (await page.locator('.inst-card').count()) === 1);
  await page.screenshot({ path: path.join(out, 'search-open.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  check('Esc closes it and clears the search', (await xs.locator('.xsearch-field').evaluate((el) => el.getBoundingClientRect().width)) < 2 && (await page.locator('.group-card').count()) === 2);

  // ---- a profile's content: updates first, three views
  await page.locator('.group-card', { hasText: 'Vanilla y más' }).click();
  await page.locator('.inst-card', { hasText: '[26.2] Vanilla' }).click();
  await page.waitForSelector('.ctable-row');
  // an old AppleSkin and an old Sodium, so the check finds updates
  for (const [projectId, versionId] of [
    ['EsAfCjCV', 'EsAfCjCV-2-26_2'],
    ['AANobbMI', 'AANobbMI-1-26_2'],
  ]) {
    const r = await page.evaluate((o) => window.havihub.call('platforms.install', o), { source: 'modrinth', projectId, versionId, instanceId: '26.2 Vanilla', type: 'mod' });
    if (!r.ok) throw new Error(`install ${projectId}: ${r.error && r.error.message}`);
  }
  await page.locator('.content-toolbar .icon-btn[aria-label="Buscar actualizaciones"]').click();
  await page.waitForSelector('.ctable-row.has-update', { timeout: 15000 });
  await page.waitForTimeout(500);
  const flags = await page.locator('.ctable-row').evaluateAll((rows) => rows.map((r) => r.classList.contains('has-update')));
  const firstPlain = flags.indexOf(false);
  check('mods with an update waiting come first', flags.filter(Boolean).length > 0 && firstPlain > 0 && flags.slice(firstPlain).every((f) => !f), flags.map((f) => (f ? 'U' : '.')).join(''));
  await page.screenshot({ path: path.join(out, 'view-table.png') });
  // sorting by another column keeps them first
  await page.locator('.ctable-head .sortable', { hasText: 'Autor' }).click();
  await page.waitForTimeout(200);
  const flags2 = await page.locator('.ctable-row').evaluateAll((rows) => rows.map((r) => r.classList.contains('has-update')));
  check('also when sorting by another column', flags2.indexOf(false) === flags.filter(Boolean).length && flags2.slice(flags2.indexOf(false)).every((f) => !f));

  await page.locator('.content-toolbar .view-btn').click();
  const items = await page.locator('.view-menu .menu-item').allTextContents();
  check('the view menu offers tiles, table and list', ['Mosaico', 'Tabla', 'Lista'].every((n) => items.some((i) => i.includes(n))), items.join(' | '));
  await page.screenshot({ path: path.join(out, 'view-menu.png') });
  await page.locator('.view-menu .menu-item', { hasText: 'Mosaico' }).click();
  await page.waitForSelector('.ctile');
  check('tiles: one per mod, the ones with an update first and marked', (await page.locator('.ctile').count()) === 12 && (await page.locator('.ctile').first().locator('.ctile-update').count()) === 1);
  check('the choice is kept', config().contentView === 'tiles');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, 'view-tiles.png') });
  await page.locator('.content-toolbar .view-btn').click();
  await page.locator('.view-menu .menu-item', { hasText: 'Lista' }).click();
  await page.waitForSelector('.clist-row');
  await page.waitForTimeout(1500);
  const firstRow = page.locator('.clist-row').first();
  check('list: big rows with the toggle and the update button', (await page.locator('.clist-row').count()) === 12 && (await firstRow.locator('.toggle').count()) === 1 && /Actualizar/.test(await firstRow.locator('.clist-action').innerText()));
  check('list rows show the date, size and categories', (await firstRow.locator('.clist-meta > span').count()) >= 2 && (await page.locator('.clist-cat').count()) > 0);
  await page.screenshot({ path: path.join(out, 'view-list.png') });
  // the search box of the content list
  await page.locator('.content-toolbar .xsearch-btn').click();
  await page.keyboard.type('sodium');
  await page.waitForTimeout(500);
  check('the content search works in every view', (await page.locator('.clist-row').count()) === 2 && (await page.locator('.clist-name').allTextContents()).every((n) => /sodium/i.test(n)));
  await page.screenshot({ path: path.join(out, 'view-list-search.png') });

  // ---- Discover: on hover the picture gets shorter and "Install" appears
  await page.keyboard.press('Escape');
  await page.locator('.top-tab', { hasText: 'Descubrir' }).click();
  await page.waitForSelector('.disc-card', { timeout: 20000 });
  await page.waitForTimeout(800);
  const card = page.locator('.disc-card').first();
  await card.scrollIntoViewIfNeeded();
  const before = await card.locator('.disc-card-img').evaluate((el) => el.getBoundingClientRect().height);
  const hidden = await card.locator('.disc-card-install').evaluate((el) => getComputedStyle(el).opacity);
  await page.screenshot({ path: path.join(out, 'discover-rest.png') });
  await card.hover();
  await page.waitForTimeout(600);
  const after = await card.locator('.disc-card-img').evaluate((el) => el.getBoundingClientRect().height);
  const shown = await card.locator('.disc-card-install').evaluate((el) => getComputedStyle(el).opacity);
  const cardBox = await card.boundingBox();
  const btnBox = await card.locator('.disc-card-install').boundingBox();
  check('Discover card hover: shorter picture and an Install button inside the card', hidden === '0' && shown === '1' && after < before - 30 && btnBox.y + btnBox.height <= cardBox.y + cardBox.height + 1, `${Math.round(before)} -> ${Math.round(after)}`);
  await page.screenshot({ path: path.join(out, 'discover-hover.png') });
} catch (e) {
  console.error(e);
  failed++;
  const page = app.windows()[0];
  if (page) await page.screenshot({ path: path.join(out, 'zz-failure.png') }).catch(() => {});
} finally {
  await app.close();
}
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
