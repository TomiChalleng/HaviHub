// The app's clock. Tests can move it (HAVIHUB_FAKE_DATE): the main process sends
// the offset in app.state and every seasonal check reads the time from here.
let offset = 0;

export function setClockOffset(ms) {
  offset = Number(ms) || 0;
}

export function now() {
  return new Date(Date.now() + offset);
}

export function todayKey(d = now()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
