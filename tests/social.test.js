// Havikun's channels in the side column (main/social.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('../src/main/util/http');
const mock = require('../scripts/mock-net.cjs');
http.setFetch(mock.fetch);
const social = require('../src/main/social');
const { SOCIALS, isSocialEmbed } = require('../src/shared/socials');

test('the channels, Linktree first', () => {
  assert.deepEqual(SOCIALS.map((s) => s.id), ['linktree', 'youtube', 'twitch', 'instagram', 'x', 'tiktok']);
  assert.deepEqual(SOCIALS.map((s) => s.url), ['https://linktr.ee/havikunn', 'https://www.youtube.com/@havikun', 'https://www.twitch.tv/havikun', 'https://www.instagram.com/havikunn/', 'https://x.com/havikun', 'https://www.tiktok.com/@havikun']);
  for (const s of SOCIALS.filter((x) => x.embed)) assert.ok(isSocialEmbed(s.embed), s.id);
  assert.equal(isSocialEmbed('https://evil.example/www.instagram.com/'), false);
  assert.equal(isSocialEmbed('http://www.instagram.com/havikunn/embed/'), false);
});

test('YouTube: the latest videos from the channel feed', async () => {
  social.cache.clear();
  const { videos } = await social.socialFeed('youtube');
  assert.equal(videos.length, 4);
  assert.deepEqual(videos[0], { id: 'aaaaaaaaa01', title: 'Sobreviví 100 días en Minecraft Hardcore', published: videos[0].published, views: 15234, url: 'https://www.youtube.com/watch?v=aaaaaaaaa01', short: false, thumbnail: 'https://i.ytimg.com/vi/aaaaaaaaa01/mqdefault.jpg' });
  assert.equal(videos[1].title, 'El totem de Gojo & otros texture packs');
  assert.equal(videos[2].short, true);
  assert.equal(videos[2].url, 'https://www.youtube.com/shorts/aaaaaaaaa03');
  assert.ok(Date.parse(videos[0].published) > 0);
  assert.deepEqual(social.parseYoutubeFeed('<feed><entry><yt:videoId>"><script></yt:videoId></entry></feed>'), []);
});

test('Twitch: live with its details and the past broadcasts', async () => {
  social.cache.clear();
  process.env.HAVIHUB_MOCK_TWITCH = 'live';
  const t = await social.socialFeed('twitch');
  assert.equal(t.details, true);
  assert.equal(t.live.title, 'Hardcore con subs');
  assert.equal(t.live.viewers, 37);
  assert.match(t.live.thumbnail, /^https:\/\/static-cdn\.jtvnw\.net\/previews-ttv\/live_user_havikun-440x248\.jpg\?t=\d+$/);
  assert.deepEqual(t.videos.map((v) => v.url), ['https://www.twitch.tv/videos/2001', 'https://www.twitch.tv/videos/2002', 'https://www.twitch.tv/videos/2003']);
  assert.equal(t.videos[0].seconds, 10230);
});

test('Twitch: offline, and what is left when the details are not available', async () => {
  social.cache.clear();
  process.env.HAVIHUB_MOCK_TWITCH = 'offline';
  const off = await social.socialFeed('twitch');
  assert.equal(off.live, null);
  assert.equal(off.videos.length, 3);
  // kept for 15 minutes: no second request
  process.env.HAVIHUB_MOCK_TWITCH = 'live';
  assert.equal((await social.socialFeed('twitch')).live, null);
  assert.ok((await social.socialFeed('twitch', { force: true })).live);
  social.cache.clear();
  process.env.HAVIHUB_MOCK_TWITCH = 'nodata';
  const bare = await social.socialFeed('twitch');
  assert.equal(bare.details, false);
  assert.ok(bare.live, 'the preview picture alone says the channel is live');
  assert.deepEqual(bare.videos, []);
  delete process.env.HAVIHUB_MOCK_TWITCH;
});

test('Linktree: the links of the page, or the last known ones', async () => {
  social.cache.clear();
  const l = await social.socialFeed('linktree');
  assert.equal(l.live, true);
  assert.deepEqual(l.links.map((x) => x.title), ['Sin Drama by Havikun', 'Server Discord', 'Sodium (Modrinth)', 'Fabric API (CurseForge)', 'Satoru Gojo Totem (Modrinth)']);
  const html = '<a data-testid="LinkButton" href="https://discord.gg/abc" class="x"><p>Mi <b>Discord</b></p></a><a href="javascript:alert(1)" data-testid="LinkButton">x</a>';
  assert.deepEqual(social.parseLinktree(html), [{ title: 'Mi Discord', url: 'https://discord.gg/abc' }]);
  assert.deepEqual(social.parseLinktree('<html>nothing</html>'), []);
  assert.equal(social.LINKTREE_KNOWN.length, 4);
  assert.equal(await social.socialFeed('instagram'), null, 'no feed for the embedded ones');
});

test('YouTube: when its feeds fail, the channel page gives the videos', async () => {
  const page = '<script>var ytInitialData = ' + JSON.stringify({ a: [{ videoRenderer: { videoId: 'abcdefghijk', title: { runs: [{ text: 'Uno' }] }, publishedTimeText: { simpleText: 'hace 2 días' }, viewCountText: { simpleText: '1.234 vistas' } } }, { lockupViewModel: { contentId: 'ABCDEFGHIJK', metadata: { lockupMetadataViewModel: { title: { content: 'Dos' } } } } }, { videoRenderer: { videoId: 'abcdefghijk', title: { simpleText: 'repetido' } } }] }) + ';</script>';
  const v = social.parseYoutubePage(page);
  assert.deepEqual(v.map((x) => [x.id, x.title, x.views]), [['abcdefghijk', 'Uno', 1234], ['ABCDEFGHIJK', 'Dos', 0]]);
  assert.equal(v[0].thumbnail, 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg');
  assert.deepEqual(social.parseYoutubePage('<html>nothing</html>'), []);
});

test('what was fetched is kept on disk and answered at once, fresh data follows', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-soc-')), 'social.json');
  fs.writeFileSync(file, JSON.stringify({ youtube: { at: 1, data: { videos: [{ id: 'old', title: 'guardado' }] } } }));
  const events = [];
  social.cache.clear();
  social.configure({ file, emit: (c, p) => events.push([c, p.id]) });
  const first = await social.socialFeed('youtube');
  assert.equal(first.videos[0].title, 'guardado'); // at once, from disk
  for (let i = 0; i < 100 && !events.length; i++) await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(events[0], ['social:feed', 'youtube']);
  assert.notEqual((await social.socialFeed('youtube')).videos[0].title, 'guardado');
  assert.match(fs.readFileSync(file, 'utf8'), /"youtube"/);
  social.configure({});
  social.cache.clear();
});

test('with the automatic loading off: only what is on disk, and nothing connects', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  let calls = 0;
  http.setFetch((...args) => {
    calls++;
    return mock.fetch(...args);
  });
  try {
    social.cache.clear();
    assert.equal(await social.socialFeed('youtube', { cachedOnly: true }), null);
    assert.equal(await social.socialFeed('twitch', { cachedOnly: true, force: true }), null);
    assert.equal(calls, 0);
    // what was kept on disk is shown, however old, without fetching it again
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-soc-')), 'social.json');
    fs.writeFileSync(file, JSON.stringify({ youtube: { at: 1, data: { videos: [{ id: 'old', title: 'guardado' }] } } }));
    social.configure({ file, emit: () => {} });
    const kept = await social.socialFeed('youtube', { cachedOnly: true });
    assert.equal(kept.videos[0].title, 'guardado');
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(calls, 0);
    // the person opens the channel: now it connects
    await social.socialFeed('youtube', { wait: true });
    assert.ok(calls > 0);
  } finally {
    http.setFetch(mock.fetch);
    social.configure({});
    social.cache.clear();
  }
});

test('the setting starts on, and a saved "off" survives the defaults', () => {
  const { DEFAULTS, deepMerge } = require('../src/main/appconfig');
  assert.equal(DEFAULTS.privacy.socialAutoload, true);
  assert.equal(DEFAULTS.privacy.socialAsked, false);
  const merged = deepMerge(structuredClone(DEFAULTS), { privacy: { socialAutoload: false, socialAsked: true } });
  assert.equal(merged.privacy.socialAutoload, false);
  assert.equal(merged.privacy.socialAsked, true);
  assert.equal(merged.privacy.maskServerIps, true);
});

test('links to projects on Modrinth and CurseForge are told apart from any other link', () => {
  const { parseProjectLink } = require('../src/shared/projectLink');
  assert.deepEqual(parseProjectLink('https://modrinth.com/resourcepack/satoru-gojo-totem'), { source: 'modrinth', type: 'resourcepack', slug: 'satoru-gojo-totem' });
  assert.deepEqual(parseProjectLink('https://www.curseforge.com/minecraft/texture-packs/Satoru-Gojo-Totem?x=1'), { source: 'curseforge', type: 'resourcepack', slug: 'satoru-gojo-totem' });
  assert.deepEqual(parseProjectLink('https://www.curseforge.com/minecraft/mc-mods/fabric-api/files/123'), { source: 'curseforge', type: 'mod', slug: 'fabric-api' });
  for (const other of ['https://discord.gg/abc', 'https://modrinth.com/user/havikun', 'https://www.curseforge.com/members/x', 'https://evil.example/modrinth.com/mod/x', 'javascript:alert(1)', 'nope']) assert.equal(parseProjectLink(other), null, other);
});
