// Content folders of an instance: mods, resource packs, shader packs and data
// packs. Reads Prism's .pw.toml metadata and the metadata inside jars/zips.
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const TOML = require('smol-toml');
const { listDir, statSafe, exists, parseLenientJson, readJson, writeJson } = require('../util/fsx');
const zip = require('../util/zip');
const { fileUrl } = require('../urls');
const { gameDirOf } = require('./instances');
const { IniFile } = require('../util/ini');

const KINDS = {
  mods: { dir: 'mods', index: '.index', exts: /\.(jar|litemod|zip)$/i, folders: false },
  resourcepacks: { dir: 'resourcepacks', index: '.index', exts: /\.zip$/i, folders: true },
  shaderpacks: { dir: 'shaderpacks', index: '', exts: /\.zip$/i, folders: true },
  datapacks: { dir: 'datapacks', index: '.index', exts: /\.(zip|jar)$/i, folders: true },
};

// ---------- metadata (.pw.toml) ----------
async function readMetadata(indexDir) {
  const byFile = new Map();
  for (const ent of await listDir(indexDir)) {
    if (!ent.isFile() || !ent.name.endsWith('.pw.toml')) continue;
    const file = path.join(indexDir, ent.name);
    try {
      const data = TOML.parse(await fsp.readFile(file, 'utf8'));
      const upd = data.update || {};
      const meta = {
        metaFile: file,
        slug: ent.name.replace(/\.pw\.toml$/, ''),
        name: data.name || '',
        filename: data.filename || '',
        side: data.side || '',
        loaders: data['x-prismlauncher-loaders'] || [],
        mcVersions: data['x-prismlauncher-mc-versions'] || [],
        releaseType: data['x-prismlauncher-release-type'] || '',
        versionNumber: data['x-prismlauncher-version-number'] || '',
        lockUpdate: Boolean(data['x-prismlauncher-lock-update']),
        download: data.download || {},
        provider: upd.curseforge ? 'curseforge' : upd.modrinth ? 'modrinth' : '',
        projectId: upd.curseforge ? String(upd.curseforge['project-id']) : upd.modrinth ? String(upd.modrinth['mod-id']) : '',
        fileId: upd.curseforge ? String(upd.curseforge['file-id']) : upd.modrinth ? String(upd.modrinth.version) : '',
      };
      if (meta.filename) byFile.set(meta.filename.toLowerCase(), meta);
    } catch {
      /* ignore broken metadata */
    }
  }
  return byFile;
}

function tomlString(s) {
  return "'" + String(s).replace(/'/g, "’") + "'";
}
function tomlBasic(s) {
  return JSON.stringify(String(s));
}

// Writes metadata in the same layout Prism Launcher uses.
async function writeMetadata(indexDir, m) {
  await fsp.mkdir(indexDir, { recursive: true });
  const lines = [];
  const arr = (a) => `[ ${(a || []).map(tomlBasic).join(', ')} ]`;
  lines.push(`filename = ${tomlBasic(m.filename)}`);
  lines.push(`name = ${tomlBasic(m.name)}`);
  lines.push(`side = ${tomlBasic(m.side || 'both')}`);
  lines.push(`x-prismlauncher-loaders = ${arr(m.loaders)}`);
  lines.push(`x-prismlauncher-mc-versions = ${arr(m.mcVersions)}`);
  lines.push(`x-prismlauncher-release-type = ${tomlBasic(m.releaseType || 'Release')}`);
  lines.push(`x-prismlauncher-version-number = ${tomlBasic(m.versionNumber || '')}`);
  lines.push(`x-prismlauncher-lock-update = ${m.lockUpdate ? 'true' : 'false'}`);
  if (m.dependencies && m.dependencies.length) {
    lines.push('x-prismlauncher-dependencies = [');
    for (const d of m.dependencies) {
      const parts = [`addonId = ${tomlBasic(d.addonId)}`, `type = ${tomlBasic(d.type)}`];
      if (d.version) parts.push(`version = ${tomlBasic(d.version)}`);
      lines.push(`  { ${parts.join(', ')} },`);
    }
    lines.push(']');
  } else {
    lines.push('x-prismlauncher-dependencies = []');
  }
  lines.push('');
  lines.push('[download]');
  lines.push(`hash = ${tomlBasic(m.hash)}`);
  lines.push(`hash-format = ${tomlBasic(m.hashFormat)}`);
  lines.push(`mode = ${tomlBasic(m.provider === 'curseforge' ? 'metadata:curseforge' : 'url')}`);
  lines.push(`url = ${tomlBasic(m.provider === 'curseforge' ? '' : m.url || '')}`);
  lines.push('');
  if (m.provider === 'curseforge') {
    lines.push('[update.curseforge]');
    lines.push(`file-id = ${parseInt(m.fileId, 10)}`);
    lines.push(`project-id = ${parseInt(m.projectId, 10)}`);
  } else {
    lines.push('[update.modrinth]');
    lines.push(`mod-id = ${tomlBasic(m.projectId)}`);
    lines.push(`version = ${tomlBasic(m.fileId)}`);
  }
  const slug = (m.slug || m.name || m.filename).toString().toLowerCase().replace(/[^a-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '') || 'resource';
  const file = path.join(indexDir, `${slug}.pw.toml`);
  await fsp.writeFile(file, lines.join('\n') + '\n');
  return file;
}

// ---------- jar / zip metadata ----------
function textFromComponent(c) {
  if (c == null) return '';
  if (typeof c === 'string') return c.replace(/§./g, '');
  if (Array.isArray(c)) return c.map(textFromComponent).join('');
  if (typeof c === 'object') return (c.text || c.translate || '') + (c.extra ? textFromComponent(c.extra) : '');
  return String(c);
}

function parseManifest(buf) {
  const out = {};
  if (!buf) return out;
  const text = buf.toString('utf8').replace(/\r?\n /g, '');
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function pickIconPath(icon) {
  if (!icon) return null;
  if (typeof icon === 'string') return icon.replace(/^\//, '');
  if (typeof icon === 'object') {
    const sizes = Object.keys(icon).map(Number).filter(Number.isFinite).sort((a, b) => b - a);
    const best = sizes.find((s) => s <= 128) || sizes[0];
    return best !== undefined ? String(icon[String(best)]).replace(/^\//, '') : null;
  }
  return null;
}

async function readModInfo(file) {
  const wanted = ['fabric.mod.json', 'quilt.mod.json', 'META-INF/mods.toml', 'META-INF/neoforge.mods.toml', 'mcmod.info', 'META-INF/MANIFEST.MF', 'pack.mcmeta', 'pack.png', 'litemod.json'];
  const e = await zip.readEntries(file, wanted);
  const info = { name: '', version: '', authors: [], description: '', iconPath: null, env: '', modId: '', loaders: [] };
  try {
    if (e.get('fabric.mod.json')) {
      const j = parseLenientJson(e.get('fabric.mod.json').toString('utf8'));
      info.modId = j.id || '';
      info.name = j.name || j.id || '';
      info.version = j.version || '';
      info.description = j.description || '';
      info.authors = (j.authors || []).map((a) => (typeof a === 'string' ? a : a && a.name)).filter(Boolean);
      info.iconPath = pickIconPath(j.icon);
      info.env = j.environment === 'client' ? 'client' : j.environment === 'server' ? 'server' : 'both';
      info.loaders.push('fabric');
    }
    if (e.get('quilt.mod.json')) {
      const j = parseLenientJson(e.get('quilt.mod.json').toString('utf8'));
      const ql = j.quilt_loader || {};
      const md = ql.metadata || {};
      info.modId = info.modId || ql.id || '';
      info.name = info.name || md.name || ql.id || '';
      info.version = info.version || ql.version || '';
      info.description = info.description || md.description || '';
      if (!info.authors.length && md.contributors) info.authors = Object.keys(md.contributors);
      info.iconPath = info.iconPath || pickIconPath(md.icon);
      const env = j.minecraft && j.minecraft.environment;
      if (!info.env) info.env = env === 'client' ? 'client' : env === 'dedicated_server' ? 'server' : 'both';
      info.loaders.push('quilt');
    }
    const modsToml = e.get('META-INF/neoforge.mods.toml') || e.get('META-INF/mods.toml');
    if (modsToml && !info.name) {
      let t = null;
      try {
        t = TOML.parse(modsToml.toString('utf8'));
      } catch {
        t = null;
      }
      const m = t && Array.isArray(t.mods) ? t.mods[0] : null;
      if (m) {
        info.modId = m.modId || '';
        info.name = m.displayName || m.modId || '';
        info.version = m.version || '';
        info.description = (m.description || '').trim();
        info.authors = typeof (m.authors || t.authors) === 'string' ? String(m.authors || t.authors).split(/,\s*/) : [];
        info.iconPath = (m.logoFile || t.logoFile || '').replace(/^\//, '') || null;
      } else {
        const g = (k) => {
          const r = new RegExp(`^\\s*${k}\\s*=\\s*["']([^"']*)["']`, 'm').exec(modsToml.toString('utf8'));
          return r ? r[1] : '';
        };
        info.modId = g('modId');
        info.name = g('displayName') || info.modId;
        info.version = g('version');
        info.authors = g('authors') ? g('authors').split(/,\s*/) : [];
        info.iconPath = g('logoFile') || null;
      }
      info.loaders.push(e.get('META-INF/neoforge.mods.toml') ? 'neoforge' : 'forge');
      info.env = info.env || 'both';
    }
    if (e.get('mcmod.info') && !info.name) {
      const j = parseLenientJson(e.get('mcmod.info').toString('utf8'));
      const m = Array.isArray(j) ? j[0] : j && Array.isArray(j.modList) ? j.modList[0] : null;
      if (m) {
        info.modId = m.modid || '';
        info.name = m.name || m.modid || '';
        info.version = m.version || '';
        info.description = m.description || '';
        info.authors = m.authorList || m.authors || [];
        info.iconPath = (m.logoFile || '').replace(/^\//, '') || null;
      }
      info.loaders.push('forge');
    }
    if (e.get('litemod.json') && !info.name) {
      const j = parseLenientJson(e.get('litemod.json').toString('utf8'));
      info.name = j.displayName || j.name || '';
      info.version = j.version || '';
      info.authors = j.author ? [j.author] : [];
      info.description = j.description || '';
      info.loaders.push('liteloader');
    }
    if (e.get('pack.mcmeta')) {
      const j = parseLenientJson(e.get('pack.mcmeta').toString('utf8'));
      if (!info.description) info.description = textFromComponent(j.pack && j.pack.description);
      info.packFormat = j.pack && j.pack.pack_format;
      if (!info.iconPath && e.get('pack.png')) info.iconPath = 'pack.png';
    }
    if (info.version && info.version.includes('${')) {
      const mf = parseManifest(e.get('META-INF/MANIFEST.MF'));
      info.version = mf['Implementation-Version'] || info.version.replace(/\$\{[^}]+\}/g, '').trim();
    }
  } catch {
    /* tolerate broken metadata */
  }
  if (info.iconPath === 'pack.png' && e.get('pack.png')) info.iconBuffer = e.get('pack.png');
  return info;
}

async function readFolderPackInfo(dir) {
  const info = { name: '', description: '', iconPath: null };
  try {
    const j = parseLenientJson(await fsp.readFile(path.join(dir, 'pack.mcmeta'), 'utf8'));
    info.description = textFromComponent(j.pack && j.pack.description);
  } catch {
    /* none */
  }
  if (await exists(path.join(dir, 'pack.png'))) info.iconFile = path.join(dir, 'pack.png');
  return info;
}

class Content {
  constructor(instances, cacheDir) {
    this.instances = instances;
    this.cacheDir = cacheDir;
    this.cacheFile = path.join(cacheDir, 'modinfo-cache.json');
    this.cache = null;
    this.saveTimer = null;
  }

  async loadCache() {
    if (!this.cache) this.cache = await readJson(this.cacheFile, {});
    return this.cache;
  }

  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => writeJson(this.cacheFile, this.cache, 0).catch(() => {}), 1500);
  }

  async folderFor(id, kind, { world } = {}) {
    const root = await this.instances.locate(id);
    const game = gameDirOf(root);
    if (kind === 'datapacks') {
      if (world) return path.join(game, 'saves', world, 'datapacks');
      const cfg = await IniFile.load(path.join(root, 'instance.cfg'));
      return path.join(game, cfg.get('GlobalDataPacksPath', '') || 'datapacks');
    }
    return path.join(game, KINDS[kind].dir);
  }

  indexDirFor(folder, kind) {
    return KINDS[kind].index ? path.join(folder, KINDS[kind].index) : folder;
  }

  async iconFromJar(file, st, iconPath, iconBuffer) {
    const key = crypto.createHash('sha1').update(`${file}|${st.size}|${st.mtimeMs}`).digest('hex');
    const dest = path.join(this.cacheDir, 'icons', `${key}.png`);
    if (await exists(dest)) return fileUrl(dest);
    let buf = iconBuffer || null;
    if (!buf && iconPath) buf = await zip.readEntry(file, iconPath, { maxSize: 4 * 1024 * 1024 }).catch(() => null);
    if (!buf || buf.length < 8) return null;
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, buf);
    return fileUrl(dest);
  }

  async list(id, kind, opts = {}) {
    if (!KINDS[kind]) throw new Error(`Tipo de contenido desconocido: ${kind}`);
    const folder = await this.folderFor(id, kind, opts);
    const indexDir = this.indexDirFor(folder, kind);
    const meta = await readMetadata(indexDir);
    const cache = await this.loadCache();
    const items = [];
    for (const ent of await listDir(folder)) {
      if (ent.name.startsWith('.')) continue;
      if (ent.name.endsWith('.pw.toml') || ent.name.endsWith('.part')) continue;
      const full = path.join(folder, ent.name);
      const isDir = ent.isDirectory();
      if (isDir && !KINDS[kind].folders) continue;
      const enabled = !ent.name.toLowerCase().endsWith('.disabled');
      const baseName = enabled ? ent.name : ent.name.slice(0, -'.disabled'.length);
      if (!isDir && !KINDS[kind].exts.test(baseName)) continue;
      const st = await statSafe(full);
      if (!st) continue;
      const m = meta.get(baseName.toLowerCase()) || null;
      let info = {};
      if (isDir) {
        info = await readFolderPackInfo(full);
        if (info.iconFile) info.icon = fileUrl(info.iconFile, st.mtimeMs);
      } else {
        const ck = `${full}|${st.size}|${st.mtimeMs}`;
        if (cache[ck]) info = cache[ck];
        else {
          try {
            const raw = await readModInfo(full);
            const icon = await this.iconFromJar(full, st, raw.iconPath, raw.iconBuffer);
            info = {
              name: raw.name,
              version: raw.version,
              authors: raw.authors,
              description: raw.description,
              env: raw.env,
              modId: raw.modId,
              loaders: raw.loaders,
              icon,
            };
          } catch {
            info = {};
          }
          // drop stale entries for this file
          for (const k of Object.keys(cache)) if (k.startsWith(full + '|')) delete cache[k];
          cache[ck] = info;
          this.scheduleSave();
        }
      }
      const env = info.env || (m && m.side === 'client' ? 'client' : m && m.side === 'server' ? 'server' : m ? 'both' : '');
      items.push({
        fileName: ent.name,
        baseName,
        path: full,
        isDir,
        enabled,
        size: st.size,
        mtime: st.mtimeMs,
        name: (m && m.name) || info.name || baseName.replace(/\.(jar|zip|litemod)$/i, ''),
        version: (m && m.versionNumber) || info.version || '',
        authors: info.authors || [],
        description: info.description || '',
        icon: info.icon || null,
        env,
        modId: info.modId || '',
        meta: m
          ? { provider: m.provider, projectId: m.projectId, fileId: m.fileId, slug: m.slug, releaseType: m.releaseType, lockUpdate: m.lockUpdate, hash: m.download.hash, hashFormat: m.download['hash-format'] }
          : null,
      });
    }
    items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return { folder, items };
  }

  async setEnabled(id, kind, fileName, enabled, opts = {}) {
    const folder = await this.folderFor(id, kind, opts);
    const cur = path.join(folder, fileName);
    const isDisabled = fileName.toLowerCase().endsWith('.disabled');
    if (enabled && isDisabled) await fsp.rename(cur, cur.slice(0, -'.disabled'.length));
    else if (!enabled && !isDisabled) await fsp.rename(cur, `${cur}.disabled`);
  }

  async remove(id, kind, fileName, opts = {}, trashFn) {
    const folder = await this.folderFor(id, kind, opts);
    const full = path.join(folder, fileName);
    if (!full.startsWith(folder)) throw new Error('Ruta inválida');
    const baseName = fileName.toLowerCase().endsWith('.disabled') ? fileName.slice(0, -9) : fileName;
    const meta = await readMetadata(this.indexDirFor(folder, kind));
    const m = meta.get(baseName.toLowerCase());
    if (trashFn) await trashFn(full).catch(() => fsp.rm(full, { recursive: true, force: true }));
    else await fsp.rm(full, { recursive: true, force: true });
    if (m) await fsp.rm(m.metaFile, { force: true });
  }

  async addFiles(id, kind, files, opts = {}) {
    const folder = await this.folderFor(id, kind, opts);
    await fsp.mkdir(folder, { recursive: true });
    const added = [];
    for (const f of files) {
      const dest = path.join(folder, path.basename(f));
      await fsp.copyFile(f, dest);
      added.push(path.basename(f));
    }
    return added;
  }

  async metadataFor(id, kind, opts = {}) {
    const folder = await this.folderFor(id, kind, opts);
    return { folder, indexDir: this.indexDirFor(folder, kind), meta: await readMetadata(this.indexDirFor(folder, kind)) };
  }
}

module.exports = { Content, KINDS, readMetadata, writeMetadata, readModInfo, textFromComponent };
