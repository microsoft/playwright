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

const playwright = require('../../');
const path = require('path');
const Source = require('./Source');
const Message = require('./Message');

const {spawnSync} = require('child_process');

const os = require('os');

const PROJECT_DIR = path.join(__dirname, '..', '..');
const VERSION = require(path.join(PROJECT_DIR, 'package.json')).version;

const RED_COLOR = '\x1b[31m';
const YELLOW_COLOR = '\x1b[33m';
const RESET_COLOR = '\x1b[0m';

run();

async function run() {
  const startTime = Date.now();
  const onlyBrowserVersions = process.argv.includes('--only-browser-versions');

  /** @type {!Array<!Message>} */
  const messages = [];
  let changedFiles = false;

  // Documentation checks.
  {
    const readme = await Source.readFile(path.join(PROJECT_DIR, 'README.md'));
    const binReadme = await Source.readFile(path.join(PROJECT_DIR, 'bin', 'README.md'));
    const ffmpegReadme = await Source.readFile(path.join(PROJECT_DIR, 'third_party', 'ffmpeg', 'README.md'));
    const contributing = await Source.readFile(path.join(PROJECT_DIR, 'CONTRIBUTING.md'));
    const api = await Source.readFile(path.join(PROJECT_DIR, 'docs', 'api.md'));
    const docs = await Source.readdir(path.join(PROJECT_DIR, 'docs'), '.md');
    const mdSources = [readme, binReadme, api, contributing, ...docs];

    const preprocessor = require('./preprocessor');
    const browserVersions = await getBrowserVersions();
    messages.push(...(await preprocessor.runCommands(mdSources, {
      libversion: VERSION,
      chromiumVersion: browserVersions.chromium,
      firefoxVersion: browserVersions.firefox,
      onlyBrowserVersions,
    })));

    if (!onlyBrowserVersions) {
      messages.push(...preprocessor.autocorrectInvalidLinks(PROJECT_DIR, mdSources, getRepositoryFiles()));
      for (const source of mdSources.filter(source => source.hasUpdatedText()))
        messages.push(Message.warning(`WARN: updated ${source.projectPath()}`));

      const browser = await playwright.chromium.launch();
      const page = await browser.newPage();
      const checkPublicAPI = require('./check_public_api');
      const jsSources = await Source.readdir(path.join(PROJECT_DIR, 'src', 'client'), '', []);
      messages.push(...await checkPublicAPI(page, [api], jsSources));
      await browser.close();
    }

    for (const source of mdSources) {
      if (!source.hasUpdatedText())
        continue;
      await source.save();
      changedFiles = true;
    }
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
  process.exit(clearExit || onlyBrowserVersions ? 0 : 1);
}

async function getBrowserVersions() {
  const [chromium, firefox] = await Promise.all([
    getChromeVersion(),
    getFirefoxVersion(),
  ])
  return {
    chromium,
    firefox,
  };
}

async function getChromeVersion() {
  if (os.platform() === 'win32' || os.platform() === 'cygwin') {
    const browser = await playwright.chromium.launch();
    const page = await browser.newPage();
    const userAgent = await page.evaluate('navigator.userAgent');
    const [type] = userAgent.split(' ').filter(str => str.includes('Chrome'));
    await browser.close();
    return type.split('/')[1];
  }
  const version = spawnSync(playwright.chromium.executablePath(), ['--version'], undefined).stdout.toString();
  return version.trim().split(' ').pop();
}

function getRepositoryFiles() {
  const out = spawnSync('git', ['ls-files'], {cwd: PROJECT_DIR});
  return out.stdout.toString().trim().split('\n').map(file => path.join(PROJECT_DIR, file));
}

async function getFirefoxVersion() {
  const isWin = os.platform() === 'win32' || os.platform() === 'cygwin';
  const out = spawnSync(playwright.firefox.executablePath(), [isWin ? '/version' : '--version'], undefined);
  const version = out.stdout.toString();
  return version.trim().split(' ').pop();
}
