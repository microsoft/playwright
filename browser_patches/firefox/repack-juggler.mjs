#!/usr/bin/env node

import {spawn} from 'child_process';
import * as path from 'path';
import * as URL from 'url';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';

const existsAsync = path => new Promise(resolve => fs.stat(path, err => resolve(!err)));

const __filename = URL.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to jar.mn in the juggler
const JARMN_PATH = path.join(__dirname, 'juggler', 'jar.mn');
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
  'mac10.13': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
  'mac10.14': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
  'mac10.15': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
  'mac11': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
  'mac11-arm64': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
  'win32': ['firefox', 'firefox.exe'],
  'win64': ['firefox', 'firefox.exe'],
};

const buildNumber = (await fs.promises.readFile(path.join(__dirname, 'BUILD_NUMBER'), 'utf8')).split('\n').shift();
const expectedBuilds = (await fs.promises.readFile(path.join(__dirname, 'EXPECTED_BUILDS'), 'utf8')).split('\n');

if (process.argv.length !== 3) {
  console.error(`ERROR: pass build name to repackage - one of ${expectedBuilds.join(', ')}`);
  process.exit(1);
}

const buildName = process.argv[2];
if (!expectedBuilds.includes(buildName)) {
  console.error(`ERROR: expected argument to be one of ${expectedBuilds.join(', ')}, received - "${buildName}"`);
  process.exit(1);
}

const currentBuildInfo = await fs.promises.readFile(BUILD_INFO_PATH).then(text => JSON.parse(text)).catch(e => ({ buildName: '', buildNumber: '' }));

if (currentBuildInfo.buildName !== buildName || currentBuildInfo.buildNumber !== buildNumber) {
  await fs.promises.rm(BUILD_DIRECTORY, { recursive: true }).catch(e => {});
  await fs.promises.mkdir(BUILD_DIRECTORY);
  const buildZipPath = path.join(BUILD_DIRECTORY, 'firefox.zip');
  console.log(`Downloading ${buildName} ${buildNumber} - it might take a few minutes`);
  await downloadFile(`https://playwright.azureedge.net/builds/firefox/${buildNumber}/${buildName}`, buildZipPath);
  await spawnAsync('unzip', [ buildZipPath ], {cwd: BUILD_DIRECTORY});
  await fs.promises.writeFile(BUILD_INFO_PATH, JSON.stringify({ buildNumber, buildName }), 'utf8');
}

// Find all omni.ja files in the Firefox build.
const omniPaths = await spawnAsync('find', ['.', '-name', 'omni.ja'], {
  cwd: BUILD_DIRECTORY,
}).then(({stdout}) => stdout.trim().split('\n').map(aPath => path.join(BUILD_DIRECTORY, aPath)));

// Iterate over all omni.ja files and find one that has juggler inside.
const omniWithJugglerPath = await (async () => {
  for (const omniPath of omniPaths) {
    const {stdout} = await spawnAsync('unzip', ['-Z1', omniPath], {cwd: BUILD_DIRECTORY});
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

await spawnAsync('unzip', [OMNI_BACKUP_PATH], {cwd: OMNI_EXTRACT_DIR });
// Remove current juggler directory
await fs.promises.rm(OMNI_JUGGLER_DIR, { recursive: true });
// Repopulate with tip-of-tree juggler files
const jarmn = await fs.promises.readFile(JARMN_PATH, 'utf8');
const jarLines = jarmn.split('\n').map(line => line.trim()).filter(line => line.startsWith('content/') && line.endsWith(')'));
for (const line of jarLines) {
  const tokens = line.split(/\s+/);
  const toPath = path.join(OMNI_JUGGLER_DIR, tokens[0]);
  const fromPath = path.join(__dirname, 'juggler', tokens[1].slice(1, -1));
  await fs.promises.mkdir(path.dirname(toPath), { recursive: true});
  await fs.promises.copyFile(fromPath, toPath);
}

await fs.promises.rm(omniWithJugglerPath);
await spawnAsync('zip', ['-0', '-qr9XD', omniWithJugglerPath, '.'], {cwd: OMNI_EXTRACT_DIR, stdio: 'inherit'});

// Output executable path to be used in test.
const buildPlatform = buildName.substring('firefox-'.length).slice(0, -'.zip'.length).replace('-', '');
console.log(`
  buildName: ${buildName}
  buildNumber: ${buildNumber}
  executablePath: ${path.join(BUILD_DIRECTORY, ...EXECUTABLE_PATHS[buildPlatform])}
`);


function httpRequest(url, method, response) {
  let options = URL.parse(url);
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
  let fulfill = ({error}) => {};
  let downloadedBytes = 0;
  let totalBytes = 0;

  const promise = new Promise(x => { fulfill = x; });

  const request = httpRequest(url, 'GET', response => {
    if (response.statusCode !== 200) {
      const error = new Error(`Download failed: server returned code ${response.statusCode}. URL: ${url}`);
      // consume response data to free up memory
      response.resume();
      fulfill({error});
      return;
    }
    const file = fs.createWriteStream(destinationPath);
    file.on('finish', () => fulfill({error: null}));
    file.on('error', error => fulfill({error}));
    response.pipe(file);
    totalBytes = parseInt(response.headers['content-length'], 10);
    if (progressCallback)
      response.on('data', onData);
  });
  request.on('error', error => fulfill({error}));
  return promise;

  function onData(chunk) {
    downloadedBytes += chunk.length;
    progressCallback(downloadedBytes, totalBytes);
  }
}

function spawnAsync(cmd, args, options) {
  // console.log(cmd, ...args, 'CWD:', options.cwd);
  const process = spawn(cmd, args, options);

  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    if (process.stdout)
      process.stdout.on('data', data => stdout += data);
    if (process.stderr)
      process.stderr.on('data', data => stderr += data);
    process.on('close', code => resolve({stdout, stderr, code}));
    process.on('error', error => resolve({stdout, stderr, code: 0, error}));
  });
}
