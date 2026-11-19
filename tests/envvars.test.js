// Environment variables per instance (the engine's OverrideEnv / Env settings)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseEnv, serializeEnv, cleanEnv, validEnvName, MAX_VARS } = require('../src/shared/envvars');
const { IniFile } = require('../src/main/util/ini');

test('rows become the JSON object the engine reads, and back', () => {
  const text = serializeEnv([
    { name: '__NV_PRIME_RENDER_OFFLOAD', value: '1' },
    { name: ' MESA_GL_VERSION_OVERRIDE ', value: '4.6' },
    { name: 'PATH_EXTRA', value: 'C:\\Program Files\\x;"quoted", a=b' },
  ]);
  assert.deepEqual(JSON.parse(text), { __NV_PRIME_RENDER_OFFLOAD: '1', MESA_GL_VERSION_OVERRIDE: '4.6', PATH_EXTRA: 'C:\\Program Files\\x;"quoted", a=b' });
  assert.deepEqual(parseEnv(text)[2], { name: 'PATH_EXTRA', value: 'C:\\Program Files\\x;"quoted", a=b' });
});

test('names that the system would refuse are left out; a repeated name keeps the last value', () => {
  assert.equal(validEnvName('A_B1'), true);
  for (const bad of ['', 'A=B', 'A B', 'A\tB', 'A\u0000']) assert.equal(validEnvName(bad), false, JSON.stringify(bad));
  const text = serializeEnv([{ name: 'A=B', value: 'x' }, { name: '', value: 'y' }, { name: 'OK', value: 'line1\nline2' }, { name: 'OK', value: 'last' }, null]);
  assert.deepEqual(JSON.parse(text), { OK: 'last' });
  assert.equal(JSON.parse(serializeEnv([{ name: 'V', value: 'a\u0000b\nc' }])).V, 'abc');
  const many = Array.from({ length: MAX_VARS + 10 }, (_, i) => ({ name: `V${i}`, value: '1' }));
  assert.equal(Object.keys(JSON.parse(serializeEnv(many))).length, MAX_VARS);
});

test('anything that is not a JSON object reads as no variables', () => {
  for (const bad of ['', '   ', 'not json', '[1,2]', '"text"', 'null', undefined, 42]) assert.deepEqual(parseEnv(bad), []);
  assert.equal(cleanEnv('garbage'), '{}');
  assert.equal(cleanEnv('{"A":1,"B":null,"C D":"x"}'), '{"A":"1","B":""}');
});

test('the text survives the settings file exactly (quotes, commas, back slashes)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-env-'));
  const file = path.join(dir, 'instance.cfg');
  fs.writeFileSync(file, '[General]\nname=Vanilla\n');
  const text = serializeEnv([{ name: 'A', value: 'C:\\x;"q", b=c' }, { name: 'B', value: '1' }]);
  const cfg = await IniFile.load(file);
  cfg.set('OverrideEnv', true);
  cfg.set('Env', text);
  await cfg.save();
  const again = await IniFile.load(file);
  assert.equal(again.get('Env'), text);
  assert.equal(again.get('name'), 'Vanilla');
  // one line, quoted as QSettings does (a comma would otherwise make it a list)
  assert.match(fs.readFileSync(file, 'utf8'), /^Env="\{\\"A\\":/m);
});
