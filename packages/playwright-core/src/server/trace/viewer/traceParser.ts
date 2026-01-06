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

import url from 'url';
import { ZipFile } from '../../utils/zipFile';
import type { TraceLoaderBackend } from '@isomorphic/trace/traceLoader';

export class ZipTraceLoaderBackend implements TraceLoaderBackend {
  private _zipFile: ZipFile;
  private _traceFile: string;

  constructor(traceFile: string) {
    this._traceFile = traceFile;
    this._zipFile = new ZipFile(traceFile);
  }

  isLive() {
    return false;
  }

  traceURL() {
    return url.pathToFileURL(this._traceFile).toString();
  }

  async entryNames(): Promise<string[]> {
    return await this._zipFile.entries();
  }

  async hasEntry(entryName: string): Promise<boolean> {
    const entries = await this.entryNames();
    return entries.includes(entryName);
  }

  async readText(entryName: string): Promise<string | undefined> {
    try {
      const buffer = await this._zipFile.read(entryName);
      return buffer.toString('utf-8');
    } catch {
    }
  }

  async readBlob(entryName: string): Promise<Blob | undefined> {
    try {
      const buffer = await this._zipFile.read(entryName);
      return new Blob([new Uint8Array(buffer)]);
    } catch {
    }
  }
}
