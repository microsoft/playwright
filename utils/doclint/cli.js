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

const playwright = require('playwright-core');
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

function getAllMarkdownFiles(dirPath, filePaths = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      filePaths.push(path.join(dirPath, entry.name));
    else if (entry.isDirectory())
      getAllMarkdownFiles(path.join(dirPath, entry.name), filePaths);
  }
  return filePaths;
}

async function run() {
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

  // Patch docker version in docs
  {
    let playwrightVersion = require(path.join(PROJECT_DIR, 'package.json')).version;
    if (playwrightVersion.endsWith('-next'))
      playwrightVersion = playwrightVersion.substring(0, playwrightVersion.indexOf('-next'));
    const regex = new RegExp("(mcr.microsoft.com/playwright[^: ]*):?([^ ]*)");
    for (const filePath of getAllMarkdownFiles(path.join(PROJECT_DIR, 'docs'))) {
      let content = fs.readFileSync(filePath).toString();
      content = content.replace(new RegExp('(mcr.microsoft.com/playwright[^:]*):([\\w\\d-.]+)', 'ig'), (match, imageName, imageVersion) => {
        return `${imageName}:v${playwrightVersion}-focal`;
      });
      writeAssumeNoop(filePath, content, dirtyFiles);
    }
  }

  // Update device descriptors
  {
    const devicesDescriptorsSourceFile = path.join(PROJECT_DIR, 'packages', 'playwright-core', 'src', 'server', 'deviceDescriptorsSource.json')
    const devicesDescriptors = require(devicesDescriptorsSourceFile)
    for (const deviceName of Object.keys(devicesDescriptors)) {
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
          ).replace(/^(.*rv:)(.*)(\).*?)$/, `$1${versions.firefox}$3`)
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
    }
    writeAssumeNoop(devicesDescriptorsSourceFile, JSON.stringify(devicesDescriptors, null, 2), dirtyFiles);
  }

  // Validate links
  {
    const langs = ['js', 'java', 'python', 'csharp'];
    const documentationRoot = path.join(PROJECT_DIR, 'docs', 'src');
    for (const lang of langs) {
      try {
        let documentation = parseApi(path.join(documentationRoot, 'api'));
        documentation.filterForLanguage(lang);
        if (lang === 'js') {
          const testDocumentation = parseApi(path.join(documentationRoot, 'test-api'), path.join(documentationRoot, 'api', 'params.md'));
          testDocumentation.filterForLanguage('js');
          const testRerpoterDocumentation = parseApi(path.join(documentationRoot, 'test-reporter-api'));
          testRerpoterDocumentation.filterForLanguage('js');
          documentation = documentation.mergeWith(testDocumentation).mergeWith(testRerpoterDocumentation);
        }

        // This validates member links.
        documentation.setLinkRenderer(() => undefined);

        const relevantMarkdownFiles = getAllMarkdownFiles(documentationRoot)
          // filter out unrelevant files
          .filter(filePath => {
            const matches = filePath.match(/(-(js|python|csharp|java))+?/g);
            // no language specific document
            if (!matches)
              return true;
            // there is a language, lets filter for it
            return matches.includes(`-${lang}`);
          })
          // Standardise naming and remove the filter in the file name
          .map(filePath => filePath.replace(/(-(js|python|csharp|java))+/, ''))
          // Internally we merge test-api and test-reporter-api into api.
          .map(filePath => filePath.replace(/\/(test-api|test-reporter-api)\//, '/api/'))
          // Strip off the root
          .map(filePath => filePath.substring(documentationRoot.length + 1))

        /**
         * @param {string} filePath
         * @returns {boolean}
         */
        function hasDocFile(filePath) {
          const kIgnoreDocFiles = ['test-assertions.md'];
          // We generate it inside the generator
          if (kIgnoreDocFiles.includes(filePath))
            return true;
          return relevantMarkdownFiles.some(other => {
            if (other === filePath)
              return true;
            if (other === path.join('api', filePath))
              return true;
            if (lang === 'js') {
              if (other === path.join('test-api', filePath))
                return true;
              if (other === path.join('test-reporter-api', filePath))
                return true;
            }
            return false;
          });
        }

        for (const filePath of getAllMarkdownFiles(documentationRoot)) {
          if (langs.some(other => other !== lang && filePath.endsWith(`-${other}.md`)))
            continue;
          const data = fs.readFileSync(filePath, 'utf-8');
          const rootNode = md.filterNodesForLanguage(md.parse(data), lang);
          documentation.renderLinksInText(rootNode);

          // Validate links:
          {
            md.visitAll(rootNode, node => {
              if (!node.text)
                return;
              for (const match of node.text.matchAll(/\[(.*?)\]\((.*?)\)/g)) {
                const [, linkName, linkRef] = match;
                const isExternal = linkRef.startsWith('http://') || linkRef.startsWith('https://');
                if (isExternal)
                  continue
                if (linkRef.startsWith('./')) {
                  const linkRefHash = linkRef.indexOf('#');
                  if (linkRefHash !== -1)
                    assertFileExists(filePath, linkRef.substring(0, linkRefHash), linkName);
                  else
                    assertFileExists(filePath, linkRef, linkName);
                }
              }
            });

            /**
             * @param {string} filePath 
             * @param {string} linkRef
             * @param {string} linkName
             */
            function assertFileExists(filePath, linkRef, linkName) {
              if (path.extname(linkRef) !== '.md')
                linkRef += '.md';
              if (linkRef.startsWith('./'))
                linkRef = linkRef.substring(2);
              if (!hasDocFile(linkRef)) {
                throw new Error(`${filePath} references to '${linkRef}' as '${linkName}' which does not exist.`);
              }
            }
          }
        }
      } catch (e) {
        e.message = `While processing "${lang}"\n` + e.message;
        throw e;
      }
    }
  }

  // Check for missing docs
  {
    const apiDocumentation = parseApi(path.join(PROJECT_DIR, 'docs', 'src', 'api'));
    apiDocumentation.filterForLanguage('js');
    const srcClient = path.join(PROJECT_DIR, 'packages', 'playwright-core', 'src', 'client');
    const sources = fs.readdirSync(srcClient).map(n => path.join(srcClient, n));
    const errors = missingDocs(apiDocumentation, sources, path.join(srcClient, 'api.ts'));
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
    console.log('ERROR: generated files have changed, this is only error if happens in CI:');
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
