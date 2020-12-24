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
const { parseMd, renderMd, parseArgument, applyTemplates } = require('./../parse_md');
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

  const api = await Source.readFile(path.join(PROJECT_DIR, 'docs', 'api.md'));
  const readme = await Source.readFile(path.join(PROJECT_DIR, 'README.md'));
  const binReadme = await Source.readFile(path.join(PROJECT_DIR, 'bin', 'README.md'));
  const contributing = await Source.readFile(path.join(PROJECT_DIR, 'CONTRIBUTING.md'));
  const docs = await Source.readdir(path.join(PROJECT_DIR, 'docs'), '.md');
  const mdSources = [readme, binReadme, api, contributing, ...docs];

  /** @type {!Array<!Message>} */
  const messages = [];
  let changedFiles = false;

  // Produce api.md
  {
    const comment = '<!-- THIS FILE IS NOW GENERATED -->';
    const header = fs.readFileSync(path.join(PROJECT_DIR, 'docs-src', 'api-header.md')).toString();
    const body = fs.readFileSync(path.join(PROJECT_DIR, 'docs-src', 'api-body.md')).toString();
    const footer = fs.readFileSync(path.join(PROJECT_DIR, 'docs-src', 'api-footer.md')).toString();
    const params = fs.readFileSync(path.join(PROJECT_DIR, 'docs-src', 'api-params.md')).toString();

    // Generate signatures
    {
      const nodes = applyTemplates(parseMd(body), parseMd(params));
      const signatures = new Map();
      for (const clazz of nodes) {
        clazz.type = 'h3';
        for (const member of clazz.children) {
          if (member.type !== 'h2')
            continue;
          member.type = 'h4';

          let match = member.text.match(/(event|method|namespace|async method|): (JS|CDP|[A-Z])([^.]+)\.(.*)/);
          if (!match)
            continue;

          if (match[1] === 'event') {
            member.text = `${match[2].toLowerCase() + match[3]}.on('${match[4]}')`;
            continue;
          }

          if (match[1] === 'method' || match[1] === 'async method') {
            const args = [];
            const argChildren = [];
            const returnContainer = [];
            const nonArgChildren = [];
            const optionsContainer = [];
            for (const item of member.children) {
              if (item.type === 'li' && item.liType === 'default') {
                const { type } = parseArgument(item.text);
                if (match[1] === 'method')
                  item.text = `returns: ${type}`;
                else
                  item.text = `returns: <[Promise]${type}>`;
                returnContainer.push(item);
                continue;
              }
              if (item.type !== 'h3') {
                nonArgChildren.push(item);
                continue;
              }
              if (item.text.startsWith('param:')) {
                const param = item.children[0];
                if (item.children[1])
                  param.text += ' ' + item.children[1].text;
                args.push(parseArgument(param.text));
                argChildren.push(param);
              }
              if (item.text.startsWith('option:')) {
                let optionsNode = optionsContainer[0];
                if (!optionsNode) {
                  optionsNode = {
                    type: 'li',
                    text: '`options` <[Object]>',
                    liType: 'default',
                    children: [],
                  };
                  optionsContainer.push(optionsNode);
                  args.push(parseArgument(optionsNode.text));
                }
                const param = item.children[0];
                if (item.children[1])
                  param.text += ' ' + item.children[1].text;
                optionsNode.children.push(param);
              }
            }
            if (match[1] === 'async method' && !returnContainer[0]) {
              returnContainer.push({
                type: 'li',
                text: 'returns: <[Promise]>',
                liType: 'default'
              });
            }
            if (optionsContainer[0])
              optionsContainer[0].children.sort((o1, o2) => o1.text.localeCompare(o2.text));
            member.children = [...argChildren, ...optionsContainer, ...returnContainer, ...nonArgChildren];

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
            const methodName = `${match[2].toLowerCase() + match[3]}.${match[4]}`;
            signatures.set(methodName, signature);
            member.text = `${methodName}(${signature})`;
          }

          if (match[1] === 'namespace') {
            member.text = `${match[2].toLowerCase() + match[3]}.${match[4]}`;
            continue;
          }
        }
      }
      api.setText([comment, header, renderMd(nodes, 10000), footer].join('\n'));

      // Generate links
      preprocessor.generateLinks(api, signatures, messages);
    }
  }

  // Documentation checks.
  {
    const browserVersions = await getBrowserVersions();
    messages.push(...(await preprocessor.runCommands(mdSources, {
      libversion: VERSION,
      chromiumVersion: browserVersions.chromium,
      firefoxVersion: browserVersions.firefox,
      webkitVersion: browserVersions.webkit,
    })));

    messages.push(...preprocessor.autocorrectInvalidLinks(PROJECT_DIR, mdSources, getRepositoryFiles()));
    for (const source of mdSources.filter(source => source.hasUpdatedText()))
      messages.push(Message.warning(`WARN: updated ${source.projectPath()}`));

    const browser = await playwright.chromium.launch();
    const page = await browser.newPage();
    const checkPublicAPI = require('./check_public_api');
    const jsSources = await Source.readdir(path.join(PROJECT_DIR, 'src', 'client'), '', []);
    messages.push(...await checkPublicAPI(page, [api], jsSources));
    await browser.close();

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
  process.exit(clearExit ? 0 : 1);
}

async function getBrowserVersions() {
  const names = ['chromium', 'firefox', 'webkit'];
  const browsers = await Promise.all(names.map(name => playwright[name].launch()));
  const result = {};
  for (let i = 0; i < names.length; i++) {
    result[names[i]] = browsers[i].version();
  }
  await Promise.all(browsers.map(browser => browser.close()));
  return result;
}

function getRepositoryFiles() {
  const out = spawnSync('git', ['ls-files'], {cwd: PROJECT_DIR});
  const files = out.stdout.toString().trim().split('\n').filter(f => !f.startsWith('docs-src'));
  return files.map(file => path.join(PROJECT_DIR, file));
}
