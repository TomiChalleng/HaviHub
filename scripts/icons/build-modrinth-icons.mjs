// Builds src/renderer/components/icons-modrinth.js: the line icons of the
// Modrinth layout. Modrinth draws with Lucide (stroke 2, round caps), keeping
// its own copies in packages/assets/icons of github.com/modrinth/code (GPL-3.0,
// like Havi Hub; Lucide itself is ISC). Each icon is taken from there first and
// from lucide-static when Modrinth doesn't have it.
//   git clone --depth 1 https://github.com/modrinth/code modrinth-code
//   npm i --no-save lucide-static@0.562.0
//   node scripts/icons/build-modrinth-icons.mjs modrinth-code/packages/assets/icons [node_modules/lucide-static/icons]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mrDir = process.argv[2];
const lucideDir = process.argv[3] || path.join(root, 'node_modules/lucide-static/icons');
if (!mrDir) {
  console.error('usage: node scripts/icons/build-modrinth-icons.mjs <modrinth packages/assets/icons> [lucide-static/icons]');
  process.exit(1);
}

// our name -> file names to try, Modrinth's first
const MAP = {
  home: ['home', 'house'],
  plus: ['plus'],
  minus: ['minus'],
  x: ['x'],
  check: ['check'],
  search: ['search'],
  chevronDown: ['chevron-down'],
  chevronUp: ['chevron-up'],
  chevronLeft: ['chevron-left'],
  chevronRight: ['chevron-right'],
  dropdown: ['dropdown'],
  arrowLeft: ['left-arrow', 'arrow-left'],
  arrowRight: ['right-arrow', 'arrow-right'],
  arrowUp: ['arrow-up'],
  arrowDown: ['arrow-down'],
  sort: ['arrow-up-down'],
  sortUp: ['sort-asc', 'arrow-up-narrow-wide'],
  sortDown: ['sort-desc', 'arrow-down-wide-narrow'],
  filter: ['filter', 'funnel'],
  grid: ['grid', 'layout-grid'],
  rows: ['rows-3'],
  list: ['list'],
  columns: ['columns-3'],
  table: ['table'],
  more: ['more-vertical', 'ellipsis-vertical'],
  moreH: ['more-horizontal', 'ellipsis'],
  play: ['play'],
  stop: ['stop-circle', 'circle-stop'],
  pause: ['pause'],
  timer: ['timer'],
  clock: ['clock'],
  gamepad: ['gamepad', 'gamepad-2'],
  folder: ['folder'],
  folderOpen: ['folder-open'],
  external: ['external', 'external-link'],
  image: ['image'],
  listOptions: ['sliders-horizontal'],
  clone: ['copy'],
  copy: ['copy'],
  share: ['share', 'share-2'],
  shareBox: ['share'],
  link: ['link'],
  wrench: ['wrench'],
  trash: ['trash', 'trash-2'],
  puzzle: ['puzzle'],
  boxes: ['boxes'],
  download: ['download'],
  update: ['download'],
  upload: ['upload'],
  save: ['save'],
  import: ['box-import', 'import'],
  groupAdd: ['square-plus'],
  squarePlus: ['square-plus'],
  groupGrid: ['grid', 'layout-grid'],
  refresh: ['refresh-cw', 'rotate-cw'],
  history: ['history'],
  settings: ['settings'],
  help: ['help-circle', 'circle-help'],
  helpOutline: ['help-circle', 'circle-help'],
  info: ['info'],
  alert: ['triangle-alert'],
  checkCircle: ['check-circle', 'circle-check'],
  xCircle: ['x-circle', 'circle-x'],
  circle: ['radio-button', 'circle'],
  radio: ['radio-button'],
  radioChecked: ['radio-button-checked'],
  monitor: ['monitor'],
  envBoth: ['monitor-smartphone'],
  server: ['server'],
  serverStack: ['server-stack'],
  globe: ['globe'],
  user: ['user'],
  users: ['users'],
  userPlus: ['user-plus'],
  signIn: ['log-in'],
  logIn: ['log-in'],
  signOut: ['log-out'],
  logs: ['file-text'],
  terminal: ['terminal-square', 'square-terminal'],
  camera: ['camera'],
  layers: ['layers'],
  palette: ['palette'],
  paintbrush: ['paintbrush', 'paintbrush-vertical'],
  glasses: ['glasses'],
  braces: ['braces'],
  packageOpen: ['package-open'],
  language: ['languages'],
  shield: ['shield'],
  sliders: ['sliders-horizontal'],
  cube: ['box'],
  box: ['box'],
  package: ['package'],
  memory: ['memory-stick'],
  keyboard: ['keyboard'],
  volume: ['volume-2'],
  video: ['video'],
  window: ['app-window'],
  minimize: ['minimize'],
  maximize: ['maximize'],
  restore: ['restore'],
  sun: ['sun'],
  sparkle: ['sparkles'],
  moon: ['moon'],
  shirt: ['shirt'],
  eye: ['eye'],
  eyeOff: ['eye-off'],
  lineNumbers: ['list-ordered'],
  wrap: ['wrap-text'],
  toTop: ['arrow-up-to-line'],
  toBottom: ['arrow-down-to-line'],
  edit: ['edit', 'pencil'],
  star: ['star'],
  heart: ['heart'],
  fire: ['flame'],
  compass: ['compass'],
  layout: ['layout-dashboard'],
  bell: ['bell'],
  tag: ['tag'],
  calendar: ['calendar'],
  lock: ['lock'],
  zap: ['zap'],
  drag: ['grip-vertical'],
  grip: ['grip-vertical'],
  map: ['map'],
  swap: ['arrow-left-right'],
  file: ['file'],
  code: ['code'],
  undo: ['undo', 'undo-2'],
  offline: ['unplug'],
  database: ['database'],
  viewport: ['scan'],
  spinner: ['spinner'],
  unknown: ['unknown'],
  ban: ['ban'],
};

// keep these attributes of the <svg> element when they differ from Lucide's
const ROOT_DEFAULTS = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

function parse(file) {
  const src = fs
    .readFileSync(file, 'utf8')
    .replace(/<\?xml[^>]*>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '');
  const open = src.match(/<svg\b([^>]*)>/);
  if (!open) throw new Error(`no <svg> in ${file}`);
  const attrs = {};
  for (const [, k, v] of open[1].matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)) attrs[k] = v;
  const body = src
    .slice(open.index + open[0].length, src.lastIndexOf('</svg>'))
    .replace(/\s(class|id|data-name)="[^"]*"/g, '')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();
  const root = {};
  for (const [k, def] of Object.entries(ROOT_DEFAULTS)) if (attrs[k] !== undefined && attrs[k] !== def) root[k] = attrs[k];
  // drawn without a stroke on its root (filled shapes, or shapes carrying
  // their own): Lucide's stroke must not reach them
  if (attrs.stroke === undefined) root.stroke = 'none';
  return { root, body };
}

const out = {};
const sources = { modrinth: 0, lucide: 0 };
for (const [name, files] of Object.entries(MAP)) {
  let found = null;
  for (const f of files) {
    const mr = path.join(mrDir, `${f}.svg`);
    if (fs.existsSync(mr)) {
      found = { file: mr, from: 'modrinth' };
      break;
    }
  }
  if (!found) {
    for (const f of files) {
      const lu = path.join(lucideDir, `${f}.svg`);
      if (fs.existsSync(lu)) {
        found = { file: lu, from: 'lucide' };
        break;
      }
    }
  }
  if (!found) throw new Error(`no icon for ${name} (${files.join(', ')})`);
  sources[found.from]++;
  out[name] = parse(found.file);
}

const lines = Object.entries(out).map(([k, { root, body }]) => {
  const r = Object.keys(root).length ? `, ${JSON.stringify(root)}` : '';
  return `  ${k}: [${JSON.stringify(body)}${r}],`;
});
const file = `// Generated by scripts/icons/build-modrinth-icons.mjs - do not edit by hand.
// The Modrinth layout's line icons: Modrinth's own (github.com/modrinth/code,
// packages/assets/icons, GPL-3.0) and Lucide's (https://lucide.dev, ISC).
// name: [inner SVG markup, attributes of the <svg> that differ from Lucide's]
export const MR_ICONS = {
${lines.join('\n')}
};
`;
fs.writeFileSync(path.join(root, 'src/renderer/components/icons-modrinth.js'), file);
console.log(`icons-modrinth.js: ${Object.keys(out).length} icons (${sources.modrinth} from Modrinth, ${sources.lucide} from Lucide)`);
