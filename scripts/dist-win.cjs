// Builds the Windows release: installer (Setup.exe), portable .exe and .zip.
//   node scripts/dist-win.cjs [nsis] [portable] [zip]   (default: all three, x64)
// Run `npm run build` first (or use `npm run dist:win`, which does both).
//
// On Linux/macOS electron-builder normally runs the NSIS installer under Wine to get
// the uninstaller out of it. It also ships a pure-JS extractor for that step, which it
// only enables on macOS; enabling it here lets the installer be built without Wine.
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

// The engine window helper ships prebuilt; rebuild it only when it is missing
const helper = path.join(__dirname, '..', 'build', 'helper', 'havihub-windows.exe');
if (!fs.existsSync(helper)) {
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'build-helper.mjs')], { stdio: 'inherit' });
  } catch {
    console.error('Falta build/helper/havihub-windows.exe y no se pudo compilar (pip install ziglang).');
    process.exit(1);
  }
}

if (process.platform !== 'win32') {
  const builderLib = path.dirname(require.resolve('app-builder-lib/package.json'));
  const macosVersion = require(path.join(builderLib, 'out/util/macosVersion.js'));
  macosVersion.isMacOsCatalina = () => true;
}

const { build, Platform, Arch } = require('electron-builder');

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const targets = wanted.length ? wanted : ['nsis', 'portable', 'zip'];

build({ targets: Platform.WINDOWS.createTarget(targets, Arch.x64) })
  .then((files) => {
    console.log('\nArtifacts:');
    for (const f of files) console.log('  ' + path.relative(process.cwd(), f));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
