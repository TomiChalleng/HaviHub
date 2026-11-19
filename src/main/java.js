// Find Java installations without executing anything (reads the JDK "release" file).
const os = require('node:os');
const path = require('node:path');
const fsp = require('node:fs/promises');
const { listDir, exists } = require('./util/fsx');

async function readRelease(javaHome) {
  try {
    const txt = await fsp.readFile(path.join(javaHome, 'release'), 'utf8');
    const ver = /JAVA_VERSION="([^"]+)"/.exec(txt);
    const vendor = /IMPLEMENTOR="([^"]+)"/.exec(txt);
    const arch = /OS_ARCH="([^"]+)"/.exec(txt);
    return { version: ver ? ver[1] : '', vendor: vendor ? vendor[1] : '', arch: arch ? arch[1] : '' };
  } catch {
    return { version: '', vendor: '', arch: '' };
  }
}

function majorOf(v) {
  if (!v) return 0;
  const m = /^1\.(\d+)/.exec(v);
  if (m) return Number(m[1]);
  return Number(String(v).split(/[.+_-]/)[0]) || 0;
}

async function findJavas(prismJavaDir) {
  const win = process.platform === 'win32';
  const bin = win ? 'javaw.exe' : 'java';
  const roots = [];
  if (win) {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const appdata = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    for (const base of [pf, pf86]) {
      for (const vendor of ['Java', 'Eclipse Adoptium', 'Eclipse Foundation', 'Zulu', 'Microsoft', 'BellSoft', 'Amazon Corretto', 'Semeru', 'GraalVM']) roots.push(path.join(base, vendor));
    }
    roots.push(path.join(appdata, '.minecraft', 'runtime'));
    roots.push(path.join(local, 'Packages', 'Microsoft.4297127D64EC6_8wekyb3d8bbwe', 'LocalCache', 'Local', 'runtime'));
  } else if (process.platform === 'darwin') {
    roots.push('/Library/Java/JavaVirtualMachines', path.join(os.homedir(), 'Library/Java/JavaVirtualMachines'));
  } else {
    roots.push('/usr/lib/jvm', '/usr/lib64/jvm', '/opt/java', '/opt/jdk');
  }
  if (prismJavaDir) roots.unshift(prismJavaDir);
  if (process.env.JAVA_HOME) roots.push(path.dirname(process.env.JAVA_HOME));

  const found = new Map();
  // search depth up to 4 under each root for bin/java(w)
  async function scan(dir, depth) {
    if (depth < 0) return;
    const candidate = path.join(dir, 'bin', bin);
    if (await exists(candidate)) {
      const home = dir;
      if (!found.has(candidate)) {
        const rel = await readRelease(home);
        found.set(candidate, { path: candidate, home, ...rel, major: majorOf(rel.version) || guessMajor(home) });
      }
      return;
    }
    const macHome = path.join(dir, 'Contents', 'Home');
    if (await exists(path.join(macHome, 'bin', 'java'))) return scan(macHome, 0);
    for (const ent of await listDir(dir)) {
      if (ent.isDirectory() && !ent.name.startsWith('.')) await scan(path.join(dir, ent.name), depth - 1);
    }
  }
  for (const r of roots) await scan(r, 4);
  return [...found.values()].sort((a, b) => b.major - a.major);
}

function guessMajor(home) {
  const m = /(?:jdk|jre|java|zulu|temurin)[-_]?(?:1\.)?(\d{1,2})/i.exec(home) || /java-runtime-(alpha|beta|gamma|delta)/.exec(home);
  if (!m) return 0;
  if (m[1] === 'alpha') return 16;
  if (m[1] === 'beta') return 17;
  if (m[1] === 'gamma') return 17;
  if (m[1] === 'delta') return 21;
  return Number(m[1]) || 0;
}

module.exports = { findJavas, majorOf };
