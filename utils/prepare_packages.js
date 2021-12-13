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
//@ts-check
const fs = require('fs');
const path = require('path');
const ncp = require('ncp');
const util = require('util');
const { packageNameToPath } = require('./list_packages');

const cpAsync = util.promisify(ncp);

const ROOT_PATH = path.join(__dirname, '..');

const LICENSE_FILES = ['NOTICE', 'LICENSE'];


const PACKAGES = {
  'playwright': {
    browsers: ['chromium', 'firefox', 'webkit', 'ffmpeg'],
    // We copy README.md additionally for Playwright so that it looks nice on NPM.
    files: [...LICENSE_FILES, 'README.md'],
  },
  'playwright-core': {
    browsers: [],
    files: LICENSE_FILES,
  },
  '@playwright/test': {
    browsers: ['chromium', 'firefox', 'webkit', 'ffmpeg'],
    files: LICENSE_FILES,
    name: '@playwright/test',
  },
  'playwright-webkit': {
    browsers: ['webkit'],
    files: LICENSE_FILES,
  },
  'playwright-firefox': {
    browsers: ['firefox'],
    files: LICENSE_FILES,
  },
  'playwright-chromium': {
    browsers: ['chromium', 'ffmpeg'],
    files: LICENSE_FILES,
  },
  'html-reporter': {
    files: [],
  }
};

const dirtyFiles = [];

(async function () {
  for (const packagePath of require('./list_packages').packages) {
    const packageJSON = require(path.join(packagePath, 'package.json'));
    packageNameToPath.set(packageJSON.name, packagePath);
  }
  for (const packageName of packageNameToPath.keys())
    await lintPackage(packageName);
  for (const file of dirtyFiles) {
    console.warn('Updated', path.relative(ROOT_PATH, file));
  }
  if (dirtyFiles.length && process.argv.includes('--check-clean'))
    process.exit(1);
})();


/**
 * @param {string} packageName
 */
async function lintPackage(packageName) {
  const packagePath = packageNameToPath.get(packageName);
  const package = PACKAGES[packageName];
  if (!package) {
    console.log(`ERROR: unknown package ${packageName}`);
    process.exit(1);
  }

  // 3. Copy package files.
  for (const file of package.files)
    await copyToPackage(path.join(ROOT_PATH, file), path.join(packagePath, file));

  // 4. Generate package.json
  const pwInternalJSON = require(path.join(ROOT_PATH, 'package.json'));
  const currentPackageJSON = require(path.join(packagePath, 'package.json'));
  if (currentPackageJSON.private)
    return;
  currentPackageJSON.version = pwInternalJSON.version;
  currentPackageJSON.repository = pwInternalJSON.repository;
  currentPackageJSON.engines = pwInternalJSON.engines;
  currentPackageJSON.homepage = pwInternalJSON.homepage;
  currentPackageJSON.author = pwInternalJSON.author;
  currentPackageJSON.license = pwInternalJSON.license;
  for (const name of Object.keys(currentPackageJSON.dependencies || {})) {
    if (name in PACKAGES)
      currentPackageJSON.dependencies[name] = `=${pwInternalJSON.version}`;
  }
  await writeToPackage('package.json', JSON.stringify(currentPackageJSON, null, 2) + '\n');

  async function writeToPackage(fileName, content) {
    const toPath = path.join(packagePath, fileName);
    const currentContent = await fs.promises.readFile(toPath, 'utf8').catch(e => null);
    if (currentContent === content)
      return;
    dirtyFiles.push(toPath);
    await fs.promises.writeFile(toPath, content);
  }

}

async function copyToPackage(fromPath, toPath) {
  await fs.promises.mkdir(path.dirname(toPath), { recursive: true });
  await cpAsync(fromPath, toPath);
}

