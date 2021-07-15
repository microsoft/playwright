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

//@ts-check

const playwright = require('../../');
const fs = require('fs');
const path = require('path');
const { parseApi } = require('./api_parser');
const missingDocs = require('./missingDocs');
const md = require('../markdown');

/** @typedef {import('./documentation').Type} Type */
/** @typedef {import('../markdown').MarkdownNode} MarkdownNode */

const PROJECT_DIR = path.join(__dirname, '..', '..');

const dirtyFiles = new Set();

run().catch(e => {
  console.error(e);
  process.exit(1);
});;

async function run() {
  const documentation = parseApi(path.join(PROJECT_DIR, 'docs', 'src', 'api'));
  // This validates member links.
  documentation.setLinkRenderer(() => undefined);
  documentation.filterForLanguage('js');

  // Patch README.md
  const versions = await getBrowserVersions();
  {
    const params = new Map();
    const { chromium, firefox, webkit } = versions;
    params.set('chromium-version', chromium);
    params.set('firefox-version', firefox);
    params.set('webkit-version', webkit);
    params.set('chromium-version-badge', `[![Chromium version](https://img.shields.io/badge/chromium-${chromium}-blue.svg?logo=google-chrome)](https://www.chromium.org/Home)`);
    params.set('firefox-version-badge', `[![Firefox version](https://img.shields.io/badge/firefox-${firefox}-blue.svg?logo=mozilla-firefox)](https://www.mozilla.org/en-US/firefox/new/)`);
    params.set('webkit-version-badge', `[![WebKit version](https://img.shields.io/badge/webkit-${webkit}-blue.svg?logo=safari)](https://webkit.org/)`);

    let content = fs.readFileSync(path.join(PROJECT_DIR, 'README.md')).toString();
    content = content.replace(/<!-- GEN:([^ ]+) -->([^<]*)<!-- GEN:stop -->/ig, (match, p1) => {
      if (!params.has(p1)) {
        console.log(`ERROR: Invalid generate parameter "${p1}" in "${match}"`);
        process.exit(1);
      }
      return `<!-- GEN:${p1} -->${params.get(p1)}<!-- GEN:stop -->`;
    });
    writeAssumeNoop(path.join(PROJECT_DIR, 'README.md'), content, dirtyFiles);
  }

  // Update device descriptors
  {
    const devicesDescriptorsSourceFile = path.join(PROJECT_DIR, 'src', 'server', 'deviceDescriptorsSource.json')
    const devicesDescriptors = require(devicesDescriptorsSourceFile)
    for (const deviceName of Object.keys(devicesDescriptors)) 
    switch (devicesDescriptors[deviceName].defaultBrowserType) {
      case 'chromium':
        devicesDescriptors[deviceName].userAgent = devicesDescriptors[deviceName].userAgent.replace(
          /(.*Chrome\/)(.*?)( .*)/,
          `$1${versions.chromium}$3`
        ).replace(
          /(.*Edg\/)(.*?)$/,
          `$1${versions.chromium}`
        )
        break;
      case 'firefox':
        devicesDescriptors[deviceName].userAgent = devicesDescriptors[deviceName].userAgent.replace(
          /^(.*Firefox\/)(.*?)( .*?)?$/,
          `$1${versions.firefox}$3`
        ).replace(/(.*rv:)(.*)\)(.*?)/, `$1${versions.firefox}$3`)
        break;
      case 'webkit':
        devicesDescriptors[deviceName].userAgent = devicesDescriptors[deviceName].userAgent.replace(
          /(.*Version\/)(.*?)( .*)/,
          `$1${versions.webkit}$3`
        )
        break;
      default:
        break;
    }
    writeAssumeNoop(devicesDescriptorsSourceFile, JSON.stringify(devicesDescriptors, null, 2), dirtyFiles);
  }

  // Validate links
  {
    for (const file of fs.readdirSync(path.join(PROJECT_DIR, 'docs', 'src'))) {
      if (!file.endsWith('.md'))
        continue;
      const data = fs.readFileSync(path.join(PROJECT_DIR, 'docs', 'src', file)).toString();
      documentation.renderLinksInText(md.parse(data));
    }
  }

  // Check for missing docs
  {
    const srcClient = path.join(PROJECT_DIR, 'src', 'client');
    const sources = fs.readdirSync(srcClient).map(n => path.join(srcClient, n));
    const errors = missingDocs(documentation, sources, path.join(srcClient, 'api.ts'));
    if (errors.length) {
      console.log('============================');
      console.log('ERROR: missing documentation:');
      errors.forEach(e => console.log(e));
      console.log('============================')
      process.exit(1);
    }
  }

  if (dirtyFiles.size) {
    console.log('============================')
    console.log('ERROR: generated markdown files have changed, this is only error if happens in CI:');
    [...dirtyFiles].forEach(f => console.log(f));
    console.log('============================')
    process.exit(1);
  }
  process.exit(0);
}

/**
 * @param {string} name
 * @param {string} content
 * @param {Set<string>} dirtyFiles
 */
function writeAssumeNoop(name, content, dirtyFiles) {
  fs.mkdirSync(path.dirname(name), { recursive: true });
  const oldContent = fs.existsSync(name) ? fs.readFileSync(name).toString() : '';
  if (oldContent !== content) {
    fs.writeFileSync(name, content);
    dirtyFiles.add(name);
  }
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
