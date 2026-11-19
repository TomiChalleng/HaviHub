// Icons: bold ones (Material Symbols, filled or weight 600, like CurseForge's)
// and an original line set (24x24 grid, stroke based) for the rest.
import { BOLD } from './icons-bold.js';

const P = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 9.8V20h4.6v-5.5h3.8V20h4.6V9.8" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  arrowLeft: <path d="M20 12H5m6-6-6 6 6 6" />,
  arrowRight: <path d="M4 12h15m-6-6 6 6-6 6" />,
  arrowUp: <path d="M12 20V5m-6 6 6-6 6 6" />,
  arrowDown: <path d="M12 4v15m-6-6 6 6 6-6" />,
  sort: <path d="M12 3.5 7.5 8.5h9L12 3.5Zm0 17-4.5-5h9l-4.5 5Z" />,
  filter: <path d="M4 5h16l-6.2 7.5V19l-3.6 1.6v-8.1L4 5Z" />,
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  rows: <path d="M4 5h16v4H4zM4 10.5h16v4H4zM4 16h16v4H4z" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  columns: <path d="M4 5h16v14H4zM9.3 5v14M14.7 5v14" />,
  table: <path d="M4 5h16v14H4zM4 10h16M4 14.5h16M9 10v9M14.5 10v9" />,
  more: (
    <>
      <circle cx="12" cy="5.5" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.3" fill="currentColor" />
    </>
  ),
  moreH: (
    <>
      <circle cx="5.5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
  play: <path d="M7 4.8v14.4a.6.6 0 0 0 .9.5l11.3-7.2a.6.6 0 0 0 0-1L7.9 4.3a.6.6 0 0 0-.9.5Z" fill="currentColor" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />,
  pause: <path d="M8 5v14M16 5v14" strokeWidth="3" />,
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5V9.5M9.5 3h5M18.5 7l1.5-1.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  gamepad: <path d="M7.5 7h9a4.5 4.5 0 0 1 4.4 5.4l-.8 3.9a2.3 2.3 0 0 1-4 1L14 15.5h-4L7.9 17.3a2.3 2.3 0 0 1-4-1l-.8-3.9A4.5 4.5 0 0 1 7.5 7ZM8 10v3M6.5 11.5h3M15.5 11h.01M17.5 12.5h.01" />,
  folder: <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7.5Z" />,
  folderOpen: <path d="M3.5 17V7.5a2 2 0 0 1 2-2h4l2 2.2h6a2 2 0 0 1 2 2V11M3.5 17l2.4-5.4a1.5 1.5 0 0 1 1.4-.9h13.2a1 1 0 0 1 .9 1.4L19 17.6a2 2 0 0 1-1.8 1.4H5.4a1.9 1.9 0 0 1-1.9-2Z" />,
  external: <path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />,
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m20.5 16-5-5-8.5 8.5" />
    </>
  ),
  listOptions: <path d="M9 6.5h11M9 12h11M9 17.5h11M4 6.5h1.5M4 12h1.5M4 17.5h1.5" />,
  clone: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="1.8" />
      <path d="M15.5 8.5V5.8A1.8 1.8 0 0 0 13.7 4H5.8A1.8 1.8 0 0 0 4 5.8v7.9a1.8 1.8 0 0 0 1.8 1.8h2.7" />
    </>
  ),
  share: <path d="M9.5 14.5 14.5 9.5M8 11.5l-2 2a3.5 3.5 0 0 0 5 5l2-2M16 12.5l2-2a3.5 3.5 0 0 0-5-5l-2 2" />,
  wrench: <path d="M14.7 6.3a4 4 0 0 0 5 5L21 10a5.5 5.5 0 0 1-7.4 5.1L7.4 21.3a2 2 0 0 1-2.8-2.8l6.2-6.2A5.5 5.5 0 0 1 16 4.9l-1.3 1.4Z" />,
  trash: <path d="M4.5 6.5h15M9.5 6.5V4.8a.8.8 0 0 1 .8-.8h3.4a.8.8 0 0 1 .8.8v1.7M6.5 6.5l.9 12.3a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.3M10 10.5v6M14 10.5v6" />,
  puzzle: <path d="M10 4.5a2 2 0 1 1 4 0V6h3.5a1 1 0 0 1 1 1v3.5h-1.5a2 2 0 1 0 0 4h1.5V18a1 1 0 0 1-1 1H14v-1.5a2 2 0 1 0-4 0V19H6.5a1 1 0 0 1-1-1v-3.5H7a2 2 0 1 0 0-4H5.5V7a1 1 0 0 1 1-1H10V4.5Z" />,
  shareBox: <path d="M12 3.5v11M8 7.5l4-4 4 4M5 12.5v5.8A1.7 1.7 0 0 0 6.7 20h10.6a1.7 1.7 0 0 0 1.7-1.7v-5.8" />,
  download: <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" />,
  upload: <path d="M12 20V9m-4.5 4.5L12 9l4.5 4.5M5 4.5h14" />,
  import: <path d="M12 3.5v10.5M8 10l4 4 4-4M4.5 14.5v3.8a1.7 1.7 0 0 0 1.7 1.7h11.6a1.7 1.7 0 0 0 1.7-1.7v-3.8" />,
  groupAdd: <path d="M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM16.75 14v6M13.75 17h6" />,
  groupGrid: <path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" />,
  refresh: <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />,
  history: <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4M12 8.5V12l2.5 1.8" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.9-1.5-1.9-3.3-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14.2 2.8h-3.8l-.4 2.3a7.6 7.6 0 0 0-2.6 1.5l-2.3-.9L3.2 9l1.9 1.5a7.7 7.7 0 0 0 0 3l-1.9 1.5 1.9 3.3 2.3-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.3h3.8l.4-2.3a7.6 7.6 0 0 0 2.6-1.5l2.3.9 1.9-3.3-1.9-1.5Z" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2-2.4 3.7M12 16.8h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8h.01" />
    </>
  ),
  alert: <path d="M12 4 2.8 19.5h18.4L12 4ZM12 10v4.5M12 17.2h.01" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.3 12.2 2.6 2.6 4.9-5.3" />
    </>
  ),
  xCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m9 9 6 6m0-6-6 6" />
    </>
  ),
  monitor: <path d="M3.5 5h17v11h-17zM9 20h6M12 16v4" />,
  microsoft: <path d="M4 4h7.2v7.2H4zM12.8 4H20v7.2h-7.2zM4 12.8h7.2V20H4zM12.8 12.8H20V20h-7.2z" />,
  envBoth: <path d="M2.5 6h11v7.5h-11zM6 17.5h4M8 13.5v4M15.5 7.5h6v5h-6zM15.5 14.5h6v5h-6zM18 10h.01M18 17h.01" />,
  engine: <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />,
  server: <path d="M4.5 4.5h15v6h-15zM4.5 13.5h15v6h-15zM8 7.5h.01M8 16.5h.01" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5Z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="9" r="3.3" />
      <path d="M3 19.5a6 6 0 0 1 12 0M15.5 5.9a3.3 3.3 0 0 1 0 6.3M17.5 14a6 6 0 0 1 3.5 5.5" />
    </>
  ),
  signIn: <path d="M10 7.5 14.5 12 10 16.5M14.5 12H3.5M13.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4.5" />,
  signOut: <path d="M15 7.5 19.5 12 15 16.5M19.5 12h-11M10.5 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4.5" />,
  logs: <path d="M6.5 3.5h8L19 8v12.5H6.5zM14.5 3.5V8H19M9.5 12h6.5M9.5 15.5h6.5M9.5 8.5h2" />,
  camera: (
    <>
      <path d="M4 8.5a1.5 1.5 0 0 1 1.5-1.5h2.3l1.6-2.2h5.2L16.2 7h2.3A1.5 1.5 0 0 1 20 8.5v9.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V8.5Z" />
      <circle cx="12" cy="13" r="3.3" />
    </>
  ),
  layers: <path d="m12 4 8.5 4.5L12 13 3.5 8.5 12 4ZM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5" />,
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.7 0-1 .8-1.8 1.8-1.8h2.1a3.8 3.8 0 0 0 3.8-3.8c0-3.9-3.8-7-8.5-7Z" />
      <circle cx="7.5" cy="11.5" r="1" fill="currentColor" />
      <circle cx="10" cy="7.5" r="1" fill="currentColor" />
      <circle cx="14.5" cy="7.5" r="1" fill="currentColor" />
    </>
  ),
  language: <path d="M4 5.5h9M8.5 4v1.5M6 5.5c.6 3 2.4 5.5 5.5 7M11 5.5c-.7 3.4-2.8 6-6.5 7.8M12.5 20l3.8-9 3.8 9M13.8 17h5" />,
  shield: <path d="M12 3.5 5 6v5.5c0 4.5 3 7.8 7 9 4-1.2 7-4.5 7-9V6l-7-2.5Z" />,
  sliders: <path d="M5 4v6M5 14v6M12 4v4M12 12v8M19 4v10M19 18v2M3 10h4M10 8h4M17 14h4" />,
  cube: <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v0M4 7.5l8 4.5 8-4.5M12 12v9" />,
  java: <path d="M7.5 18.5h9M6 15.5h12M8.5 8.5c0-2 2.5-2 2.5-4M12.5 9c0-2 2.5-2 2.5-4M7 11.5h10v1a5 5 0 0 1-10 0v-1ZM17 12h1.3a1.7 1.7 0 0 1 0 3.4H17" />,
  memory: <path d="M5 7h14v10H5zM8 7V4.5M12 7V4.5M16 7V4.5M8 19.5V17M12 19.5V17M16 19.5V17M8.5 10h7v4h-7z" />,
  terminal: <path d="M4 5h16v14H4zM7.5 9.5 10.5 12l-3 2.5M12.5 15h4" />,
  keyboard: <path d="M3.5 6.5h17v11h-17zM7 10h.01M10 10h.01M13 10h.01M16.5 10h.01M7.5 14h9" />,
  volume: <path d="M4.5 9.5h3.2L12 6v12l-4.3-3.5H4.5zM15.5 9.3a4 4 0 0 1 0 5.4M18 7a7.3 7.3 0 0 1 0 10" />,
  video: <path d="M3.5 6.5h12v11h-12zM15.5 10.5l5-3v9l-5-3" />,
  window: <path d="M3.5 5h17v14h-17zM3.5 9h17" />,
  minimize: <path d="M5 12h14" />,
  maximize: <rect x="5.5" y="5.5" width="13" height="13" rx="1" />,
  restore: <path d="M8.5 8.5h11v11h-11zM5 15.5V4.5h11" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </>
  ),
  sparkle: <path d="M12 3.5c.8 4 2.5 5.7 6.5 6.5-4 .8-5.7 2.5-6.5 6.5-.8-4-2.5-5.7-6.5-6.5 4-.8 5.7-2.5 6.5-6.5ZM18.5 15.5c.3 1.4.9 2 2.3 2.3-1.4.3-2 .9-2.3 2.3-.3-1.4-.9-2-2.3-2.3 1.4-.3 2-.9 2.3-2.3Z" />,
  moon: <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />,
  noBg: <path d="M4 4h7v7H4zM13 13h7v7h-7zM13 4h7v7h-7zM4 13h7v7H4z" />,
  cape: <path d="M8 4h8l1.5 15.5-2.8-1.8-2.7 2-2.7-2-2.8 1.8L8 4ZM8 4l4 3 4-3" />,
  wings: <path d="M12 6c-1.5-1.5-4-2.5-8-2 0 6 1.5 10.5 4.5 14l1.5-3 2 2V6Zm0 0c1.5-1.5 4-2.5 8-2 0 6-1.5 10.5-4.5 14l-1.5-3-2 2" />,
  arms: <path d="m4 8 4 4-4 4M20 8l-4 4 4 4M10.5 12h3" />,
  shirt: <path d="M8.5 4 4 6.5l1.8 4L8 9.6V20h8V9.6l2.2.9 1.8-4L15.5 4c-.7 1.2-2 2-3.5 2s-2.8-.8-3.5-2Z" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: <path d="m4 4 16 16M10.6 6a9 9 0 0 1 1.4-.1c6 0 9.5 6.1 9.5 6.1a16 16 0 0 1-2.5 3.2M6.6 7.1A16.6 16.6 0 0 0 2.5 12S6 18.4 12 18.4a9 9 0 0 0 4-.9M9.9 9.9a2.8 2.8 0 0 0 4 4" />,
  lineNumbers: <path d="M4 5h16v14H4zM8 9.5 9.5 8.5v6M12 9.5a1.5 1.5 0 1 1 3 0c0 1.5-3 2.4-3 5h3" />,
  wrap: <path d="M4 6h16M4 12h12.5a3 3 0 0 1 0 6H12m1.5-2-2 2 2 2M4 18h4.5" />,
  toTop: <path d="M5 4.5h14M12 20V9m-4.5 4.5L12 9l4.5 4.5" />,
  toBottom: <path d="M5 19.5h14M12 4v11m-4.5-4.5L12 15l4.5-4.5" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="1.8" />
      <path d="M15.5 8.5V5.8A1.8 1.8 0 0 0 13.7 4H5.8A1.8 1.8 0 0 0 4 5.8v7.9a1.8 1.8 0 0 0 1.8 1.8h2.7" />
    </>
  ),
  link: <path d="M9.5 14.5 14.5 9.5M8 11.5l-2 2a3.5 3.5 0 0 0 5 5l2-2M16 12.5l2-2a3.5 3.5 0 0 0-5-5l-2 2" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />,
  star: <path d="m12 4 2.5 5.2 5.7.8-4.1 4 1 5.6L12 17l-5.1 2.6 1-5.6-4.1-4 5.7-.8L12 4Z" />,
  heart: <path d="M12 19.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 6.8a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10-7.5 10Z" />,
  fire: <path d="M12 21c3.6 0 6.5-2.6 6.5-6.3 0-4.6-4.6-6.4-4.6-11.2C10 6 8.4 9.4 9 12.5c-1.4-.8-2-2.3-2-3.5C5.5 10.5 5.5 12.6 5.5 14.7 5.5 18.4 8.4 21 12 21Z" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  layout: <path d="M4 4h16v16H4zM4 9h16M10 9v11" />,
  bell: <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5l1.5-2ZM10 20.5a2 2 0 0 0 4 0" />,
  tag: <path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1 1 0 0 1 0 1.4l-7.4 7.4a1 1 0 0 1-1.4 0l-8.2-8.2ZM8 8h.01" />,
  calendar: <path d="M4.5 6h15v14h-15zM4.5 10h15M8.5 3.5V7M15.5 3.5V7" />,
  box: <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3ZM4 7.5l8 4.5 8-4.5M12 12v9" />,
  prism: <path d="M11 4.5 18.5 18h-15L11 4.5ZM1.5 13.5l6.2-1.6M14.6 11.2l7.4-3M15.3 12.6l7 0.4M16 14.1l6 3.4" />,
  anvil: <path d="M4 7h11a4 4 0 0 0 4 4v1h-6l-1.5 2.5L15 18H6.5L9 14.5 7.5 12H6A2 2 0 0 1 4 10V7Z" />,
  feather: <path d="M19.5 4.5c-6 0-11 4-11.5 10.5L5 19.5M8 15h6.5c2.8-2 4.5-5.5 5-10.5M10.5 11.5h6" />,
  quilt: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7zM7.5 4v7M16.5 13v7M4 7.5h7M13 16.5h7" />,
  fox: <path d="M4 4l4 5h8l4-5-1 9-7 7-7-7-1-9Zm5 10h.01M15 10h.01M10.5 15.5 12 17l1.5-1.5" />,
  lock: <path d="M6 10.5h12V20H6zM8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />,
  zap: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
  package: <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3ZM8 5.3l8 4.5M4 7.5l8 4.5 8-4.5M12 12v9" />,
  drag: (
    <>
      <circle cx="9" cy="6.5" r="1.2" fill="currentColor" />
      <circle cx="15" cy="6.5" r="1.2" fill="currentColor" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" />
      <circle cx="9" cy="17.5" r="1.2" fill="currentColor" />
      <circle cx="15" cy="17.5" r="1.2" fill="currentColor" />
    </>
  ),
};

// line icons for switching versions, sharing codes, accounts and dragging
Object.assign(P, {
  circle: <circle cx="12" cy="12" r="8" />,
  map: <path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5L3.5 20zM9 4v13.5M15 6.5V20" />,
  swap: <path d="M6.5 8h12.5m-3.2-3.3L19 8l-3.2 3.3M17.5 16H5m3.2-3.3L5 16l3.2 3.3" />,
  file: <path d="M7 3.5h6.8L18 7.7V20.5H7zM13.5 3.5v4.4H18M9.6 12h5.8M9.6 15.5h5.8" />,
  code: <path d="m8.5 7.5-4.5 4.5 4.5 4.5M15.5 7.5l4.5 4.5-4.5 4.5M13.4 5.5l-2.8 13" />,
  undo: <path d="M9 6.5 4.5 11 9 15.5M5 11h9.3a4.8 4.8 0 0 1 0 9.6H11" />,
  userPlus: (
    <>
      <circle cx="10" cy="8" r="3.6" />
      <path d="M3.5 20c.7-3.7 3.3-5.6 6.5-5.6 2 0 3.7.7 4.9 2.1M18.5 13.5v6M15.5 16.5h6" />
    </>
  ),
  logIn: <path d="M13.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4.5M9.5 8l4 4-4 4M13.5 12H4" />,
  grip: (
    <>
      <circle cx="9" cy="6.5" r="1.2" fill="currentColor" />
      <circle cx="15" cy="6.5" r="1.2" fill="currentColor" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" />
      <circle cx="9" cy="17.5" r="1.2" fill="currentColor" />
      <circle cx="15" cy="17.5" r="1.2" fill="currentColor" />
    </>
  ),
  offline: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c.7-3.7 3.4-5.6 7.5-5.6s6.8 1.9 7.5 5.6M3 3l18 18" />
    </>
  ),
});

export default function Icon({ name, size = 20, stroke = 1.8, className = '', style, title }) {
  const bold = BOLD[name] || (!P[name] ? BOLD.box : null);
  if (bold) {
    return (
      <svg className={`icon ${className}`} width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" style={style} aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined}>
        {title ? <title>{title}</title> : null}
        <path d={bold} />
      </svg>
    );
  }
  const content = P[name];
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {content}
    </svg>
  );
}

export const ICON_NAMES = [...new Set([...Object.keys(BOLD), ...Object.keys(P)])];
