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
import type { Log } from '../har/har';

export class LocalUtilsDispatcher extends Dispatcher<{ guid: string }, channels.LocalUtilsChannel> implements channels.LocalUtilsChannel {
  _type_LocalUtils: boolean;
  private _harCache = new Map<string, Map<string, Log>>();

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

  async harFindEntry(params: channels.LocalUtilsHarFindEntryParams, metadata?: channels.Metadata): Promise<channels.LocalUtilsHarFindEntryResult> {
    try {
      let cache = this._harCache.get(params.cacheKey);
      if (!cache) {
        cache = new Map();
        this._harCache.set(params.cacheKey, cache);
      }

      let harLog = cache.get(params.harFile);
      if (!harLog) {
        const contents = await fs.promises.readFile(params.harFile, 'utf-8');
        harLog = JSON.parse(contents).log as Log;
        cache.set(params.harFile, harLog);
      }

      const entry = harLog.entries.find(entry => entry.request.url === params.url);
      if (!entry)
        throw new Error(`No entry matching ${params.url}`);
      let base64body: string | undefined;
      if (params.needBody && entry.response.content && entry.response.content.text !== undefined) {
        if (entry.response.content.encoding === 'base64')
          base64body = entry.response.content.text;
        else
          base64body = Buffer.from(entry.response.content.text, 'utf8').toString('base64');
      }
      return { status: entry.response.status, headers: entry.response.headers, body: base64body };
    } catch (e) {
      return { error: `Error reading HAR file ${params.harFile}: ` + e.message };
    }
  }

  async harClearCache(params: channels.LocalUtilsHarClearCacheParams, metadata?: channels.Metadata): Promise<void> {
    this._harCache.delete(params.cacheKey);
  }
}
