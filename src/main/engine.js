// Havi Hub's private engine: an official, unmodified Prism Launcher portable
// build that Havi Hub downloads from Prism Launcher's GitHub releases and
// keeps up to date in the background. Havi Hub is the only interface: the
// engine runs only to start the game and, when adding a Microsoft account, to
// show Microsoft's sign-in (only an approved app may sign in to Minecraft).
//
// Layout:  <dir>/engine.json            state (active version, last check)
//          <dir>/versions/<version>/    extracted portable build
//          <dir>/downloads/             temporary archives
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const os = require('node:os');
const fsp = require('node:fs/promises');
const { spawn, execFile } = require('node:child_process');
const http = require('./util/http');
const { extractPrefix } = require('./util/zip');
const { extractTarGz } = require('./util/tar');
const { readJson, writeJson, exists, listDir, parseLenientJson } = require('./util/fsx');
const { IniFile } = require('./util/ini');
const { resolvePalette, luminance, mix } = require('../shared/themes.js');
const { brandEngine, isBranded } = require('./engine-brand');

const REPO = 'PrismLauncher/PrismLauncher';
const API_LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;
const LATEST_PAGE = `https://github.com/${REPO}/releases/latest`;
const RECHECK_MS = 6 * 3600 * 1000;
const THEME_ID = 'havihub';

// Windows antivirus scanners briefly lock freshly extracted files
async function renameRetry(from, to) {
  for (let i = 0; ; i++) {
    try {
      await fsp.rename(from, to);
      return;
    } catch (e) {
      if (i >= 8 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
}

function releaseAssetUrl(tag, name) {
  return `https://github.com/${REPO}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
}

// "11.1.1" > "11.1.0" > "11.1.0-pre1"
function compareVersions(a, b) {
  const parse = (v) => {
    const [main, pre] = String(v || '').replace(/^v/i, '').split('-');
    return { nums: main.split('.').map((n) => parseInt(n, 10) || 0), pre: pre || '' };
  };
  const A = parse(a);
  const B = parse(b);
  for (let i = 0; i < Math.max(A.nums.length, B.nums.length); i++) {
    const d = (A.nums[i] || 0) - (B.nums[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  if (A.pre === B.pre) return 0;
  if (!A.pre) return 1;
  if (!B.pre) return -1;
  return A.pre.localeCompare(B.pre, undefined, { numeric: true });
}

function assetNames(version, platform = process.platform, arch = process.arch) {
  if (platform === 'win32') {
    if (arch === 'arm64') return [`PrismLauncher-Windows-MSVC-arm64-Portable-${version}.zip`];
    return [`PrismLauncher-Windows-MSVC-Portable-${version}.zip`, `PrismLauncher-Windows-MinGW-w64-Portable-${version}.zip`];
  }
  if (platform === 'linux') {
    if (arch === 'arm64') return [`PrismLauncher-Linux-aarch64-Qt6-Portable-${version}.tar.gz`];
    if (arch === 'x64') return [`PrismLauncher-Linux-Qt6-Portable-${version}.tar.gz`];
    return [];
  }
  if (platform === 'darwin') return [`PrismLauncher-macOS-${version}.zip`];
  return [];
}

function exeRelPath(platform = process.platform) {
  if (platform === 'win32') return 'prismlauncher.exe';
  if (platform === 'darwin') return path.join('Prism Launcher.app', 'Contents', 'MacOS', 'prismlauncher');
  return 'PrismLauncher'; // start script of the portable Linux build
}

// ------------------------------------------------------------------ engine data
// Settings that keep the engine invisible: no setup wizard, no console, no
// update prompts, and dialogs that use Havi Hub's colors and language.
function engineLanguage(appLanguage, systemLocale) {
  const lang = appLanguage || (String(systemLocale || '').toLowerCase().startsWith('es') ? 'es' : 'en');
  return lang === 'en' ? 'en_US' : 'es';
}

function qtTheme(palette) {
  const p = palette;
  const dark = luminance(p.bg) < 0.5;
  const theme = {
    name: 'Havi Hub',
    widgets: 'Fusion',
    qssFilePath: 'themeStyle.css',
    colors: {
      Window: p.surface,
      WindowText: p.text,
      Base: p.surface2,
      AlternateBase: p.surface3,
      ToolTipBase: p.surface3,
      ToolTipText: p.text,
      Text: p.text,
      Button: p.surface2,
      ButtonText: p.text,
      BrightText: p.danger,
      Link: p.accent,
      Highlight: p.accent,
      HighlightedText: p.accentText,
      fadeColor: p.surface,
      fadeAmount: 0.5,
    },
    logColors: {
      Launcher: p.info,
      Error: p.logError,
      Warning: p.logWarn,
      Debug: p.textMuted,
      Fatal: p.danger,
    },
  };
  const css = [
    `QToolTip { color: ${p.text}; background-color: ${p.surface3}; border: 1px solid ${p.border}; }`,
    `QProgressBar { border: 1px solid ${p.border}; border-radius: 3px; background-color: ${p.surface2}; color: ${p.text}; text-align: center; }`,
    `QProgressBar::chunk { background-color: ${p.accent}; border-radius: 2px; }`,
    `QPushButton:default { background-color: ${p.accent}; color: ${p.accentText}; border: 1px solid ${mix(p.accent, '#000000', 0.15)}; border-radius: 3px; padding: 4px 14px; }`,
    `QPushButton:default:hover { background-color: ${mix(p.accent, dark ? '#ffffff' : '#000000', 0.12)}; }`,
  ].join('\n');
  return { theme, css, iconTheme: dark ? 'flat_white' : 'flat' };
}

// folders: { shared, instancesDir, iconsDir } when Havi Hub shares Prism
// Launcher's profiles (see sharing.js); otherwise the data folder's own ones.
// msaClientId: the Microsoft app the engine signs in with: Havi Hub's own
// (HAVIHUB_MSA_CLIENT_ID, approved by Mojang) or the person's (Ajustes →
// Avanzado); empty = the engine's own.
// flameKey: { value, isOurs(key) } — the CurseForge API key Havi Hub uses, so
// the engine's own requests to CurseForge carry it too. It replaces only an
// empty setting or a key Havi Hub wrote before (isOurs): a key the person put
// in the engine's settings stays. Returns { flameKey } with the key now in
// the setting when Havi Hub wrote it (undefined when it was left alone).
// Havi Hub's app in Microsoft Entra, approved by Mojang for the Minecraft
// services. Microsoft's sign-in page shows its name. It is a public client ID,
// not a secret: it identifies the app, like the one built into the engine.
const HAVIHUB_MSA_CLIENT_ID = '10ba024d-897d-422d-bf41-2f818b9a1468';

async function prepareData(dataDir, { palette, language = 'es', showConsole, folders, msaClientId, flameKey } = {}) {
  await fsp.mkdir(dataDir, { recursive: true });
  const cfgPath = path.join(dataDir, 'prismlauncher.cfg');
  const cfg = await IniFile.load(cfgPath);
  const { theme, css, iconTheme } = qtTheme(palette || resolvePalette('forge'));
  const themeDir = path.join(dataDir, 'themes', THEME_ID);
  await fsp.mkdir(themeDir, { recursive: true });
  await writeJson(path.join(themeDir, 'theme.json'), theme, 4);
  await fsp.writeFile(path.join(themeDir, 'themeStyle.css'), css);

  const want = {
    Language: language,
    ApplicationTheme: THEME_ID,
    IconTheme: iconTheme,
    IgnoreJavaWizard: true,
    UserAskedAboutAutomaticJavaDownload: true,
  };
  if (folders) {
    want.InstanceDir = folders.shared ? folders.instancesDir : 'instances';
    want.IconsDir = folders.shared ? folders.iconsDir : 'icons';
  } else if (!cfg.has('InstanceDir')) want.InstanceDir = 'instances';
  if (!cfg.has('AutomaticJavaDownload')) want.AutomaticJavaDownload = true;
  if (!cfg.has('AutomaticJavaSwitch') && !cfg.get('JavaPath')) want.AutomaticJavaSwitch = true;
  if (msaClientId !== undefined) want.MSAClientIDOverride = /^[0-9a-f-]{36}$/i.test(String(msaClientId).trim()) ? String(msaClientId).trim().toLowerCase() : '';
  if (!cfg.has('ShowConsole')) want.ShowConsole = false;
  // a game that crashes is shown by Havi Hub: it opens the profile's log
  want.ShowConsoleOnError = false;
  if (showConsole !== undefined) want.ShowConsole = Boolean(showConsole);
  let flameKeyWritten;
  if (flameKey) {
    const current = String(cfg.get('FlameKeyOverride', '') || '');
    if (!current || flameKey.isOurs(current)) {
      if (current !== flameKey.value) want.FlameKeyOverride = flameKey.value;
      flameKeyWritten = flameKey.value;
    }
  }
  let changed = false;
  for (const [k, v] of Object.entries(want)) {
    if (String(cfg.get(k)) !== String(v)) {
      cfg.set(k, v);
      changed = true;
    }
  }
  // A non-empty legacy paste URL forces Prism's setup wizard
  if (cfg.has('PastebinURL') && cfg.get('PastebinURL')) {
    cfg.remove('PastebinURL');
    changed = true;
  }
  if (changed || !(await exists(cfgPath))) await cfg.save(cfgPath);
  return { flameKey: flameKeyWritten };
}

// ------------------------------------------------------------------ manager
class EngineManager {
  // iconBitmap(size): Havi Hub's icon as BGRA pixels, for the engine program's own icon (Windows)
  constructor({ dir, tasks, emit, isRunning, customExe, iconBitmap }) {
    this.dir = dir;
    this.iconBitmap = iconBitmap;
    this.tasks = tasks;
    this.emit = emit || (() => {});
    this.isRunning = isRunning || (() => false);
    this.customExe = customExe || (() => '');
    this.stateFile = path.join(dir, 'engine.json');
    this.state = { version: '', pending: '', latest: '', lastCheck: 0 };
    this.checking = null;
    this.installing = null;
    this.progress = 0;
    this.error = '';
  }

  async load() {
    this.state = { ...this.state, ...(await readJson(this.stateFile, {})) };
    return this;
  }

  async save() {
    await fsp.mkdir(this.dir, { recursive: true });
    await writeJson(this.stateFile, this.state, 2);
  }

  versionDir(v) {
    return path.join(this.dir, 'versions', v);
  }

  exeFor(v) {
    return path.join(this.versionDir(v), exeRelPath());
  }

  supported() {
    return assetNames('x').length > 0;
  }

  status() {
    return {
      version: this.state.version || '',
      pending: this.state.pending || '',
      latest: this.state.latest || '',
      lastCheck: this.state.lastCheck || 0,
      checking: Boolean(this.checking),
      installing: Boolean(this.installing),
      progress: this.progress,
      error: this.error,
      custom: this.customExe() || '',
      supported: this.supported(),
    };
  }

  emitStatus() {
    this.emit('engine:status', this.status());
  }

  async exe() {
    const custom = this.customExe();
    if (custom) return (await exists(custom)) ? custom : null;
    await this.activatePending();
    if (this.state.version && (await exists(this.exeFor(this.state.version)))) {
      await this.brand(this.versionDir(this.state.version));
      return this.exeFor(this.state.version);
    }
    return null;
  }

  // Havi Hub's name on the engine (engine-brand.js). An engine installed by an
  // older Havi Hub gets it here, the next time it isn't running. Never fatal.
  async brand(dir) {
    try {
      if (this.isRunning() || (await isBranded(dir))) return;
      await brandEngine(dir, { iconBitmap: this.iconBitmap });
    } catch (e) {
      console.warn('engine brand:', e.message);
    }
  }

  async activatePending() {
    if (!this.state.pending || this.isRunning()) return;
    if (await exists(this.exeFor(this.state.pending))) {
      this.state.version = this.state.pending;
      this.state.pending = '';
      await this.save();
      await this.cleanup();
      this.emitStatus();
    }
  }

  async cleanup() {
    const keep = new Set([this.state.version, this.state.pending].filter(Boolean));
    for (const ent of await listDir(path.join(this.dir, 'versions'))) {
      if (!keep.has(ent.name)) await fsp.rm(path.join(this.dir, 'versions', ent.name), { recursive: true, force: true }).catch(() => {});
    }
  }

  async latestRelease() {
    try {
      const r = await http.getJson(API_LATEST, { headers: { Accept: 'application/vnd.github+json' }, timeout: 20000, retries: 1 });
      return {
        tag: r.tag_name,
        version: String(r.tag_name).replace(/^v/i, ''),
        date: r.published_at || '',
        // digest: the SHA-256 GitHub computes for each release file ("sha256:<hex>")
        assets: (r.assets || []).map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size, digest: typeof a.digest === 'string' ? a.digest : '' })),
      };
    } catch (apiError) {
      // Fallback without the API (rate limits): the "latest" page redirects to the tag
      const res = await http.request(LATEST_PAGE, { timeout: 20000, retries: 1 });
      const m = /\/releases\/tag\/([^/?#]+)/.exec(res.url || '');
      if (!m) throw apiError;
      const tag = decodeURIComponent(m[1]);
      return { tag, version: tag.replace(/^v/i, ''), date: '', assets: [] };
    }
  }

  // Look for a newer Prism Launcher and install it in the background.
  check({ force = false } = {}) {
    if (this.customExe() || !this.supported()) return Promise.resolve(this.status());
    if (this.checking) return this.checking;
    if (!force && this.state.version && Date.now() - (this.state.lastCheck || 0) < RECHECK_MS) return Promise.resolve(this.status());
    this.checking = (async () => {
      this.emitStatus();
      try {
        const rel = await this.latestRelease();
        this.state.latest = rel.version;
        this.state.lastCheck = Date.now();
        this.error = '';
        await this.save();
        const current = this.state.pending || this.state.version;
        const installed = current && (await exists(this.exeFor(current)));
        if (!installed || compareVersions(rel.version, current) > 0) await this.install(rel);
      } catch (e) {
        this.error = String((e && e.message) || e);
      } finally {
        this.checking = null;
        this.emitStatus();
      }
      return this.status();
    })();
    return this.checking;
  }

  install(rel) {
    if (this.installing) return this.installing;
    this.installing = this.doInstall(rel).finally(() => {
      this.installing = null;
      this.progress = 0;
      this.emitStatus();
    });
    return this.installing;
  }

  async doInstall(rel) {
    const names = assetNames(rel.version);
    const listed = (rel.assets || []).find((a) => names.includes(a.name));
    const asset = listed || (names[0] ? { name: names[0], url: releaseAssetUrl(rel.tag || rel.version, names[0]) } : null);
    if (!asset) throw new Error('No hay un motor de juego descargable para este sistema.');
    const title = `Motor de juego de Havi Hub ${rel.version}`;
    const run = async (task) => {
      const archive = path.join(this.dir, 'downloads', asset.name);
      await http.download(asset.url, archive, {
        onProgress: (got, total) => {
          this.progress = total ? (got / total) * 0.85 : 0;
          if (task) task.progress(this.progress, total ? `${Math.round(got / 1048576)} / ${Math.round(total / 1048576)} MB` : '');
          this.emitStatus();
        },
      });
      // the file must be the one GitHub published (when GitHub gives its SHA-256)
      const want = /^sha256:([0-9a-f]{64})$/i.exec(asset.digest || '');
      if (want) {
        const hash = crypto.createHash('sha256');
        await pipeline(fs.createReadStream(archive), hash);
        if (hash.digest('hex') !== want[1].toLowerCase()) {
          await fsp.rm(archive, { force: true });
          throw new Error('La descarga del motor no coincide con la huella SHA-256 que publica GitHub. Se descartó y se intentará de nuevo.');
        }
      }
      if (task) task.progress(0.88, 'Descomprimiendo…');
      const target = this.versionDir(rel.version);
      const tmp = `${target}.partial`;
      await fsp.rm(tmp, { recursive: true, force: true });
      await fsp.mkdir(tmp, { recursive: true });
      if (asset.name.endsWith('.tar.gz')) await extractTarGz(archive, tmp);
      else await extractPrefix(archive, '', tmp);
      // Some archives wrap everything in one folder
      let root = tmp;
      if (!(await exists(path.join(root, exeRelPath())))) {
        const ents = (await listDir(root)).filter((e) => e.isDirectory());
        if (ents.length === 1 && (await exists(path.join(root, ents[0].name, exeRelPath())))) root = path.join(root, ents[0].name);
      }
      if (!(await exists(path.join(root, exeRelPath())))) throw new Error('El archivo descargado no contiene el motor de juego.');
      // Havi Hub handles updates: remove the engine's own updater
      for (const n of ['prismlauncher_updater.exe', 'prismlauncher_updater', path.join('bin', 'prismlauncher_updater')]) await fsp.rm(path.join(root, n), { force: true });
      if (process.platform !== 'win32') await fsp.chmod(path.join(root, exeRelPath()), 0o755).catch(() => {});
      if (task) task.progress(0.94, 'Preparando…');
      // Havi Hub's name on its windows and pages (engine-brand.js)
      await brandEngine(root, { iconBitmap: this.iconBitmap }).catch((e) => console.warn('engine brand:', e.message));
      await fsp.rm(target, { recursive: true, force: true });
      if (root === tmp) await renameRetry(tmp, target);
      else {
        await renameRetry(root, target);
        await fsp.rm(tmp, { recursive: true, force: true });
      }
      await fsp.rm(archive, { force: true });
      if (this.isRunning() && this.state.version) this.state.pending = rel.version;
      else {
        this.state.version = rel.version;
        this.state.pending = '';
      }
      await this.save();
      await this.cleanup();
    };
    if (this.tasks) await this.tasks.run(title, { kind: 'engine' }, run);
    else await run(null);
  }

  // The engine executable, installing it first if needed.
  async ensure() {
    let exe = await this.exe();
    if (exe) return exe;
    if (this.customExe()) throw Object.assign(new Error('No se encontró el motor personalizado configurado en Ajustes → Avanzado.'), { code: 'NO_ENGINE' });
    await this.check({ force: true });
    if (this.installing) await this.installing.catch(() => {});
    exe = await this.exe();
    if (!exe) throw Object.assign(new Error(this.error ? `No se pudo descargar el motor: ${this.error}` : 'No se pudo preparar el motor de Havi Hub.'), { code: 'NO_ENGINE' });
    return exe;
  }
}

// ------------------------------------------------------------------ sign-in
// Microsoft sign-in through the engine, in a temporary folder with no
// accounts: the engine then shows only its sign-in page. The new account is
// copied into Havi Hub's accounts.json and the engine is closed.
function startLogin({ exe, dataFile, prepare, onDone, onSpawn }) {
  let child = null;
  let finished = false;
  let timer = null;
  let poll = null;
  let tmp = null;

  const finish = async (result) => {
    if (finished) return;
    finished = true;
    clearInterval(poll);
    clearTimeout(timer);
    if (child && child.exitCode === null) killTree(child.pid);
    setTimeout(() => tmp && fsp.rm(tmp, { recursive: true, force: true }).catch(() => {}), 1500);
    onDone(result);
  };

  (async () => {
    tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'havihub-login-'));
    await prepare(tmp);
    const inst = path.join(tmp, 'instances', '__havihub_login__');
    await fsp.mkdir(inst, { recursive: true });
    await fsp.writeFile(path.join(inst, 'instance.cfg'), '[General]\r\nConfigVersion=1.3\r\nInstanceType=OneSix\r\nname=Havi Hub\r\n');
    // --profile with an unknown name: after sign-in the engine starts nothing
    // and opens no window, so only Microsoft's sign-in is ever shown.
    child = spawn(exe, ['--dir', tmp, '--launch', '__havihub_login__', '--profile', '__havihub__'], { cwd: tmp, detached: process.platform !== 'win32', stdio: 'ignore' });
    if (onSpawn) onSpawn(exe);
    child.on('error', (e) => finish({ error: String(e.message || e) }));
    child.on('exit', () => setTimeout(() => finish({ cancelled: true }), 1200));
    const accountsFile = path.join(tmp, 'accounts.json');
    const logFile = path.join(tmp, 'logs', 'PrismLauncher-0.log');
    let wizardClosedAt = 0;
    poll = setInterval(async () => {
      try {
        const data = parseLenientJson(await fsp.readFile(accountsFile, 'utf8'));
        const found = (data.accounts || []).filter((a) => a.type === 'MSA' && a.profile && a.profile.id && a.ygg && a.ygg.token);
        if (found.length) {
          await mergeAccounts(dataFile, found);
          finish({ added: found.map((a) => a.profile.name) });
          return;
        }
      } catch {
        /* not written yet */
      }
      // The sign-in page was closed without an account: the engine logs that
      // it moves on to "launching" (and then idles), so close it.
      if (!wizardClosedAt) {
        const log = await fsp.readFile(logFile, 'utf8').catch(() => '');
        if (log.includes('__havihub_login__" launching') || log.includes('Setup wizard was not completed')) wizardClosedAt = Date.now();
      } else if (Date.now() - wizardClosedAt > 2500) finish({ cancelled: true });
    }, 800);
    timer = setTimeout(() => finish({ cancelled: true, timeout: true }), 20 * 60 * 1000);
  })().catch((e) => finish({ error: String(e.message || e) }));

  return { cancel: () => finish({ cancelled: true }) };
}

// Add/replace accounts (by profile id) without touching the others.
async function mergeAccounts(file, incoming) {
  let data = { formatVersion: 3, accounts: [] };
  if (await exists(file)) {
    data = parseLenientJson(await fsp.readFile(file, 'utf8'));
    if (!data || !Array.isArray(data.accounts)) throw new Error('accounts.json tiene un formato inesperado; no se modificó.');
  }
  const hasActive = data.accounts.some((a) => a.active);
  for (const acc of incoming) {
    const copy = { ...acc };
    delete copy.active;
    const i = data.accounts.findIndex((a) => a.profile && acc.profile && a.profile.id === acc.profile.id);
    if (i >= 0) {
      if (data.accounts[i].active) copy.active = true;
      data.accounts[i] = copy;
    } else data.accounts.push(copy);
  }
  if (!hasActive && data.accounts.length) {
    const first = data.accounts.find((a) => incoming.some((n) => n.profile && a.profile && n.profile.id === a.profile.id)) || data.accounts[0];
    first.active = true;
  }
  if (!data.formatVersion) data.formatVersion = 3;
  await writeJson(file, data, 4);
  return data;
}

function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => {});
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      /* gone */
    }
  }
}

module.exports = { EngineManager, prepareData, HAVIHUB_MSA_CLIENT_ID, qtTheme, engineLanguage, compareVersions, assetNames, exeRelPath, startLogin, mergeAccounts, killTree, THEME_ID };
