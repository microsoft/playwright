#!/usr/bin/env node
/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

const path = require('path');
const { Registry } = require('../packages/playwright-core/lib/server');
const fs = require('fs');
const protocolGenerator = require('./protocol-types-generator');
const {execSync} = require('child_process');
const playwright = require('playwright-core');

const SCRIPT_NAME = path.basename(__filename);
const CORE_PATH = path.resolve(path.join(__dirname, '..', 'packages', 'playwright-core'));

function usage() {
  return `
usage: ${SCRIPT_NAME} <browser> <revision>

Roll the <browser> to a specific <revision> and generate new protocol.
Supported browsers: chromium, firefox, webkit, ffmpeg, firefox-beta.

Example:
  ${SCRIPT_NAME} chromium 123456
`;
}

(async () => {
  // 1. Parse CLI arguments
  const args = process.argv.slice(2);
  if (args.some(arg => arg === '--help')) {
    console.log(usage());
    process.exit(1);
  } else if (args.length < 1) {
    console.log(`Please specify the browser name, e.g. 'chromium'.`);
    console.log(`Try running ${SCRIPT_NAME} --help`);
    process.exit(1);
  } else if (args.length < 2) {
    console.log(`Please specify the revision`);
    console.log(`Try running ${SCRIPT_NAME} --help`);
    process.exit(1);
  }
  const browsersJSON = require(path.join(CORE_PATH, 'browsers.json'));
  const browserName = {
    'cr': 'chromium',
    'ff': 'firefox',
    'ff-beta': 'firefox-beta',
    'wk': 'webkit',
  }[args[0].toLowerCase()] ?? args[0].toLowerCase();
  const descriptors = [browsersJSON.browsers.find(b => b.name === browserName)];

  if (!descriptors.every(d => !!d)) {
    console.log(`Unknown browser "${browserName}"`);
    console.log(`Try running ${SCRIPT_NAME} --help`);
    process.exit(1);
  }

  const revision = args[1];
  console.log(`Rolling ${browserName} to ${revision}`);

  // 2. Update browser revisions in browsers.json.
  console.log('\nUpdating revision in browsers.json...');
  for (const descriptor of descriptors)
    descriptor.revision = String(revision);
  fs.writeFileSync(path.join(CORE_PATH, 'browsers.json'), JSON.stringify(browsersJSON, null, 2) + '\n');

  // 3. Download new browser.
  console.log('\nDownloading new browser...');
  const registry = new Registry(browsersJSON);
  const executable = registry.findExecutable(browserName);
  await registry.install([...registry.defaultExecutables(), executable]);

  // 4. Update browser version if rolling WebKit / Firefox / Chromium.
  const browserType = playwright[browserName.split('-')[0]];
  if (browserType) {
    const browser = await browserType.launch({
      executablePath: executable.executablePath('javascript'),
    });
    const browserVersion = await browser.version();
    await browser.close();
    console.log('\nUpdating browser version in browsers.json...');
    for (const descriptor of descriptors)
      descriptor.browserVersion = browserVersion;
    fs.writeFileSync(path.join(CORE_PATH, 'browsers.json'), JSON.stringify(browsersJSON, null, 2) + '\n');
  }

  if (browserType && descriptors[0].installByDefault) {
    // 5. Generate types.
    console.log('\nGenerating protocol types...');
    const executablePath = registry.findExecutable(browserName).executablePathOrDie();
    await protocolGenerator.generateProtocol(browserName, executablePath).catch(console.warn);

    // 6. Update docs.
    console.log('\nUpdating documentation...');
    try {
      process.stdout.write(execSync('npm run --silent doc'));
    } catch (e) {
    }
  }
  console.log(`\nRolled ${browserName} to ${revision}`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});

