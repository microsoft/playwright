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

import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';
import { helper } from '../helper';
import { mkdirIfNeeded } from '../../utils/utils';

const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));
const fsAppendFileAsync = util.promisify(fs.appendFile.bind(fs));
const fsAccessAsync = util.promisify(fs.access.bind(fs));

// Map from a trace file to the last writing operation.
// We do this to serialize multiple writes to the same trace file.
type AppendEventChain = { counter: number, promise: Promise<string> };
const appendEventChains = new Map<string, AppendEventChain>();

export class TraceFile {
  private _traceStoragePromise: Promise<string>;
  private _appendEventChain: AppendEventChain;

  constructor(traceStorageDir: string, traceFile: string) {
    this._traceStoragePromise = mkdirIfNeeded(path.join(traceStorageDir, 'sha1')).then(() => traceStorageDir);
    // All traces sharing the same file serialize their writes to that file
    // to avoid corrupted data by using a single shared promise chain.
    const chain = appendEventChains.get(traceFile);
    if (chain) {
      // Someone is already using this file, reuse the chain.
      chain.counter++;
      this._appendEventChain = chain;
    } else {
      // Noone is using this file, create a new chain.
      this._appendEventChain = { counter: 1, promise: mkdirIfNeeded(traceFile).then(() => traceFile) };
      appendEventChains.set(traceFile, this._appendEventChain);
    }
  }

  async writeArtifact(sha1: string, buffer: Buffer): Promise<void> {
    const traceDirectory = await this._traceStoragePromise;
    const filePath = path.join(traceDirectory, sha1);
    try {
      await fsAccessAsync(filePath);
    } catch (e) {
      // File does not exist - write it.
      await fsWriteFileAsync(filePath, buffer);
    }
  }

  async appendTraceEvent(event: any) {
    // Serialize writes to the trace file.
    this._appendEventChain.promise = this._appendEventChain.promise.then(async traceFile => {
      const timestamp = helper.monotonicTime();
      await fsAppendFileAsync(traceFile, JSON.stringify({...event, timestamp}) + '\n');
      return traceFile;
    });
  }

  async dispose() {
    const traceFile = await this._appendEventChain.promise;
    if (!--this._appendEventChain.counter) {
      // This was the last usage of a particular file, cleanup from the
      // shared map.
      appendEventChains.delete(traceFile);
    }
  }
}
