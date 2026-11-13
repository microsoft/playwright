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

// Prints the draft notes of a patch release, for publish_manual.yml: the issues that the commits
// since the previous release fixed, and the browser versions when browsers.json changed.
// Run it before the commit that sets the new version.
//
// usage: draft_patch_release_notes.js <previous-release-tag>
//
// Needs the gh CLI with a token that can read the issues and pull requests of the repository.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_PATH = path.join(__dirname, '..');
const REPOSITORY = 'microsoft/playwright';
const BROWSERS_JSON = 'packages/playwright-core/browsers.json';
const BROWSER_TITLES = { chromium: 'Chromium', firefox: 'Mozilla Firefox', webkit: 'WebKit' };

/**
 * @param {string} command
 * @param {string[]} args
 */
function run(command, args) {
  return execFileSync(command, args, { cwd: ROOT_PATH, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}

/**
 * @param {string} previousTag
 * @returns {number[][]} The pull requests of each commit, oldest commit first.
 */
function listPullRequests(previousTag) {
  const log = run('git', ['log', '--reverse', '--format=%s', `${previousTag}..HEAD`]);
  return log.split('\n').filter(Boolean).map(subject => {
    // "cherry-pick(#123): fix: foo (#456)" came from the pull request 123, "fix: foo (#123)" is the pull request 123.
    const cherryPick = subject.match(/^cherry-pick\(([^)]*)\)/);
    if (cherryPick)
      return [...cherryPick[1].matchAll(/#(\d+)/g)].map(match => +match[1]);
    const squash = subject.match(/\(#(\d+)\)$/);
    return squash ? [+squash[1]] : [];
  });
}

/**
 * @param {number[]} pullRequests
 * @returns {Map<number, { number: number, title: string, url: string, repository: { nameWithOwner: string } }[]>}
 */
function fetchFixedIssues(pullRequests) {
  const result = new Map();
  if (!pullRequests.length)
    return result;
  const [owner, name] = REPOSITORY.split('/');
  // A number can belong to an issue: issueOrPullRequest returns an empty object for it instead of an error.
  const query = `query {
    repository(owner: "${owner}", name: "${name}") {
      ${pullRequests.map(number => `pr${number}: issueOrPullRequest(number: ${number}) {
        ... on PullRequest { closingIssuesReferences(first: 50) { nodes { number title url repository { nameWithOwner } } } }
      }`).join('\n')}
    }
  }`;
  let output;
  try {
    output = run('gh', ['api', 'graphql', '-f', `query=${query}`]);
  } catch (error) {
    // gh fails when a number in a commit title does not exist, and still prints the other results.
    output = error.stdout;
  }
  const repository = JSON.parse(output || '{}').data?.repository;
  if (!repository)
    throw new Error('Failed to fetch the pull requests from GitHub');
  for (const number of pullRequests)
    result.set(number, repository[`pr${number}`]?.closingIssuesReferences?.nodes ?? []);
  return result;
}

/** @param {string} previousTag */
function browserVersions(previousTag) {
  // Compares with the working tree, because `npm run doc` can update the versions in browsers.json.
  if (!run('git', ['diff', '--name-only', previousTag, '--', BROWSERS_JSON]))
    return [];
  const { browsers } = JSON.parse(fs.readFileSync(path.join(ROOT_PATH, BROWSERS_JSON), 'utf8'));
  return Object.entries(BROWSER_TITLES).map(([name, title]) => {
    const browser = browsers.find(browser => browser.name === name);
    return `- ${title} ${browser.browserVersion}`;
  });
}

const previousTag = process.argv[2];
if (!previousTag) {
  console.error('usage: draft_patch_release_notes.js <previous-release-tag>');
  process.exit(1);
}

const pullRequests = listPullRequests(previousTag);
if (!pullRequests.length) {
  console.error(`ERROR: there are no commits after ${previousTag}`);
  process.exit(1);
}

const fixedIssues = fetchFixedIssues([...new Set(pullRequests.flat())]);
/** @type {Map<string, string>} */
const issueLines = new Map();
for (const issue of pullRequests.flat().flatMap(number => fixedIssues.get(number) ?? [])) {
  const reference = issue.repository.nameWithOwner === REPOSITORY ? `#${issue.number}` : `${issue.repository.nameWithOwner}#${issue.number}`;
  issueLines.set(issue.url, `- ${reference} ${issue.title}`);
}

const sections = [];
if (issueLines.size)
  sections.push(['### Bug Fixes', '', ...issueLines.values()]);
const versions = browserVersions(previousTag);
if (versions.length)
  sections.push(['### Browser Versions', '', ...versions]);

console.log(sections.map(section => section.join('\n')).join('\n\n'));
