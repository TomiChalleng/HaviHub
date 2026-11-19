// CurseForge files whose authors don't let other apps download them: the API
// gives no download link for those. Havi Hub gets them the ways their authors
// do allow, and installs them by itself:
//   1. the very same file (same SHA-1) from Modrinth, when the author
//      publishes it there too;
//   2. CurseForge's own download page, opened in a Havi Hub window: the
//      download that page starts is saved and installed (nothing to move by hand);
//   3. the Downloads folder: the file, downloaded there with any browser, is
//      found and installed.
// The CurseForge CDN is never guessed at: that would go around the author's choice.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { modrinth } = require('./modrinth');

const SITE = 'https://www.curseforge.com';
// files fetched in this session: "projectId:fileId" -> path on this computer
const captured = new Map();

const keyOf = (version) => `${version.projectId}:${version.id}`;

function sha1Of(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha1');
    fs.createReadStream(file)
      .on('data', (c) => h.update(c))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });
}

// Another place to download a blocked file from, or null
async function alternativeUrl(version, file) {
  const local = captured.get(keyOf(version));
  if (local && fs.existsSync(local)) return pathToFileURL(local).href;
  const sha1 = file.hashes && file.hashes.sha1;
  if (!sha1) return null;
  try {
    const found = await modrinth.versionsByHash([sha1], 'sha1');
    const v = found && found[sha1];
    const f = v && (v.files || []).find((x) => x.hashes && x.hashes.sha1 === sha1 && x.url);
    return f ? f.url : null;
  } catch {
    return null;
  }
}

// What the app needs to fetch one blocked file later. `resume` says how to
// finish installing it once the file is on this computer.
function blockedEntry({ version, file, mod, title, folder, resume }) {
  const site = (process.env.HAVIHUB_CF_SITE || SITE).replace(/\/$/, '');
  const base = mod && mod.url ? String(mod.url).replace(/^https:\/\/(www\.)?curseforge\.com/i, site) : '';
  return {
    key: keyOf(version),
    title: title || file.filename,
    fileName: file.filename,
    url: mod && mod.url ? `${mod.url}/files/${version.id}` : `${SITE}/projects/${version.projectId}`,
    page: base ? `${base}/download/${version.id}` : '',
    folder,
    sha1: (file.hashes && file.hashes.sha1) || '',
    size: file.size || 0,
    resume,
  };
}

// Is this file on disk the one the entry asks for?
async function matches(entry, file) {
  try {
    const st = await fsp.stat(file);
    if (!st.isFile() || !st.size) return false;
    if (entry.size && st.size !== entry.size) return false;
    if (entry.sha1) return (await sha1Of(file)).toLowerCase() === entry.sha1.toLowerCase();
    return path.basename(file).toLowerCase() === entry.fileName.toLowerCase();
  } catch {
    return false;
  }
}

// Names a browser may give the file in Downloads: "x.jar", "x (1).jar", "+" for spaces
function nameCandidates(fileName) {
  const ext = path.extname(fileName);
  const stem = fileName.slice(0, fileName.length - ext.length);
  const variants = new Set([stem, stem.replace(/ /g, '+'), stem.replace(/ /g, '_'), stem.replace(/\+/g, ' ')]);
  return (name) => {
    if (path.extname(name).toLowerCase() !== ext.toLowerCase()) return false;
    const s = name.slice(0, name.length - ext.length).replace(/ ?\(\d+\)$/, '');
    for (const v of variants) if (v.toLowerCase() === s.toLowerCase()) return true;
    return false;
  };
}

async function findInFolder(dir, entry) {
  if (!dir) return null;
  let names;
  try {
    names = await fsp.readdir(dir);
  } catch {
    return null;
  }
  const ok = nameCandidates(entry.fileName);
  for (const name of names) {
    if (!ok(name)) continue;
    const file = path.join(dir, name);
    if (await matches(entry, file)) return file;
  }
  return null;
}

class BlockedDownloads {
  // openBrowser({ onDownload, onClosed }) -> { load(url), close(), setTitle(text) }   (CurseForge's page in a window)
  // openExternal(url)                     the person's own browser
  // downloadsDir()                        the folder their browser downloads to
  // complete(entry)                       finishes installing an entry whose file is now on this computer
  // emit(channel, payload)
  constructor({ openBrowser, openExternal, downloadsDir, complete, emit, pollMs = 1500 }) {
    Object.assign(this, { openBrowser, openExternal, downloadsDir, complete, emit, pollMs });
    this.active = null;
  }

  cancel() {
    if (this.active) this.active.stop();
  }

  // mode 'window': CurseForge's page in a Havi Hub window. mode 'browser':
  // the person's browser, watching their Downloads folder.
  // Resolves { done: [entry], pending: [entry] } when all are in, or it's cancelled.
  async resolve(entries, mode = 'window') {
    if (this.active) this.active.stop();
    const status = new Map(entries.map((e) => [e.key, { key: e.key, title: e.title, fileName: e.fileName, state: 'waiting', progress: 0 }]));
    const send = () => this.emit('blocked:status', { mode, items: [...status.values()] });
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'havihub-cf-'));
    const done = [];
    let stopped = false;
    let browser = null;
    let current = null; // { entry, finish(path|null) }
    const session = {
      stop: () => {
        stopped = true;
        if (current) current.finish(null);
      },
    };
    this.active = session;

    const onDownload = (item) => {
      // only the file being waited for is kept; anything else the page starts is dropped
      if (!current) return item.cancel();
      const { entry, finish } = current;
      const st = status.get(entry.key);
      const save = path.join(tmp, `${done.length}-${path.basename(item.getFilename()).replace(/[^\w.+\- ()[\]]/g, '_')}`);
      item.setSavePath(save);
      item.on('updated', () => {
        const total = item.getTotalBytes();
        st.state = 'downloading';
        st.progress = total ? item.getReceivedBytes() / total : 0;
        send();
      });
      item.once('done', async (_e, result) => {
        if (result === 'completed' && (await matches(entry, save))) finish(save);
        else await fsp.rm(save, { force: true }).catch(() => {});
      });
    };

    try {
      for (const entry of entries) {
        if (stopped) break;
        const st = status.get(entry.key);
        // already in Downloads? then no page at all
        let file = await findInFolder(this.downloadsDir(), entry);
        if (!file) {
          if (!entry.page) {
            st.state = 'pending';
            send();
            continue;
          }
          st.state = 'opening';
          send();
          file = await new Promise((resolve) => {
            let settled = false;
            const finish = (p) => {
              if (settled) return;
              settled = true;
              clearInterval(poll);
              resolve(p);
            };
            current = { entry, finish };
            // the Downloads folder is watched in both modes
            const poll = setInterval(async () => {
              const found = await findInFolder(this.downloadsDir(), entry);
              if (found) finish(found);
            }, this.pollMs);
            if (mode === 'window') {
              if (!browser) {
                browser = this.openBrowser({
                  onDownload,
                  onClosed: () => {
                    browser = null;
                    session.stop();
                  },
                });
              }
              browser.setTitle(`Havi Hub · CurseForge · ${done.length + 1}/${entries.length} · ${entry.fileName}`);
              browser.load(entry.page);
            } else this.openExternal(entry.page);
          });
          current = null;
        }
        if (!file) {
          st.state = 'pending';
          send();
          continue;
        }
        captured.set(entry.key, file);
        st.state = 'installing';
        st.progress = 1;
        send();
        try {
          await this.complete(entry);
          st.state = 'done';
          done.push(entry);
        } catch (e) {
          st.state = 'failed';
          st.reason = String((e && e.message) || e);
        }
        captured.delete(entry.key);
        send();
      }
    } finally {
      if (this.active === session) this.active = null;
      if (browser) browser.close();
      for (const st of status.values()) if (!['done', 'failed'].includes(st.state)) st.state = 'pending';
      send();
      setTimeout(() => fsp.rm(tmp, { recursive: true, force: true }).catch(() => {}), 3000);
    }
    const doneKeys = new Set(done.map((e) => e.key));
    return { done, pending: entries.filter((e) => !doneKeys.has(e.key)), items: [...status.values()] };
  }
}

module.exports = { alternativeUrl, blockedEntry, matches, findInFolder, nameCandidates, BlockedDownloads, keyOf, captured };
