#!/usr/bin/env node
/**
 * Copyright 2018 Google Inc. All rights reserved.
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

const URL = require('url');
const debug = require('debug');
const playwright = require('..');
const browserFetcher = playwright.chromium._createBrowserFetcher();
const path = require('path');
const fs = require('fs');
const {fork} = require('child_process');

const COLOR_RESET = '\x1b[0m';
const COLOR_RED = '\x1b[31m';
const COLOR_GREEN = '\x1b[32m';
const COLOR_YELLOW = '\x1b[33m';

const argv = require('minimist')(process.argv.slice(2), {});

const help = `
Usage:
  node bisect.js --good <revision> --bad <revision> <script>

Parameters:
  --good    revision that is known to be GOOD
  --bad     revision that is known to be BAD
  <script>  path to the script that returns non-zero code for BAD revisions and 0 for good

Example:
  node utils/bisect.js --good 577361 --bad 599821 simple.js
`;

if (argv.h || argv.help) {
  console.log(help);
  process.exit(0);
}

if (typeof argv.good !== 'number') {
  console.log(COLOR_RED + 'ERROR: expected --good argument to be a number' + COLOR_RESET);
  console.log(help);
  process.exit(1);
}

if (typeof argv.bad !== 'number') {
  console.log(COLOR_RED + 'ERROR: expected --bad argument to be a number' + COLOR_RESET);
  console.log(help);
  process.exit(1);
}

const scriptPath = path.resolve(argv._[0]);
if (!fs.existsSync(scriptPath)) {
  console.log(COLOR_RED + 'ERROR: Expected to be given a path to a script to run' + COLOR_RESET);
  console.log(help);
  process.exit(1);
}

(async(scriptPath, good, bad) => {
  const span = Math.abs(good - bad);
  console.log(`Bisecting ${COLOR_YELLOW}${span}${COLOR_RESET} revisions in ${COLOR_YELLOW}~${span.toString(2).length}${COLOR_RESET} iterations`);

  while (true) {
    const middle = Math.round((good + bad) / 2);
    const revision = await findDownloadableRevision(middle, good, bad);
    if (!revision || revision === good || revision === bad)
      break;
    let info = browserFetcher.revisionInfo(revision);
    const shouldRemove = !info.local;
    info = await downloadRevision(revision);
    const exitCode = await runScript(scriptPath, info);
    if (shouldRemove)
      await browserFetcher.remove(revision);
    let outcome;
    if (exitCode) {
      bad = revision;
      outcome = COLOR_RED + 'BAD' + COLOR_RESET;
    } else {
      good = revision;
      outcome = COLOR_GREEN + 'GOOD' + COLOR_RESET;
    }
    const span = Math.abs(good - bad);
    let fromText = '';
    let toText = '';
    if (good < bad) {
      fromText = COLOR_GREEN + good + COLOR_RESET;
      toText = COLOR_RED + bad + COLOR_RESET;
    } else {
      fromText = COLOR_RED + bad + COLOR_RESET;
      toText = COLOR_GREEN + good + COLOR_RESET;
    }
    console.log(`- ${COLOR_YELLOW}r${revision}${COLOR_RESET} was ${outcome}. Bisecting [${fromText}, ${toText}] - ${COLOR_YELLOW}${span}${COLOR_RESET} revisions and ${COLOR_YELLOW}~${span.toString(2).length}${COLOR_RESET} iterations`);
  }

  const [fromSha, toSha] = await Promise.all([
    revisionToSha(Math.min(good, bad)),
    revisionToSha(Math.max(good, bad)),
  ]);
  console.log(`RANGE: https://chromium.googlesource.com/chromium/src/+log/${fromSha}..${toSha}`);
})(scriptPath, argv.good, argv.bad);

function runScript(scriptPath, revisionInfo) {
  const log = debug('bisect:runscript');
  log('Running script');
  const child = fork(scriptPath, [], {
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    env: {
      ...process.env,
      PLAYWRIGHT_EXECUTABLE_PATH: revisionInfo.executablePath,
    },
  });
  return new Promise((resolve, reject) => {
    child.on('error', err => reject(err));
    child.on('exit', code => resolve(code));
  });
}

async function downloadRevision(revision) {
  const log = debug('bisect:download');
  log(`Downloading ${revision}`);
  let progressBar = null;
  let lastDownloadedBytes = 0;
  return await browserFetcher.download(revision, (downloadedBytes, totalBytes) => {
    if (!progressBar) {
      const ProgressBar = require('progress');
      progressBar = new ProgressBar(`- downloading Chromium r${revision} - ${toMegabytes(totalBytes)} [:bar] :percent :etas `, {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: totalBytes,
      });
    }
    const delta = downloadedBytes - lastDownloadedBytes;
    lastDownloadedBytes = downloadedBytes;
    progressBar.tick(delta);
  });
  function toMegabytes(bytes) {
    const mb = bytes / 1024 / 1024;
    return `${Math.round(mb * 10) / 10} Mb`;
  }
}

async function findDownloadableRevision(rev, from, to) {
  const log = debug('bisect:findrev');
  const min = Math.min(from, to);
  const max = Math.max(from, to);
  log(`Looking around ${rev} from [${min}, ${max}]`);
  if (await browserFetcher.canDownload(rev))
    return rev;
  let down = rev;
  let up = rev;
  while (min <= down || up <= max) {
    const [downOk, upOk] = await Promise.all([
      down > min ? probe(--down) : Promise.resolve(false),
      up < max ? probe(++up) : Promise.resolve(false),
    ]);
    if (downOk)
      return down;
    if (upOk)
      return up;
  }
  return null;

  async function probe(rev) {
    const result = await browserFetcher.canDownload(rev);
    log(`  ${rev} - ${result ? 'OK' : 'missing'}`);
    return result;
  }
}

async function revisionToSha(revision) {
  const json = await fetchJSON('https://cr-rev.appspot.com/_ah/api/crrev/v1/redirect/' + revision);
  return json.git_sha;
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const agent = url.startsWith('https://') ? require('https') : require('http');
    const options = URL.parse(url);
    options.method = 'GET';
    options.headers = {
      'Content-Type': 'application/json'
    };
    const req = agent.request(options, function(res) {
      let result = '';
      res.setEncoding('utf8');
      res.on('data', chunk => result += chunk);
      res.on('end', () => resolve(JSON.parse(result)));
    });
    req.on('error', err => reject(err));
    req.end();
  });
}
