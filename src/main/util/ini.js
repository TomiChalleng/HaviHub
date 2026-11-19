// Reader/editor for the INI files Prism Launcher writes through QSettings
// (prismlauncher.cfg, instance.cfg). Edits are done line-by-line so every key we
// don't touch is preserved exactly as Prism wrote it.
const fsp = require('node:fs/promises');
const { writeFileAtomic } = require('./fsx');

// ---- key escaping (QSettingsPrivate::iniEscapedKey / iniUnescapedKey) ----
function unescapeKey(raw) {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '\\') {
      out += '/';
    } else if (c === '%' && i + 2 < raw.length + 1) {
      if (raw[i + 1] === 'U' && /^[0-9A-Fa-f]{4}$/.test(raw.slice(i + 2, i + 6))) {
        out += String.fromCharCode(parseInt(raw.slice(i + 2, i + 6), 16));
        i += 5;
      } else if (/^[0-9A-Fa-f]{2}$/.test(raw.slice(i + 1, i + 3))) {
        out += String.fromCharCode(parseInt(raw.slice(i + 1, i + 3), 16));
        i += 2;
      } else out += c;
    } else out += c;
  }
  return out;
}

function escapeKey(key) {
  let out = '';
  for (const ch of key) {
    const code = ch.codePointAt(0);
    if (ch === '/') out += '\\';
    else if (/[A-Za-z0-9_\-.]/.test(ch)) out += ch;
    else if (code <= 0xff) out += '%' + code.toString(16).toUpperCase().padStart(2, '0');
    else out += '%U' + code.toString(16).toUpperCase().padStart(4, '0');
  }
  return out;
}

// ---- value escaping (QSettingsPrivate::iniEscapedString) ----
function escapeString(str) {
  let res = '';
  let needsQuotes = false;
  let escapeNextIfDigit = false;
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (ch === ';' || ch === ',' || ch === '=') needsQuotes = true;
    if (escapeNextIfDigit && /[0-9A-Fa-f]/.test(ch)) {
      res += '\\x' + code.toString(16);
      continue;
    }
    escapeNextIfDigit = false;
    switch (ch) {
      case '\0':
        res += '\\0';
        escapeNextIfDigit = true;
        break;
      case '\x07':
        res += '\\a';
        break;
      case '\b':
        res += '\\b';
        break;
      case '\f':
        res += '\\f';
        break;
      case '\n':
        res += '\\n';
        break;
      case '\r':
        res += '\\r';
        break;
      case '\t':
        res += '\\t';
        break;
      case '\v':
        res += '\\v';
        break;
      case '"':
      case '\\':
        res += '\\' + ch;
        break;
      default:
        if (code <= 0x1f) {
          res += '\\x' + code.toString(16);
          escapeNextIfDigit = true;
        } else res += ch;
    }
  }
  if (needsQuotes || /^\s/.test(res) || /\s$/.test(res)) res = `"${res}"`;
  if (str.startsWith('@')) res = '@' + res; // QSettings protects leading @
  return res;
}

function formatValue(value) {
  if (value === null || value === undefined) return '@Invalid()';
  if (Array.isArray(value)) {
    if (value.length === 0) return '@Invalid()';
    return value.map((v) => escapeString(String(v))).join(', ');
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return escapeString(String(value));
}

// Parse a raw value. Returns a string, or an array when the value is an
// unquoted comma-separated list (QStringList).
function parseValue(raw) {
  let s = raw.trim();
  if (s === '@Invalid()') return null;
  const items = [];
  let cur = '';
  let inQuotes = false;
  let hadComma = false;
  let i = 0;
  // leading @@ -> literal @
  while (i < s.length) {
    const c = s[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      i++;
      continue;
    }
    if (c === '\\' && i + 1 < s.length) {
      const n = s[i + 1];
      i += 2;
      switch (n) {
        case 'a':
          cur += '\x07';
          break;
        case 'b':
          cur += '\b';
          break;
        case 'f':
          cur += '\f';
          break;
        case 'n':
          cur += '\n';
          break;
        case 'r':
          cur += '\r';
          break;
        case 't':
          cur += '\t';
          break;
        case 'v':
          cur += '\v';
          break;
        case '0': {
          let oct = '';
          while (i < s.length && /[0-7]/.test(s[i]) && oct.length < 3) oct += s[i++];
          cur += String.fromCharCode(oct ? parseInt(oct, 8) : 0);
          break;
        }
        case 'x': {
          let hex = '';
          while (i < s.length && /[0-9A-Fa-f]/.test(s[i])) hex += s[i++];
          cur += String.fromCodePoint(hex ? parseInt(hex, 16) : 0);
          break;
        }
        default:
          cur += n;
      }
      continue;
    }
    if (c === ',' && !inQuotes) {
      hadComma = true;
      items.push(cur.trim());
      cur = '';
      i++;
      continue;
    }
    if (c === ';' && !inQuotes) break; // comment
    cur += c;
    i++;
  }
  if (hadComma) {
    items.push(cur.trim());
    return items.map(unAt);
  }
  return unAt(hadQuotes(s) ? cur : cur.trim());
}

function hadQuotes(s) {
  return s.includes('"');
}

function unAt(v) {
  if (v.startsWith('@@')) return v.slice(1);
  return v;
}

function detectEol(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

class IniFile {
  constructor(text = '') {
    this.eol = detectEol(text);
    this.lines = text.length ? text.split(/\r?\n/) : [];
    // trailing empty line from final newline
    if (this.lines.length && this.lines[this.lines.length - 1] === '') this.lines.pop();
  }

  static async load(file) {
    let text = '';
    try {
      text = await fsp.readFile(file, 'utf8');
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    } catch {
      /* new file */
    }
    const ini = new IniFile(text);
    ini.file = file;
    return ini;
  }

  // Iterate over key lines: yields {index, section, key, raw}
  *entries() {
    let section = '';
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const t = line.trim();
      if (!t || t.startsWith(';') || t.startsWith('#')) continue;
      if (t.startsWith('[') && t.endsWith(']')) {
        const name = unescapeKey(t.slice(1, -1).trim());
        section = name.toLowerCase() === 'general' ? '' : name;
        continue;
      }
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const k = unescapeKey(line.slice(0, eq).trim());
      const key = section ? `${section}/${k}` : k;
      yield { index: i, section, key, raw: line.slice(eq + 1) };
    }
  }

  toObject() {
    const out = {};
    for (const e of this.entries()) out[e.key] = parseValue(e.raw);
    return out;
  }

  get(key, fallback = undefined) {
    let found;
    for (const e of this.entries()) if (e.key === key) found = e;
    if (!found) return fallback;
    return parseValue(found.raw);
  }

  has(key) {
    for (const e of this.entries()) if (e.key === key) return true;
    return false;
  }

  set(key, value) {
    const slash = key.indexOf('/');
    const section = slash === -1 ? '' : key.slice(0, slash);
    const subKey = slash === -1 ? key : key.slice(slash + 1);
    const lineText = `${escapeKey(subKey)}=${formatValue(value)}`;
    for (const e of this.entries()) {
      if (e.key === key) {
        this.lines[e.index] = lineText;
        return;
      }
    }
    // Not present: find the section block
    let sectionStart = -1;
    let sectionEnd = this.lines.length;
    let cur = null;
    let sawHeader = false;
    for (let i = 0; i < this.lines.length; i++) {
      const t = this.lines[i].trim();
      if (t.startsWith('[') && t.endsWith(']')) {
        sawHeader = true;
        const name = unescapeKey(t.slice(1, -1).trim());
        const norm = name.toLowerCase() === 'general' ? '' : name;
        if (cur === section && sectionStart !== -1) {
          sectionEnd = i;
          break;
        }
        cur = norm;
        if (norm === section) sectionStart = i;
      }
    }
    if (sectionStart === -1 && section === '' && !sawHeader && this.lines.length) {
      // Legacy file without headers: keys at top level are General.
      this.lines.push(lineText);
      return;
    }
    if (sectionStart === -1) {
      if (section === '') {
        this.lines.unshift('[General]', lineText);
        if (this.lines.length > 2) this.lines.splice(2, 0, '');
      } else {
        if (this.lines.length && this.lines[this.lines.length - 1].trim() !== '') this.lines.push('');
        this.lines.push(`[${escapeKey(section)}]`, lineText);
      }
      return;
    }
    // insert before trailing blank lines of the section
    let insertAt = sectionEnd;
    while (insertAt - 1 > sectionStart && this.lines[insertAt - 1].trim() === '') insertAt--;
    this.lines.splice(insertAt, 0, lineText);
  }

  remove(key) {
    const idx = [];
    for (const e of this.entries()) if (e.key === key) idx.push(e.index);
    for (const i of idx.reverse()) this.lines.splice(i, 1);
  }

  toString() {
    return this.lines.join(this.eol) + this.eol;
  }

  async save(file = this.file) {
    if (!this.has('ConfigVersion')) this.set('ConfigVersion', '1.3');
    await writeFileAtomic(file, this.toString());
  }
}

// Helpers to coerce values
function asBool(v, def = false) {
  if (v === undefined || v === null || v === '') return def;
  if (typeof v === 'boolean') return v;
  return String(v).toLowerCase() === 'true' || v === '1';
}
function asInt(v, def = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}
function asList(v) {
  if (v === undefined || v === null || v === '') return [];
  return Array.isArray(v) ? v : [v];
}

module.exports = { IniFile, parseValue, formatValue, escapeString, escapeKey, unescapeKey, asBool, asInt, asList };
