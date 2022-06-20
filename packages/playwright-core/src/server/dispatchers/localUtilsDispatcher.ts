/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

import type EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import type * as channels from '../../protocol/channels';
import { ManualPromise } from '../../utils/manualPromise';
import { assert, createGuid } from '../../utils';
import type { DispatcherScope } from './dispatcher';
import { Dispatcher } from './dispatcher';
import { yazl, yauzl } from '../../zipBundle';
import { ZipFile } from '../../utils/zipFile';
import type { HAREntry, HARFile } from '../../../types/types';
import type { HeadersArray } from '../types';

export class LocalUtilsDispatcher extends Dispatcher<{ guid: string }, channels.LocalUtilsChannel> implements channels.LocalUtilsChannel {
  _type_LocalUtils: boolean;
  private _harBakends = new Map<string, HarBackend>();

  constructor(scope: DispatcherScope) {
    super(scope, { guid: 'localUtils@' + createGuid() }, 'LocalUtils', {});
    this._type_LocalUtils = true;
  }

  async zip(params: channels.LocalUtilsZipParams, metadata?: channels.Metadata): Promise<void> {
    const promise = new ManualPromise<void>();
    const zipFile = new yazl.ZipFile();
    (zipFile as any as EventEmitter).on('error', error => promise.reject(error));

    for (const entry of params.entries) {
      try {
        if (fs.statSync(entry.value).isFile())
          zipFile.addFile(entry.value, entry.name);
      } catch (e) {
      }
    }

    if (!fs.existsSync(params.zipFile)) {
      // New file, just compress the entries.
      await fs.promises.mkdir(path.dirname(params.zipFile), { recursive: true });
      zipFile.end(undefined, () => {
        zipFile.outputStream.pipe(fs.createWriteStream(params.zipFile)).on('close', () => promise.resolve());
      });
      return promise;
    }

    // File already exists. Repack and add new entries.
    const tempFile = params.zipFile + '.tmp';
    await fs.promises.rename(params.zipFile, tempFile);

    yauzl.open(tempFile, (err, inZipFile) => {
      if (err) {
        promise.reject(err);
        return;
      }
      assert(inZipFile);
      let pendingEntries = inZipFile.entryCount;
      inZipFile.on('entry', entry => {
        inZipFile.openReadStream(entry, (err, readStream) => {
          if (err) {
            promise.reject(err);
            return;
          }
          zipFile.addReadStream(readStream!, entry.fileName);
          if (--pendingEntries === 0) {
            zipFile.end(undefined, () => {
              zipFile.outputStream.pipe(fs.createWriteStream(params.zipFile)).on('close', () => {
                fs.promises.unlink(tempFile).then(() => {
                  promise.resolve();
                });
              });
            });
          }
        });
      });
    });
    return promise;
  }

  async harOpen(params: channels.LocalUtilsHarOpenParams, metadata?: channels.Metadata): Promise<channels.LocalUtilsHarOpenResult> {
    let harBackend: HarBackend;
    if (params.file.endsWith('.zip')) {
      const zipFile = new ZipFile(params.file);
      const entryNames = await zipFile.entries();
      const harEntryName = entryNames.find(e => e.endsWith('.har'));
      if (!harEntryName)
        return { error: 'Specified archive does not have a .har file' };
      const har = await zipFile.read(harEntryName);
      const harFile = JSON.parse(har.toString()) as HARFile;
      harBackend = new HarBackend(harFile, null, zipFile);
    } else {
      const harFile = JSON.parse(await fs.promises.readFile(params.file, 'utf-8')) as HARFile;
      harBackend = new HarBackend(harFile, path.dirname(params.file), null);
    }
    this._harBakends.set(harBackend.id, harBackend);
    return { harId: harBackend.id };
  }

  async harLookup(params: channels.LocalUtilsHarLookupParams, metadata?: channels.Metadata): Promise<channels.LocalUtilsHarLookupResult> {
    const harBackend = this._harBakends.get(params.harId);
    if (!harBackend)
      return { action: 'error', message: `Internal error: har was not opened` };
    return await harBackend.lookup(params.url, params.method, params.headers, params.postData ? Buffer.from(params.postData, 'base64') : undefined, params.isNavigationRequest);
  }

  async harClose(params: channels.LocalUtilsHarCloseParams, metadata?: channels.Metadata): Promise<void> {
    const harBackend = this._harBakends.get(params.harId);
    if (harBackend) {
      this._harBakends.delete(harBackend.id);
      harBackend.dispose();
    }
  }
}

const redirectStatus = [301, 302, 303, 307, 308];

class HarBackend {
  readonly id = createGuid();
  private _harFile: HARFile;
  private _zipFile: ZipFile | null;
  private _baseDir: string | null;

  constructor(harFile: HARFile, baseDir: string | null, zipFile: ZipFile | null) {
    this._harFile = harFile;
    this._baseDir = baseDir;
    this._zipFile = zipFile;
  }

  async lookup(url: string, method: string, headers: HeadersArray, postData: Buffer | undefined, isNavigationRequest: boolean): Promise<{
      action: 'error' | 'redirect' | 'fulfill' | 'noentry',
      message?: string,
      redirectURL?: string,
      status?: number,
      headers?: HeadersArray,
      body?: string,
      base64Encoded?: boolean }> {
    let entry;
    try {
      entry = await this._harFindResponse(url, method, headers, postData);
    } catch (e) {
      return { action: 'error', message: 'HAR error: ' + e.message };
    }

    if (!entry)
      return { action: 'noentry' };

    // If navigation is being redirected, restart it with the final url to ensure the document's url changes.
    if (entry.request.url !== url && isNavigationRequest)
      return { action: 'redirect', redirectURL: entry.request.url };

    const response = entry.response;
    try {
      const buffer = await this._loadContent(response.content);
      return {
        action: 'fulfill',
        status: response.status,
        headers: response.headers,
        body: buffer.toString('base64'),
      };
    } catch (e) {
      return { action: 'error', message: e.message };
    }
  }

  private async _loadContent(content: { text?: string, encoding?: string, _sha1?: string }): Promise<Buffer> {
    const sha1 = content._sha1;
    let buffer: Buffer;
    if (sha1) {
      if (this._zipFile)
        buffer = await this._zipFile.read(sha1);
      else
        buffer = await fs.promises.readFile(path.resolve(this._baseDir!, sha1));
    } else {
      buffer = Buffer.from(content.text || '', content.encoding === 'base64' ? 'base64' : 'utf-8');
    }
    return buffer;
  }

  private async _harFindResponse(url: string, method: string, headers: HeadersArray, postData: Buffer | undefined): Promise<HAREntry | undefined> {
    const harLog = this._harFile.log;
    const visited = new Set<HAREntry>();
    while (true) {
      const entries = harLog.entries.filter(entry => entry.request.url === url && entry.request.method === method);
      if (!entries.length)
        return;

      let entry: HAREntry | undefined;

      if (entries.length > 1) {
        // Disambiguating requests

        // 1. Disambiguate by postData - this covers GraphQL
        if (!entry && postData) {
          for (const candidate of entries) {
            if (!candidate.request.postData)
              continue;
            const buffer = await this._loadContent(candidate.request.postData);
            if (buffer.equals(postData)) {
              entry = candidate;
              break;
            }
          }
        }

        // TODO: disambiguate by headers.
      }

      // Fall back to first entry.
      if (!entry)
        entry = entries[0];

      if (visited.has(entry))
        throw new Error(`Found redirect cycle for ${url}`);

      visited.add(entry);

      // Follow redirects.
      const locationHeader = entry.response.headers.find(h => h.name.toLowerCase() === 'location');
      if (redirectStatus.includes(entry.response.status) && locationHeader) {
        const locationURL = new URL(locationHeader.value, url);
        url = locationURL.toString();
        if ((entry.response.status === 301 || entry.response.status === 302) && method === 'POST' ||
          entry.response.status === 303 && !['GET', 'HEAD'].includes(method)) {
          // HTTP-redirect fetch step 13 (https://fetch.spec.whatwg.org/#http-redirect-fetch)
          method = 'GET';
        }
        continue;
      }

      return entry;
    }
  }

  dispose() {
    this._zipFile?.close();
  }
}
