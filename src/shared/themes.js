// Theme presets and color helpers shared by the renderer (CSS variables) and
// the main process (the engine's Qt theme). CommonJS so Node tests can load it.

const TOKENS = [
  { key: 'accent', group: 'accent' },
  { key: 'accentText', group: 'accent' },
  { key: 'bg', group: 'surfaces' },
  { key: 'titlebar', group: 'surfaces' },
  { key: 'sidebar', group: 'surfaces' },
  { key: 'sidebarActive', group: 'surfaces' },
  { key: 'surface', group: 'surfaces' },
  { key: 'surface2', group: 'surfaces' },
  { key: 'surface3', group: 'surfaces' },
  { key: 'border', group: 'surfaces' },
  { key: 'text', group: 'text' },
  { key: 'text2', group: 'text' },
  { key: 'textMuted', group: 'text' },
  { key: 'success', group: 'status' },
  { key: 'warning', group: 'status' },
  { key: 'danger', group: 'status' },
  { key: 'info', group: 'status' },
  { key: 'logTime', group: 'logs' },
  { key: 'logWarn', group: 'logs' },
  { key: 'logError', group: 'logs' },
];

const PRESETS = {
  forge: {
    name: 'CurseForge (original)',
    colors: {
      accent: '#eb622b', accentText: '#ffffff', bg: '#0d0d0d', titlebar: '#1f1e1f', sidebar: '#202020', sidebarActive: '#404040',
      surface: '#202020', surface2: '#303030', surface3: '#404040', border: '#333333', text: '#ffffff', text2: '#cacaca', textMuted: '#999999',
      success: '#3fb950', warning: '#e3a33b', danger: '#e5484d', info: '#4ea1f3', logTime: '#5aa9f5', logWarn: '#f0a33b', logError: '#f25555',
    },
  },
  emerald: {
    name: 'Esmeralda',
    colors: {
      accent: '#1bd96a', accentText: '#0b1a10', bg: '#16181c', titlebar: '#111316', sidebar: '#1e2025', sidebarActive: '#2c3038',
      surface: '#26292f', surface2: '#30343b', surface3: '#3c4049', border: '#33363d', text: '#f1f3f5', text2: '#c9ced6', textMuted: '#96a2b0',
      success: '#1bd96a', warning: '#ffa347', danger: '#ff496e', info: '#4f9cff', logTime: '#4f9cff', logWarn: '#ffa347', logError: '#ff496e',
    },
  },
  amethyst: {
    name: 'Amatista',
    colors: {
      accent: '#9b7bff', accentText: '#ffffff', bg: '#100e16', titlebar: '#17141f', sidebar: '#1b1825', sidebarActive: '#2f2a40',
      surface: '#1f1b2a', surface2: '#2a2538', surface3: '#383148', border: '#2f2a3d', text: '#f4f1ff', text2: '#d2cbe6', textMuted: '#9a92b3',
      success: '#4ed39a', warning: '#f2b45a', danger: '#ff5c7a', info: '#7fb2ff', logTime: '#8fb8ff', logWarn: '#f2b45a', logError: '#ff6b81',
    },
  },
  ocean: {
    name: 'Océano',
    colors: {
      accent: '#3d9cf0', accentText: '#ffffff', bg: '#0a1019', titlebar: '#0f1724', sidebar: '#121b2a', sidebarActive: '#22324a',
      surface: '#141e2f', surface2: '#1d2a40', surface3: '#283952', border: '#22314a', text: '#eef4fb', text2: '#c3d1e3', textMuted: '#8295ad',
      success: '#43c58a', warning: '#f0b44c', danger: '#f0566a', info: '#5bb4ff', logTime: '#68b9ff', logWarn: '#f0b44c', logError: '#f0566a',
    },
  },
  crimson: {
    name: 'Carmesí',
    colors: {
      accent: '#e5484d', accentText: '#ffffff', bg: '#0b0909', titlebar: '#151111', sidebar: '#191414', sidebarActive: '#3a2626',
      surface: '#1c1616', surface2: '#2a2020', surface3: '#3a2a2a', border: '#2e2222', text: '#fbf3f3', text2: '#dccaca', textMuted: '#a08c8c',
      success: '#5cc28a', warning: '#e9a84b', danger: '#ff6166', info: '#7aa7e6', logTime: '#7aa7e6', logWarn: '#e9a84b', logError: '#ff6166',
    },
  },
  // OLED: true black everywhere the screen is empty (pixels off), with just
  // enough lift on cards and menus to keep them apart
  oled: {
    name: 'CurseForge OLED',
    colors: {
      accent: '#ff6a2b', accentText: '#ffffff', bg: '#000000', titlebar: '#000000', sidebar: '#000000', sidebarActive: '#1f1f1f',
      surface: '#0b0b0b', surface2: '#171717', surface3: '#262626', border: '#1c1c1c', text: '#ffffff', text2: '#c4c4c4', textMuted: '#8a8a8a',
      success: '#3fd06a', warning: '#f0b03c', danger: '#ff4f5a', info: '#55a8ff', logTime: '#5aa9f5', logWarn: '#f0a33b', logError: '#ff5c5c',
    },
  },
  // Modrinth's own colors (its app's dark, OLED and light modes): the
  // original look of the Modrinth layout
  modrinth: {
    name: 'Modrinth (original)',
    layout: 'modrinth',
    colors: {
      accent: '#1bd96a', accentText: '#000000', bg: '#16181c', titlebar: '#27292e', sidebar: '#27292e', sidebarActive: '#24553d',
      surface: '#27292e', surface2: '#34363c', surface3: '#42444a', border: '#34363c', text: '#ffffff', text2: '#b0bac5', textMuted: '#96a2b0',
      success: '#1bd96a', warning: '#ffa347', danger: '#ff496e', info: '#4f9cff', logTime: '#4f9cff', logWarn: '#ffa347', logError: '#ff496e',
    },
  },
  modrinthOled: {
    name: 'Modrinth OLED',
    layout: 'modrinth',
    colors: {
      accent: '#1bd96a', accentText: '#000000', bg: '#000000', titlebar: '#101013', sidebar: '#101013', sidebarActive: '#123a24',
      surface: '#101013', surface2: '#1b1b20', surface3: '#25262b', border: '#1b1b20', text: '#ffffff', text2: '#b0bac5', textMuted: '#96a2b0',
      success: '#1bd96a', warning: '#ffa347', danger: '#ff496e', info: '#4f9cff', logTime: '#4f9cff', logWarn: '#ffa347', logError: '#ff496e',
    },
  },
  modrinthLight: {
    name: 'Modrinth claro',
    layout: 'modrinth',
    colors: {
      accent: '#00af5c', accentText: '#ffffff', bg: '#ebebeb', titlebar: '#f8f8f8', sidebar: '#f8f8f8', sidebarActive: '#c4e8d4',
      surface: '#f8f8f8', surface2: '#ffffff', surface3: '#dddddd', border: '#dddddd', text: '#1a202c', text2: '#2c2e31', textMuted: '#484d54',
      success: '#00af5c', warning: '#e08325', danger: '#cb2245', info: '#1f68c0', logTime: '#1f68c0', logWarn: '#c66019', logError: '#cb2245',
    },
  },
  light: {
    name: 'CurseForge claro',
    colors: {
      accent: '#e2571f', accentText: '#ffffff', bg: '#f2f2f4', titlebar: '#e6e6ea', sidebar: '#ffffff', sidebarActive: '#ececf0',
      surface: '#ffffff', surface2: '#ececef', surface3: '#dedee3', border: '#d6d6dc', text: '#141417', text2: '#2e2e35', textMuted: '#6c6c76',
      success: '#1f9d55', warning: '#b7791f', danger: '#d42f3a', info: '#2b7bd6', logTime: '#2b6cb0', logWarn: '#b7791f', logError: '#c53030',
    },
  },
};

function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isValidHex(v) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || '').trim());
}

function resolvePalette(presetKey, overrides = {}) {
  const base = (PRESETS[presetKey] || PRESETS.forge).colors;
  const out = { ...base };
  for (const [k, v] of Object.entries(overrides || {})) if (isValidHex(v) && k in base) out[k] = v;
  return out;
}

// The order they are offered in: two rows of five, each CurseForge theme above
// its Modrinth counterpart (original, OLED, light), the coloured ones at the end.
const PRESET_ORDER = ['forge', 'oled', 'light', 'emerald', 'amethyst', 'modrinth', 'modrinthOled', 'modrinthLight', 'ocean', 'crimson'];

module.exports = { PRESET_ORDER, TOKENS, PRESETS, hexToRgb, rgbToHex, mix, luminance, isValidHex, resolvePalette };
