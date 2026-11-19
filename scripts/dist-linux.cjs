// Linux packages. electron-builder installs the .deb into /opt/<product name>
// ("/opt/Havi Hub"); every folder of Havi Hub is called "havihub", so the
// package is unpacked, its folder renamed (and the paths in its scripts, menu
// entry and AppArmor profile with it) and packed again. A package with the
// old name "havi-hub" is replaced by this one (Conflicts + Replaces), so
// installing it over the old one removes the old one. Needs dpkg-deb (any
// Debian/Ubuntu); without it the package is left as electron-builder made it.
const { execFileSync, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const OLD = `/opt/${pkg.build.productName}`;
const EXE = pkg.build.linux.executableName; // "havihub"
const NEW = `/opt/${EXE}`;
const LEGACY = 'havi-hub'; // the old name of the package, folder and command

function renameInstallDir(deb) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-deb-'));
  try {
    const dir = path.join(work, 'pkg');
    execFileSync('dpkg-deb', ['-R', deb, dir]);
    if (!fs.existsSync(path.join(dir, OLD))) return false; // already as wanted
    fs.renameSync(path.join(dir, OLD), path.join(dir, NEW));
    for (const rel of ['DEBIAN/postinst', 'DEBIAN/postrm', `usr/share/applications/${EXE}.desktop`, `${NEW.slice(1)}/resources/apparmor-profile`]) {
      const file = path.join(dir, rel);
      if (!fs.existsSync(file)) continue;
      let text = fs.readFileSync(file, 'utf8').split(OLD).join(NEW);
      // coming from an older package: its entries in "alternatives" go first
      // (normally its own scripts remove them when it is replaced)
      if (rel === 'DEBIAN/postinst') {
        const stale = [`${OLD}/${LEGACY}`, `/opt/${LEGACY}/${LEGACY}`].map((p) => `update-alternatives --remove '${LEGACY}' '${p}' >/dev/null 2>&1 || true`).join('; ');
        text = text.replace(/^(#!.*\n)/, `$1\nif type update-alternatives >/dev/null 2>&1; then ${stale}; fi\n`);
      }
      fs.writeFileSync(file, text);
    }
    // the package that came before, under its old name
    const control = path.join(dir, 'DEBIAN', 'control');
    let fields = fs.readFileSync(control, 'utf8').replace(/\n*$/, '\n');
    if (!/^Conflicts:/m.test(fields)) fields += `Conflicts: ${LEGACY}\n`;
    if (!/^Replaces:/m.test(fields)) fields += `Replaces: ${LEGACY}\n`;
    fs.writeFileSync(control, fields);
    // md5sums: every packaged file, with its new path. And nothing installed is
    // left writable by other users (the modes come from the computer that built it).
    const lines = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
        const p = path.join(d, e.name);
        if (e.isSymbolicLink()) continue;
        fs.chmodSync(p, fs.statSync(p).mode & 0o7755);
        if (e.isDirectory()) {
          if (path.relative(dir, p) !== 'DEBIAN') walk(p);
        } else if (e.isFile()) lines.push(`${crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex')}  ${path.relative(dir, p)}`);
      }
    };
    walk(dir);
    fs.writeFileSync(path.join(dir, 'DEBIAN', 'md5sums'), lines.join('\n') + '\n');
    const out = `${deb}.tmp`;
    execFileSync('dpkg-deb', ['--root-owner-group', '-Zxz', '-b', dir, out], { stdio: 'inherit' });
    fs.renameSync(out, deb);
    return true;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const bin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder');
  const r = spawnSync(bin, ['--linux', 'AppImage', 'deb', '--x64'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status || 1);
  const deb = path.join(root, 'release', `HaviHub-${pkg.version}-linux-amd64.deb`);
  if (spawnSync('dpkg-deb', ['--version']).status !== 0) {
    console.warn(`dpkg-deb is not available: the .deb installs to "${OLD}" instead of ${NEW}`);
  } else if (renameInstallDir(deb)) console.log(`  • .deb installs to ${NEW}`);
}

module.exports = { renameInstallDir };
