// Names for the server directory's tags (Modrinth's server categories),
// regions and languages.
import { getLanguage } from './i18n.js';

// [id, group, Spanish, English]
const CATS = [
  ['anarchy', 'gameplay', 'Anarquía', 'Anarchy'],
  ['battle-royale', 'gameplay', 'Battle royale', 'Battle royale'],
  ['bedwars', 'gameplay', 'Bedwars', 'Bedwars'],
  ['factions', 'gameplay', 'Facciones', 'Factions'],
  ['gens', 'gameplay', 'Gens', 'Gens'],
  ['kitpvp', 'gameplay', 'KitPvP', 'KitPvP'],
  ['lifesteal', 'gameplay', 'Lifesteal', 'Lifesteal'],
  ['microgames', 'gameplay', 'Microjuegos', 'Microgames'],
  ['minigames', 'gameplay', 'Minijuegos', 'Minigames'],
  ['oneblock', 'gameplay', 'OneBlock', 'OneBlock'],
  ['parkour', 'gameplay', 'Parkour', 'Parkour'],
  ['prison', 'gameplay', 'Prisión', 'Prison'],
  ['racing', 'gameplay', 'Carreras', 'Racing'],
  ['rpg', 'gameplay', 'RPG', 'RPG'],
  ['skyblock', 'gameplay', 'Skyblock', 'Skyblock'],
  ['towns', 'gameplay', 'Pueblos', 'Towns'],
  ['vanilla-like', 'gameplay', 'Estilo vanilla', 'Vanilla-like'],
  ['bosses', 'features', 'Jefes', 'Bosses'],
  ['classes', 'features', 'Clases', 'Classes'],
  ['custom-content', 'features', 'Contenido propio', 'Custom content'],
  ['dungeons', 'features', 'Mazmorras', 'Dungeons'],
  ['economy', 'features', 'Economía', 'Economy'],
  ['media', 'features', 'Medios', 'Media'],
  ['op', 'features', 'OP', 'OP'],
  ['personal-worlds', 'features', 'Mundos personales', 'Personal worlds'],
  ['plots', 'features', 'Parcelas', 'Plots'],
  ['pokemon', 'features', 'Pokémon', 'Pokémon'],
  ['pve', 'features', 'PvE', 'PvE'],
  ['pvp', 'features', 'PvP', 'PvP'],
  ['questing', 'features', 'Misiones', 'Questing'],
  ['teams', 'features', 'Equipos', 'Teams'],
  ['competitive', 'community', 'Competitivo', 'Competitive'],
  ['creator-community', 'community', 'Comunidad de creadores', 'Creator community'],
  ['mmo', 'community', 'MMO', 'MMO'],
  ['recording-smp', 'community', 'SMP para grabar', 'Recording SMP'],
  ['roleplay', 'community', 'Rol', 'Roleplay'],
  ['smp', 'community', 'SMP', 'SMP'],
  ['social', 'community', 'Social', 'Social'],
  ['technical', 'community', 'Técnico', 'Technical'],
  ['adventure-mode', 'meta', 'Modo aventura', 'Adventure mode'],
  ['creative-mode', 'meta', 'Modo creativo', 'Creative mode'],
  ['crossplay', 'meta', 'Multiplataforma', 'Crossplay'],
  ['hardcore-mode', 'meta', 'Modo extremo', 'Hardcore mode'],
  ['keep-inventory', 'meta', 'Conservar inventario', 'Keep inventory'],
  ['network', 'meta', 'Red de servidores', 'Network'],
  ['offline-mode', 'meta', 'Sin cuenta premium', 'Offline mode'],
  ['survival-mode', 'meta', 'Supervivencia', 'Survival mode'],
  ['whitelisted', 'meta', 'Con lista blanca', 'Whitelisted'],
  ['world-resets', 'meta', 'Reinicios de mundo', 'World resets'],
];

export const CATEGORY_GROUPS = [
  { id: 'gameplay', es: 'Modo de juego', en: 'Gameplay' },
  { id: 'features', es: 'Características', en: 'Features' },
  { id: 'community', es: 'Comunidad', en: 'Community' },
  { id: 'meta', es: 'Reglas y estilo', en: 'Rules and style' },
];

const en = () => getLanguage() === 'en';

export function categoriesOf(group) {
  return CATS.filter((c) => c[1] === group).map(([id, , es, eng]) => ({ id, label: en() ? eng : es }));
}

export function categoryLabel(id) {
  const c = CATS.find((x) => x[0] === id);
  if (!c) return id;
  return en() ? c[3] : c[2];
}

const REGIONS = {
  us_east: ['Norteamérica (este)', 'North America (east)'],
  us_west: ['Norteamérica (oeste)', 'North America (west)'],
  europe: ['Europa', 'Europe'],
  asia: ['Asia', 'Asia'],
  australia: ['Oceanía', 'Oceania'],
  south_america: ['Sudamérica', 'South America'],
  middle_east: ['Medio Oriente', 'Middle East'],
  russia: ['Rusia', 'Russia'],
};
export const REGION_IDS = Object.keys(REGIONS);
export const regionLabel = (id) => (REGIONS[id] ? REGIONS[id][en() ? 1 : 0] : id);

// languages, by their own names
export const LANGUAGES = [
  ['es', 'Español'],
  ['en', 'English'],
  ['pt', 'Português'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['it', 'Italiano'],
  ['pl', 'Polski'],
  ['ru', 'Русский'],
  ['tr', 'Türkçe'],
  ['zh', '中文'],
  ['ja', '日本語'],
  ['ko', '한국어'],
];
