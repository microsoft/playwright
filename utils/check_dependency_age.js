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

// @ts-check

// Fails when package-lock.json resolves any package to a version that was
// published less than MAX_AGE_DAYS ago. A version that is only a few days old
// has not been looked at by anyone yet, so a compromised release would reach
// us before it is reported. The playwright-audit-deps skill rolls dependencies
// with the same rule, see .claude/skills/playwright-audit-deps/SKILL.md.
//
// Usage: node utils/check_dependency_age.js

const fs = require('fs');
const path = require('path');

const MAX_AGE_DAYS = 7;
const REGISTRY = 'https://registry.npmjs.org/';
const CONCURRENCY = 16;

/**
 * @param {string} url
 * @returns {Promise<any>}
 */
async function fetchJson(url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok)
        throw new Error(`${url}: HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function main() {
  const lock = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
  const problems = [];

  /** @type {Map<string, { nodePath: string, version: string }[]>} */
  const byName = new Map();
  for (const [nodePath, entry] of Object.entries(lock.packages)) {
    if (!nodePath || entry.link || !entry.resolved)
      continue; // The root and the workspace packages.
    if (!entry.resolved.startsWith(REGISTRY)) {
      problems.push(`${nodePath}@${entry.version} is not from ${REGISTRY}, so its publish date cannot be checked: ${entry.resolved}`);
      continue;
    }
    const name = nodePath.slice(nodePath.lastIndexOf('node_modules/') + 'node_modules/'.length);
    if (!byName.has(name))
      byName.set(name, []);
    byName.get(name).push({ nodePath, version: entry.version });
  }

  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const names = [...byName.keys()];
  let next = 0;
  const worker = async () => {
    while (next < names.length) {
      const name = names[next++];
      const { time } = await fetchJson(REGISTRY + name.replace('/', '%2F'));
      for (const { nodePath, version } of byName.get(name)) {
        const published = time?.[version] ? new Date(time[version]) : undefined;
        if (!published)
          problems.push(`${nodePath}@${version} has no publish date in the registry`);
        else if (published.getTime() > cutoff)
          problems.push(`${nodePath}@${version} was published on ${published.toISOString().slice(0, 10)}, less than ${MAX_AGE_DAYS} days ago`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (problems.length) {
    for (const problem of problems.sort())
      console.error(problem);
    console.error(`\nEvery version in package-lock.json must be at least ${MAX_AGE_DAYS} days old. Pick an older version, or wait.`);
    process.exit(1);
  }
  console.log(`All ${names.length} packages in package-lock.json are at least ${MAX_AGE_DAYS} days old.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
