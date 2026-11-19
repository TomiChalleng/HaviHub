// Text fields can't take unlimited text: every input and textarea gets a
// maximum length (fields that set their own keep it), and pasting more than
// fits says that the text was cut instead of silently dropping the rest.
import { LIMITS } from '../../shared/limits.js';

const TEXT_TYPES = new Set(['', 'text', 'search', 'url', 'email', 'password', 'tel']);
let notice = null;
let lastNotice = 0;

export function setInputNotice(fn) {
  notice = fn;
}

function guard(el) {
  if (el instanceof HTMLTextAreaElement) {
    if (!(el.maxLength > 0)) el.maxLength = LIMITS.textarea;
    return true;
  }
  if (el instanceof HTMLInputElement && TEXT_TYPES.has(el.type)) {
    if (!(el.maxLength > 0)) el.maxLength = LIMITS.generic;
    return true;
  }
  return false;
}

export function installInputGuard() {
  document.addEventListener('focusin', (e) => guard(e.target), true);
  document.addEventListener(
    'paste',
    (e) => {
      const el = e.target;
      if (!guard(el)) return;
      const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
      const selected = Math.max(0, (el.selectionEnd || 0) - (el.selectionStart || 0));
      const room = el.maxLength - (el.value.length - selected);
      if (text.length > room && notice && Date.now() - lastNotice > 1500) {
        lastNotice = Date.now();
        notice(el.maxLength);
      }
    },
    true,
  );
}
