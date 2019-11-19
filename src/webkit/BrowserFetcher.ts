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
import * as ProxyAgent from 'https-proxy-agent';
import * as os from 'os';
import * as path from 'path';
import { getProxyForUrl } from 'proxy-from-env';
import * as removeRecursive from 'rimraf';
import * as URL from 'url';
import * as util from 'util';
import { assert, helper } from '../helper';
import {execSync} from 'child_process';

const DEFAULT_DOWNLOAD_HOST = 'https://playwrightaccount.blob.core.windows.net';

const supportedPlatforms = ['linux', 'mac'];
const downloadURLs = {
  linux: '%s/builds/webkit/%s/minibrowser-linux.zip',
  mac: '%s/builds/webkit/%s/minibrowser-mac-%s.zip',
};
let cachedMacVersion = undefined;
function getMacVersion() {
  if (!cachedMacVersion) {
    const [major, minor] = execSync('sw_vers -productVersion').toString('utf8').trim().split('.');
    cachedMacVersion = major + '.' + minor;
  }
  return cachedMacVersion;
}

function downloadURL(platform: string, host: string, revision: string): string {
  if (platform === 'mac')
    return util.format(downloadURLs['mac'], host, revision, getMacVersion());
  return util.format(downloadURLs[platform], host, revision);
}

const readdirAsync = helper.promisify(fs.readdir.bind(fs));
const mkdirAsync = helper.promisify(fs.mkdir.bind(fs));
const unlinkAsync = helper.promisify(fs.unlink.bind(fs));
const chmodAsync = helper.promisify(fs.chmod.bind(fs));

function existsAsync(filePath) {
  let fulfill = null;
  const promise = new Promise(x => fulfill = x);
  fs.access(filePath, err => fulfill(!err));
  return promise;
}

export class BrowserFetcher {
  private _downloadsFolder: string;
  private _downloadHost: string;
  private _platform: string;

  constructor(projectRoot: string, options: BrowserFetcherOptions = {}) {
    this._downloadsFolder = options.path || path.join(projectRoot, '.local-webkit');
    this._downloadHost = options.host || DEFAULT_DOWNLOAD_HOST;
    this._platform = options.platform || '';
    if (!this._platform) {
      const platform = os.platform();
      if (platform === 'darwin')
        this._platform = 'mac';
      else if (platform === 'linux')
        this._platform = 'linux';
      else if (platform === 'win32')
        this._platform = 'linux'; // Windows gets linux binaries and uses WSL
      assert(this._platform, 'Unsupported platform: ' + os.platform());
    }
    assert(supportedPlatforms.includes(this._platform), 'Unsupported platform: ' + this._platform);
  }

  platform(): string {
    return this._platform;
  }

  canDownload(revision: string): Promise<boolean> {
    const url = downloadURL(this._platform, this._downloadHost, revision);
    let resolve;
    const promise = new Promise<boolean>(x => resolve = x);
    const request = httpRequest(url, 'HEAD', response => {
      resolve(response.statusCode === 200);
    });
    request.on('error', error => {
      console.error(error);
      resolve(false);
    });
    return promise;
  }
  async download(revision: string, progressCallback: ((arg0: number, arg1: number) => void) | null): Promise<BrowserFetcherRevisionInfo> {
    const url = downloadURL(this._platform, this._downloadHost, revision);
    const zipPath = path.join(this._downloadsFolder, `download-${this._platform}-${revision}.zip`);
    const folderPath = this._getFolderPath(revision);
    if (await existsAsync(folderPath))
      return this.revisionInfo(revision);
    if (!(await existsAsync(this._downloadsFolder)))
      await mkdirAsync(this._downloadsFolder);
    try {
      await downloadFile(url, zipPath, progressCallback);
      await extractZip(zipPath, folderPath);
    } finally {
      if (await existsAsync(zipPath))
        await unlinkAsync(zipPath);
    }
    const revisionInfo = this.revisionInfo(revision);
    if (revisionInfo)
      await chmodAsync(revisionInfo.executablePath, 0o755);
    return revisionInfo;
  }

  async localRevisions(): Promise<string[]> {
    if (!await existsAsync(this._downloadsFolder))
      return [];
    const fileNames = await readdirAsync(this._downloadsFolder);
    return fileNames.map(fileName => parseFolderPath(fileName)).filter(entry => entry && entry.platform === this._platform).map(entry => entry.revision);
  }

  async remove(revision: string) {
    const folderPath = this._getFolderPath(revision);
    assert(await existsAsync(folderPath), `Failed to remove: revision ${revision} is not downloaded`);
    await new Promise(fulfill => removeRecursive(folderPath, fulfill));
  }

  revisionInfo(revision: string): BrowserFetcherRevisionInfo {
    const folderPath = this._getFolderPath(revision);
    let executablePath = '';
    if (this._platform === 'linux' || this._platform === 'mac')
      executablePath = path.join(folderPath, 'pw_run.sh');
    else
      throw new Error('Unsupported platform: ' + this._platform);
    const url = downloadURL(this._platform, this._downloadHost, revision);
    const local = fs.existsSync(folderPath);
    return {revision, executablePath, folderPath, local, url};
  }

  _getFolderPath(revision: string): string {
    return path.join(this._downloadsFolder, this._platform + '-' + revision);
  }
}

function parseFolderPath(folderPath: string): { platform: string; revision: string; } | null {
  const name = path.basename(folderPath);
  const splits = name.split('-');
  if (splits.length !== 2)
    return null;
  const [platform, revision] = splits;
  if (!supportedPlatforms.includes(platform))
    return null;
  return {platform, revision};
}

function downloadFile(url: string, destinationPath: string, progressCallback: ((arg0: number, arg1: number) => void) | null): Promise<any> {
  let fulfill, reject;
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
  request.on('error', error => reject(error));
  return promise;

  function onData(chunk) {
    downloadedBytes += chunk.length;
    progressCallback(downloadedBytes, totalBytes);
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

  const requestCallback = res => {
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

export type BrowserFetcherOptions = {
  platform?: string,
  path?: string,
  host ?: string,
};

type BrowserFetcherRevisionInfo = {
  folderPath: string,
  executablePath: string,
  url: string,
  local: boolean,
  revision: string,
};
