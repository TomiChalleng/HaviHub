// Theme presets and the fully customizable palette. Every token is a CSS
// variable; the user can override any of them in Settings → Themes.

import { TOKENS, PRESETS, PRESET_ORDER, hexToRgb, rgbToHex, mix, luminance, isValidHex, resolvePalette } from '../../shared/themes.js';
import { SEASON_THEMES, SEASON_THEMES_MODRINTH } from '../../shared/seasons.js';

export { TOKENS, PRESETS, PRESET_ORDER, hexToRgb, rgbToHex, mix, luminance, isValidHex, resolvePalette };

const cssName = (k) => '--' + k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

const rgba = (hex, a) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};
// a color with alpha `a` laid over `under`, as an opaque color
const over = (hex, a, under) => mix(under, hex, a);

// The tokens of Modrinth's design system (packages/assets/styles/variables.scss)
// that the palette doesn't carry, derived from it so every theme gets them.
// With the "Modrinth" presets they come out as Modrinth's own values.
function applyModrinthTokens(root, p, light) {
  const set = (k, v) => root.style.setProperty(k, v);
  // the surfaces between the page (surface-1) and the cards (surface-3)
  set('--mr-surface-1-5', mix(p.bg, p.surface, light ? 0.15 : 0.24));
  set('--mr-surface-2', mix(p.bg, p.surface, light ? 0.77 : 0.41));
  set('--mr-surface-2-5', mix(p.bg, p.surface, light ? 0.45 : 0.7));
  set('--mr-button-border', light ? 'rgba(161, 161, 161, 0.35)' : 'rgba(193, 190, 209, 0.12)');
  set('--mr-brand-shadow', rgba(p.accent, 0.7));
  set('--mr-brand-highlight', rgba(p.accent, 0.25));
  set('--mr-brand-bg', rgba(p.accent, light ? 0.1 : 0.2));
  set('--mr-red-highlight', rgba(p.danger, 0.25));
  set('--mr-red-bg', rgba(p.danger, light ? 0.1 : 0.2));
  set('--mr-hover-brightness', light ? '0.9' : '1.25');
  set('--mr-focus-ring', '#ea80ff');
  set('--mr-gray', light ? '#595b61' : '#9fa4b3');
  set('--mr-shadow-card', light ? 'rgba(50, 50, 100, 0.1) 0 2px 4px 0' : 'rgba(0, 0, 0, 0.25) 0 2px 4px 0');
  // the right sidebar's tint
  const deep = mix(p.accent, '#000000', 0.84);
  const mid = mix(p.accent, '#000000', 0.4);
  if (light) {
    set('--mr-brand-gradient-bg', `linear-gradient(0deg, ${rgba(p.accent, 0.175)} 0%, ${rgba(p.accent, 0.125)} 100%)`);
    set('--mr-brand-gradient-border', rgba(mix(p.accent, '#000000', 0.7), 0.15));
    set('--mr-brand-gradient-button', 'rgba(255, 255, 255, 0.5)');
    const base = over(p.accent, 0.15, p.bg);
    set('--mr-brand-gradient-fade', `linear-gradient(to bottom, ${rgba(base, 0)}, ${base} 70%)`);
  } else {
    set('--mr-brand-gradient-bg', `linear-gradient(0deg, ${rgba(deep, 0.2)} 0%, ${rgba(mid, 0.1)} 100%)`);
    set('--mr-brand-gradient-border', rgba(mix(p.accent, '#ffffff', 0.6), 0.08));
    set('--mr-brand-gradient-button', 'rgba(255, 255, 255, 0.08)');
    const base = over(deep, 0.2, p.bg);
    set('--mr-brand-gradient-fade', `linear-gradient(to bottom, ${rgba(base, 0)}, ${base} 80%)`);
  }
  // loader colors (tags in search results)
  const platform = light
    ? { fabric: '#8a7b71', quilt: '#8b61b4', forge: '#5b6197', neoforge: '#dc895c', liteloader: '#4c90de' }
    : { fabric: '#dbb69b', quilt: '#c796f9', forge: '#959eef', neoforge: '#f99e6b', liteloader: '#7ab0ee' };
  for (const [k, v] of Object.entries(platform)) set(`--mr-platform-${k}`, v);
}

// season: 'halloween' | 'christmas' | 'newyear' puts that season's colors on
// top of the user's theme (only while it lasts; nothing is saved)
// layout: 'curseforge' | 'modrinth' (how the app is arranged, see App.jsx)
export function applyTheme(presetKey, overrides, { reduceMotion = false, season = null, layout = 'curseforge' } = {}) {
  const seasonal = layout === 'modrinth' ? SEASON_THEMES_MODRINTH : SEASON_THEMES;
  const p = season && seasonal[season] ? { ...seasonal[season] } : resolvePalette(presetKey, overrides);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(p)) root.style.setProperty(cssName(k), v);
  const light = luminance(p.bg) > 0.5;
  const [ar, ag, ab] = hexToRgb(p.accent);
  root.style.setProperty('--accent-hover', mix(p.accent, light ? '#000000' : '#ffffff', 0.12));
  root.style.setProperty('--accent-press', mix(p.accent, '#000000', 0.15));
  root.style.setProperty('--accent-soft', `rgba(${ar}, ${ag}, ${ab}, 0.16)`);
  root.style.setProperty('--accent-rgb', `${ar}, ${ag}, ${ab}`);
  root.style.setProperty('--overlay', light ? 'rgba(20, 20, 30, 0.35)' : 'rgba(0, 0, 0, 0.6)');
  root.style.setProperty('--shadow', light ? '0 8px 28px rgba(0,0,0,0.15)' : '0 10px 32px rgba(0,0,0,0.55)');
  root.style.setProperty('--hover', light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)');
  root.style.setProperty('--scrollbar', mix(p.surface3, p.textMuted, 0.25));
  // Interface size is applied by the main process (Electron zoom), not CSS zoom
  root.style.setProperty('--zoom', '1');
  if (layout === 'modrinth') applyModrinthTokens(root, p, light);
  root.dataset.light = light ? '1' : '0';
  root.dataset.reduceMotion = reduceMotion ? '1' : '0';
  root.dataset.season = season || '';
  root.dataset.layout = layout === 'modrinth' ? 'modrinth' : 'curseforge';
  return p;
}
