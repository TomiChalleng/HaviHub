// Minecraft key names (options.txt format, e.g. "key.keyboard.left.shift")
// from browser keyboard / mouse events, and their labels.
import { KEY_NAMES, MOUSE_BUTTON } from './mckeys.js';
import { getLanguage } from './i18n.js';

export const UNBOUND = 'key.keyboard.unknown';

const CODE = {
  Space: 'space',
  Tab: 'tab',
  CapsLock: 'caps.lock',
  Enter: 'enter',
  Escape: 'escape',
  Backspace: 'backspace',
  ShiftLeft: 'left.shift',
  ShiftRight: 'right.shift',
  ControlLeft: 'left.control',
  ControlRight: 'right.control',
  AltLeft: 'left.alt',
  AltRight: 'right.alt',
  MetaLeft: 'left.win',
  MetaRight: 'right.win',
  OSLeft: 'left.win',
  OSRight: 'right.win',
  ContextMenu: 'menu',
  Insert: 'insert',
  Delete: 'delete',
  Home: 'home',
  End: 'end',
  PageUp: 'page.up',
  PageDown: 'page.down',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Backquote: 'grave.accent',
  Minus: 'minus',
  Equal: 'equal',
  BracketLeft: 'left.bracket',
  BracketRight: 'right.bracket',
  Backslash: 'backslash',
  IntlBackslash: 'world.2',
  IntlRo: 'world.1',
  Semicolon: 'semicolon',
  Quote: 'apostrophe',
  Comma: 'comma',
  Period: 'period',
  Slash: 'slash',
  NumLock: 'num.lock',
  ScrollLock: 'scroll.lock',
  PrintScreen: 'print.screen',
  Pause: 'pause',
  NumpadDecimal: 'keypad.decimal',
  NumpadComma: 'keypad.decimal',
  NumpadDivide: 'keypad.divide',
  NumpadMultiply: 'keypad.multiply',
  NumpadSubtract: 'keypad.subtract',
  NumpadAdd: 'keypad.add',
  NumpadEnter: 'keypad.enter',
  NumpadEqual: 'keypad.equal',
};

// Physical key (like Minecraft, independent of the keyboard layout)
export function keyFromEvent(e) {
  const c = e.code || '';
  let k = CODE[c];
  if (!k && /^Key[A-Z]$/.test(c)) k = c.slice(3).toLowerCase();
  if (!k && /^Digit\d$/.test(c)) k = c.slice(5);
  if (!k && /^Numpad\d$/.test(c)) k = `keypad.${c.slice(6)}`;
  if (!k && /^F([1-9]|1\d|2[0-5])$/.test(c)) k = c.toLowerCase();
  return k ? `key.keyboard.${k}` : null;
}

export function keyFromMouse(button) {
  return ['key.mouse.left', 'key.mouse.middle', 'key.mouse.right', 'key.mouse.4', 'key.mouse.5'][button] || `key.mouse.${button + 1}`;
}

export function keyLabel(key) {
  const lang = getLanguage() === 'en' ? 'en' : 'es';
  const names = KEY_NAMES[lang] || KEY_NAMES.en;
  if (!key || key === UNBOUND) return names[UNBOUND] || '—';
  // Minecraft's lang files escape % as %% (shown as a single %)
  if (names[key]) return names[key].replace(/%%/g, '%');
  const mouse = /^key\.mouse\.(\d+)$/.exec(key);
  if (mouse) return (MOUSE_BUTTON[lang] || 'Button %1$s').replace('%1$s', mouse[1]);
  const kb = /^key\.keyboard\.(.+)$/.exec(key);
  if (kb) {
    const s = kb[1];
    if (/^f\d+$/.test(s)) return s.toUpperCase();
    if (s.length === 1) return s.toUpperCase();
    return s
      .split('.')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return key;
}
