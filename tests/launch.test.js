// How a game ended: a crash (with the file that tells why), a game that could
// not start, or the player closing it (normally or by force).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Launcher } = require('../src/main/prism/launch');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'havihub-launch-'));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function game(name, files = {}) {
  const dir = path.join(tmp, name);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const launcherFor = (dir) => new Launcher(() => null, () => {}, { gameDir: async () => dir });
const started = (preparing = false) => ({ startedAt: Date.now() - 60000, preparing });
const PLAYING = '[12:00:01] [Render thread/INFO]: Loaded 1234 advancements\n[12:05:00] [Server thread/INFO]: Saving chunks for level\n';

test('a crash report written during the game is a crash, and it is the file shown', async () => {
  const dir = game('report', { 'crash-reports/crash-2026-11-18_20.10.00-client.txt': '---- Minecraft Crash Report ----', 'logs/latest.log': PLAYING });
  const end = await launcherFor(dir).howItEnded('x', started(), 255);
  assert.deepEqual(end, { kind: 'crash', file: 'crash-reports/crash-2026-11-18_20.10.00-client.txt' });
});

test('a crash report from an earlier game does not count', async () => {
  const dir = game('old-report', { 'crash-reports/crash-old.txt': 'old', 'logs/latest.log': `${PLAYING}[12:06:00] [Render thread/INFO]: Stopping!\n` });
  const old = new Date(Date.now() - 3600 * 1000);
  fs.utimesSync(path.join(dir, 'crash-reports', 'crash-old.txt'), old, old);
  assert.deepEqual(await launcherFor(dir).howItEnded('x', started(), 0), { kind: 'closed' });
});

test("Java's own crash file (hs_err_pid) is a crash", async () => {
  const dir = game('jvm', { 'hs_err_pid4242.log': '# A fatal error has been detected by the Java Runtime Environment', 'logs/latest.log': PLAYING });
  assert.deepEqual(await launcherFor(dir).howItEnded('x', started(), 1), { kind: 'crash', file: 'hs_err_pid4242.log' });
});

test('a game that never got to write its log could not start', async () => {
  const dir = game('no-start');
  assert.deepEqual(await launcherFor(dir).howItEnded('x', started(true), 1), { kind: 'failed' });
});

test('an error at the end of the log is a crash', async () => {
  const dir = game('log-error', { 'logs/latest.log': `${PLAYING}[12:05:01] [main/FATAL]: Mixin apply failed\njava.lang.RuntimeException: boom\n\tat x.y(Z.java:1)\n` });
  assert.deepEqual(await launcherFor(dir).howItEnded('x', started(), 1), { kind: 'crash', file: 'logs/latest.log' });
});

test('closing the game, normally or by force, is not reported', async () => {
  const quit = game('quit', { 'logs/latest.log': `${PLAYING}[12:06:00] [Render thread/INFO]: Stopping!\n` });
  assert.deepEqual(await launcherFor(quit).howItEnded('x', started(), 0), { kind: 'closed' });
  // some modded games end with an error code after a normal stop
  assert.deepEqual(await launcherFor(quit).howItEnded('x', started(), 1), { kind: 'closed' });
  // ended from the task manager: a calm log, no report
  const killed = game('killed', { 'logs/latest.log': PLAYING });
  assert.deepEqual(await launcherFor(killed).howItEnded('x', started(), 1), { kind: 'closed' });
});
