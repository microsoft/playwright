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
const fs = require('fs');
const https = require('https');
const path = require('path');
const { URL } = require('url');

const MIN_AGE_DAYS = 7;
const MIN_AGE_MS = MIN_AGE_DAYS * 24 * 60 * 60 * 1000;
const CONCURRENCY = 12;

/**
 * @returns {string}
 */
function resolveRegistry() {
  const fromEnv = process.env.npm_config_registry;
  if (fromEnv)
    return fromEnv.endsWith('/') ? fromEnv : fromEnv + '/';
  return 'https://registry.npmjs.org/';
}

/**
 * @param {string} lockfilePath
 * @returns {Map<string, Set<string>>}
 */
function lockedVersions(lockfilePath) {
  const lock = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
  /** @type {Map<string, Set<string>>} */
  const byName = new Map();
  for (const [location, entry] of Object.entries(lock.packages || {})) {
    if (!location || !entry || typeof entry !== 'object')
      continue;
    const pkg = /** @type {{ version?: string, resolved?: string, link?: boolean }} */ (entry);
    if (pkg.link || !pkg.version || !pkg.resolved)
      continue;
    if (!pkg.resolved.includes('registry.npmjs.org'))
      continue;
    const parts = location.split('node_modules/').filter(Boolean);
    const name = parts[parts.length - 1];
    if (!name)
      continue;
    let versions = byName.get(name);
    if (!versions) {
      versions = new Set();
      byName.set(name, versions);
    }
    versions.add(pkg.version);
  }
  return byName;
}

/**
 * @param {string} registry
 * @param {import('https').Agent} agent
 * @param {string} name
 * @param {number} attempt
 * @returns {Promise<any>}
 */
function fetchPackument(registry, agent, name, attempt = 0) {
  const url = new URL(registry + name.replace('/', '%2f'));
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      agent,
      headers: { accept: 'application/json', 'user-agent': 'playwright-check-package-age' },
      timeout: 60_000,
    }, res => {
      /** @type {Buffer[]} */
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if ((res.statusCode === 429 || (res.statusCode && res.statusCode >= 500)) && attempt < 4) {
          setTimeout(() => {
            fetchPackument(registry, agent, name, attempt + 1).then(resolve, reject);
          }, 500 * (attempt + 1));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch ${name}: HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Failed to parse packument for ${name}: ${/** @type {Error} */ (error).message}`));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`Timed out fetching ${name}`)));
    req.on('error', error => {
      if (attempt < 4) {
        setTimeout(() => {
          fetchPackument(registry, agent, name, attempt + 1).then(resolve, reject);
        }, 500 * (attempt + 1));
        return;
      }
      reject(error);
    });
  });
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T) => Promise<void>} worker
 */
async function mapPool(items, concurrency, worker) {
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index++;
      await worker(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
}

async function main() {
  const lockfilePath = path.join(__dirname, '..', 'package-lock.json');
  const byName = lockedVersions(lockfilePath);
  const names = [...byName.keys()].sort();
  const registry = resolveRegistry();
  const agent = new https.Agent({ keepAlive: true, maxSockets: CONCURRENCY });
  const now = Date.now();

  /** @type {{ name: string, version: string, published: string, ageDays: number }[]} */
  const tooNew = [];
  /** @type {string[]} */
  const missing = [];
  /** @type {string[]} */
  const fetchErrors = [];

  console.log(`Checking ${names.length} packages from package-lock.json against ${registry}`);
  console.log(`Minimum release age: ${MIN_AGE_DAYS} days`);

  await mapPool(names, CONCURRENCY, async name => {
    let packument;
    try {
      packument = await fetchPackument(registry, agent, name);
    } catch (error) {
      fetchErrors.push(`${name}: ${/** @type {Error} */ (error).message}`);
      return;
    }
    for (const version of byName.get(name) || []) {
      const published = packument.time?.[version];
      if (!published) {
        missing.push(`${name}@${version}`);
        continue;
      }
      const ageMs = now - Date.parse(published);
      if (Number.isNaN(ageMs)) {
        missing.push(`${name}@${version} (invalid time ${published})`);
        continue;
      }
      if (ageMs < MIN_AGE_MS) {
        tooNew.push({
          name,
          version,
          published,
          ageDays: ageMs / (24 * 60 * 60 * 1000),
        });
      }
    }
  });

  agent.destroy();
  tooNew.sort((a, b) => a.ageDays - b.ageDays);

  if (fetchErrors.length) {
    console.error('\nFailed to fetch packuments:');
    for (const line of fetchErrors)
      console.error(`  ${line}`);
  }
  if (missing.length) {
    console.error('\nMissing publish time in registry:');
    for (const line of missing)
      console.error(`  ${line}`);
  }
  if (tooNew.length) {
    console.error(`\nPackages younger than ${MIN_AGE_DAYS} days:`);
    for (const entry of tooNew)
      console.error(`  ${entry.name}@${entry.version} published ${entry.published} (${entry.ageDays.toFixed(1)} days ago)`);
  }

  if (fetchErrors.length || missing.length || tooNew.length) {
    console.error(`\nPackage age check failed. Only pin versions at least ${MIN_AGE_DAYS} days old (see Dependabot cooldown).`);
    process.exit(1);
  }

  console.log(`All ${names.length} packages are at least ${MIN_AGE_DAYS} days old.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
