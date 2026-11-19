// Seasonal dates, the server directory filters and the server ping protocol.
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');

const { activeSeason, inSeason, seasonEnd, seasonYear, nextNewYear } = require('../src/shared/seasons');
const { filterString, normalize } = require('../src/main/platforms/servers');
const { ping, parseAddress, chatText } = require('../src/main/serverping');

const d = (s) => new Date(`${s}T12:00:00`);

test('seasons turn on during their week only', () => {
  assert.equal(activeSeason(d('2026-10-24')), null);
  assert.equal(activeSeason(d('2026-10-25')), 'halloween');
  assert.equal(activeSeason(d('2026-10-31')), 'halloween');
  assert.equal(activeSeason(d('2026-11-01')), 'halloween');
  assert.equal(activeSeason(d('2026-11-02')), null);
  assert.equal(activeSeason(d('2026-12-18')), null);
  assert.equal(activeSeason(d('2026-12-24')), 'christmas');
  assert.equal(activeSeason(d('2026-12-27')), 'newyear');
  assert.equal(activeSeason(d('2026-12-31')), 'newyear');
  assert.equal(activeSeason(d('2027-01-02')), 'newyear');
  assert.equal(activeSeason(d('2027-01-03')), null);
  // turned off in Settings
  assert.equal(activeSeason(d('2026-10-31'), { halloween: false }), null);
  assert.equal(activeSeason(d('2026-12-24'), { christmas: false, halloween: false }), null);
  assert.ok(inSeason(d('2027-01-01'), 'newyear'));
  assert.equal(seasonYear(d('2027-01-01'), 'newyear'), 2026);
  assert.equal(seasonEnd(d('2026-12-29'), 'newyear').getFullYear(), 2027);
  assert.equal(seasonEnd(d('2027-01-01'), 'newyear').getDate(), 2);
  assert.equal(nextNewYear(new Date(2026, 11, 31, 23, 59, 50)).getTime(), new Date(2027, 0, 1).getTime());
});

test('server directory filters', () => {
  assert.equal(filterString({}), 'project_types = minecraft_java_server');
  const f = filterString({ online: true, kinds: ['vanilla'], version: '1.21.1', region: 'europe', language: 'es', categories: ['smp', 'pvp'] });
  assert.match(f, /minecraft_java_server\.ping\.data EXISTS/);
  assert.match(f, /minecraft_java_server\.content\.kind = vanilla/);
  assert.match(f, /game_versions = 1\.21\.1/);
  assert.match(f, /minecraft_server\.region = europe/);
  assert.match(f, /categories = smp AND categories = pvp/);
  // both kinds = no kind filter; unknown regions are ignored; odd values are quoted
  assert.doesNotMatch(filterString({ kinds: ['vanilla', 'modpack'], region: 'mars' }), /kind|region/);
  assert.match(filterString({ categories: ['a b'] }), /categories = "a b"/);
  const s = normalize({
    project_id: 'p1',
    slug: 'cobble',
    name: 'Cobble',
    categories: ['smp'],
    minecraft_server: { region: 'us_east', languages: ['en'] },
    minecraft_java_server: { address: 'play.cobble.gg', content: { kind: 'modpack', project_id: 'mp', version_id: 'v1', project_name: 'Pack' }, verified_plays_2w: 10, ping: { data: { players_online: 5, players_max: 50 } } },
  });
  assert.equal(s.kind, 'modpack');
  assert.equal(s.modpack.versionId, 'v1');
  assert.equal(s.online, 5);
  assert.equal(s.address, 'play.cobble.gg');
});

// a tiny Minecraft server that answers the Server List Ping
function fakeServer({ answerPing = true } = {}) {
  const readVarint = (buf, o) => {
    let n = 0;
    let shift = 0;
    let i = o;
    for (;;) {
      if (i >= buf.length) return null;
      const b = buf[i++];
      n |= (b & 0x7f) << shift;
      if (!(b & 0x80)) break;
      shift += 7;
    }
    return { value: n, size: i - o };
  };
  const varint = (n) => {
    const out = [];
    do {
      let b = n & 0x7f;
      n >>>= 7;
      if (n) b |= 0x80;
      out.push(b);
    } while (n);
    return Buffer.from(out);
  };
  const packet = (id, body) => {
    const b = Buffer.concat([varint(id), body]);
    return Buffer.concat([varint(b.length), b]);
  };
  const server = net.createServer((sock) => {
    let buf = Buffer.alloc(0);
    let packets = 0;
    sock.on('data', (c) => {
      buf = Buffer.concat([buf, c]);
      for (;;) {
        const len = readVarint(buf, 0);
        if (!len || buf.length < len.size + len.value) return;
        const body = buf.subarray(len.size, len.size + len.value);
        buf = buf.subarray(len.size + len.value);
        packets++;
        const id = readVarint(body, 0).value;
        if (packets === 2 && id === 0) {
          const json = Buffer.from(JSON.stringify({ version: { name: 'Paper 1.21.1', protocol: 767 }, players: { online: 42, max: 100 }, description: { text: '§aHola ', extra: [{ text: 'mundo' }] } }));
          sock.write(packet(0, Buffer.concat([varint(json.length), json])));
        } else if (id === 1 && answerPing) sock.write(packet(1, body.subarray(1)));
        else if (id === 1) sock.end();
      }
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

test('server list ping', async () => {
  assert.deepEqual(parseAddress('play.example.net:25570'), { host: 'play.example.net', port: 25570 });
  assert.deepEqual(parseAddress('play.example.net'), { host: 'play.example.net', port: null });
  assert.equal(chatText({ text: '§cA', extra: [{ text: 'B' }] }), 'AB');
  const s = await fakeServer();
  const r = await ping(`127.0.0.1:${s.address().port}`);
  s.close();
  assert.equal(r.online, 42);
  assert.equal(r.max, 100);
  assert.equal(r.version, 'Paper 1.21.1');
  assert.equal(r.motd, 'Hola mundo');
  assert.ok(r.latency >= 1);
  // a server that answers the status but not the ping still counts
  const s2 = await fakeServer({ answerPing: false });
  const r2 = await ping(`127.0.0.1:${s2.address().port}`, { timeout: 1500 });
  s2.close();
  assert.equal(r2.online, 42);
  // nobody there
  await assert.rejects(() => ping('127.0.0.1:1', { timeout: 1000 }));
});
