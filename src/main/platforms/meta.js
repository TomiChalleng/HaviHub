// Minecraft and mod loader versions from Prism Launcher's meta server (the same
// source Prism uses), with a disk cache for offline use.
const path = require('node:path');
const http = require('../util/http');
const { readJson, writeJson } = require('../util/fsx');

const DEFAULT_META = 'https://meta.prismlauncher.org/v1/';

class Meta {
  constructor(cacheDir, metaUrlProvider) {
    this.cacheDir = path.join(cacheDir, 'meta');
    this.metaUrlProvider = metaUrlProvider || (() => DEFAULT_META);
    this.mem = new Map();
  }

  async index(uid) {
    const hit = this.mem.get(uid);
    if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.data;
    const base = this.metaUrlProvider() || DEFAULT_META;
    const url = `${base.replace(/\/?$/, '/')}${uid}/index.json`;
    const cacheFile = path.join(this.cacheDir, `${uid}.json`);
    let data;
    try {
      data = await http.getJson(url, { timeout: 20000 });
      await writeJson(cacheFile, data, 0).catch(() => {});
    } catch (e) {
      data = await readJson(cacheFile, null);
      if (!data) throw e;
    }
    this.mem.set(uid, { at: Date.now(), data });
    return data;
  }

  async minecraftVersions() {
    const idx = await this.index('net.minecraft');
    return (idx.versions || []).map((v) => ({ version: v.version, type: v.type || 'release', releaseTime: v.releaseTime, recommended: Boolean(v.recommended) }));
  }

  async loaderVersions(loader, mcVersion) {
    const uid = {
      fabric: 'net.fabricmc.fabric-loader',
      quilt: 'org.quiltmc.quilt-loader',
      forge: 'net.minecraftforge',
      neoforge: 'net.neoforged',
    }[loader];
    if (!uid) return [];
    const idx = await this.index(uid);
    let versions = idx.versions || [];
    if (loader === 'fabric' || loader === 'quilt') {
      // Fabric/Quilt need intermediary mappings for the Minecraft version
      if (mcVersion) {
        const inter = await this.index('net.fabricmc.intermediary').catch(() => null);
        const ok = inter ? (inter.versions || []).some((v) => v.version === mcVersion) : true;
        if (!ok) return [];
      }
    } else if (mcVersion) {
      versions = versions.filter((v) => (v.requires || []).some((r) => r.uid === 'net.minecraft' && r.equals === mcVersion));
    }
    return versions.map((v) => ({ version: v.version, recommended: Boolean(v.recommended), type: v.type || 'release', releaseTime: v.releaseTime }));
  }

  async loadersFor(mcVersion) {
    const out = [];
    for (const l of ['fabric', 'quilt', 'forge', 'neoforge']) {
      try {
        const v = await this.loaderVersions(l, mcVersion);
        if (v.length) out.push(l);
      } catch {
        /* offline */
      }
    }
    return out;
  }
}

module.exports = { Meta };
