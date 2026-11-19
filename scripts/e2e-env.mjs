// Environment variables for one profile and for all of them.
//   xvfb-run -a -s "-screen 0 1920x1080x24" node scripts/e2e-env.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'havihub-env'));
fs.mkdirSync(out, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-env-'));
const data = path.join(work, 'PrismLauncher');
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
fs.writeFileSync(path.join(work, 'userdata', 'config.json'), JSON.stringify({ closeToTray: false, importPromptDone: true, layout: 'curseforge', themePreset: 'forge' }));
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
const cfgOf = (file) => fs.readFileSync(file, 'utf8');
// the value as the engine reads it (QSettings escapes: \" and \\, quoted when it has a comma)
const envOf = (text) => {
  const m = /^Env=(.*)$/m.exec(text);
  if (!m) return null;
  const raw = (m[1].startsWith('"') ? m[1].slice(1, -1) : m[1]).replace(/\\(["\\])/g, '$1');
  return JSON.parse(raw);
};
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1536, 864));
  await page.waitForSelector('.inst-card, .group-card', { timeout: 20000 });
  const instFile = path.join(data, 'instances', '26.2 Vanilla', 'instance.cfg');
  // ---- one profile
  await page.locator('.group-card', { hasText: 'Vanilla' }).click();
  await page.locator('.inst-card', { hasText: '[26.2] Vanilla' }).click();
  await page.locator('.kebab').click();
  await page.getByText('Opciones del perfil', { exact: true }).click();
  await page.waitForSelector('.options-layout');
  await page.locator('.options-nav-item', { hasText: 'Al iniciar' }).click();
  const block = page.locator('.override', { hasText: 'Variables de entorno' });
  await block.scrollIntoViewIfNeeded();
  check('the profile options have "Variables de entorno", off until asked', (await block.count()) === 1 && !(await block.locator('.override-toggle input, .override-toggle [role="switch"]').first().isChecked().catch(() => false)));
  await block.locator('.override-toggle').click();
  await block.getByText('Añadir variable').click();
  await block.locator('.env-name input').nth(0).fill('__NV_PRIME_RENDER_OFFLOAD');
  await block.locator('.env-value input').nth(0).fill('1');
  await block.getByText('Añadir variable').click();
  await block.locator('.env-name input').nth(1).fill('MI RUTA');
  await block.locator('.env-value input').nth(1).fill('x');
  check('a name with a space is pointed out', /espacios/.test(await block.locator('.env-problem').innerText()));
  await block.locator('.env-name input').nth(1).fill('MI_RUTA');
  await block.locator('.env-value input').nth(1).fill('C:\\Juegos\\x; "dos", a=b');
  await block.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, 'env-profile.png') });
  await page.locator('.modal .btn-primary', { hasText: 'Guardar' }).click();
  await page.waitForSelector('.options-layout', { state: 'detached' });
  await page.waitForTimeout(400);
  const text = cfgOf(instFile);
  check('saved in the profile\'s instance.cfg, as the engine reads it', /^OverrideEnv=true$/m.test(text) && JSON.stringify(envOf(text)) === JSON.stringify({ __NV_PRIME_RENDER_OFFLOAD: '1', MI_RUTA: 'C:\\Juegos\\x; "dos", a=b' }), (/^Env=.*$/m.exec(text) || [''])[0]);
  check('the rest of the file is untouched', /^name=/m.test(text) && /^InstanceType=/m.test(text));
  // ---- open again: the rows are there; removing one and saving
  await page.locator('.kebab').click();
  await page.getByText('Opciones del perfil', { exact: true }).click();
  await page.locator('.options-nav-item', { hasText: 'Al iniciar' }).click();
  await block.scrollIntoViewIfNeeded();
  check('opening the options again shows the saved rows', (await block.locator('.env-row').count()) === 2 && (await block.locator('.env-value input').nth(1).inputValue()) === 'C:\\Juegos\\x; "dos", a=b');
  await block.locator('.env-remove').nth(1).click();
  await page.locator('.modal .btn-primary', { hasText: 'Guardar' }).click();
  await page.waitForSelector('.options-layout', { state: 'detached' });
  await page.waitForTimeout(400);
  check('removing a row removes the variable', JSON.stringify(envOf(cfgOf(instFile))) === JSON.stringify({ __NV_PRIME_RENDER_OFFLOAD: '1' }));
  // ---- all profiles (settings)
  await page.locator('.side-btn[aria-label="Ajustes"]').click();
  await page.waitForSelector('.settings');
  const section = page.locator('.settings-section, section', { hasText: 'Variables de entorno' }).last();
  if (!(await section.count())) {
    for (const item of await page.locator('.settings-item').all()) {
      await item.click();
      if (await page.getByText('Variables de entorno', { exact: true }).count()) break;
    }
  }
  const global = page.locator('.env-vars').last();
  await global.scrollIntoViewIfNeeded();
  await global.getByText('Añadir variable').click();
  await global.locator('.env-name input').last().fill('MESA_GL_VERSION_OVERRIDE');
  check('nothing is saved while the name is half written', !/MESA/.test(cfgOf(path.join(data, 'prismlauncher.cfg'))));
  await global.locator('.env-value input').last().fill('4.6');
  await global.locator('.env-value input').last().press('Enter');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, 'env-global.png') });
  const g = envOf(cfgOf(path.join(data, 'prismlauncher.cfg')));
  check('variables for every profile are saved in the engine\'s settings', g && g.MESA_GL_VERSION_OVERRIDE === '4.6', JSON.stringify(g));
} catch (e) {
  console.error('FAILED', e.message.slice(0, 500));
  failed++;
}
await app.close().catch(() => {});
fs.rmSync(work, { recursive: true, force: true });
console.log(failed ? `${failed} failed` : 'all ok');
process.exit(failed ? 1 : 0);
