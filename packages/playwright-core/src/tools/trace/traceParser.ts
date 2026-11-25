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
import { resolveWithinRoot } from '@utils/fileUtils';
import { ZipFile } from '@utils/zipFile';

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
    const resolved = resolveWithinRoot(this._dir, entryName);
    if (!resolved)
      return false;
    try {
      await fs.promises.access(resolved);
      return true;
    } catch {
      return false;
    }
  }

  async readText(entryName: string): Promise<string | undefined> {
    const resolved = resolveWithinRoot(this._dir, entryName);
    if (!resolved)
      return;
    try {
      return await fs.promises.readFile(resolved, 'utf-8');
    } catch {
    }
  }

  async readBlob(entryName: string): Promise<Blob | undefined> {
    const resolved = resolveWithinRoot(this._dir, entryName);
    if (!resolved)
      return;
    try {
      const buffer = await fs.promises.readFile(resolved);
      return new Blob([new Uint8Array(buffer)]);
    } catch {
    }
  }
}

export class ZipTraceLoaderBackend implements TraceLoaderBackend {
  private _zipFile: ZipFile;

  constructor(zipFile: ZipFile) {
    this._zipFile = zipFile;
  }

  isLive() {
    return false;
  }

  async entryNames(): Promise<string[]> {
    return await this._zipFile.entries();
  }

  async hasEntry(entryName: string): Promise<boolean> {
    const entries = await this._zipFile.entries();
    return entries.includes(entryName);
  }

  async readText(entryName: string): Promise<string | undefined> {
    try {
      const buffer = await this._zipFile.read(entryName);
      return buffer.toString('utf-8');
    } catch {
      return undefined;
    }
  }

  async readBlob(entryName: string): Promise<Blob | undefined> {
    try {
      const buffer = await this._zipFile.read(entryName);
      return new Blob([new Uint8Array(buffer)]);
    } catch {
      return undefined;
    }
  }
}

export class SingleFileTraceLoaderBackend implements TraceLoaderBackend {
  private _filePath: string;
  private _fileName: string;

  constructor(filePath: string) {
    this._filePath = filePath;
    this._fileName = path.basename(filePath);
  }

  isLive() {
    return false;
  }

  async entryNames(): Promise<string[]> {
    return [this._fileName];
  }

  async hasEntry(entryName: string): Promise<boolean> {
    return entryName === this._fileName;
  }

  async readText(entryName: string): Promise<string | undefined> {
    if (entryName !== this._fileName)
      return undefined;
    try {
      return await fs.promises.readFile(this._filePath, 'utf-8');
    } catch {
      return undefined;
    }
  }

  async readBlob(entryName: string): Promise<Blob | undefined> {
    if (entryName !== this._fileName)
      return undefined;
    try {
      const buffer = await fs.promises.readFile(this._filePath);
      return new Blob([new Uint8Array(buffer)]);
    } catch {
      return undefined;
    }
  }
}

export async function extractTrace(traceFile: string, outDir: string): Promise<void> {
  const zipFile = new ZipFile(traceFile);
  try {
    const entries = await zipFile.entries();
    for (const entry of entries) {
      const outPath = resolveWithinRoot(outDir, entry);
      if (!outPath)
        throw new Error(`Trace entry '${entry}' escapes output directory`);
      await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
      const buffer = await zipFile.read(entry);
      await fs.promises.writeFile(outPath, buffer);
    }
  } finally {
    zipFile.close();
  }
}
