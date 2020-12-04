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
const fs = require('fs');
const path = require('path');
const os = require('os');
const Source = require('./Source');
const Message = require('./Message');
const { renderMdTemplate, parseMd, renderMd, parseArgument } = require('./../parse_md');
const { spawnSync } = require('child_process');
const preprocessor = require('./preprocessor');

const PROJECT_DIR = path.join(__dirname, '..', '..');
const VERSION = require(path.join(PROJECT_DIR, 'package.json')).version;

const RED_COLOR = '\x1b[31m';
const YELLOW_COLOR = '\x1b[33m';
const RESET_COLOR = '\x1b[0m';

run().catch(e => {
  console.error(e);
  process.exit(1);
});;

async function run() {
  const startTime = Date.now();
  const onlyBrowserVersions = process.argv.includes('--only-browser-versions');

  /** @type {!Array<!Message>} */
  const messages = [];
  let changedFiles = false;

  // Produce api.md
  const api = await Source.readFile(path.join(PROJECT_DIR, 'docs', 'api.md'));
  {
    const comment = '<!-- THIS FILE IS NOW GENERATED -->';
    const header = fs.readFileSync(path.join(PROJECT_DIR, 'docs-src', 'api-header.md')).toString();
    const body = fs.readFileSync(path.join(PROJECT_DIR, 'docs-src', 'api-body.md')).toString();
    const footer = fs.readFileSync(path.join(PROJECT_DIR, 'docs-src', 'api-footer.md')).toString();
    let params = fs.readFileSync(path.join(PROJECT_DIR, 'docs-src', 'api-params.md')).toString();
    params = renderMdTemplate(params, params);

    // Generate signatures
    {
      const nodes = parseMd(renderMdTemplate(body, params));
      const signatures = new Map();
      let lastMethod;
      let args;
      const flushMethodSignature = () => {
        if (!lastMethod)
          return;
        const tokens = [];
        let hasOptional = false;
        for (const arg of args) {
          const optional = arg.name === 'options' || arg.text.includes('Optional');
          if (tokens.length) {
            if (optional && !hasOptional)
              tokens.push(`[, ${arg.name}`);
            else
              tokens.push(`, ${arg.name}`);
          } else {
            if (optional && !hasOptional)
              tokens.push(`[${arg.name}`);
            else
              tokens.push(`${arg.name}`);
          }
          hasOptional = hasOptional || optional;
        }
        if (hasOptional)
          tokens.push(']');
        const signature = tokens.join('');
        signatures.set(lastMethod.h4, signature);
        lastMethod.h4 = `${lastMethod.h4}(${signature})`;
        lastMethod = null;
        args = null;
      };
      for (const node of nodes) {
        if (node.h1 || node.h2 || node.h3 || node.h4)
          flushMethodSignature();

        if (node.h4) {
          lastMethod = null;
          args = null;
          let match = node.h4.match(/(event|method|namespace) (JS|CDP|[A-Z])([^.]+)\.(.*)/);
          if (!match)
            continue;
          if (match[1] === 'event') {
            node.h4 = `${match[2].toLowerCase() + match[3]}.on('${match[4]}')`;
            continue;
          }

          if (match[1] === 'method') {
            node.h4 = `${match[2].toLowerCase() + match[3]}.${match[4]}`;
            lastMethod = node;
            args = [];
            continue;
          }

          if (match[1] === 'namespace') {
            node.h4 = `${match[2].toLowerCase() + match[3]}.${match[4]}`;
            continue;
          }

          continue;
        }
        if (args && node.li && node.liType === 'default' && !node.li.startsWith('returns'))
          args.push(parseArgument(node.li));
      }
      api.setText([comment, header, renderMd(nodes), footer].join('\n'));

      // Generate links
      preprocessor.generateLinks(api, signatures, messages);
    }
  }

  // Documentation checks.
  {
    const readme = await Source.readFile(path.join(PROJECT_DIR, 'README.md'));
    const binReadme = await Source.readFile(path.join(PROJECT_DIR, 'bin', 'README.md'));
    const contributing = await Source.readFile(path.join(PROJECT_DIR, 'CONTRIBUTING.md'));
    const docs = await Source.readdir(path.join(PROJECT_DIR, 'docs'), '.md');
    const mdSources = [readme, binReadme, api, contributing, ...docs];

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
  const files = out.stdout.toString().trim().split('\n').filter(f => !f.startsWith('docs-src'));
  return files.map(file => path.join(PROJECT_DIR, file));
}

async function getFirefoxVersion() {
  const isWin = os.platform() === 'win32' || os.platform() === 'cygwin';
  const out = spawnSync(playwright.firefox.executablePath(), [isWin ? '/version' : '--version'], undefined);
  const version = out.stdout.toString();
  return version.trim().split(' ').pop();
}
