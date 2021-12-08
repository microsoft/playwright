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

import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import yauzl from 'yauzl';
import yazl from 'yazl';
import * as channels from '../protocol/channels';
import { ManualPromise } from '../utils/async';
import { assert, calculateSha1 } from '../utils/utils';
import { SdkObject } from './instrumentation';

export class LocalUtils extends SdkObject {
  constructor(parent: SdkObject) {
    super(parent, 'LocalUtils');
  }

  async zipTrace(params: channels.LocalUtilsZipTraceParams): Promise<void> {
    const promise = new ManualPromise<void>();
    const zipFile = new yazl.ZipFile();
    (zipFile as any as EventEmitter).on('error', error => promise.reject(error));

    // Add sources.
    for (const source of params.sources) {
      try {
        if (fs.statSync(source).isFile())
          zipFile.addFile(source, 'resources/src@' + calculateSha1(source) + '.txt');
      } catch (e) {
      }
    }
    const filePath = params.traceFile;
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    // Local scenario, compress the entries.
    for (const entry of params.entries)
      zipFile.addFile(entry.value, entry.name);
    zipFile.end(undefined, () => {
      zipFile.outputStream.pipe(fs.createWriteStream(filePath)).on('close', () => promise.resolve());
    });
    return promise;
  }

  async addSourcesToTrace(params: channels.LocalUtilsAddSourcesToTraceParams): Promise<void> {
    const { traceFile, sources } = params;
    const promise = new ManualPromise<void>();
    const zipFile = new yazl.ZipFile();
    (zipFile as any as EventEmitter).on('error', error => promise.reject(error));

    // Add sources.
    for (const source of sources) {
      try {
        if (fs.statSync(source).isFile())
          zipFile.addFile(source, 'resources/src@' + calculateSha1(source) + '.txt');
      } catch (e) {
      }
    }

    const tempTraceFile = traceFile + '.tmp';
    await fs.promises.rename(traceFile, tempTraceFile);

    // Repack.
    yauzl.open(tempTraceFile, (err, inZipFile) => {
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
              zipFile.outputStream.pipe(fs.createWriteStream(traceFile)).on('close', () => {
                fs.promises.unlink(tempTraceFile).then(() => {
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
