#!/usr/bin/env node
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Finds the Chrome for Testing build to roll Chromium to, and names the roll.
// Changes nothing: the roll itself is `utils/roll_browser.js chromium <revision> <version>`.
// Run with --help for usage.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = `
usage: node utils/resolve_chromium_roll.mjs <beta|tip-of-tree>

Prints the roll of Chromium to the newest Chrome for Testing build of the channel:
the revision and the version for utils/roll_browser.js, the branch, the title and
the description of the roll PR. Prints nothing to roll when browsers.json is at that
build already, or when the origin remote has the roll branch already.

  beta         The roll that ships.
  tip-of-tree  Chrome Canary. This roll only runs the tests and never merges.

On GitHub Actions the same values go to the step outputs.
`;

const CHANNELS = {
  'beta': { cftChannel: 'Beta', branchPrefix: 'roll-chromium/' },
  'tip-of-tree': { cftChannel: 'Canary', branchPrefix: 'roll-chromium-tip-of-tree/' },
};

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}
const channel = CHANNELS[args[0]];
if (args.length !== 1 || !channel) {
  console.error(USAGE);
  process.exit(1);
}

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return await response.json();
}

function compareVersions(a, b) {
  const [partsA, partsB] = [a, b].map(v => v.split('.').map(Number));
  for (let i = 0; i < Math.max(partsA.length, partsB.length); ++i) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff)
      return diff;
  }
  return 0;
}

function remoteBranchExists(branch) {
  const output = execFileSync('git', ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`], { cwd: rootDir, encoding: 'utf8' });
  return !!output.trim();
}

function nothingToRoll(reason) {
  console.log(`Nothing to roll: ${reason}.`);
  process.exit(0);
}

const cft = await fetchJson('https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json');
const { version, revision: position } = cft.channels[channel.cftChannel];
// These values end up in a branch name and on a command line.
if (!/^\d+(\.\d+){3}$/.test(version) || !/^\d+$/.test(position))
  throw new Error(`Unexpected Chrome for Testing ${channel.cftChannel} build: ${JSON.stringify({ version, position })}`);

const browsersJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'packages', 'playwright-core', 'browsers.json'), 'utf8'));
const current = browsersJson.browsers.find(b => b.name === 'chromium');
if (compareVersions(version, current.browserVersion) <= 0)
  nothingToRoll(`${channel.cftChannel} is at ${version}, browsers.json is at ${current.browserVersion}`);

const branch = `${channel.branchPrefix}${version}`;
if (remoteBranchExists(branch))
  nothingToRoll(`branch ${branch} exists already`);

const nextRevision = parseInt(current.revision, 10) + 1;
let roll;
if (args[0] === 'beta') {
  roll = {
    revision: String(nextRevision),
    title: `feat(chromium): roll to ${version}`,
    summary: `Roll Chromium to ${version}, as v${nextRevision}. Please check all the bots for platform coverage.`,
  };
} else {
  roll = {
    revision: `tot-${nextRevision}`,
    title: `feat(chromium-tip-of-tree): roll to ${version} - DO NOT MERGE`,
    summary: `**DO NOT MERGE.** Playwright does not ship tip-of-tree Chromium.`,
  };
}
roll.branch = branch;

// The commit is a courtesy for the reader, the roll does not need it.
const dash = await fetchJson(`https://chromiumdash.appspot.com/fetch_version?version=${version}`).catch(() => undefined);
const commit = /^[0-9a-f]{40}$/.test(dash?.hashes?.chromium ?? '') ? dash.hashes.chromium : undefined;

roll.version = version;
roll.description = [
  roll.summary,
  ``,
  `- Version: ${current.browserVersion} → ${version}`,
  `- Chromium position: r${position}${commit ? `, commit [${commit.substring(0, 12)}](https://chromium.googlesource.com/chromium/src/+/${commit})` : ''}`,
  `- Upstream changes: https://chromium.googlesource.com/chromium/src/+log/${current.browserVersion}..${version}`,
].join('\n');

for (const name of ['revision', 'version', 'branch', 'title', 'description'])
  console.log(`${name}: ${roll[name]}`);

if (process.env.GITHUB_OUTPUT) {
  const delimiter = `EOF_${Date.now()}_${process.pid}`;
  const outputs = ['revision', 'version', 'branch', 'title', 'description'].map(name => `${name}<<${delimiter}\n${roll[name]}\n${delimiter}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, outputs.join(''));
}
