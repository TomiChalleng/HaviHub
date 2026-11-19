// A link to a project on Modrinth or CurseForge (as people paste and share
// them): which site, which kind of content and which project.
const MODRINTH = { mod: 'mod', plugin: 'mod', resourcepack: 'resourcepack', shader: 'shader', datapack: 'datapack', modpack: 'modpack' };
const CURSEFORGE = { 'mc-mods': 'mod', 'texture-packs': 'resourcepack', shaders: 'shader', 'data-packs': 'datapack', modpacks: 'modpack', worlds: 'world', customization: 'mod' };

function parseProjectLink(link) {
  let u;
  try {
    u = new URL(String(link));
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);
  if (host === 'modrinth.com' && parts.length >= 2 && MODRINTH[parts[0]] && /^[\w!@$()`.+,"\-']{2,64}$/.test(parts[1])) {
    return { source: 'modrinth', type: MODRINTH[parts[0]], slug: parts[1] };
  }
  if (host === 'curseforge.com' && parts.length >= 3 && parts[0] === 'minecraft' && CURSEFORGE[parts[1]] && /^[a-z0-9-]{1,80}$/i.test(parts[2])) {
    return { source: 'curseforge', type: CURSEFORGE[parts[1]], slug: parts[2].toLowerCase() };
  }
  return null;
}

module.exports = { parseProjectLink };
