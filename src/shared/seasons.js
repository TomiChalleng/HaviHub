// Seasonal themes: when each one is on (local dates, both ends included) and
// its colors. CommonJS so the Node tests can load it.

const SEASONS = {
  halloween: { start: [10, 25], end: [11, 1] },
  christmas: { start: [12, 19], end: [12, 26] },
  newyear: { start: [12, 27], end: [1, 2] }, // goes into the next year
};
const ORDER = ['halloween', 'christmas', 'newyear'];

// "month * 100 + day" makes date ranges easy to compare
const md = (d) => (d.getMonth() + 1) * 100 + d.getDate();

function inSeason(date, id) {
  const s = SEASONS[id];
  if (!s) return false;
  const a = s.start[0] * 100 + s.start[1];
  const b = s.end[0] * 100 + s.end[1];
  const x = md(date);
  return a <= b ? x >= a && x <= b : x >= a || x <= b;
}

// enabled: { halloween: bool, christmas: bool, newyear: bool } (missing = on)
function activeSeason(date, enabled = {}) {
  for (const id of ORDER) if (enabled[id] !== false && inSeason(date, id)) return id;
  return null;
}

// The year a season "belongs" to (New Year's week counts as the year it starts)
function seasonYear(date, id) {
  if (id === 'newyear' && date.getMonth() === 0) return date.getFullYear() - 1;
  return date.getFullYear();
}

// Last day of the season that contains `date`, as a Date at 23:59:59
function seasonEnd(date, id) {
  const s = SEASONS[id];
  let y = seasonYear(date, id);
  if (s.end[0] < s.start[0]) y += 1;
  return new Date(y, s.end[0] - 1, s.end[1], 23, 59, 59);
}

// Midnight that starts the next year
function nextNewYear(date) {
  return new Date(date.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
}

const SEASON_THEMES = {
  // pumpkin orange over a purple night, like the sky of a Minecraft night
  halloween: {
    accent: '#ff8a1a', accentText: '#1a0d00', bg: '#0e0a12', titlebar: '#150f1b', sidebar: '#18111f', sidebarActive: '#33233f',
    surface: '#1b1422', surface2: '#271d31', surface3: '#372a45', border: '#2b2036', text: '#f6effa', text2: '#d6c9e2', textMuted: '#9b8aac',
    success: '#7ed957', warning: '#f2b13c', danger: '#ff4d5e', info: '#a77bff', logTime: '#a77bff', logWarn: '#f2b13c', logError: '#ff5c6b',
  },
  // holly red over pine green
  christmas: {
    accent: '#e4322b', accentText: '#ffffff', bg: '#0a120e', titlebar: '#0f1913', sidebar: '#111d16', sidebarActive: '#23372b',
    surface: '#132019', surface2: '#1c2d23', surface3: '#283d31', border: '#1f3127', text: '#f3f8f4', text2: '#cddcd2', textMuted: '#8fa596',
    success: '#46c46e', warning: '#f2c14e', danger: '#ff5a5f', info: '#6fb7ff', logTime: '#6fb7ff', logWarn: '#f2c14e', logError: '#ff5a5f',
  },
  // gold over a night-blue sky
  newyear: {
    accent: '#f5c542', accentText: '#1b1400', bg: '#090b16', titlebar: '#0e1120', sidebar: '#101425', sidebarActive: '#232a45',
    surface: '#121730', surface2: '#1b2240', surface3: '#283154', border: '#1e2546', text: '#f4f6ff', text2: '#cfd5ef', textMuted: '#8d95b8',
    success: '#4fd18b', warning: '#ffb347', danger: '#ff5d73', info: '#7aa8ff', logTime: '#7aa8ff', logWarn: '#ffb347', logError: '#ff5d73',
  },
};

// The same seasons dressed like the Modrinth layout: its raised bars a step
// lighter than the content area, softer surfaces
const SEASON_THEMES_MODRINTH = {
  halloween: {
    accent: '#ff8f1f', accentText: '#140a00', bg: '#140f18', titlebar: '#231a2b', sidebar: '#231a2b', sidebarActive: '#4a2f1d',
    surface: '#231a2b', surface2: '#30253a', surface3: '#3f3249', border: '#30253a', text: '#ffffff', text2: '#cdbfd9', textMuted: '#a091b0',
    success: '#7ed957', warning: '#f2b13c', danger: '#ff4d6d', info: '#b48cff', logTime: '#b48cff', logWarn: '#f2b13c', logError: '#ff5c6b',
  },
  christmas: {
    accent: '#ff4b55', accentText: '#ffffff', bg: '#0f1714', titlebar: '#1b2723', sidebar: '#1b2723', sidebarActive: '#4a2229',
    surface: '#1b2723', surface2: '#26352f', surface3: '#33453d', border: '#26352f', text: '#ffffff', text2: '#c3d6cb', textMuted: '#93aa9c',
    success: '#3ddc84', warning: '#f2c14e', danger: '#ff5a5f', info: '#6fb7ff', logTime: '#6fb7ff', logWarn: '#f2c14e', logError: '#ff5a5f',
  },
  newyear: {
    accent: '#f7c948', accentText: '#1b1400', bg: '#0e1120', titlebar: '#1a1f36', sidebar: '#1a1f36', sidebarActive: '#4a3f1c',
    surface: '#1a1f36', surface2: '#252b47', surface3: '#323a5a', border: '#252b47', text: '#ffffff', text2: '#c9cfe8', textMuted: '#959dbf',
    success: '#4fd18b', warning: '#ffb347', danger: '#ff5d73', info: '#7aa8ff', logTime: '#7aa8ff', logWarn: '#ffb347', logError: '#ff5d73',
  },
};

module.exports = { SEASONS, ORDER, inSeason, activeSeason, seasonYear, seasonEnd, nextNewYear, SEASON_THEMES, SEASON_THEMES_MODRINTH };
