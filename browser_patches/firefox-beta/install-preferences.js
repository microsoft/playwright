/**
 * Copyright 2018 Google Inc. All rights reserved.
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

const os = require('os');
const fs = require('fs');
const path = require('path');
const util = require('util');

const writeFileAsync = util.promisify(fs.writeFile.bind(fs));
const mkdirAsync = util.promisify(fs.mkdir.bind(fs));

// Install browser preferences after downloading and unpacking
// firefox instances.
// Based on:   https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Enterprise_deployment_before_60#Configuration
async function installFirefoxPreferences(distpath) {
  let executablePath = '';
  if (os.platform() === 'linux')
    executablePath = path.join(distpath, 'firefox');
  else if (os.platform() === 'darwin')
    executablePath = path.join(distpath, 'Nightly.app', 'Contents', 'MacOS', 'firefox');
  else if (os.platform() === 'win32')
    executablePath = path.join(distpath, 'firefox.exe');

  const firefoxFolder = path.dirname(executablePath);

  let prefPath = '';
  let configPath = '';
  if (os.platform() === 'darwin') {
    prefPath = path.join(firefoxFolder, '..', 'Resources', 'defaults', 'pref');
    configPath = path.join(firefoxFolder, '..', 'Resources');
  } else if (os.platform() === 'linux') {
    if (!fs.existsSync(path.join(firefoxFolder, 'browser', 'defaults')))
      await mkdirAsync(path.join(firefoxFolder, 'browser', 'defaults'));
    if (!fs.existsSync(path.join(firefoxFolder, 'browser', 'defaults', 'preferences')))
      await mkdirAsync(path.join(firefoxFolder, 'browser', 'defaults', 'preferences'));
    prefPath = path.join(firefoxFolder, 'browser', 'defaults', 'preferences');
    configPath = firefoxFolder;
  } else if (os.platform() === 'win32') {
    prefPath = path.join(firefoxFolder, 'defaults', 'pref');
    configPath = firefoxFolder;
  } else {
    throw new Error('Unsupported platform: ' + os.platform());
  }

  await Promise.all([
    copyFile({
      from: path.join(__dirname, 'preferences', '00-playwright-prefs.js'),
      to: path.join(prefPath, '00-playwright-prefs.js'),
    }),
    copyFile({
      from: path.join(__dirname, 'preferences', 'playwright.cfg'),
      to: path.join(configPath, 'playwright.cfg'),
    }),
  ]);
}

function copyFile({from, to}) {
  const rd = fs.createReadStream(from);
  const wr = fs.createWriteStream(to);
  return new Promise(function(resolve, reject) {
    rd.on('error', reject);
    wr.on('error', reject);
    wr.on('finish', resolve);
    rd.pipe(wr);
  }).catch(function(error) {
    rd.destroy();
    wr.end();
    throw error;
  });
}

if (process.argv.length !== 3) {
  console.log('ERROR: expected a path to the directory with browser build');
  process.exit(1);
  return;
}

installFirefoxPreferences(process.argv[2]).catch(error => {
  console.error('ERROR: failed to put preferences!');
  console.error(error);
  process.exit(1);
});
