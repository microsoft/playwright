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
// @ts-check

// Moves a dist-tag (next, beta or latest) to the packages that publish_all_packages.sh published
// under "<tag>-pending", once all of them are live. npm processes a package after accepting it,
// and that took up to 110 minutes, so this waits for hours before giving up.
//
// usage: promote_npm_packages.js <npm-publish.json>

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const POLL_INTERVAL_MS = 60 * 1000;
const TIMEOUT_MS = 5 * 60 * 60 * 1000;

/** @type {{ version: string, tag: string, packages: string[] }} */
const { version, tag, packages } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const pendingTag = `${tag}-pending`;

/**
 * @param {string[]} args
 * @param {{ quiet?: boolean }} options
 */
function npm(args, { quiet = false } = {}) {
  return execFileSync('npm', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', quiet ? 'pipe' : 'inherit'] }).trim();
}

/** @param {string} name */
function isLive(name) {
  try {
    return npm(['view', `${name}@${version}`, 'version', '--prefer-online'], { quiet: true }) === version;
  } catch {
    return false;
  }
}

async function waitUntilLive() {
  const deadline = Date.now() + TIMEOUT_MS;
  let missing = packages;
  while (true) {
    missing = missing.filter(name => !isLive(name));
    if (!missing.length)
      return;
    if (Date.now() > deadline)
      throw new Error(`Not live after ${TIMEOUT_MS / 3600000} hours: ${missing.map(name => `${name}@${version}`).join(', ')}`);
    console.log(`Waiting for ${missing.map(name => `${name}@${version}`).join(', ')}`);
    await new Promise(f => setTimeout(f, POLL_INTERVAL_MS));
  }
}

function checkInstall() {
  // Install them together, as users do, to check that the tarballs download and the dependencies resolve.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-'));
  npm(['install', '--prefix', dir, '--ignore-scripts', '--no-audit', '--no-fund', ...packages.map(name => `${name}@${version}`)]);
  fs.rmSync(dir, { recursive: true, force: true });
}

function moveDistTags() {
  for (const name of packages) {
    const distTags = JSON.parse(npm(['view', name, 'dist-tags', '--json', '--prefer-online']));
    const current = distTags[tag];
    if (current === version) {
      console.log(`${name}@${tag} is already ${version}`);
    } else if (current && publishTime(name, current) > publishTime(name, version)) {
      // A later run promoted a newer version first.
      console.log(`${name}@${tag} stays at ${current}, which was published after ${version}`);
    } else {
      npm(['dist-tag', 'add', `${name}@${version}`, tag]);
    }
    if (distTags[pendingTag] === version)
      npm(['dist-tag', 'rm', name, pendingTag]);
  }
}

/** @type {Map<string, Record<string, string>>} */
const publishTimes = new Map();

/**
 * @param {string} name
 * @param {string} packageVersion
 */
function publishTime(name, packageVersion) {
  if (!publishTimes.has(name))
    publishTimes.set(name, JSON.parse(npm(['view', name, 'time', '--json', '--prefer-online'])));
  return publishTimes.get(name)?.[packageVersion] ?? '';
}

(async () => {
  console.log(`Promoting ${version} to @${tag}: ${packages.join(', ')}`);
  await waitUntilLive();
  checkInstall();
  moveDistTags();
  console.log('Done.');
})().catch(error => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
