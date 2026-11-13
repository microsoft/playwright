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
// A version that is too new is allowed when it fixes an advisory of high or
// critical severity, and no version that is old enough fixes it. For each
// version that is too new, the script prints the advisories that it fixes, and
// the oldest version that fixes them.
//
// Usage: node utils/check_dependency_age.js

const fs = require('fs');
const path = require('path');

const MAX_AGE_DAYS = 7;
const REGISTRY = 'https://registry.npmjs.org/';
const ADVISORIES = REGISTRY + '-/npm/v1/security/advisories/bulk';
const CONCURRENCY = 16;
const MAX_VERSIONS_TO_CHECK = 20;
const DAY = 24 * 60 * 60 * 1000;
const URGENT_SEVERITIES = ['high', 'critical'];

/**
 * @param {string} url
 * @param {RequestInit=} init
 * @returns {Promise<any>}
 */
async function fetchJson(url, init) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
      if (!response.ok)
        throw new Error(`${url}: HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * @param {string} version
 * @returns {number[]|undefined}
 */
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : undefined;
}

/**
 * @param {string} name
 * @param {string} version
 * @returns {Promise<{ id: string, severity: string }[]>}
 */
async function advisoriesFor(name, version) {
  const result = await fetchJson(ADVISORIES, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ [name]: [version] }),
  });
  return (result[name] || []).map(advisory => ({ id: advisory.url.split('/').pop(), severity: advisory.severity }));
}

/**
 * Walks down from the given version, and stops at the first version that has
 * an advisory. The version above it is the oldest one that fixes the
 * advisories.
 *
 * @param {string} name
 * @param {string} version
 * @param {Record<string, string>} time
 * @param {number} cutoff
 * @returns {Promise<{ urgent: boolean, text: string }>}
 */
async function fixedAdvisories(name, version, time, cutoff) {
  const current = parseVersion(version);
  if (!current)
    return { urgent: false, text: '' };
  const older = Object.keys(time)
      .map(v => ({ version: v, parsed: parseVersion(v) }))
      .filter(c => c.parsed && c.parsed[0] === current[0])
      .filter(c => (c.parsed[1] - current[1] || c.parsed[2] - current[2]) < 0)
      .sort((a, b) => b.parsed[1] - a.parsed[1] || b.parsed[2] - a.parsed[2])
      .slice(0, MAX_VERSIONS_TO_CHECK)
      .map(c => c.version);
  const [remaining, ...advisories] = await Promise.all([version, ...older].map(v => advisoriesFor(name, v)));
  const firstVulnerable = advisories.findIndex(list => list.length);
  if (firstVulnerable === -1)
    return { urgent: false, text: '' };
  const fixed = advisories[firstVulnerable].filter(a => !remaining.some(r => r.id === a.id));
  if (!fixed.length)
    return { urgent: false, text: '' };
  const oldest = firstVulnerable ? older[firstVulnerable - 1] : version;
  const published = new Date(time[oldest]);
  const age = Math.floor((Date.now() - published.getTime()) / DAY);
  return {
    urgent: published.getTime() > cutoff && fixed.some(a => URGENT_SEVERITIES.includes(a.severity)),
    text: `\n  Version ${oldest}, published on ${published.toISOString().slice(0, 10)}, ${age} days ago, is the oldest one that fixes:` +
        fixed.map(a => `\n    ${a.id} (${a.severity})`).join(''),
  };
}

async function main() {
  const lock = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
  const problems = [];
  /** @type {{ nodePath: string, name: string, version: string, published: Date, time: Record<string, string> }[]} */
  const tooNew = [];

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

  const cutoff = Date.now() - MAX_AGE_DAYS * DAY;
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
          tooNew.push({ nodePath, name, version, published, time });
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const allowed = [];
  for (const { nodePath, name, version, published, time } of tooNew) {
    const { urgent, text } = await fixedAdvisories(name, version, time, cutoff);
    const message = `${nodePath}@${version} was published on ${published.toISOString().slice(0, 10)}, less than ${MAX_AGE_DAYS} days ago`;
    if (urgent)
      allowed.push(`${message}. It is allowed, because it fixes an advisory of high or critical severity, and no version that is old enough fixes it.${text}`);
    else
      problems.push(`${message}.${text}`);
  }
  for (const message of allowed.sort())
    console.log(message + '\n');

  if (problems.length) {
    for (const problem of problems.sort())
      console.error(problem);
    console.error(`\nEvery version in package-lock.json must be at least ${MAX_AGE_DAYS} days old, unless only a newer version fixes an advisory of high or critical severity. Pick an older version, or wait.`);
    process.exit(1);
  }
  console.log(`All ${names.length} packages in package-lock.json are at least ${MAX_AGE_DAYS} days old${allowed.length ? ', or fix an advisory of high or critical severity' : ''}.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
