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

export class LocalUtilsDispatcher extends Dispatcher<{ guid: string }, channels.LocalUtilsChannel> implements channels.LocalUtilsChannel {
  _type_LocalUtils: boolean;
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
}
