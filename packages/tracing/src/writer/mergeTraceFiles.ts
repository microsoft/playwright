/**
 * Copyright (c) Microsoft Corporation.
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

import fs from 'fs';

import * as yauzl from 'yauzl';
import * as yazl from 'yazl';
import { ManualPromise } from '@isomorphic/manualPromise';

import type EventEmitter from 'events';

// Merges multiple trace zip files into a single zip at `fileName`.
// `keepEntryName`, if present, marks the one entry whose name should not be
// prefixed with the source index — so the most recent trace's primary
// trace entry (e.g. "test.trace") survives un-renamed. Other entries
// matching `trace.<ext>` are namespaced as "<i>-trace.<ext>" to avoid
// collisions across the merged sources. The source files are deleted
// after a successful merge.
export async function mergeTraceFiles(fileName: string, temporaryTraceFiles: string[], options: { keepEntryName?: string } = {}): Promise<void> {
  temporaryTraceFiles = temporaryTraceFiles.filter(file => fs.existsSync(file));
  if (temporaryTraceFiles.length === 1) {
    await fs.promises.rename(temporaryTraceFiles[0], fileName);
    return;
  }

  const mergePromise = new ManualPromise();
  const zipFile = new yazl.ZipFile();
  const entryNames = new Set<string>();
  (zipFile as any as EventEmitter).on('error', error => mergePromise.reject(error));

  for (let i = temporaryTraceFiles.length - 1; i >= 0; --i) {
    const tempFile = temporaryTraceFiles[i];
    const promise = new ManualPromise<void>();
    yauzl.open(tempFile, (err, inZipFile) => {
      if (err) {
        promise.reject(err);
        return;
      }
      let pendingEntries = inZipFile.entryCount;
      inZipFile.on('entry', entry => {
        let entryName = entry.fileName;
        if (options.keepEntryName && entry.fileName === options.keepEntryName) {
          // Keep the name for this entry so the newest source's copy is the
          // one preserved. Note the reverse iteration order above.
        } else if (entry.fileName.match(/trace\.[a-z]*$/)) {
          entryName = i + '-' + entry.fileName;
        }
        if (entryNames.has(entryName)) {
          if (--pendingEntries === 0)
            promise.resolve();
          return;
        }
        entryNames.add(entryName);
        inZipFile.openReadStream(entry, (err, readStream) => {
          if (err) {
            promise.reject(err);
            return;
          }
          zipFile.addReadStream(readStream!, entryName);
          if (--pendingEntries === 0)
            promise.resolve();
        });
      });
    });
    await promise;
  }

  zipFile.end(undefined, () => {
    zipFile.outputStream.pipe(fs.createWriteStream(fileName)).on('close', () => {
      void Promise.all(temporaryTraceFiles.map(tempFile => fs.promises.unlink(tempFile))).then(() => {
        mergePromise.resolve();
      }).catch(error => mergePromise.reject(error));
    }).on('error', error => mergePromise.reject(error));
  });
  await mergePromise;
}
