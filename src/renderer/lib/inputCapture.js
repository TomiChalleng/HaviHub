// While a control is being assigned (Settings → Controls) every key and mouse
// button belongs to it: the mouse's back/forward buttons and Alt+arrows must
// not move between pages. A short grace period covers the button's release.
let depth = 0;
let until = 0;

export function beginCapture() {
  depth++;
}

export function endCapture() {
  depth = Math.max(0, depth - 1);
  until = Date.now() + 500;
}

export function capturingInput() {
  return depth > 0 || Date.now() < until;
}
