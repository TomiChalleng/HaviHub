// Windows: the engine is an official Prism Launcher build, whose window names
// ("Prism Launcher 11.1.1") and icon are compiled in. A tiny native helper
// (build/helper/havihub-windows.exe) renames its windows to "Havi Hub", gives
// them Havi Hub's icon and groups them with Havi Hub on the taskbar. It only
// touches windows of the engine's own executable and ends by itself.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function firstExisting(list) {
  return list.filter(Boolean).find((p) => {
    try {
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  });
}

const inside = (file, dir) => path.resolve(file).toLowerCase().startsWith(path.resolve(dir).toLowerCase() + path.sep);

// opts: { engineDir, exe, appId, title, resourcesDir, devRoot, logFile }
// Only for Havi Hub's own engine: a custom engine (Ajustes → Avanzado) may be
// the user's real Prism Launcher, whose windows are left as they are.
function startWindowHelper(opts = {}) {
  if (process.platform !== 'win32') return false;
  const { engineDir, exe, appId, title = 'Havi Hub', resourcesDir, devRoot, logFile } = opts;
  if (!engineDir || (exe && !inside(exe, engineDir))) return false;
  const helper = firstExisting([resourcesDir && path.join(resourcesDir, 'havihub-windows.exe'), devRoot && path.join(devRoot, 'build', 'helper', 'havihub-windows.exe')]);
  if (!helper) return false;
  const icon = firstExisting([resourcesDir && path.join(resourcesDir, 'icon.ico'), devRoot && path.join(devRoot, 'build', 'icon.ico')]);
  const args = ['--dir', engineDir, '--title', title, '--parent', String(process.pid)];
  if (icon) args.push('--icon', icon);
  if (appId) args.push('--aumid', appId);
  if (logFile) args.push('--log', logFile);
  try {
    // detached: it keeps the windows right even if Havi Hub closes while the game runs
    const child = spawn(helper, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

module.exports = { startWindowHelper, inside };
