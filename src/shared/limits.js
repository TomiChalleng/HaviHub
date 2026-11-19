// Maximum lengths for the text people type into Havi Hub. The renderer puts
// them on the fields (maxLength) and the main process cuts anything longer
// before it reaches a file, a folder name or the engine.
const LIMITS = {
  instanceName: 64,
  groupName: 40,
  serverName: 64,
  serverAddress: 255,
  search: 120,
  offlineName: 16,
  version: 32,
  summary: 300,
  path: 1024,
  url: 2048,
  javaArgs: 8000,
  generic: 256,
  textarea: 20000,
};

// Plain one-line text: no control characters, single spaces, trimmed and cut
// to `max` characters (counting emoji as one).
function cleanText(value, max = LIMITS.generic) {
  const s = String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max).join('').trim() : s;
}

module.exports = { LIMITS, cleanText };
