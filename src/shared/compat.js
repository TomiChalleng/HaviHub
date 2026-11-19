// What can go into an instance, decided the same way by the search, the
// project page, the version lists and the installer:
//   mods       need the instance's loader and its exact game version
//   data packs need the exact game version (their format changes often)
//   shaders    need a mod loader (Iris, Oculus, OptiFine…); the pack itself
//              works across game versions
//   resource packs work with any version (older ones still load)
//   maps (worlds) open in their version or a newer one (the game upgrades them)

function loaderOf(instance) {
  return instance && instance.loader ? instance.loader.id || instance.loader : '';
}

// loaders whose mods run on this instance
function modLoadersFor(instance) {
  const l = loaderOf(instance);
  if (!l) return [];
  if (l === 'quilt') return ['quilt', 'fabric'];
  if (l === 'neoforge' && instance.mcVersion === '1.20.1') return ['neoforge', 'forge'];
  return [l];
}

// content types that make sense for this instance (no mods or shaders on vanilla)
function typesFor(instance) {
  const types = ['resourcepack', 'datapack', 'world'];
  if (loaderOf(instance)) types.unshift('mod', 'shader');
  return types;
}

function typeAllowed(instance, type) {
  if (type === 'mod' || type === 'shader') return Boolean(loaderOf(instance));
  return true;
}

// "1.20.4" < "1.21" < "26.1": compares the numeric parts
function cmpVersion(a, b) {
  const pa = String(a).split(/[^\d]+/).filter(Boolean).map(Number);
  const pb = String(b).split(/[^\d]+/).filter(Boolean).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

const isRelease = (v) => /^\d+(\.\d+)+$/.test(String(v));

// The search filters a content type starts with inside an instance (the
// person can remove any of them; what can't go in is caught by compatIssue).
function searchFiltersFor(instance, type) {
  const mc = instance && instance.mcVersion;
  if (type === 'mod') return { gameVersion: mc, loaders: modLoadersFor(instance) };
  if (type === 'datapack') return { gameVersion: mc, loaders: undefined };
  if (type === 'world') return { gameVersion: undefined, maxVersion: mc };
  return { gameVersion: undefined, loaders: undefined };
}

// Is one version (or a search hit, with its gameVersions/loaders) usable here?
function versionCompatible(v, instance, type) {
  const mc = instance && instance.mcVersion;
  const games = (v && v.gameVersions) || [];
  if (type === 'mod') {
    const loaders = modLoadersFor(instance);
    if (!loaders.length) return false;
    const vl = (v.loaders || []).map((x) => String(x).toLowerCase());
    return (!mc || games.includes(mc)) && (!vl.length || vl.some((l) => loaders.includes(l)));
  }
  if (type === 'datapack') return !mc || !games.length || games.includes(mc);
  if (type === 'shader') return Boolean(loaderOf(instance));
  if (type === 'world') return !mc || !games.length || games.some((g) => !isRelease(g) || cmpVersion(g, mc) <= 0);
  return true;
}

// Why a search result (or a version) can't go into this instance, or null:
//   { code: 'vanilla' }                     mods and shaders on a profile without a loader
//   { code: 'version-loader', v, l }        a mod with no version for this game version + loader
//   { code: 'version', v }                  a data pack with no version for this game version
//   { code: 'newer-map', v }                a map made for a newer game version
function compatIssue(hit, instance, type) {
  if (!instance) return null;
  if ((type === 'mod' || type === 'shader') && !loaderOf(instance)) return { code: 'vanilla', type };
  if (versionCompatible(hit, instance, type)) return null;
  const v = instance.mcVersion;
  if (type === 'mod') return { code: 'version-loader', v, l: loaderOf(instance) };
  if (type === 'datapack') return { code: 'version', v };
  if (type === 'world') return { code: 'newer-map', v };
  return null;
}

// kind (folder) -> type
const TYPE_OF_KIND = { mods: 'mod', resourcepacks: 'resourcepack', shaderpacks: 'shader', datapacks: 'datapack', worlds: 'world' };

module.exports = { loaderOf, modLoadersFor, typesFor, typeAllowed, searchFiltersFor, versionCompatible, compatIssue, cmpVersion, TYPE_OF_KIND };
