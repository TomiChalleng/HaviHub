// Builds src/renderer/components/icons-bold.js: the bold, CurseForge-like icons
// (filled or weight 600) taken from Google's Material Symbols (Apache License 2.0).
//   npm i --no-save @material-symbols/svg-600@0.48.2
//   node scripts/icons/build-icons.mjs [path to @material-symbols/svg-600]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = process.argv[2] || path.join(root, 'node_modules/@material-symbols/svg-600');

// our name -> [style, symbol (with -fill for the filled variant)]
const MAP = {
  home: ['rounded', 'home-fill'],
  plus: ['rounded', 'add'],
  minus: ['rounded', 'remove'],
  x: ['rounded', 'close'],
  check: ['rounded', 'check'],
  search: ['rounded', 'search'],
  chevronDown: ['rounded', 'keyboard_arrow_down'],
  chevronUp: ['rounded', 'keyboard_arrow_up'],
  chevronLeft: ['rounded', 'chevron_left'],
  chevronRight: ['rounded', 'chevron_right'],
  arrowUp: ['rounded', 'arrow_upward'],
  arrowDown: ['rounded', 'arrow_downward'],
  filter: ['rounded', 'filter_alt-fill'],
  grid: ['rounded', 'grid_view-fill'],
  list: ['rounded', 'list'],
  columns: ['rounded', 'view_column'],
  table: ['rounded', 'table_rows'],
  more: ['rounded', 'more_vert'],
  moreH: ['rounded', 'more_horiz'],
  play: ['sharp', 'play_arrow-fill'],
  stop: ['rounded', 'stop-fill'],
  pause: ['rounded', 'pause-fill'],
  timer: ['rounded', 'timer-fill'],
  clock: ['rounded', 'schedule-fill'],
  gamepad: ['rounded', 'sports_esports-fill'],
  folder: ['rounded', 'folder'],
  folderOpen: ['rounded', 'folder_open'],
  external: ['rounded', 'open_in_new'],
  image: ['rounded', 'image'],
  listOptions: ['rounded', 'tune'],
  clone: ['rounded', 'content_copy'],
  copy: ['rounded', 'content_copy'],
  share: ['rounded', 'share-fill'],
  link: ['rounded', 'link'],
  wrench: ['rounded', 'build-fill'],
  trash: ['rounded', 'delete-fill'],
  puzzle: ['rounded', 'extension-fill'],
  shareBox: ['rounded', 'ios_share'],
  download: ['rounded', 'vertical_align_bottom'],
  upload: ['rounded', 'upload'],
  save: ['rounded', 'save-fill'],
  import: ['rounded', 'download'],
  groupAdd: ['rounded', 'dashboard_customize-fill'],
  groupGrid: ['rounded', 'grid_view-fill'],
  refresh: ['rounded', 'sync'],
  history: ['rounded', 'history'],
  update: ['rounded', 'update'],
  settings: ['rounded', 'settings-fill'],
  help: ['rounded', 'help-fill'],
  info: ['rounded', 'info-fill'],
  alert: ['rounded', 'warning-fill'],
  checkCircle: ['rounded', 'check_circle-fill'],
  xCircle: ['rounded', 'cancel-fill'],
  monitor: ['rounded', 'desktop_windows'],
  server: ['rounded', 'dns'],
  envBoth: ['rounded', 'devices'],
  globe: ['rounded', 'language'],
  user: ['rounded', 'person-fill'],
  users: ['rounded', 'group-fill'],
  signIn: ['rounded', 'login'],
  signOut: ['rounded', 'logout'],
  logs: ['rounded', 'description'],
  camera: ['rounded', 'photo_camera-fill'],
  layers: ['rounded', 'layers-fill'],
  palette: ['rounded', 'palette-fill'],
  language: ['rounded', 'translate'],
  shield: ['rounded', 'shield-fill'],
  sliders: ['rounded', 'tune'],
  cube: ['rounded', 'deployed_code'],
  box: ['rounded', 'deployed_code'],
  package: ['rounded', 'deployed_code'],
  java: ['rounded', 'coffee-fill'],
  memory: ['rounded', 'memory'],
  terminal: ['rounded', 'terminal'],
  keyboard: ['rounded', 'keyboard'],
  volume: ['rounded', 'volume_up-fill'],
  video: ['rounded', 'videocam-fill'],
  window: ['rounded', 'web_asset'],
  sun: ['rounded', 'light_mode-fill'],
  moon: ['rounded', 'dark_mode-fill'],
  eye: ['rounded', 'visibility-fill'],
  eyeOff: ['rounded', 'visibility_off-fill'],
  lock: ['rounded', 'lock-fill'],
  wrap: ['rounded', 'wrap_text'],
  lineNumbers: ['rounded', 'format_list_numbered'],
  toTop: ['rounded', 'vertical_align_top'],
  toBottom: ['rounded', 'vertical_align_bottom'],
  edit: ['rounded', 'edit-fill'],
  star: ['rounded', 'star-fill'],
  heart: ['rounded', 'favorite-fill'],
  fire: ['rounded', 'local_fire_department-fill'],
  compass: ['rounded', 'explore-fill'],
  bell: ['rounded', 'notifications-fill'],
  tag: ['rounded', 'sell-fill'],
  calendar: ['rounded', 'calendar_today'],
  zap: ['rounded', 'bolt-fill'],
  drag: ['rounded', 'drag_indicator'],
  database: ['rounded', 'database-fill'],
  loader: ['rounded', 'ink_eraser-fill'],
  restart: ['rounded', 'restart_alt'],
  sortUp: ['rounded', 'arrow_drop_up'],
  sortDown: ['rounded', 'arrow_drop_down'],
  tray: ['rounded', 'move_to_inbox'],
  helpOutline: ['rounded', 'help'],
  devices: ['rounded', 'devices'],
};

// Drawn to match CurseForge where Material has no equivalent (0 -960 960 960 grid)
const CUSTOM = {
  // two filled triangles, CurseForge's sort icon
  sort: 'M480-850 690-560H270L480-850ZM270-400h420L480-110 270-400Z',
  // a bar on top of two rows of squares, CurseForge's view icon
  rows: 'M150-820h660q30 0 30 30v84q0 30-30 30H150q-30 0-30-30v-84q0-30 30-30Zm0 262h136q30 0 30 30v136q0 30-30 30H150q-30 0-30-30v-136q0-30 30-30Zm262 0h136q30 0 30 30v136q0 30-30 30H412q-30 0-30-30v-136q0-30 30-30Zm262 0h136q30 0 30 30v136q0 30-30 30H674q-30 0-30-30v-136q0-30 30-30ZM150-296h136q30 0 30 30v136q0 30-30 30H150q-30 0-30-30v-136q0-30 30-30Zm262 0h136q30 0 30 30v136q0 30-30 30H412q-30 0-30-30v-136q0-30 30-30Zm262 0h136q30 0 30 30v136q0 30-30 30H674q-30 0-30-30v-136q0-30 30-30Z',
};

const out = {};
for (const [name, [style, sym]] of Object.entries(MAP)) {
  const file = path.join(pkg, style, `${sym}.svg`);
  const svg = fs.readFileSync(file, 'utf8');
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  if (paths.length !== 1) throw new Error(`${sym}: ${paths.length} paths`);
  out[name] = paths[0];
}
Object.assign(out, CUSTOM);

const lines = [
  '// Generated by scripts/icons/build-icons.mjs - do not edit by hand.',
  '// Bold icons from Material Symbols by Google (Apache License 2.0,',
  '// https://github.com/google/material-design-icons), plus two drawn for Havi Hub.',
  '// All paths use the viewBox "0 -960 960 960".',
  'export const BOLD = {',
  ...Object.entries(out).map(([k, d]) => `  ${k}: '${d}',`),
  '};',
  '',
];
fs.writeFileSync(path.join(root, 'src/renderer/components/icons-bold.js'), lines.join('\n'));
console.log(`${Object.keys(out).length} icons written`);
