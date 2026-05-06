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
import path from 'path';

import * as yauzl from 'yauzl';
import * as yazl from 'yazl';
import { ManualPromise } from '@isomorphic/manualPromise';
import { assert } from '@isomorphic/assert';
import { calculateSha1 } from '@utils/crypto';
import { serializeClientSideCallMetadata } from '@tracing/reader/traceUtils';

import { race } from './race';
import { deleteStackSession } from './stackSession';

import type { StackSession } from './stackSession';
import type { NameValue } from '@isomorphic/types';
import type EventEmitter from 'events';

export type ZipParams = {
  zipFile: string;
  entries: NameValue[];
  stacksId?: string;
  mode: 'write' | 'append';
  includeSources: boolean;
  additionalSources?: string[];
};

export async function zip(signal: AbortSignal, stackSessions: Map<string, StackSession>, params: ZipParams): Promise<void> {
  const promise = new ManualPromise<void>();
  const zipFile = new yazl.ZipFile();
  (zipFile as any as EventEmitter).on('error', error => promise.reject(error));

  const addFile = (file: string, name: string) => {
    try {
      if (fs.statSync(file).isFile())
        zipFile.addFile(file, name);
    } catch (e) {
    }
  };

  for (const entry of params.entries)
    addFile(entry.value, entry.name);

  // Add stacks and the sources.
  const stackSession = params.stacksId ? stackSessions.get(params.stacksId) : undefined;
  if (stackSession?.callStacks.length) {
    await race(signal, stackSession.writer);
    const buffer = Buffer.from(JSON.stringify(serializeClientSideCallMetadata(stackSession.callStacks)));
    zipFile.addBuffer(buffer, 'trace.stacks');
  }

  // Collect sources from stacks.
  if (params.includeSources) {
    const sourceFiles = new Set<string>(params.additionalSources);
    for (const { stack } of stackSession?.callStacks || []) {
      if (!stack)
        continue;
      for (const { file } of stack)
        sourceFiles.add(file);
    }
    for (const sourceFile of sourceFiles)
      addFile(sourceFile, 'resources/src@' + calculateSha1(sourceFile) + '.txt');
  }

  if (params.mode === 'write') {
    // New file, just compress the entries.
    await race(signal, fs.promises.mkdir(path.dirname(params.zipFile), { recursive: true }));
    zipFile.end(undefined, () => {
      zipFile.outputStream.pipe(fs.createWriteStream(params.zipFile))
          .on('close', () => promise.resolve())
          .on('error', error => promise.reject(error));
    });
    await race(signal, promise);
    await deleteStackSession(signal, stackSessions, params.stacksId);
    return;
  }

  // File already exists. Repack and add new entries.
  const tempFile = params.zipFile + '.tmp';
  await race(signal, fs.promises.rename(params.zipFile, tempFile));

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
              }).catch(error => promise.reject(error));
            });
          });
        }
      });
    });
  });
  await race(signal, promise);
  await deleteStackSession(signal, stackSessions, params.stacksId);
}
