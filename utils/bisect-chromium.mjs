#!/usr/bin/env node
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Bisect Chrome for Testing per-commit builds between a known-good and a
// known-bad revision. Run with --help for usage.

import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseArgs } from 'util';

const BUCKET = 'https://storage.googleapis.com/chrome-for-testing-per-commit-public';
const DEFAULT_CHECK = 'npm run ctest';

const HELP = `Bisect Chrome for Testing per-commit builds.

Usage:
  node utils/bisect-chromium.mjs --good <rev> --bad <rev> [--check <command>]
      Bisect between the revisions to find the last good and first bad build.

  node utils/bisect-chromium.mjs <rev> [--check <command>]
      Single-revision mode: download, extract and check just that build,
      showing full output of the check command. Exits 0 if good, 1 if bad.

Options:
  --good <rev>       Known good revision (required for bisect mode).
  --bad <rev>        Known bad revision (required for bisect mode).
  --check <command>  Shell command that decides whether a build is good:
                     run with CRPATH set to the browser executable, exit
                     code 0 means good. Default:
                     ${DEFAULT_CHECK}
  --headed           Use the full Chrome for Testing build instead of the
                     default chrome-headless-shell build.
  --help             Show this help.

Builds are cached in /tmp/chromium-r<rev>-<headless|headed> and reused on
subsequent runs.
The platform (${detectPlatform()}) is auto-detected.`;

function detectPlatform() {
  const { platform, arch } = process;
  if (platform === 'darwin')
    return arch === 'arm64' ? 'mac-arm64' : 'mac-x64';
  if (platform === 'linux')
    return 'linux64';
  if (platform === 'win32')
    return arch === 'x64' ? 'win64' : 'win32';
  throw new Error(`Unsupported platform: ${platform}/${arch}`);
}

const PLATFORM = detectPlatform();

function parseRevision(value, name) {
  const rev = Number(String(value).replace(/^r/, ''));
  if (!Number.isInteger(rev) || rev <= 0)
    throw new Error(`Invalid ${name} revision: ${value}`);
  return rev;
}

async function listRevisions(good, bad) {
  const revisions = [];
  let marker = `${PLATFORM}/r${good - 1}`;
  while (true) {
    const url = `${BUCKET}/?delimiter=/&prefix=${PLATFORM}/r&marker=${encodeURIComponent(marker)}`;
    const text = await (await fetch(url)).text();
    for (const m of text.matchAll(new RegExp(`<Prefix>${PLATFORM}/r(\\d+)/</Prefix>`, 'g'))) {
      const rev = Number(m[1]);
      if (rev >= good && rev <= bad)
        revisions.push(rev);
    }
    const next = text.match(/<NextMarker>([^<]+)<\/NextMarker>/);
    if (!next)
      break;
    marker = next[1];
    const nextRev = Number(marker.match(/r(\d+)/)?.[1] ?? NaN);
    if (nextRev > bad)
      break;
  }
  return revisions.sort((a, b) => a - b);
}

function findExecutable(dir) {
  const exeName = PLATFORM.startsWith('win') ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const entry of fs.readdirSync(d)) {
      const p = path.join(d, entry);
      if (HEADED) {
        if (PLATFORM.startsWith('mac') && entry.endsWith('.app')) {
          const exeDir = path.join(p, 'Contents', 'MacOS');
          return path.join(exeDir, fs.readdirSync(exeDir)[0]);
        }
        if (PLATFORM === 'linux64' && entry === 'chrome')
          return p;
        if (PLATFORM.startsWith('win') && entry === 'chrome.exe')
          return p;
      } else if (entry === exeName) {
        return p;
      }
      if (fs.statSync(p).isDirectory())
        stack.push(p);
    }
  }
  throw new Error(`No browser executable found under ${dir}`);
}

function prepareBuild(rev) {
  const dir = path.join(os.tmpdir(), `chromium-r${rev}-${HEADED ? 'headed' : 'headless'}`);
  const marker = path.join(dir, '.ready');
  if (!fs.existsSync(marker)) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const zip = path.join(dir, 'build.zip');
    const zipName = HEADED ? `chrome-${PLATFORM}.zip` : `chrome-headless-shell-${PLATFORM}.zip`;
    const url = `${BUCKET}/${PLATFORM}/r${rev}/${zipName}`;
    console.log(`  downloading ${url}`);
    execFileSync('curl', ['-sf', '-o', zip, url], { stdio: 'inherit' });
    execFileSync('unzip', ['-q', zip, '-d', dir]);
    fs.rmSync(zip);
    if (PLATFORM.startsWith('mac'))
      execFileSync('xattr', ['-cr', dir]);
    fs.writeFileSync(marker, '');
  }
  return findExecutable(dir);
}

function isGood(rev, check, { verbose = false } = {}) {
  const exe = prepareBuild(rev);
  console.log(`  running with CRPATH=${exe}: ${check}`);
  const result = spawnSync(check, {
    shell: true,
    env: { ...process.env, CRPATH: exe, PLAYWRIGHT_HTML_OPEN: 'never' },
    encoding: verbose ? undefined : 'utf8',
    stdio: verbose ? 'inherit' : 'pipe',
  });
  const good = result.status === 0;
  if (!good && !verbose) {
    const tail = (result.stdout || '').split('\n').slice(-15).join('\n');
    console.log(tail);
  }
  console.log(`  r${rev}: ${good ? 'GOOD' : 'BAD'}`);
  return good;
}

const { values: options, positionals } = parseArgs({
  options: {
    good: { type: 'string' },
    bad: { type: 'string' },
    check: { type: 'string', default: DEFAULT_CHECK },
    headed: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
  allowPositionals: true,
});

const HEADED = options.headed;

if (options.help) {
  console.log(HELP);
  process.exit(0);
}

// Single-revision mode.
if (positionals.length === 1) {
  const rev = parseRevision(positionals[0], 'requested');
  process.exit(isGood(rev, options.check, { verbose: true }) ? 0 : 1);
}
if (positionals.length > 1)
  throw new Error(`Expected at most one positional argument, got: ${positionals.join(' ')}`);

if (!options.good || !options.bad)
  throw new Error('Both --good and --bad are required for bisect mode. See --help.');
const good = parseRevision(options.good, '--good');
const bad = parseRevision(options.bad, '--bad');
if (good >= bad)
  throw new Error(`--good (${good}) must be smaller than --bad (${bad}).`);

const revisions = await listRevisions(good, bad);
console.log(`Found ${revisions.length} available ${PLATFORM} builds in [${good}, ${bad}]`);
if (revisions.length < 2)
  throw new Error('Not enough builds available to bisect.');
if (revisions[0] !== good)
  console.warn(`Warning: good revision r${good} has no build; nearest is r${revisions[0]}`);
if (revisions[revisions.length - 1] !== bad)
  console.warn(`Warning: bad revision r${bad} has no build; nearest is r${revisions[revisions.length - 1]}`);

console.log(`Verifying endpoints...`);
console.log(`Checking good endpoint r${revisions[0]}`);
if (!isGood(revisions[0], options.check))
  throw new Error(`Supposedly good revision r${revisions[0]} is BAD; aborting.`);
console.log(`Checking bad endpoint r${revisions[revisions.length - 1]}`);
if (isGood(revisions[revisions.length - 1], options.check))
  throw new Error(`Supposedly bad revision r${revisions[revisions.length - 1]} is GOOD; aborting.`);

let lo = 0; // known good index
let hi = revisions.length - 1; // known bad index
while (hi - lo > 1) {
  const mid = (lo + hi) >> 1;
  console.log(`\nBisecting r${revisions[mid]} (${hi - lo - 1} candidates left, ~${Math.ceil(Math.log2(hi - lo))} steps)`);
  if (isGood(revisions[mid], options.check))
    lo = mid;
  else
    hi = mid;
}

console.log(`\n=== RESULT ===`);
console.log(`Last good build:  r${revisions[lo]}`);
console.log(`First bad build:  r${revisions[hi]}`);
console.log(`Commits: https://crrev.com/${revisions[lo]} .. https://crrev.com/${revisions[hi]}`);
