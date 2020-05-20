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
const fs = require('fs');
const path = require('path');
const rmSync = require('rimraf').sync;
const ncp = require('ncp');
const {spawnSync} = require('child_process');

const FILENAME = path.basename(__filename);
const ROOT_PATH = path.join(__dirname, '..');

const cleanupPaths = [];

// 1. Parse CLI arguments
const args = process.argv.slice(2);
if (args.some(arg => arg === '--help')) {
  console.log(usage());
  process.exit(1);
} else if (args.length < 1) {
  console.log(`Please specify package name, e.g. 'playwright' or 'playwright-chromium'.`);
  console.log(`Try running ${FILENAME} --help`);
  process.exit(1);
} else if (args.length < 2) {
  console.log(`Please specify output path`);
  console.log(`Try running ${FILENAME} --help`);
  process.exit(1);
}

// 2. Setup cleanup if needed
if (!args.some(arg => arg === '--no-cleanup')) {
  process.on('exit', () => { 
    cleanupPaths.forEach(cleanupPath => rmSync(cleanupPath, {}));
  });
  process.on('SIGINT', () => process.exit(2));
  process.on('SIGHUP', () => process.exit(3));
  process.on('SIGTERM', () => process.exit(4));
  process.on('uncaughtException', error => {
    console.error(error);
    process.exit(5);
  });
  process.on('unhandledRejection', error => {
    console.error(error);
    process.exit(6);
  });
}

const packageName = args[0];
const outputPath = path.resolve(args[1]);
const packagePath = path.join(__dirname, packageName);

(async () => {
  // 3. figure package description and browsers based on name
  let description = '';
  let whitelistedBrowsers = [];
  if (packageName === 'playwright') {
    description = 'A high-level API to automate web browsers';
    whitelistedBrowsers = ['chromium', 'firefox', 'webkit'];
    // For Playwright, we need to copy README.md
    await copyToPackage('README.md');
  } else if (packageName === 'playwright-core') {
    description = 'A high-level API to automate web browsers';
    whitelistedBrowsers = [];
  } else if (packageName === 'playwright-webkit') {
    description = 'A high-level API to automate WebKit';
    whitelistedBrowsers = ['webkit'];
  } else if (packageName === 'playwright-firefox') {
    description = 'A high-level API to automate Firefox';
    whitelistedBrowsers = ['firefox'];
  } else if (packageName === 'playwright-chromium') {
    description = 'A high-level API to automate Chromium';
    whitelistedBrowsers = ['chromium'];
  } else {
    console.log(`ERROR: unknown package ${packageName}`);
    process.exit(1);
  }

  // 4. Copy files & directories from playwright-internal to package.
  await copyToPackage('lib');
  await copyToPackage('types');
  await copyToPackage('NOTICE');
  await copyToPackage('LICENSE');
  await copyToPackage('.npmignore');

  // 5. Generate package.json
  const packageJSON = require(path.join(ROOT_PATH, 'package.json'));
  await writeToPackage('package.json', JSON.stringify({
    name: packageName,
    version: packageJSON.version,
    description,
    repository: packageJSON.repository,
    engines: packageJSON.engines,
    homepage: packageJSON.homepage,
    main: 'index.js',
    scripts: {
      install: 'node install.js',
    },
    author: packageJSON.author,
    license: packageJSON.license,
    dependencies: packageJSON.dependencies
  }, null, 2));

  // 6. Generate browsers.json
  const browsersJSON = require(path.join(ROOT_PATH, 'browsers.json'));
  browsersJSON.browsers = browsersJSON.browsers.filter(browser => whitelistedBrowsers.includes(browser.name));
  await writeToPackage('browsers.json', JSON.stringify(browsersJSON, null, 2));

  // 7. Run npm pack
  const {stdout, stderr, status} = spawnSync('npm', ['pack'], {cwd: packagePath, encoding: 'utf8'});
  if (status !== 0) {
    console.log(`ERROR: "npm pack" failed`);
    console.log(stderr);
    process.exit(1);
  }
  const tgzName = stdout.trim();

  // 8. Move result to the outputPath
  fs.renameSync(path.join(packagePath, tgzName), outputPath);
  console.log(outputPath);
})();

async function writeToPackage(fileName, content) {
  const toPath = path.join(packagePath, fileName);
  cleanupPaths.push(toPath);
  console.error(`- generating: //${path.relative(ROOT_PATH, toPath)}`);
  await new Promise((resolve, reject) => {
    fs.writeFile(toPath, content, error => {
      if (error)
        reject(error);
      else
        resolve();
    });
  });
}

async function copyToPackage(fileOrDirectoryName) {
  const fromPath = path.join(ROOT_PATH, fileOrDirectoryName);
  const toPath = path.join(packagePath, fileOrDirectoryName);
  cleanupPaths.push(toPath);
  console.error(`- copying: //${path.relative(ROOT_PATH, fromPath)} -> //${path.relative(ROOT_PATH, toPath)}`);
  await new Promise((resolve, reject) => {
    ncp(fromPath, toPath, error => {
      if (error)
        reject(error);
      else
        resolve();
    });
  });
}

function usage() {
  return `
usage: ${FILENAME} <package-name> <output-path> [--no-cleanup]

Creates a .tgz of the package and saves it at the given output path

  --no-cleanup    skip cleaning up generated files from package directory

Example:
  ${FILENAME} playwright ./playwright.tgz
`;
}

