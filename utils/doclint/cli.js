#!/usr/bin/env node
/**
 * Copyright 2017 Google Inc. All rights reserved.
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

const playwright = require('../../index.js');
const path = require('path');
const Source = require('./Source');

const {spawnSync} = require('child_process');

const PROJECT_DIR = path.join(__dirname, '..', '..');
const VERSION = require(path.join(PROJECT_DIR, 'package.json')).version;

const RED_COLOR = '\x1b[31m';
const YELLOW_COLOR = '\x1b[33m';
const RESET_COLOR = '\x1b[0m';

run();

async function run() {
  const startTime = Date.now();

  /** @type {!Array<!Message>} */
  const messages = [];
  let changedFiles = false;

  // Documentation checks.
  {
    const readme = await Source.readFile(path.join(PROJECT_DIR, 'README.md'));
    const api = await Source.readFile(path.join(PROJECT_DIR, 'docs', 'api.md'));
    const troubleshooting = await Source.readFile(path.join(PROJECT_DIR, 'docs', 'troubleshooting.md'));
    const mdSources = [readme, api, troubleshooting];

    const preprocessor = require('./preprocessor');
    const browserVersions = getBrowserVersions();
    messages.push(...(await preprocessor.runCommands(mdSources, {
      libversion: VERSION,
      chromiumVersion: browserVersions.chromium,
      firefoxVersion: browserVersions.firefox,
    })));
    messages.push(...await preprocessor.ensureReleasedAPILinks([readme], VERSION));

    const browser = await playwright.chromium.launch();
    const page = await browser.newPage();
    const checkPublicAPI = require('./check_public_api');
    const jsSources = await Source.readdir(path.join(PROJECT_DIR, 'src'));
    const externalDependencies = Object.keys(require('../../src/web.webpack.config').externals);
    messages.push(...await checkPublicAPI(page, mdSources, jsSources, externalDependencies));
    await browser.close();

    for (const source of mdSources) {
      if (!source.hasUpdatedText())
        continue;
      await source.save();
      changedFiles = true;
    }

    await readme.saveAs(path.join(PROJECT_DIR, 'packages', 'playwright', 'README.md'));
  }

  // Report results.
  const errors = messages.filter(message => message.type === 'error');
  if (errors.length) {
    console.log('DocLint Failures:');
    for (let i = 0; i < errors.length; ++i) {
      let error = errors[i].text;
      error = error.split('\n').join('\n      ');
      console.log(`  ${i + 1}) ${RED_COLOR}${error}${RESET_COLOR}`);
    }
  }
  const warnings = messages.filter(message => message.type === 'warning');
  if (warnings.length) {
    console.log('DocLint Warnings:');
    for (let i = 0; i < warnings.length; ++i) {
      let warning = warnings[i].text;
      warning = warning.split('\n').join('\n      ');
      console.log(`  ${i + 1}) ${YELLOW_COLOR}${warning}${RESET_COLOR}`);
    }
  }
  let clearExit = messages.length === 0;
  if (changedFiles) {
    if (clearExit)
      console.log(`${YELLOW_COLOR}Some files were updated.${RESET_COLOR}`);
    clearExit = false;
  }
  console.log(`${errors.length} failures, ${warnings.length} warnings.`);
  const runningTime = Date.now() - startTime;
  console.log(`DocLint Finished in ${runningTime / 1000} seconds`);
  process.exit(clearExit ? 0 : 1);
}

function getBrowserVersions() {
  const chromiumVersion = spawnSync(playwright.chromium.executablePath(), ['--version']).stdout.toString();
  const firefoxVersion = spawnSync(playwright.firefox.executablePath(), ['--version']).stdout.toString();
  return {
    chromium: chromiumVersion.trim().split(' ').pop(),
    firefox: firefoxVersion.trim().split(' ').pop(),
  };
}
