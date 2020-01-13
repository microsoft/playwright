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
import * as path from 'path';
import * as platform from '../platform';
import { getProxyForUrl } from 'proxy-from-env';
import * as removeRecursive from 'rimraf';
import * as URL from 'url';
import { assert } from '../helper';

const readdirAsync = platform.promisify(fs.readdir.bind(fs));
const mkdirAsync = platform.promisify(fs.mkdir.bind(fs));
const unlinkAsync = platform.promisify(fs.unlink.bind(fs));
const chmodAsync = platform.promisify(fs.chmod.bind(fs));

function existsAsync(filePath: string): Promise<boolean> {
  let fulfill: (exists: boolean) => void;
  const promise = new Promise<boolean>(x => fulfill = x);
  fs.access(filePath, err => fulfill(!err));
  return promise;
}

type ParamsGetter = (platform: string, revision: string) => { downloadUrl: string, executablePath: string };

export type OnProgressCallback = (downloadedBytes: number, totalBytes: number) => void;

export class BrowserFetcher {
  private _downloadsFolder: string;
  private _platform: string;
  private _preferredRevision: string;
  private _params: ParamsGetter;

  constructor(downloadsFolder: string, platform: string, preferredRevision: string, params: ParamsGetter) {
    this._downloadsFolder = downloadsFolder;
    this._platform = platform;
    this._preferredRevision = preferredRevision;
    this._params = params;
  }

  canDownload(revision: string = this._preferredRevision): Promise<boolean> {
    const url = this._params(this._platform, revision).downloadUrl;
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

  async download(revision: string = this._preferredRevision, progressCallback?: OnProgressCallback): Promise<BrowserFetcherRevisionInfo> {
    const url = this._params(this._platform, revision).downloadUrl;
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
    const fileNames: string[] = await readdirAsync(this._downloadsFolder);
    return fileNames.map(fileName => parseFolderPath(fileName)).filter(entry => entry && entry.platform === this._platform).map(entry => entry!.revision);
  }

  async remove(revision: string = this._preferredRevision) {
    const folderPath = this._getFolderPath(revision);
    assert(await existsAsync(folderPath), `Failed to remove: revision ${revision} is not downloaded`);
    await new Promise(fulfill => removeRecursive(folderPath, fulfill));
  }

  revisionInfo(revision: string = this._preferredRevision): BrowserFetcherRevisionInfo {
    const folderPath = this._getFolderPath(revision);
    const params = this._params(this._platform, revision);
    const local = fs.existsSync(folderPath);
    return {revision, executablePath: path.join(folderPath, params.executablePath), folderPath, local, url: params.downloadUrl};
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
  return {platform, revision};
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

export type BrowserFetcherOptions = {
  platform?: string,
  path?: string,
  host?: string,
};

export type BrowserFetcherRevisionInfo = {
  folderPath: string,
  executablePath: string,
  url: string,
  local: boolean,
  revision: string,
};
