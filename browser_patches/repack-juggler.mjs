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

import * as path from 'path';
import * as URL from 'url';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import * as util from 'util';
import * as child_process from 'child_process';

const existsAsync = path => new Promise(resolve => fs.stat(path, err => resolve(!err)));

const __filename = URL.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.argv[2] === '--help' || process.argv[2] === '-h') {
  console.log(`usage: ${path.basename(process.argv[1])} [firefox|ff|firefox-beta|ff-beta] [build number] [build platform]`);
  console.log(``);
  console.log(`Repackages Firefox with tip-of-tree Juggler implementation`);
  process.exit(1);
}

let browserName = '';
if (process.argv[2] === 'firefox' || process.argv[2] === 'ff') {
  browserName = 'firefox';
} else if (process.argv[2] === 'firefox-beta' || process.argv[2] === 'ff-beta') {
  browserName = 'firefox-beta';
} else {
  console.error('ERROR: unknown firefox to repackage - either "firefox", "ff", "firefox-beta" or "ff-beta" is allowed as first argument');
  process.exit(1);
}

// Path to jar.mn in the juggler
const JARMN_PATH = path.join(__dirname, browserName, 'juggler', 'jar.mn');
// Workdir for Firefox repackaging
const BUILD_DIRECTORY = `/tmp/repackaged-firefox`;
// Information about currently downloaded build
const BUILD_INFO_PATH = path.join(BUILD_DIRECTORY, 'build-info.json');
// Backup OMNI.JA - the original one before repackaging.
const OMNI_BACKUP_PATH = path.join(BUILD_DIRECTORY, 'omni.ja.backup');
// Workdir to extract omni.ja
const OMNI_EXTRACT_DIR = path.join(BUILD_DIRECTORY, 'omni');
// Path inside omni.ja to juggler
const OMNI_JUGGLER_DIR = path.join(OMNI_EXTRACT_DIR, 'chrome', 'juggler');

const EXECUTABLE_PATHS = {
  'ubuntu18.04': ['firefox', 'firefox'],
  'ubuntu20.04': ['firefox', 'firefox'],
  'mac10.14': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
  'mac10.15': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
  'mac11': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
  'mac11-arm64': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
  'mac12': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
  'mac12-arm64': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
  'win64': ['firefox', 'firefox.exe'],
};

const DOWNLOAD_URLS = {
  'firefox': {
    'ubuntu18.04': 'https://playwright.azureedge.net/builds/firefox/%s/firefox-ubuntu-18.04.zip',
    'ubuntu20.04': 'https://playwright.azureedge.net/builds/firefox/%s/firefox-ubuntu-20.04.zip',
    'mac10.14': 'https://playwright.azureedge.net/builds/firefox/%s/firefox-mac-11.zip',
    'mac10.15': 'https://playwright.azureedge.net/builds/firefox/%s/firefox-mac-11.zip',
    'mac11': 'https://playwright.azureedge.net/builds/firefox/%s/firefox-mac-11.zip',
    'mac11-arm64': 'https://playwright.azureedge.net/builds/firefox/%s/firefox-mac-11.0-arm64.zip',
    'mac12': 'https://playwright.azureedge.net/builds/firefox/%s/firefox-mac-11.zip',
    'mac12-arm64': 'https://playwright.azureedge.net/builds/firefox/%s/firefox-mac-11.0-arm64.zip',
    'win64': 'https://playwright.azureedge.net/builds/firefox/%s/firefox-win64.zip',
  },
  'firefox-beta': {
    'ubuntu18.04': 'https://playwright.azureedge.net/builds/firefox-beta/%s/firefox-beta-ubuntu-18.04.zip',
    'ubuntu20.04': 'https://playwright.azureedge.net/builds/firefox-beta/%s/firefox-beta-ubuntu-20.04.zip',
    'mac10.14': 'https://playwright.azureedge.net/builds/firefox-beta/%s/firefox-beta-mac-11.zip',
    'mac10.15': 'https://playwright.azureedge.net/builds/firefox-beta/%s/firefox-beta-mac-11.zip',
    'mac11': 'https://playwright.azureedge.net/builds/firefox-beta/%s/firefox-beta-mac-11.zip',
    'mac11-arm64': 'https://playwright.azureedge.net/builds/firefox-beta/%s/firefox-beta-mac-11.0-arm64.zip',
    'mac12': 'https://playwright.azureedge.net/builds/firefox-beta/%s/firefox-beta-mac-11.zip',
    'mac12-arm64': 'https://playwright.azureedge.net/builds/firefox-beta/%s/firefox-beta-mac-11.0-arm64.zip',
    'win64': 'https://playwright.azureedge.net/builds/firefox-beta/%s/firefox-beta-win64.zip',
  },
};

async function ensureFirefoxBuild(browserName, buildNumber, buildPlatform) {
  if (!buildNumber)
    buildNumber = (await fs.promises.readFile(path.join(__dirname, browserName, 'BUILD_NUMBER'), 'utf8')).split('\n').shift();
  if (!buildPlatform)
    buildPlatform = getHostPlatform();
  const currentBuildInfo = await fs.promises.readFile(BUILD_INFO_PATH).then(text => JSON.parse(text)).catch(e => ({ buildPlatform: '', buildNumber: '', browserName: '' }));

  if (currentBuildInfo.buildPlatform === buildPlatform && currentBuildInfo.buildNumber === buildNumber && currentBuildInfo.browserName === browserName)
    return currentBuildInfo;
  await fs.promises.rm(BUILD_DIRECTORY, { recursive: true }).catch(e => {});
  await fs.promises.mkdir(BUILD_DIRECTORY);
  const buildZipPath = path.join(BUILD_DIRECTORY, 'firefox.zip');

  const urlTemplate = DOWNLOAD_URLS[browserName][buildPlatform];
  if (!urlTemplate)
    throw new Error(`ERROR: repack-juggler does not support ${buildPlatform}`);
  const url = util.format(urlTemplate, buildNumber);
  console.log(`Downloading ${browserName} r${buildNumber} for ${buildPlatform} - it might take a few minutes`);
  await downloadFile(url, buildZipPath);
  await spawnAsync('unzip', [ buildZipPath ], { cwd: BUILD_DIRECTORY });
  const buildInfo = { buildNumber, buildPlatform, browserName };
  await fs.promises.writeFile(BUILD_INFO_PATH, JSON.stringify(buildInfo), 'utf8');
  return buildInfo;
}

async function repackageJuggler(browserName, buildInfo) {
  const { buildNumber, buildPlatform } = buildInfo;

  // Find all omni.ja files in the Firefox build.
  const omniPaths = await spawnAsync('find', ['.', '-name', 'omni.ja'], {
    cwd: BUILD_DIRECTORY,
  }).then(({ stdout }) => stdout.trim().split('\n').map(aPath => path.join(BUILD_DIRECTORY, aPath)));

  // Iterate over all omni.ja files and find one that has juggler inside.
  const omniWithJugglerPath = await (async () => {
    for (const omniPath of omniPaths) {
      const { stdout } = await spawnAsync('unzip', ['-Z1', omniPath], { cwd: BUILD_DIRECTORY });
      if (stdout.includes('chrome/juggler'))
        return omniPath;
    }
    return null;
  })();

  if (!omniWithJugglerPath) {
    console.error('ERROR: did not find omni.ja file with baked in Juggler!');
    process.exit(1);
  } else {
    if (!(await existsAsync(OMNI_BACKUP_PATH)))
      await fs.promises.copyFile(omniWithJugglerPath, OMNI_BACKUP_PATH);
  }

  // Let's repackage omni folder!
  await fs.promises.rm(OMNI_EXTRACT_DIR, { recursive: true }).catch(e => {});
  await fs.promises.mkdir(OMNI_EXTRACT_DIR);

  await spawnAsync('unzip', [OMNI_BACKUP_PATH], { cwd: OMNI_EXTRACT_DIR });
  // Remove current juggler directory
  await fs.promises.rm(OMNI_JUGGLER_DIR, { recursive: true });
  // Repopulate with tip-of-tree juggler files
  const jarmn = await fs.promises.readFile(JARMN_PATH, 'utf8');
  const jarLines = jarmn.split('\n').map(line => line.trim()).filter(line => line.startsWith('content/') && line.endsWith(')'));
  for (const line of jarLines) {
    const tokens = line.split(/\s+/);
    const toPath = path.join(OMNI_JUGGLER_DIR, tokens[0]);
    const fromPath = path.join(__dirname, browserName, 'juggler', tokens[1].slice(1, -1));
    await fs.promises.mkdir(path.dirname(toPath), { recursive: true });
    await fs.promises.copyFile(fromPath, toPath);
  }

  await fs.promises.unlink(omniWithJugglerPath);
  await spawnAsync('zip', ['-0', '-qr9XD', omniWithJugglerPath, '.'], { cwd: OMNI_EXTRACT_DIR, stdio: 'inherit' });

  const module = await import(path.join(__dirname, browserName, 'install-preferences.js'));
  await module.default.installFirefoxPreferences(path.join(BUILD_DIRECTORY, 'firefox'));

  // Output executable path to be used in test.
  console.log(`
    browser: ${browserName}
    buildNumber: ${buildNumber}
    buildPlatform: ${buildPlatform}
    executablePath: ${path.join(BUILD_DIRECTORY, ...EXECUTABLE_PATHS[buildPlatform])}
  `);
}


function httpRequest(url, method, response) {
  const options = URL.parse(url);
  options.method = method;

  const requestCallback = res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
      httpRequest(res.headers.location, method, response);
    else
      response(res);
  };
  const request = options.protocol === 'https:' ?
    https.request(options, requestCallback) :
    http.request(options, requestCallback);
  request.end();
  return request;
}

function downloadFile(url, destinationPath, progressCallback) {
  let fulfill = ({ error }) => {};
  let downloadedBytes = 0;
  let totalBytes = 0;

  const promise = new Promise(x => { fulfill = x; });

  const request = httpRequest(url, 'GET', response => {
    if (response.statusCode !== 200) {
      const error = new Error(`Download failed: server returned code ${response.statusCode}. URL: ${url}`);
      // consume response data to free up memory
      response.resume();
      fulfill({ error });
      return;
    }
    const file = fs.createWriteStream(destinationPath);
    file.on('finish', () => fulfill({ error: null }));
    file.on('error', error => fulfill({ error }));
    response.pipe(file);
    totalBytes = parseInt(response.headers['content-length'], 10);
    if (progressCallback)
      response.on('data', onData);
  });
  request.on('error', error => fulfill({ error }));
  return promise;

  function onData(chunk) {
    downloadedBytes += chunk.length;
    progressCallback(downloadedBytes, totalBytes);
  }
}

function spawnAsync(cmd, args, options) {
  // console.log(cmd, ...args, 'CWD:', options.cwd);
  const process = child_process.spawn(cmd, args, options);

  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    if (process.stdout)
      process.stdout.on('data', data => stdout += data);
    if (process.stderr)
      process.stderr.on('data', data => stderr += data);
    process.on('close', code => resolve({ stdout, stderr, code }));
    process.on('error', error => resolve({ stdout, stderr, code: 0, error }));
  });
}

function getUbuntuVersionSync() {
  if (os.platform() !== 'linux')
    return '';
  try {
    let osReleaseText;
    if (fs.existsSync('/etc/upstream-release/lsb-release'))
      osReleaseText = fs.readFileSync('/etc/upstream-release/lsb-release', 'utf8');
    else
      osReleaseText = fs.readFileSync('/etc/os-release', 'utf8');
    if (!osReleaseText)
      return '';
    return getUbuntuVersionInternal(osReleaseText);
  } catch (e) {
    return '';
  }
}

function getUbuntuVersionInternal(osReleaseText) {
  const fields = new Map();
  for (const line of osReleaseText.split('\n')) {
    const tokens = line.split('=');
    const name = tokens.shift();
    let value = tokens.join('=').trim();
    if (value.startsWith('"') && value.endsWith('"'))
      value = value.substring(1, value.length - 1);
    if (!name)
      continue;
    fields.set(name.toLowerCase(), value);
  }
  // For Linux mint
  if (fields.get('distrib_id') && fields.get('distrib_id').toLowerCase() === 'ubuntu')
    return fields.get('distrib_release') || '';
  if (!fields.get('name') || fields.get('name').toLowerCase() !== 'ubuntu')
    return '';
  return fields.get('version_id') || '';
}

function getHostPlatform() {
  const platform = os.platform();
  if (platform === 'darwin') {
    const [major, minor] = child_process.execSync('sw_vers -productVersion', {
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString('utf8').trim().split('.').map(x => parseInt(x, 10));
    let arm64 = false;
    // BigSur is the first version that might run on Apple Silicon.
    if (major >= 11) {
      arm64 = child_process.execSync('/usr/sbin/sysctl -in hw.optional.arm64', {
        stdio: ['ignore', 'pipe', 'ignore']
      }).toString().trim() === '1';
    }
    const LAST_STABLE_MAC_MAJOR_VERSION = 11;
    // All new MacOS releases increase major version.
    let macVersion = `${major}`;
    if (major === 10) {
      // Pre-BigSur MacOS was increasing minor version every release.
      macVersion = `${major}.${minor}`;
    } else if (major > LAST_STABLE_MAC_MAJOR_VERSION) {
      // Best-effort support for MacOS beta versions.
      macVersion = LAST_STABLE_MAC_MAJOR_VERSION + '';
    }
    const archSuffix = arm64 ? '-arm64' : '';
    return `mac${macVersion}${archSuffix}`;
  }
  if (platform === 'linux') {
    const ubuntuVersion = getUbuntuVersionSync();
    if (parseInt(ubuntuVersion, 10) <= 19)
      return 'ubuntu18.04';
    return 'ubuntu20.04';
  }
  if (platform === 'win32')
    return 'win64';
  return platform;
}

async function main() {
  const buildInfo = await ensureFirefoxBuild(browserName, process.argv[3], process.argv[4]);
  await repackageJuggler(browserName, buildInfo);
}

await main();

