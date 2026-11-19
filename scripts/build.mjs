// Build script: bundles the Electron main process, the preload script and the
// React renderer with esbuild into ./dist
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const watch = process.argv.includes('--watch');
const preview = process.argv.includes('--preview'); // browser preview with mocked API

// from an empty folder: what an earlier build left there (a file since removed
// from src/) must not end up in the installers
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'renderer'), { recursive: true });

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const common = { bundle: true, sourcemap: watch ? 'inline' : false, logLevel: 'info', minify: !watch && !process.env.HAVIHUB_NO_MINIFY, define: { __APP_VERSION__: JSON.stringify(pkg.version) } };

// CurseForge's API key for this build (src/main/buildinfo.js). Release builds
// get it from a secret of the repository; it is never written in the code.
const cfKey = String(process.env.HAVIHUB_CF_KEY || '').trim();

const builds = [
  {
    ...common,
    entryPoints: [path.join(root, 'src/main/main.js')],
    outfile: path.join(dist, 'main.js'),
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
    define: { ...common.define, __CF_BUILD_KEY__: JSON.stringify(cfKey) },
  },
  {
    ...common,
    entryPoints: [path.join(root, 'src/main/preload.js')],
    outfile: path.join(dist, 'preload.js'),
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
  },
  {
    ...common,
    entryPoints: [path.join(root, 'src/renderer/main.jsx')],
    outfile: path.join(dist, 'renderer/app.js'),
    platform: 'browser',
    format: 'iife',
    target: 'chrome130',
    jsx: 'automatic',
    loader: { '.woff2': 'file', '.woff': 'file', '.png': 'file', '.svg': 'text' },
    assetNames: 'assets/[name]-[hash]',
    define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"', __PREVIEW__: preview ? 'true' : 'false', __APP_VERSION__: JSON.stringify(pkg.version) },
  },
];

function copyStatic() {
  fs.copyFileSync(path.join(root, 'src/renderer/index.html'), path.join(dist, 'renderer/index.html'));
  // Havi Hub's own license (GPL-3.0), shown in Ajustes → Licencias
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(dist, 'renderer/LICENSE.txt'));
  const assets = path.join(root, 'src/renderer/static');
  if (fs.existsSync(assets)) {
    fs.cpSync(assets, path.join(dist, 'renderer/static'), { recursive: true });
  }
}

if (watch) {
  for (const b of builds) {
    const ctx = await esbuild.context(b);
    await ctx.watch();
  }
  copyStatic();
  console.log('watching...');
} else {
  const results = await Promise.all(builds.map((b) => esbuild.build({ ...b, metafile: true })));
  copyStatic();
  writeNotices(results.map((r) => r.metafile));
  console.log(`  CurseForge API key: ${cfKey ? 'included' : 'not set (HAVIHUB_CF_KEY)'}`);
}

// Third-party code inside the app: the licenses of these packages ask that their
// copyright notice and license travel with every copy. The list comes from what
// esbuild actually bundled, so it stays right when dependencies change.
//   dist/renderer/licenses.json           name, version and license, for Ajustes → Licencias
//   dist/renderer/THIRD-PARTY-NOTICES.txt  the full texts
function writeNotices(metafiles) {
  const dirs = new Map();
  for (const m of metafiles) {
    for (const input of Object.keys(m.inputs)) {
      const p = input.replace(/\\/g, '/');
      const i = p.lastIndexOf('node_modules/');
      if (i < 0) continue;
      const parts = p.slice(i + 13).split('/');
      const name = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
      dirs.set(path.join(root, p.slice(0, i + 13), name), name);
    }
  }
  const list = [];
  for (const [dir, name] of dirs) {
    let meta = {};
    try {
      meta = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    } catch {
      /* a package without package.json: listed by name */
    }
    const licenseFile = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.[a-z]+)?$/i.test(f)) : null;
    const license = typeof meta.license === 'string' ? meta.license : (meta.license && meta.license.type) || 'see text';
    const author = meta.author ? (typeof meta.author === 'string' ? meta.author : meta.author.name) : '';
    const text = licenseFile ? fs.readFileSync(path.join(dir, licenseFile), 'utf8').trim() : `${license}${author ? ` (${author})` : ''}`;
    list.push({ name: meta.name || name, version: meta.version || '', license, homepage: meta.homepage || '', text });
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(path.join(dist, 'renderer', 'licenses.json'), JSON.stringify(list.map(({ text, ...rest }) => rest)));
  const rule = '='.repeat(72);
  const body = list.map((x) => `${rule}\n${x.name} ${x.version} (${x.license})${x.homepage ? `\n${x.homepage}` : ''}\n${rule}\n\n${x.text}\n`).join('\n');
  fs.writeFileSync(
    path.join(dist, 'renderer', 'THIRD-PARTY-NOTICES.txt'),
    `Havi Hub ${pkg.version} includes the following third-party software. Electron and Chromium ship their own LICENSE and LICENSES.chromium.html files next to the program.\n\n${body}`,
  );
  console.log(`  notices: ${list.length} packages`);
}
