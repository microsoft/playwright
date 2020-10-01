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
const os = require('os');
const path = require('path');
const rmSync = require('rimraf').sync;
const ncp = require('ncp');
const {spawnSync} = require('child_process');
const util = require('util');

const writeFileAsync = util.promisify(fs.writeFile.bind(fs));
const cpAsync = util.promisify(ncp);

const SCRIPT_NAME = path.basename(__filename);
const ROOT_PATH = path.join(__dirname, '..');

const PLAYWRIGHT_CORE_FILES = ['bin', 'lib', 'types', 'NOTICE', 'LICENSE'];
const FFMPEG_FILES = ['third_party/ffmpeg'];

const PACKAGES = {
  'playwright': {
    description: 'A high-level API to automate web browsers',
    browsers: ['chromium', 'firefox', 'webkit'],
    // We copy README.md additionally for Playwright so that it looks nice on NPM.
    files: [...PLAYWRIGHT_CORE_FILES, ...FFMPEG_FILES, 'README.md'],
  },
  'playwright-core': {
    description: 'A high-level API to automate web browsers',
    browsers: [],
    files: PLAYWRIGHT_CORE_FILES,
  },
  'playwright-webkit': {
    description: 'A high-level API to automate WebKit',
    browsers: ['webkit'],
    files: PLAYWRIGHT_CORE_FILES,
  },
  'playwright-firefox': {
    description: 'A high-level API to automate Firefox',
    browsers: ['firefox'],
    files: PLAYWRIGHT_CORE_FILES,
  },
  'playwright-chromium': {
    description: 'A high-level API to automate Chromium',
    browsers: ['chromium'],
    files: [...PLAYWRIGHT_CORE_FILES, ...FFMPEG_FILES],
  },
  'playwright-electron': {
    version: '0.4.0', // Manually manage playwright-electron version.
    description: 'A high-level API to automate Electron',
    browsers: [],
    files: [...PLAYWRIGHT_CORE_FILES, ...FFMPEG_FILES, 'electron-types.d.ts'],
  },
};

// 1. Parse CLI arguments
const args = process.argv.slice(2);
if (args.some(arg => arg === '--help')) {
  console.log(usage());
  process.exit(1);
} else if (args.length < 1) {
  console.log(`Please specify package name, e.g. 'playwright' or 'playwright-chromium'.`);
  console.log(`Try running ${SCRIPT_NAME} --help`);
  process.exit(1);
} else if (args.length < 2) {
  console.log(`Please specify output path`);
  console.log(`Try running ${SCRIPT_NAME} --help`);
  process.exit(1);
}

const packageName = args[0];
const outputPath = path.resolve(args[1]);
const packagePath = path.join(__dirname, 'output', packageName);
const package = PACKAGES[packageName];
if (!package) {
  console.log(`ERROR: unknown package ${packageName}`);
  process.exit(1);
}

// 2. Setup cleanup if needed
if (!args.some(arg => arg === '--no-cleanup')) {
  process.on('exit', () => {
    rmSync(packagePath, {});
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

(async () => {
  // 3. Copy package files.
  rmSync(packagePath, {});
  fs.mkdirSync(packagePath, { recursive: true });
  await copyToPackage(path.join(__dirname, 'common') + path.sep, packagePath + path.sep);
  if (fs.existsSync(path.join(__dirname, packageName))) {
    // Copy package-specific files, these can overwrite common ones.
    await copyToPackage(path.join(__dirname, packageName) + path.sep, packagePath + path.sep);
  }
  for (const file of package.files)
    await copyToPackage(path.join(ROOT_PATH, file), path.join(packagePath, file));

  await copyToPackage(path.join(ROOT_PATH, 'docs/api.json'), path.join(packagePath, 'api.json'));
  await copyToPackage(path.join(ROOT_PATH, 'src/protocol/protocol.yml'), path.join(packagePath, 'protocol.yml'));

  // 4. Generate package.json
  const pwInternalJSON = require(path.join(ROOT_PATH, 'package.json'));
  await writeToPackage('package.json', JSON.stringify({
    name: packageName,
    version: package.version || pwInternalJSON.version,
    description: package.description,
    repository: pwInternalJSON.repository,
    engines: pwInternalJSON.engines,
    homepage: pwInternalJSON.homepage,
    main: 'index.js',
    exports: {
      // Root import: we have a wrapper ES Module to support the following syntax.
      // const { chromium } = require('playwright');
      // import { chromium } from 'playwright';
      '.': {
        import: './index.mjs',
        require: './index.js',
      },
      // Anything else can be required/imported by providing a relative path.
      './': './',
    },
    scripts: {
      install: 'node install.js',
    },
    author: pwInternalJSON.author,
    license: pwInternalJSON.license,
    dependencies: pwInternalJSON.dependencies
  }, null, 2));

  // 5. Generate browsers.json
  const browsersJSON = require(path.join(ROOT_PATH, 'browsers.json'));
  for (const browser of browsersJSON.browsers)
    browser.download = package.browsers.includes(browser.name);
  await writeToPackage('browsers.json', JSON.stringify(browsersJSON, null, 2));

  // 6. Bake commit SHA into the package
  const commitSHA = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: __dirname, encoding: 'utf8'});
  await writeToPackage('commitinfo', commitSHA.stdout.trim());

  // 7. Run npm pack
  const shell = os.platform() === 'win32';
  const {stdout, stderr, status} = spawnSync('npm', ['pack'], {cwd: packagePath, encoding: 'utf8', shell});
  if (status !== 0) {
    console.log(`ERROR: "npm pack" failed`);
    console.log(stderr);
    process.exit(1);
  }
  const tgzName = stdout.trim();

  // 7. Move result to the outputPath
  fs.renameSync(path.join(packagePath, tgzName), outputPath);
  console.log(outputPath);
})();

async function writeToPackage(fileName, content) {
  const toPath = path.join(packagePath, fileName);
  console.error(`- generating: //${path.relative(ROOT_PATH, toPath)}`);
  await writeFileAsync(toPath, content);
}

async function copyToPackage(fromPath, toPath) {
  console.error(`- copying: //${path.relative(ROOT_PATH, fromPath)} -> //${path.relative(ROOT_PATH, toPath)}`);
  try {
    fs.mkdirSync(path.dirname(toPath), { recursive: true });
  } catch (e) {
    // the folder might exist already
  }
  await cpAsync(fromPath, toPath);
}

function usage() {
  return `
usage: ${SCRIPT_NAME} <package-name> <output-path> [--no-cleanup]

Creates a .tgz of the package and saves it at the given output path

  --no-cleanup    skip cleaning up generated files from package directory

Example:
  ${SCRIPT_NAME} playwright ./playwright.tgz
`;
}

