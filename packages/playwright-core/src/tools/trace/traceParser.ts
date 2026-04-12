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
import { ZipFile } from '../../server/utils/zipFile';

import type { TraceLoaderBackend } from '@isomorphic/trace/traceLoader';

export class DirTraceLoaderBackend implements TraceLoaderBackend {
  private _dir: string;

  constructor(dir: string) {
    this._dir = dir;
  }

  isLive() {
    return false;
  }

  async entryNames(): Promise<string[]> {
    const entries: string[] = [];
    const walk = async (dir: string, prefix: string) => {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory())
          await walk(path.join(dir, item.name), prefix ? `${prefix}/${item.name}` : item.name);
        else
          entries.push(prefix ? `${prefix}/${item.name}` : item.name);
      }
    };
    await walk(this._dir, '');
    return entries;
  }

  async hasEntry(entryName: string): Promise<boolean> {
    try {
      await fs.promises.access(path.join(this._dir, entryName));
      return true;
    } catch {
      return false;
    }
  }

  async readText(entryName: string): Promise<string | undefined> {
    try {
      return await fs.promises.readFile(path.join(this._dir, entryName), 'utf-8');
    } catch {
    }
  }

  async readBlob(entryName: string): Promise<Blob | undefined> {
    try {
      const buffer = await fs.promises.readFile(path.join(this._dir, entryName));
      return new Blob([new Uint8Array(buffer)]);
    } catch {
    }
  }
}

export async function extractTrace(traceFile: string, outDir: string): Promise<void> {
  const zipFile = new ZipFile(traceFile);
  const entries = await zipFile.entries();
  for (const entry of entries) {
    const outPath = path.join(outDir, entry);
    await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
    const buffer = await zipFile.read(entry);
    await fs.promises.writeFile(outPath, buffer);
  }
  zipFile.close();
}
