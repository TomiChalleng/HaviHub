// What to tell the person when something can't go into a profile (see
// compatIssue in shared/compat.js).
import { t } from './i18n.js';

const LOADER_NAMES = { fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', quilt: 'Quilt', liteloader: 'LiteLoader' };
export const loaderDisplayName = (l) => LOADER_NAMES[l] || (l ? l.charAt(0).toUpperCase() + l.slice(1) : '');

export function compatText(issue) {
  if (!issue) return '';
  if (issue.code === 'vanilla') return issue.type === 'shader' ? t('Este perfil es vanilla: los shaders necesitan Iris u OptiFine, que funcionan con un cargador de mods.') : t('Este perfil es vanilla: para usar mods, cambia su versión a una con Fabric, Forge, NeoForge o Quilt.');
  if (issue.code === 'version-loader') return t('No tiene una versión para {v} con {l}.', { v: issue.v, l: loaderDisplayName(issue.l) });
  if (issue.code === 'version') return t('No tiene una versión para {v}.', { v: issue.v });
  if (issue.code === 'newer-map') return t('Este mapa es de una versión más nueva que {v}.', { v: issue.v });
  return '';
}
