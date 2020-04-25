/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

// This file is only run when someone installs via the github repo

const {execSync} = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const rmAsync = util.promisify(require('rimraf'));

(async () => {
  const SRC_FOLDER = path.join(__dirname, 'src');
  const LIB_FOLDER = path.join(__dirname, 'lib');
  const srcTypeScriptFiles = (await listFiles(path.join(__dirname, 'src'))).filter(filepath => filepath.toLowerCase().endsWith('.ts'));
  const outdatedFiles = await Promise.all(srcTypeScriptFiles.map(async srcFile => {
    const libFileTS = path.join(LIB_FOLDER, path.relative(SRC_FOLDER, srcFile));
    const libFile = libFileTS.substring(0, libFileTS.lastIndexOf('.')) + '.js';
    try {
      const [srcStat, libStat] = await Promise.all([fs.promises.stat(srcFile), fs.promises.stat(libFile)]);
      return srcStat.ctimeMs > libStat.ctimeMs;
    } catch (e) {
      // Either `.ts` of `.js` file is missing - rebuild is required.
      return true;
    }
  }));
  if (outdatedFiles.some(Boolean)) {
    console.log(`Rebuilding playwright...`);
    try {
      execSync('npm run build');
    } catch (e) {
    }
  }
  await downloadAllBrowsersAndGenerateProtocolTypes();
})();

async function listFiles(dirpath) {
  const files = [];
  await dfs(dirpath);
  return files;

  async function dfs(dirpath) {
    const entries = await fs.promises.readdir(dirpath, {withFileTypes: true});
    files.push(...entries.filter(entry => entry.isFile()).map(entry => path.join(dirpath, entry.name)));
    await Promise.all(entries.filter(entry => entry.isDirectory()).map(entry => dfs(path.join(dirpath, entry.name))));
  }
}

async function downloadAllBrowsersAndGenerateProtocolTypes() {
  const { installBrowsersWithProgressBar } = require('./lib/install/installer');
  const protocolGenerator = require('./utils/protocol-types-generator');
  const browserPaths = require('./lib/install/browserPaths');
  const browsersPath = browserPaths.browsersPath(__dirname);
  const browsers = require('./browsers.json')['browsers'];
  await installBrowsersWithProgressBar(__dirname);
  for (const browser of browsers) {
    const browserPath = browserPaths.browserDirectory(browsersPath, browser);
    await protocolGenerator.generateProtocol(browser.name, browserPaths.executablePath(browserPath, browser)).catch(console.warn);
  }

  try {
    console.log('Generating types...');
    execSync('npm run generate-types');
  } catch (e) {
  }

  async function readdirAsync(dirpath) {
    return fs.promises.readdir(dirpath).then(dirs => dirs.map(dir => path.join(dirpath, dir)));
  }
}
