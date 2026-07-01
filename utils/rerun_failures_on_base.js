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
const os = require('os');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const MAX_RERUN_FAILURES = 50;
const RUNNER_TEMP = process.env.RUNNER_TEMP || os.tmpdir();

function group(title, fn) {
  console.log(`::group::${title}`);
  try {
    return fn();
  } finally {
    console.log('::endgroup::');
  }
}

function sh(command, { allowFailure = false } = {}) {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    if (!allowFailure)
      throw error;
  }
}

function run(file, args, { allowFailure = false } = {}) {
  const result = spawnSync(file, args, { stdio: 'inherit' });
  if (result.error) {
    if (!allowFailure)
      throw result.error;
    console.log(`${file} could not start: ${result.error.message}`);
  } else if (result.status !== 0 && !allowFailure) {
    throw new Error(`${file} exited with code ${result.status}`);
  }
}

function rerunCommand(command, lastRunFile) {
  let rerun = command.replace(/--shard[ =]\d+\/\d+/g, '').trim();
  // npm scripts need `--` to forward the flags appended below.
  if (rerun.startsWith('npm run') && !rerun.includes(' -- '))
    rerun += ' --';
  return `${rerun} --last-failed --last-failed-file=${lastRunFile}`;
}

const KEY_SEPARATOR = '\x1e';

// Must match _canonicalTestKey() in tests/config/markdownReporter.ts.
function canonicalKey(projectName, file, titles) {
  return [projectName, file.split(path.sep).join('/'), ...titles].join(KEY_SEPARATOR);
}

function visitSuite(suite, file, titles, keys) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      if (test.status === 'unexpected')
        keys.add(canonicalKey(test.projectName, file, [...titles, spec.title]));
    }
  }
  for (const child of suite.suites ?? [])
    visitSuite(child, file, [...titles, child.title], keys);
}

function extractBaseFailures(report) {
  const keys = new Set();
  for (const fileSuite of report.suites ?? [])
    visitSuite(fileSuite, fileSuite.file, [], keys);
  return [...keys].sort();
}

function main() {
  const lastRun = 'test-results/.last-run.json';
  if (!fs.existsSync(lastRun)) {
    console.log(`No ${lastRun} found; nothing to re-run on base.`);
    return;
  }

  let failedCount = 0;
  try {
    failedCount = (JSON.parse(fs.readFileSync(lastRun, 'utf8')).failedTests || []).length;
  } catch {
  }
  console.log(`Genuine failures recorded on head: ${failedCount}`);
  if (failedCount === 0) {
    console.log('No genuine failures recorded; skipping base re-run.');
    return;
  }
  if (failedCount > MAX_RERUN_FAILURES) {
    console.log(`Too many failures (${failedCount} > ${MAX_RERUN_FAILURES}); likely systemic, skipping base re-run.`);
    return;
  }

  const { COMMAND = '', SETUP_COMMAND = '', BROWSERS_TO_INSTALL = '', BASE_SHA = '', BOT_NAME = '', SHARD_INDEX = '0' } = process.env;
  const savedLastRun = path.join(RUNNER_TEMP, '.last-run.json');
  fs.copyFileSync(lastRun, savedLastRun);
  const headSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

  group(`Checkout base (${BASE_SHA})`, () => {
    sh(`git fetch --no-tags --depth=1 origin ${BASE_SHA}`);
    sh(`git checkout --force --detach ${BASE_SHA}`);
    sh('git clean -ffdx -e node_modules');
  });
  group('Build base', () => {
    sh('npm ci');
    sh('npm run build');
    sh(`npx playwright install --with-deps ${BROWSERS_TO_INSTALL}`);
  });
  if (SETUP_COMMAND)
    group('Base setup command', () => run('bash', ['-c', SETUP_COMMAND]));

  group('Re-run failing tests on base', () => {
    const command = rerunCommand(COMMAND, savedLastRun);
    console.log(`Base re-run command: ${command}`);
    if (process.platform === 'linux')
      run('xvfb-run', ['--auto-servernum', '--server-args=-screen 0 1280x960x24', '--', 'bash', '-c', command], { allowFailure: true });
    else
      run('bash', ['-c', command], { allowFailure: true });
  });

  const baseFailures = path.join(RUNNER_TEMP, `base-failures-${BOT_NAME}-${SHARD_INDEX}.json`);
  let keys = [];
  try {
    keys = extractBaseFailures(JSON.parse(fs.readFileSync('test-results/report.json', 'utf8')));
  } catch (error) {
    console.log(`No base report parsed: ${error instanceof Error ? error.message : error}`);
  }
  fs.writeFileSync(baseFailures, JSON.stringify(keys, null, 2) + '\n');

  group(`Restore head (${headSha})`, () => sh(`git checkout --force --detach ${headSha}`, { allowFailure: true }));

  console.log('Tests failing on base too:');
  try {
    console.log(fs.readFileSync(baseFailures, 'utf8'));
  } catch {
    console.log('(none)');
  }
}

module.exports = { rerunCommand, extractBaseFailures };

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
