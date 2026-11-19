// Builds build/helper/havihub-windows.exe (the engine window helper, Windows
// only) with Zig's C compiler, which cross-compiles from Linux too:
//   pip install ziglang   (or have "zig" on PATH)
//   node scripts/build-helper.mjs [--test]
// --test also builds build/helper/test/*.exe (used by scripts/helper-test.mjs).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'build', 'helper');

function zig() {
  for (const [cmd, pre] of [
    ['zig', []],
    ['python3', ['-m', 'ziglang']],
    ['python', ['-m', 'ziglang']],
  ]) {
    try {
      execFileSync(cmd, [...pre, 'version'], { stdio: 'ignore' });
      return [cmd, pre];
    } catch {
      /* try the next one */
    }
  }
  throw new Error('Zig no está instalado (pip install ziglang)');
}

const [cmd, pre] = zig();
const cc = (args) => execFileSync(cmd, [...pre, 'cc', '-target', 'x86_64-windows-gnu', ...args], { cwd: dir, stdio: 'inherit' });

cc(['-Os', '-s', '-Wall', 'havihub-windows.c', 'havihub-windows.rc', '-o', 'havihub-windows.exe', '-luser32', '-lshell32', '-lole32', '-Wl,--subsystem,windows']);
console.log('built', path.join(dir, 'havihub-windows.exe'), fs.statSync(path.join(dir, 'havihub-windows.exe')).size, 'bytes');

if (process.argv.includes('--test')) {
  fs.mkdirSync(path.join(dir, 'test'), { recursive: true });
  cc(['-O1', '-Wall', 'test/fakeprism.c', '-o', 'test/prismlauncher.exe', '-luser32', '-lshell32']);
  cc(['-O1', '-Wall', '-DHH_TEST_MAIN', 'test/rewrite-test.c', '-o', 'test/rewrite-test.exe', '-luser32', '-lshell32', '-lole32']);
  console.log('built test programs');
}
