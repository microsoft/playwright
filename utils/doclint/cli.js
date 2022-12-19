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
const docs = require('./documentation');

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
    params.set('firefox-version-badge', `[![Firefox version](https://img.shields.io/badge/firefox-${firefox}-blue.svg?logo=firefoxbrowser)](https://www.mozilla.org/en-US/firefox/new/)`);
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

  let playwrightVersion = require(path.join(PROJECT_DIR, 'package.json')).version;
  if (playwrightVersion.endsWith('-next'))
    playwrightVersion = playwrightVersion.substring(0, playwrightVersion.indexOf('-next'));

  // Ensure browser versions in browsers.json. This is most important for WebKit
  // since its version is hardcoded in Playwright library rather then in browser builds.
  // @see https://github.com/microsoft/playwright/issues/15702
  {
    const browsersJSONPath = path.join(__dirname, '..', '..', 'packages/playwright-core/browsers.json');
    const browsersJSON = JSON.parse(await fs.promises.readFile(browsersJSONPath, 'utf8'));
    for (const browser of browsersJSON.browsers) {
      if (versions[browser.name])
        browser.browserVersion = versions[browser.name];
    }
    writeAssumeNoop(browsersJSONPath, JSON.stringify(browsersJSON, null, 2) + '\n', dirtyFiles);
  }

  // Patch docker version in docs
  {
    for (const filePath of getAllMarkdownFiles(path.join(PROJECT_DIR, 'docs'))) {
      let content = fs.readFileSync(filePath).toString();
      content = content.replace(new RegExp('(mcr.microsoft.com/playwright[^:]*):([\\w\\d-.]+)', 'ig'), (match, imageName, imageVersion) => {
        const [version, distroName] = imageVersion.split('-');
        return `${imageName}:v${playwrightVersion}-${distroName ?? 'focal'}`;
      });
      writeAssumeNoop(filePath, content, dirtyFiles);
    }

    // Patch pom.xml
    {
      const introPath = path.join(PROJECT_DIR, 'docs', 'src', 'intro-java.md');
      const pomVersionRe = new RegExp('^(\\s*<artifactId>playwright<\\/artifactId>\\n\\s*<version>)(.*)(<\\/version>)$', 'gm');
      let content = fs.readFileSync(introPath).toString();
      const majorVersion = playwrightVersion.replace(new RegExp('((\\d+\\.){2})(\\d+)'), '$10')
      content = content.replace(pomVersionRe, '$1' + majorVersion + '$3');
      writeAssumeNoop(introPath, content, dirtyFiles);
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
    const invalidConfigurations = Object.entries(devicesDescriptors).filter(([_, deviceDescriptor]) => deviceDescriptor.isMobile && deviceDescriptor.defaultBrowserType === 'firefox').map(([deviceName, deviceDescriptor]) => deviceName);
    if (invalidConfigurations.length > 0)
      throw new Error(`Invalid Device Configurations. isMobile with Firefox not supported: ${invalidConfigurations.join(', ')}`);
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
        // This validates code snippet groups in comments.
        documentation.setCodeGroupsTransformer(lang, tabs => tabs.map(tab => tab.spec));
        documentation.generateSourceCodeComments();

        const relevantMarkdownFiles = new Set([...getAllMarkdownFiles(documentationRoot)
          // filter out language specific files
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
          // Internally (playwright.dev generator) we merge test-api and test-reporter-api into api.
          .map(filePath => filePath.replace(/(\/|\\)(test-api|test-reporter-api)(\/|\\)/, `${path.sep}api${path.sep}`))]);

        for (const filePath of getAllMarkdownFiles(documentationRoot)) {
          if (langs.some(other => other !== lang && filePath.endsWith(`-${other}.md`)))
            continue;
          const data = fs.readFileSync(filePath, 'utf-8');
          let rootNode = md.filterNodesForLanguage(md.parse(data), lang);
          // Validates code snippet groups.
          rootNode = docs.processCodeGroups(rootNode, lang, tabs => tabs.map(tab => tab.spec));
          // Renders links.
          documentation.renderLinksInNodes(rootNode);
          // Validate links.
          {
            md.visitAll(rootNode, node => {
              if (!node.text)
                return;
              for (const [, mdLinkName, mdLink] of node.text.matchAll(/\[([\w\s\d]+)\]\((.*?)\)/g)) {
                const isExternal = mdLink.startsWith('http://') || mdLink.startsWith('https://');
                if (isExternal)
                  continue;
                // ignore links with only a hash (same file)
                if (mdLink.startsWith('#'))
                  continue;

                let markdownBasePath = path.dirname(filePath);
                let linkWithoutHash = path.join(markdownBasePath, mdLink.split('#')[0]);
                if (path.extname(linkWithoutHash) !== '.md')
                  linkWithoutHash += '.md';

                if (!relevantMarkdownFiles.has(linkWithoutHash))
                  throw new Error(`${path.relative(PROJECT_DIR, filePath)} references to '${linkWithoutHash}' as '${mdLinkName}' which does not exist.`);
              }
            });
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
