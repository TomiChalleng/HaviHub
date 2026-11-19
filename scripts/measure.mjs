// How much memory and processor Havi Hub uses while it sits open (and hidden).
//   xvfb-run -s "-screen 0 1920x1080x24" node scripts/measure.mjs [curseforge|modrinth] [label]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAYOUT = process.argv[2] || 'curseforge';
const label = process.argv[3] || '';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-measure-'));
const data = path.join(work, 'PrismLauncher');
execFileSync(process.execPath, [path.join(root, 'scripts/make-fixtures.mjs'), data]);
fs.mkdirSync(path.join(work, 'userdata'), { recursive: true });
fs.writeFileSync(path.join(work, 'userdata', 'config.json'), JSON.stringify({ closeToTray: true, closeAsked: true, importPromptDone: true, layout: LAYOUT, themePreset: LAYOUT === 'modrinth' ? 'modrinth' : 'forge', ...(process.env.MEASURE_CONFIG ? JSON.parse(process.env.MEASURE_CONFIG) : {}) }));
const start = () => electron.launch({
  executablePath: require('electron'),
  args: [path.join(root, 'dist/main.js'), '--no-sandbox', '--lang=es-CL', '--force-device-scale-factor=1.25', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  env: { ...process.env, HAVIHUB_USER_DATA: path.join(work, 'userdata'), HAVIHUB_PRISM_DIR: data, HAVIHUB_PRISM_EXE: path.join(data, 'prismlauncher'), HAVIHUB_MOCK_NET: path.join(root, 'scripts/mock-net.cjs'), HAVIHUB_TEST_CF_KEY: 'test-key' },
});
let app = await start();
let page = await app.firstWindow();
await app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows()[0];
  w.setSize(1536, 864);
});
const sample = async (seconds) => {
  await app.evaluate(({ app }) => app.getAppMetrics()); // resets the CPU counters
  await new Promise((r) => setTimeout(r, seconds * 1000));
  const m = await app.evaluate(({ app }) => app.getAppMetrics().map((p) => ({ type: p.type, name: p.name || p.serviceName || '', mem: p.memory.workingSetSize, priv: p.memory.privateBytes || 0, cpu: p.cpu.percentCPUUsage })));
  const by = {};
  for (const p of m) {
    const k = p.type === 'Utility' ? `Utility ${p.name}` : p.type;
    by[k] = by[k] || { mb: 0, cpu: 0 };
    by[k].mb += p.mem / 1024;
    by[k].cpu += p.cpu;
  }
  const total = Object.values(by).reduce((a, b) => ({ mb: a.mb + b.mb, cpu: a.cpu + b.cpu }), { mb: 0, cpu: 0 });
  return { total: `${total.mb.toFixed(0)} MB, ${total.cpu.toFixed(1)}% CPU`, parts: Object.entries(by).map(([k, v]) => `${k} ${v.mb.toFixed(0)} MB ${v.cpu.toFixed(1)}%`).join(' | ') };
};
const heap = () => page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0)).catch(() => -1);
try {
  await page.waitForSelector(LAYOUT === 'modrinth' ? '.mr-inst' : '.inst-card, .group-card', { timeout: 20000 });
  if (process.env.MEASURE_BIG) {
    // every instance gets a big photo, the way people really use them
    const n = await page.evaluate(async () => {
      const list = (await window.havihub.call('instances.list')).value;
      const all = Array.isArray(list) ? list : list.instances || [];
      let i = 0;
      for (const inst of all) {
        const c = new OffscreenCanvas(3000, 1700);
        const g = c.getContext('2d');
        const img = g.createImageData(3000, 1700);
        for (let p = 0; p < img.data.length; p += 4) {
          const v = (p * 2654435761 + i * 97) >>> 24;
          img.data[p] = v; img.data[p + 1] = (v * 3) & 255; img.data[p + 2] = 255 - v; img.data[p + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        const bytes = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
        await window.havihub.call('instances.setImage', inst.id, bytes, {});
        i++;
      }
      return i;
    });
    console.log('    big photos set on', n, 'instances');
    // measure a fresh start, not the leftovers of making those photos
    await app.close();
    app = await start();
    page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1536, 864));
    await page.waitForSelector(LAYOUT === 'modrinth' ? '.mr-inst' : '.inst-card, .group-card', { timeout: 20000 });
    if (!process.env.HAVIHUB_NO_SCALED) {
      // and not the first run either (that one makes the small copies)
      await page.waitForTimeout(6000);
      await app.close();
      app = await start();
      page = await app.firstWindow();
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1536, 864));
      await page.waitForSelector(LAYOUT === 'modrinth' ? '.mr-inst' : '.inst-card, .group-card', { timeout: 20000 });
    }
  }
  await page.waitForTimeout(5000);
  const idle = await sample(8);
  console.log(`[${LAYOUT}${label ? ' ' + label : ''}] open, idle : ${idle.total}  (JS ${await heap()} MB, DOM ${await page.evaluate(() => document.querySelectorAll('*').length)})`);
  console.log('   ', idle.parts);
  // hidden in the tray (what happens while playing)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
  await new Promise((r) => setTimeout(r, Number(process.env.MEASURE_HIDE_WAIT || 4) * 1000));
  const hidden = await sample(8);
  console.log(`[${LAYOUT}${label ? ' ' + label : ''}] hidden     : ${hidden.total}`);
  console.log('   ', hidden.parts);
} catch (e) {
  console.error('FAILED', e.message);
}
await app.close().catch(() => {});
fs.rmSync(work, { recursive: true, force: true });
process.exit(0);
