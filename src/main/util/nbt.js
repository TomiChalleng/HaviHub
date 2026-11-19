// Minimal NBT (Named Binary Tag) reader/writer for level.dat and servers.dat.
// Values are kept typed ({ t, v }) so files can be written back losslessly.
const zlib = require('node:zlib');

const T = {
  End: 0,
  Byte: 1,
  Short: 2,
  Int: 3,
  Long: 4,
  Float: 5,
  Double: 6,
  ByteArray: 7,
  String: 8,
  List: 9,
  Compound: 10,
  IntArray: 11,
  LongArray: 12,
};

// Java "modified UTF-8" decode (close enough: handles the 0xC0 0x80 null form)
function decodeMUtf8(buf) {
  let out = '';
  for (let i = 0; i < buf.length; ) {
    const a = buf[i++];
    if (a < 0x80) out += String.fromCharCode(a);
    else if ((a & 0xe0) === 0xc0) {
      const b = buf[i++];
      out += String.fromCharCode(((a & 0x1f) << 6) | (b & 0x3f));
    } else if ((a & 0xf0) === 0xe0) {
      const b = buf[i++];
      const c = buf[i++];
      out += String.fromCharCode(((a & 0x0f) << 12) | ((b & 0x3f) << 6) | (c & 0x3f));
    } else {
      out += '�';
    }
  }
  return out;
}

function encodeMUtf8(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c !== 0 && c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return Buffer.from(bytes);
}

class Reader {
  constructor(buf) {
    this.buf = buf;
    this.pos = 0;
  }
  u8() {
    return this.buf.readUInt8(this.pos++);
  }
  i8() {
    return this.buf.readInt8(this.pos++);
  }
  i16() {
    const v = this.buf.readInt16BE(this.pos);
    this.pos += 2;
    return v;
  }
  u16() {
    const v = this.buf.readUInt16BE(this.pos);
    this.pos += 2;
    return v;
  }
  i32() {
    const v = this.buf.readInt32BE(this.pos);
    this.pos += 4;
    return v;
  }
  i64() {
    const v = this.buf.readBigInt64BE(this.pos);
    this.pos += 8;
    return v;
  }
  f32() {
    const v = this.buf.readFloatBE(this.pos);
    this.pos += 4;
    return v;
  }
  f64() {
    const v = this.buf.readDoubleBE(this.pos);
    this.pos += 8;
    return v;
  }
  str() {
    const len = this.u16();
    const s = decodeMUtf8(this.buf.subarray(this.pos, this.pos + len));
    this.pos += len;
    return s;
  }
  payload(type) {
    switch (type) {
      case T.Byte:
        return this.i8();
      case T.Short:
        return this.i16();
      case T.Int:
        return this.i32();
      case T.Long:
        return this.i64();
      case T.Float:
        return this.f32();
      case T.Double:
        return this.f64();
      case T.ByteArray: {
        const len = this.i32();
        const v = Buffer.from(this.buf.subarray(this.pos, this.pos + len));
        this.pos += len;
        return v;
      }
      case T.String:
        return this.str();
      case T.List: {
        const et = this.u8();
        const len = this.i32();
        const items = [];
        for (let i = 0; i < len; i++) items.push(this.payload(et));
        return { et, items };
      }
      case T.Compound: {
        const obj = {};
        for (;;) {
          const t = this.u8();
          if (t === T.End) break;
          const name = this.str();
          obj[name] = { t, v: this.payload(t) };
        }
        return obj;
      }
      case T.IntArray: {
        const len = this.i32();
        const arr = [];
        for (let i = 0; i < len; i++) arr.push(this.i32());
        return arr;
      }
      case T.LongArray: {
        const len = this.i32();
        const arr = [];
        for (let i = 0; i < len; i++) arr.push(this.i64());
        return arr;
      }
      default:
        throw new Error(`Unknown NBT tag type ${type}`);
    }
  }
}

// Returns { name, value } where value is a typed compound payload.
function parse(buffer) {
  let buf = buffer;
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  else if (buf.length >= 2 && buf[0] === 0x78) {
    try {
      buf = zlib.inflateSync(buf);
    } catch {
      /* not zlib */
    }
  }
  const r = new Reader(buf);
  const type = r.u8();
  if (type !== T.Compound) throw new Error('NBT root is not a compound');
  const name = r.str();
  return { name, value: r.payload(T.Compound) };
}

// Convert typed payload into plain JS values (Longs become Numbers).
function simplify(typedCompound) {
  const conv = (t, v) => {
    switch (t) {
      case T.Long:
        return Number(v);
      case T.LongArray:
        return v.map(Number);
      case T.Compound:
        return simplify(v);
      case T.List:
        return v.items.map((it) => conv(v.et, it));
      default:
        return v;
    }
  };
  const out = {};
  for (const [k, { t, v }] of Object.entries(typedCompound)) out[k] = conv(t, v);
  return out;
}

class Writer {
  constructor() {
    this.chunks = [];
  }
  push(b) {
    this.chunks.push(b);
  }
  u8(v) {
    const b = Buffer.alloc(1);
    b.writeUInt8(v);
    this.push(b);
  }
  i8(v) {
    const b = Buffer.alloc(1);
    b.writeInt8(v);
    this.push(b);
  }
  i16(v) {
    const b = Buffer.alloc(2);
    b.writeInt16BE(v);
    this.push(b);
  }
  u16(v) {
    const b = Buffer.alloc(2);
    b.writeUInt16BE(v);
    this.push(b);
  }
  i32(v) {
    const b = Buffer.alloc(4);
    b.writeInt32BE(v);
    this.push(b);
  }
  i64(v) {
    const b = Buffer.alloc(8);
    b.writeBigInt64BE(BigInt(v));
    this.push(b);
  }
  str(s) {
    const enc = encodeMUtf8(s);
    this.u16(enc.length);
    this.push(enc);
  }
  payload(t, v) {
    switch (t) {
      case T.Byte:
        return this.i8(v);
      case T.Short:
        return this.i16(v);
      case T.Int:
        return this.i32(v);
      case T.Long:
        return this.i64(v);
      case T.Float: {
        const b = Buffer.alloc(4);
        b.writeFloatBE(v);
        return this.push(b);
      }
      case T.Double: {
        const b = Buffer.alloc(8);
        b.writeDoubleBE(v);
        return this.push(b);
      }
      case T.ByteArray:
        this.i32(v.length);
        return this.push(Buffer.from(v));
      case T.String:
        return this.str(v);
      case T.List:
        this.u8(v.items.length ? v.et : v.et || T.End);
        this.i32(v.items.length);
        for (const it of v.items) this.payload(v.et, it);
        return;
      case T.Compound:
        for (const [k, tv] of Object.entries(v)) {
          this.u8(tv.t);
          this.str(k);
          this.payload(tv.t, tv.v);
        }
        return this.u8(T.End);
      case T.IntArray:
        this.i32(v.length);
        for (const x of v) this.i32(x);
        return;
      case T.LongArray:
        this.i32(v.length);
        for (const x of v) this.i64(x);
        return;
      default:
        throw new Error(`Unknown NBT tag type ${t}`);
    }
  }
}

function serialize({ name = '', value }, { gzip = false } = {}) {
  const w = new Writer();
  w.u8(T.Compound);
  w.str(name);
  w.payload(T.Compound, value);
  const buf = Buffer.concat(w.chunks);
  return gzip ? zlib.gzipSync(buf) : buf;
}

// helpers for building typed values
const tag = {
  byte: (v) => ({ t: T.Byte, v }),
  int: (v) => ({ t: T.Int, v }),
  long: (v) => ({ t: T.Long, v: BigInt(v) }),
  string: (v) => ({ t: T.String, v: String(v) }),
  compound: (obj) => ({ t: T.Compound, v: obj }),
  list: (et, items) => ({ t: T.List, v: { et, items } }),
};

module.exports = { T, parse, simplify, serialize, tag };
