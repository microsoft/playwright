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

import * as extract from 'extract-zip';
import * as fs from 'fs';
import * as os from 'os';
import * as util from 'util';
import { execSync } from 'child_process';
import * as ProxyAgent from 'https-proxy-agent';
import * as path from 'path';
import { getProxyForUrl } from 'proxy-from-env';
import * as URL from 'url';
import { assert } from '../helper';
import * as platform from '../platform';

const unlinkAsync = platform.promisify(fs.unlink.bind(fs));
const chmodAsync = platform.promisify(fs.chmod.bind(fs));
const existsAsync = (path: string): Promise<boolean> => new Promise(resolve => fs.stat(path, err => resolve(!err)));

const DEFAULT_DOWNLOAD_HOSTS = {
  chromium: 'https://storage.googleapis.com',
  firefox: 'https://playwright.azureedge.net',
  webkit: 'https://playwright.azureedge.net',
};

const DOWNLOAD_URLS = {
  chromium: {
    'linux': '%s/chromium-browser-snapshots/Linux_x64/%d/chrome-linux.zip',
    'mac10.14': '%s/chromium-browser-snapshots/Mac/%d/chrome-mac.zip',
    'mac10.15': '%s/chromium-browser-snapshots/Mac/%d/chrome-mac.zip',
    'win32': '%s/chromium-browser-snapshots/Win/%d/chrome-win.zip',
    'win64': '%s/chromium-browser-snapshots/Win_x64/%d/chrome-win.zip',
  },
  firefox: {
    'linux': '%s/builds/firefox/%s/firefox-linux.zip',
    'mac10.14': '%s/builds/firefox/%s/firefox-mac.zip',
    'mac10.15': '%s/builds/firefox/%s/firefox-mac.zip',
    'win32': '%s/builds/firefox/%s/firefox-win32.zip',
    'win64': '%s/builds/firefox/%s/firefox-win64.zip',
  },
  webkit: {
    'linux': '%s/builds/webkit/%s/minibrowser-gtk-wpe.zip',
    'mac10.14': '%s/builds/webkit/%s/minibrowser-mac-10.14.zip',
    'mac10.15': '%s/builds/webkit/%s/minibrowser-mac-10.15.zip',
    'win32': '%s/builds/webkit/%s/minibrowser-win64.zip',
    'win64': '%s/builds/webkit/%s/minibrowser-win64.zip',
  },
};

const RELATIVE_EXECUTABLE_PATHS = {
  chromium: {
    'linux': ['chrome-linux', 'chrome'],
    'mac10.14': ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    'mac10.15': ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    'win32': ['chrome-win', 'chrome.exe'],
    'win64': ['chrome-win', 'chrome.exe'],
  },
  firefox: {
    'linux': ['firefox', 'firefox'],
    'mac10.14': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
    'mac10.15': ['firefox', 'Nightly.app', 'Contents', 'MacOS', 'firefox'],
    'win32': ['firefox', 'firefox.exe'],
    'win64': ['firefox', 'firefox.exe'],
  },
  webkit: {
    'linux': ['pw_run.sh'],
    'mac10.14': ['pw_run.sh'],
    'mac10.15': ['pw_run.sh'],
    'win32': ['MiniBrowser.exe'],
    'win64': ['MiniBrowser.exe'],
  },
};

export type OnProgressCallback = (downloadedBytes: number, totalBytes: number) => void;
export type BrowserName = ('chromium'|'webkit'|'firefox');
export type BrowserPlatform = ('win32'|'win64'|'mac10.14'|'mac10.15'|'linux');

export type DownloadOptions = {
  browser: BrowserName,
  revision: string,
  downloadPath: string,
  platform?: BrowserPlatform,
  host?: string,
  progress?: OnProgressCallback,
};

const CURRENT_HOST_PLATFORM = ((): string => {
  const platform = os.platform();
  if (platform === 'darwin') {
    const macVersion = execSync('sw_vers -productVersion').toString('utf8').trim().split('.').slice(0, 2).join('.');
    return `mac${macVersion}`;
  }
  if (platform === 'linux')
    return 'linux';
  if (platform === 'win32')
    return os.arch() === 'x64' ? 'win64' : 'win32';
  return platform;
})();

function revisionURL(options: DownloadOptions): string {
  const {
    browser,
    revision,
    platform = CURRENT_HOST_PLATFORM,
    host = DEFAULT_DOWNLOAD_HOSTS[browser],
  } = options;
  assert(revision, `'revision' must be specified`);
  assert(DOWNLOAD_URLS[browser], 'Unsupported browser: ' + browser);
  const urlTemplate = (DOWNLOAD_URLS[browser] as any)[platform];
  assert(urlTemplate, `ERROR: Playwright does not support ${browser} on ${platform}`);
  return util.format(urlTemplate, host, revision);
}

export async function downloadBrowser(options: DownloadOptions): Promise<string> {
  const {
    browser,
    revision,
    downloadPath,
    platform = CURRENT_HOST_PLATFORM,
    progress,
  } = options;
  assert(downloadPath, '`downloadPath` must be provided');
  const url = revisionURL(options);
  const zipPath = path.join(os.tmpdir(), `playwright-download-${browser}-${platform}-${revision}.zip`);
  if (await existsAsync(downloadPath))
    throw new Error('ERROR: downloadPath folder already exists!');
  try {
    await downloadFile(url, zipPath, progress);
    // await mkdirAsync(downloadPath, {recursive: true});
    await extractZip(zipPath, downloadPath);
  } finally {
    if (await existsAsync(zipPath))
      await unlinkAsync(zipPath);
  }
  const executablePath = path.join(downloadPath, ...RELATIVE_EXECUTABLE_PATHS[browser][platform as BrowserPlatform]);
  await chmodAsync(executablePath, 0o755);
  return executablePath;
}

export async function canDownload(options: DownloadOptions): Promise<boolean> {
  const url = revisionURL(options);
  let resolve: (result: boolean) => void = () => {};
  const promise = new Promise<boolean>(x => resolve = x);
  const request = httpRequest(url, 'HEAD', response => {
    resolve(response.statusCode === 200);
  });
  request.on('error', (error: any) => {
    console.error(error);
    resolve(false);
  });
  return promise;
}

function downloadFile(url: string, destinationPath: string, progressCallback: OnProgressCallback | undefined): Promise<any> {
  let fulfill: () => void = () => {};
  let reject: (error: any) => void = () => {};
  let downloadedBytes = 0;
  let totalBytes = 0;

  const promise = new Promise((x, y) => { fulfill = x; reject = y; });

  const request = httpRequest(url, 'GET', response => {
    if (response.statusCode !== 200) {
      const error = new Error(`Download failed: server returned code ${response.statusCode}. URL: ${url}`);
      // consume response data to free up memory
      response.resume();
      reject(error);
      return;
    }
    const file = fs.createWriteStream(destinationPath);
    file.on('finish', () => fulfill());
    file.on('error', error => reject(error));
    response.pipe(file);
    totalBytes = parseInt(response.headers['content-length'], 10);
    if (progressCallback)
      response.on('data', onData);
  });
  request.on('error', (error: any) => reject(error));
  return promise;

  function onData(chunk: string) {
    downloadedBytes += chunk.length;
    progressCallback!(downloadedBytes, totalBytes);
  }
}

function extractZip(zipPath: string, folderPath: string): Promise<Error | null> {
  return new Promise((fulfill, reject) => extract(zipPath, {dir: folderPath}, err => {
    if (err)
      reject(err);
    else
      fulfill();
  }));
}

function httpRequest(url: string, method: string, response: (r: any) => void) {
  let options: any = URL.parse(url);
  options.method = method;

  const proxyURL = getProxyForUrl(url);
  if (proxyURL) {
    if (url.startsWith('http:')) {
      const proxy = URL.parse(proxyURL);
      options = {
        path: options.href,
        host: proxy.hostname,
        port: proxy.port,
      };
    } else {
      const parsedProxyURL: any = URL.parse(proxyURL);
      parsedProxyURL.secureProxy = parsedProxyURL.protocol === 'https:';

      options.agent = new ProxyAgent(parsedProxyURL);
      options.rejectUnauthorized = false;
    }
  }

  const requestCallback = (res: any) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
      httpRequest(res.headers.location, method, response);
    else
      response(res);
  };
  const request = options.protocol === 'https:' ?
    require('https').request(options, requestCallback) :
    require('http').request(options, requestCallback);
  request.end();
  return request;
}
