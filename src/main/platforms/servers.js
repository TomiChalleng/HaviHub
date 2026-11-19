// Server listings from Modrinth (projects of type "minecraft_java_server"),
// normalized for the Servers page.
const http = require('../util/http');

const BASE = 'https://api.modrinth.com/v3';

const SORTS = {
  relevance: 'relevance',
  plays: 'minecraft_java_server.verified_plays_2w',
  online: 'minecraft_java_server.ping.data.players_online',
  follows: 'follows',
  newest: 'date_created',
  updated: 'date_modified',
};

const REGIONS = ['us_east', 'us_west', 'europe', 'asia', 'australia', 'south_america', 'middle_east', 'russia'];

// a value in the filter language: bare when simple, quoted otherwise
const val = (v) => (/^[a-z0-9_.-]+$/i.test(String(v)) ? String(v) : JSON.stringify(String(v)));

function filterString({ online, kinds, version, region, language, categories } = {}) {
  const f = ['project_types = minecraft_java_server'];
  if (online) f.push('minecraft_java_server.ping.data EXISTS');
  const k = (kinds || []).filter((x) => x === 'vanilla' || x === 'modpack');
  if (k.length === 1) f.push(`minecraft_java_server.content.kind = ${k[0]}`);
  if (version) f.push(`game_versions = ${val(version)}`);
  if (region && REGIONS.includes(region)) f.push(`minecraft_server.region = ${val(region)}`);
  if (language) f.push(`minecraft_server.languages = ${val(language)}`);
  for (const c of categories || []) f.push(`categories = ${val(c)}`);
  return f.join(' AND ');
}

function normalize(h) {
  const ms = h.minecraft_server || {};
  const js = h.minecraft_java_server || {};
  const content = js.content || {};
  const ping = js.ping && js.ping.data ? js.ping.data : null;
  const modpack =
    content.kind === 'modpack'
      ? { projectId: content.project_id || '', versionId: content.version_id || '', name: content.project_name || '', icon: content.project_icon || null }
      : null;
  return {
    id: h.project_id,
    slug: h.slug,
    name: h.name,
    summary: h.summary || '',
    author: h.author || '',
    icon: h.icon_url || null,
    url: `https://modrinth.com/server/${h.slug || h.project_id}`,
    address: js.address || (js.ping && js.ping.address) || '',
    categories: h.display_categories && h.display_categories.length ? h.display_categories : h.categories || [],
    allCategories: h.categories || [],
    region: ms.region || '',
    languages: ms.languages || [],
    kind: content.kind || 'vanilla',
    versions: content.supported_game_versions || h.game_versions || [],
    recommended: content.recommended_game_version || (h.game_versions || [])[0] || '',
    modpack,
    plays: js.verified_plays_2w || 0,
    follows: h.follows || 0,
    online: ping ? ping.players_online : null,
    maxPlayers: ping ? ping.players_max : ms.max_players || null,
    motd: ping ? ping.description || '' : '',
    serverVersion: ping ? ping.version_name || '' : '',
  };
}

async function search({ query = '', sort = 'relevance', offset = 0, limit = 20, ...filters } = {}) {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  params.set('index', SORTS[sort] || 'relevance');
  params.set('offset', String(offset));
  params.set('limit', String(limit));
  params.set('new_filters', filterString(filters));
  const res = await http.getJson(`${BASE}/search?${params.toString()}`);
  // if the filters were not understood the API answers with every project:
  // only servers count
  const hits = (res.hits || []).filter((h) => (h.project_types || []).includes('minecraft_java_server'));
  return { total: hits.length || offset ? res.total_hits || 0 : 0, hits: hits.map(normalize) };
}

module.exports = { search, filterString, normalize, SORTS, REGIONS };
