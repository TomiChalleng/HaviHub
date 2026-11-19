// "Quiet" means Havi Hub should stand still: its window is hidden, or it is not
// the window in use (at once while a game runs, after half a minute otherwise).
// Decorations (snow, fireworks, the 3D sky and skin, looping CSS animations)
// stop then, so the game and other programs get that processor and graphics
// time; they carry on the moment you come back.
let quiet = false;

export function isQuiet() {
  return quiet || document.hidden;
}

export function setQuiet(value) {
  quiet = Boolean(value);
  document.documentElement.toggleAttribute('data-quiet', quiet);
  window.dispatchEvent(new Event('havihub:quiet'));
}

// requestAnimationFrame that only idles (twice a second) while quiet
export function requestFrame(fn) {
  const handle = { raf: 0, timer: 0 };
  if (isQuiet()) handle.timer = setTimeout(() => (handle.raf = requestAnimationFrame(fn)), 500);
  else handle.raf = requestAnimationFrame(fn);
  return handle;
}

export function cancelFrame(handle) {
  if (!handle) return;
  clearTimeout(handle.timer);
  cancelAnimationFrame(handle.raf);
}
