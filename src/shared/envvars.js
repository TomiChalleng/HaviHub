// Environment variables for the game (the engine's "Env" setting: a JSON object
// of name → value, kept as text in instance.cfg / prismlauncher.cfg).
const MAX_VARS = 64;
const MAX_NAME = 128;
const MAX_VALUE = 4096;

// A name the system accepts: no "=", no spaces or control characters, not empty.
function validEnvName(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= MAX_NAME && !/[=\s\u0000-\u001f\u007f]/.test(name);
}

// The saved text → rows for the editor ([{ name, value }]). Anything unreadable is an empty list.
function parseEnv(text) {
  let obj = null;
  try {
    obj = typeof text === 'string' && text.trim() ? JSON.parse(text) : null;
  } catch {
    obj = null;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  return Object.entries(obj).map(([name, value]) => ({ name, value: value == null ? '' : String(value) }));
}

// Rows → the text to save. Rows without a valid name are left out, values lose
// control characters, a repeated name keeps its last value, and the limits apply.
function serializeEnv(rows) {
  const out = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    const name = String((r && r.name) || '').trim();
    if (!validEnvName(name)) continue;
    if (!(name in out) && Object.keys(out).length >= MAX_VARS) continue;
    out[name] = String(r.value == null ? '' : r.value)
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .slice(0, MAX_VALUE);
  }
  return JSON.stringify(out);
}

// What reaches the engine is always a clean JSON object (whatever the page sent).
const cleanEnv = (text) => serializeEnv(parseEnv(text));

module.exports = { parseEnv, serializeEnv, cleanEnv, validEnvName, MAX_VARS, MAX_NAME, MAX_VALUE };
