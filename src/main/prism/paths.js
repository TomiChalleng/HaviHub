// Locating Prism Launcher's data folder and executable, and resolving the
// folders configured inside prismlauncher.cfg.
const os = require('node:os');
const path = require('node:path');
const { exists, existsSync } = require('../util/fsx');
const { IniFile, asList } = require('../util/ini');

const CFG_NAMES = ['prismlauncher.cfg', 'polymc.cfg', 'multimc.cfg'];

function home() {
  return os.homedir();
}

function dataDirCandidates() {
  const list = [];
  const env = process.env.PRISMLAUNCHER_DATA_DIR;
  if (env) list.push(env);
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA || path.join(home(), 'AppData', 'Roaming');
    const local = process.env.LOCALAPPDATA || path.join(home(), 'AppData', 'Local');
    list.push(path.join(appdata, 'PrismLauncher'));
    // portable installs next to the exe
    list.push(path.join(local, 'Programs', 'PrismLauncher', 'UserData'));
    list.push(path.join(local, 'Programs', 'PrismLauncher'));
    list.push(path.join(home(), 'scoop', 'persist', 'prismlauncher'));
    list.push(path.join(home(), 'scoop', 'apps', 'prismlauncher', 'current', 'UserData'));
  } else if (process.platform === 'darwin') {
    list.push(path.join(home(), 'Library', 'Application Support', 'PrismLauncher'));
  } else {
    const xdg = process.env.XDG_DATA_HOME || path.join(home(), '.local', 'share');
    list.push(path.join(xdg, 'PrismLauncher'));
    list.push(path.join(home(), '.var', 'app', 'org.prismlauncher.PrismLauncher', 'data', 'PrismLauncher'));
    list.push(path.join(home(), 'snap', 'prismlauncher', 'common'));
  }
  return list;
}

function exeCandidates() {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(home(), 'AppData', 'Local');
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    return [
      path.join(local, 'Programs', 'PrismLauncher', 'prismlauncher.exe'),
      path.join(pf, 'PrismLauncher', 'prismlauncher.exe'),
      path.join(pf86, 'PrismLauncher', 'prismlauncher.exe'),
      path.join(home(), 'scoop', 'apps', 'prismlauncher', 'current', 'prismlauncher.exe'),
      path.join(local, 'Microsoft', 'WinGet', 'Links', 'prismlauncher.exe'),
    ];
  }
  if (process.platform === 'darwin') {
    return ['/Applications/Prism Launcher.app/Contents/MacOS/prismlauncher', path.join(home(), 'Applications', 'Prism Launcher.app', 'Contents', 'MacOS', 'prismlauncher')];
  }
  return ['/usr/bin/prismlauncher', '/usr/local/bin/prismlauncher', path.join(home(), '.local', 'bin', 'prismlauncher'), '/var/lib/flatpak/exports/bin/org.prismlauncher.PrismLauncher', path.join(home(), '.local/share/flatpak/exports/bin/org.prismlauncher.PrismLauncher'), '/snap/bin/prismlauncher'];
}

async function findCfg(dir) {
  for (const n of CFG_NAMES) {
    const p = path.join(dir, n);
    if (await exists(p)) return p;
  }
  return null;
}

async function isPrismDataDir(dir) {
  if (!dir) return false;
  return Boolean((await findCfg(dir)) || (await exists(path.join(dir, 'instances'))) || (await exists(path.join(dir, 'accounts.json'))));
}

async function detectDataDir() {
  for (const c of dataDirCandidates()) {
    if (await isPrismDataDir(c)) return c;
  }
  return null;
}

async function detectExe(dataDir) {
  const list = [];
  if (dataDir) {
    // portable: exe lives in the data dir (portable.txt) or its parent (UserData)
    const exeName = process.platform === 'win32' ? 'prismlauncher.exe' : 'prismlauncher';
    list.push(path.join(dataDir, exeName));
    list.push(path.join(path.dirname(dataDir), exeName));
  }
  list.push(...exeCandidates());
  for (const c of list) if (await exists(c)) return c;
  return null;
}

// The data dir context: resolves every folder Prism uses.
class PrismContext {
  constructor(dataDir, exe) {
    this.dataDir = dataDir;
    this.exe = exe;
  }

  async cfgPath() {
    return (await findCfg(this.dataDir)) || path.join(this.dataDir, 'prismlauncher.cfg');
  }

  async loadCfg() {
    return IniFile.load(await this.cfgPath());
  }

  resolve(p) {
    if (!p) return this.dataDir;
    return path.isAbsolute(p) ? p : path.join(this.dataDir, p);
  }

  async dirs() {
    const cfg = await this.loadCfg();
    const instanceDir = this.resolve(cfg.get('InstanceDir') || 'instances');
    const extra = asList(cfg.get('AdditionalInstanceDirs')).filter(Boolean).map((d) => this.resolve(d));
    return {
      instanceDirs: [instanceDir, ...extra.filter((d) => path.resolve(d) !== path.resolve(instanceDir))],
      primaryInstanceDir: instanceDir,
      iconsDir: this.resolve(cfg.get('IconsDir') || 'icons'),
      centralModsDir: this.resolve(cfg.get('CentralModsDir') || 'mods'),
      skinsDir: this.resolve(cfg.get('SkinsDir') || 'skins'),
      javaDir: this.resolve(cfg.get('JavaDir') || 'java'),
      templateDir: this.resolve(cfg.get('TemplateDir') || 'instance-template'),
      downloadsDir: cfg.get('DownloadsDir') || path.join(home(), 'Downloads'),
    };
  }

  groupsFile() {
    return path.join(this.dataDir, 'instgroups.json');
  }

  accountsFile() {
    return path.join(this.dataDir, 'accounts.json');
  }
}

module.exports = { detectDataDir, detectExe, isPrismDataDir, PrismContext, dataDirCandidates, exeCandidates, existsSync };
