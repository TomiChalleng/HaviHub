// CurseForge's file servers ask for the API key on downloads (required since
// July 16, 2026). The key goes only to those servers, also across redirects.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('../src/main/util/http');

const isForge = (url) => /(^|\.)forgecdn\.net$/i.test(new URL(url).hostname);
function setup(routes) {
  const calls = [];
  http.setFetch(async (url, opts) => {
    calls.push({ url, key: (opts.headers || {})['x-api-key'] || null, redirect: opts.redirect || null });
    const r = routes[url];
    if (!r) return new Response('nope', { status: 404 });
    return new Response(r.body || null, { status: r.status || 200, headers: r.headers || {} });
  });
  http.setHostRules({
    headers: (url) => (isForge(url) ? { 'x-api-key': 'KEY' } : null),
    explain: (status, url) => (status === 401 && isForge(url) ? Object.assign(new Error('CurseForge no aceptó la descarga'), { code: 'CF_KEY' }) : null),
  });
  return calls;
}

test('the key goes with a CurseForge download, follows it to their other server and stops at anyone else', async () => {
  const calls = setup({
    'https://edge.forgecdn.net/files/1/2/a.jar': { status: 302, headers: { location: 'https://mediafilez.forgecdn.net/files/1/2/a.jar' } },
    'https://mediafilez.forgecdn.net/files/1/2/a.jar': { status: 302, headers: { location: 'https://cdn.example.net/a.jar' } },
    'https://cdn.example.net/a.jar': { body: 'JAR' },
  });
  const dest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-http-')), 'a.jar');
  await http.download('https://edge.forgecdn.net/files/1/2/a.jar', dest);
  assert.equal(fs.readFileSync(dest, 'utf8'), 'JAR');
  assert.deepEqual(calls.map((c) => [new URL(c.url).hostname, c.key]), [['edge.forgecdn.net', 'KEY'], ['mediafilez.forgecdn.net', 'KEY'], ['cdn.example.net', null]]);
});

test('other servers never see the key, and their requests are made as before', async () => {
  const calls = setup({ 'https://cdn.modrinth.com/data/x.jar': { body: 'M' } });
  const res = await http.request('https://cdn.modrinth.com/data/x.jar');
  assert.equal(await res.text(), 'M');
  assert.deepEqual(calls, [{ url: 'https://cdn.modrinth.com/data/x.jar', key: null, redirect: null }]);
});

test('a download CurseForge refuses says why', async () => {
  setup({ 'https://edge.forgecdn.net/files/9/9/b.jar': { status: 401 } });
  const dest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-http-')), 'b.jar');
  await assert.rejects(http.download('https://edge.forgecdn.net/files/9/9/b.jar', dest), (e) => e.code === 'CF_KEY' && /CurseForge/.test(e.message));
  assert.equal(fs.existsSync(dest), false);
});

test('a redirect that never ends is given up', async () => {
  setup({ 'https://edge.forgecdn.net/loop': { status: 302, headers: { location: 'https://edge.forgecdn.net/loop' } } });
  await assert.rejects(http.request('https://edge.forgecdn.net/loop', { retries: 0 }));
});
