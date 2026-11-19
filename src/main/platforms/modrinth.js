// Modrinth API v2 client, normalized to Havi Hub's common shapes.
const http = require('../util/http');
const { envFromSides } = require('./env');

const BASE = 'https://api.modrinth.com/v2';

const TYPE_MAP = { mod: 'mod', modpack: 'modpack', resourcepack: 'resourcepack', shader: 'shader', datapack: 'datapack' };

function q(params) {
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(typeof v === 'string' ? v : JSON.stringify(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

function projectUrl(type, slug) {
  const seg = { mod: 'mod', modpack: 'modpack', resourcepack: 'resourcepack', shader: 'shader', datapack: 'datapack' }[type] || 'project';
  return `https://modrinth.com/${seg}/${slug}`;
}

// Search hits list the loaders among their categories
const LOADER_TAGS = new Set(['fabric', 'forge', 'neoforge', 'quilt', 'liteloader', 'modloader', 'rift', 'iris', 'optifine', 'canvas', 'vanilla']);

function normalizeHit(h, typeHint) {
  let type = TYPE_MAP[h.project_type] || typeHint || 'mod';
  if ((h.loaders || h.categories || []).includes('datapack') && typeHint === 'datapack') type = 'datapack';
  return {
    source: 'modrinth',
    id: h.project_id || h.id,
    slug: h.slug,
    title: h.title,
    author: h.author || '',
    description: h.description || '',
    icon: h.icon_url || null,
    downloads: h.downloads || 0,
    follows: h.follows || h.followers || 0,
    updated: h.date_modified || h.updated || null,
    created: h.date_created || h.published || null,
    categories: h.display_categories || h.categories || [],
    gameVersions: h.versions || h.game_versions || [],
    loaders: h.loaders || (h.categories || []).filter((c) => LOADER_TAGS.has(c)),
    type,
    url: projectUrl(type, h.slug),
    featuredImage: h.featured_gallery || (Array.isArray(h.gallery) && h.gallery[0]) || null,
    color: h.color || null,
    clientSide: h.client_side,
    serverSide: h.server_side,
    env: envFromSides(h.client_side, h.server_side),
  };
}

function normalizeVersion(v) {
  return {
    source: 'modrinth',
    projectId: v.project_id,
    id: v.id,
    name: v.name,
    versionNumber: v.version_number,
    type: v.version_type || 'release',
    gameVersions: v.game_versions || [],
    loaders: v.loaders || [],
    date: v.date_published,
    downloads: v.downloads || 0,
    changelog: v.changelog || '',
    files: (v.files || []).map((f) => ({
      filename: f.filename,
      url: f.url,
      size: f.size,
      primary: Boolean(f.primary),
      hashes: f.hashes || {},
    })),
    dependencies: (v.dependencies || []).map((d) => ({
      projectId: d.project_id || null,
      versionId: d.version_id || null,
      fileName: d.file_name || null,
      type: d.dependency_type,
    })),
  };
}

const client = {
  async search({ query = '', type = 'mod', gameVersion, loaders, categories = [], sort = 'relevance', offset = 0, limit = 20, environment } = {}) {
    const facets = [[`project_type:${type}`]];
    if (loaders && loaders.length) facets.push(loaders.map((l) => `categories:${l}`));
    if (gameVersion) facets.push([`versions:${gameVersion}`]);
    for (const c of categories) facets.push([`categories:${c}`]);
    if (environment === 'client') facets.push(['client_side:required', 'client_side:optional']);
    const index = { relevance: 'relevance', downloads: 'downloads', follows: 'follows', newest: 'newest', updated: 'updated' }[sort] || 'relevance';
    const res = await http.getJson(`${BASE}/search${q({ query, facets, index, offset, limit })}`);
    return { total: res.total_hits || 0, hits: (res.hits || []).map((h) => normalizeHit(h, type)) };
  },

  async project(id) {
    const p = await http.getJson(`${BASE}/project/${encodeURIComponent(id)}`);
    let author = '';
    try {
      const members = await http.getJson(`${BASE}/project/${encodeURIComponent(id)}/members`);
      const owner = (members || []).find((m) => m.role === 'Owner' || m.is_owner) || (members || [])[0];
      author = owner && owner.user ? owner.user.username : '';
    } catch {
      /* optional */
    }
    const base = normalizeHit({ ...p, project_id: p.id, versions: p.game_versions, follows: p.followers, date_modified: p.updated, date_created: p.published, author }, p.project_type);
    return {
      ...base,
      body: p.body || '',
      bodyFormat: 'markdown',
      gallery: (p.gallery || []).sort((a, b) => (a.ordering || 0) - (b.ordering || 0)).map((g) => ({ url: g.raw_url || g.url, thumb: g.url, title: g.title || '', description: g.description || '' })),
      links: {
        source: p.source_url || null,
        issues: p.issues_url || null,
        wiki: p.wiki_url || null,
        discord: p.discord_url || null,
        donations: (p.donation_urls || []).map((d) => ({ platform: d.platform, url: d.url })),
      },
      license: p.license ? p.license.name || p.license.id : '',
      versionIds: p.versions || [],
    };
  },

  async projects(ids) {
    if (!ids.length) return [];
    const list = await http.getJson(`${BASE}/projects${q({ ids })}`);
    return list.map((p) => normalizeHit({ ...p, project_id: p.id, versions: p.game_versions, follows: p.followers, date_modified: p.updated, date_created: p.published }, p.project_type));
  },

  async versions(id, { loaders, gameVersions } = {}) {
    const list = await http.getJson(`${BASE}/project/${encodeURIComponent(id)}/version${q({ loaders, game_versions: gameVersions })}`);
    return list.map(normalizeVersion);
  },

  async version(id) {
    return normalizeVersion(await http.getJson(`${BASE}/version/${encodeURIComponent(id)}`));
  },

  async versionsByHash(hashes, algorithm = 'sha1') {
    if (!hashes.length) return {};
    const res = await http.postJson(`${BASE}/version_files`, { hashes, algorithm });
    const out = {};
    for (const [h, v] of Object.entries(res || {})) out[h] = normalizeVersion(v);
    return out;
  },

  async latestByHash(hashes, algorithm, { loaders, gameVersions } = {}) {
    if (!hashes.length) return {};
    const body = { hashes, algorithm };
    if (loaders && loaders.length) body.loaders = loaders;
    if (gameVersions && gameVersions.length) body.game_versions = gameVersions;
    const res = await http.postJson(`${BASE}/version_files/update`, body);
    const out = {};
    for (const [h, v] of Object.entries(res || {})) out[h] = normalizeVersion(v);
    return out;
  },

  async categories() {
    const list = await http.getJson(`${BASE}/tag/category`);
    return list.map((c) => ({ id: c.name, name: c.name, type: c.project_type, header: c.header, icon: c.icon }));
  },

  async gameVersions() {
    const list = await http.getJson(`${BASE}/tag/game_version`);
    return list.map((v) => ({ version: v.version, type: v.version_type, major: v.major, date: v.date }));
  },
};

module.exports = { modrinth: client, normalizeHit, normalizeVersion };
