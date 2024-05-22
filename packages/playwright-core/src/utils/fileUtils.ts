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

import fs from 'fs';
import path from 'path';
import { ManualPromise } from './manualPromise';
import type { EventEmitter } from 'events';
import { yazl } from '../zipBundle';

export const fileUploadSizeLimit = 50 * 1024 * 1024;

export const existsAsync = (path: string): Promise<boolean> => new Promise(resolve => fs.stat(path, err => resolve(!err)));

export async function mkdirIfNeeded(filePath: string) {
  // This will harmlessly throw on windows if the dirname is the root directory.
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
}

export async function removeFolders(dirs: string[]): Promise<Error[]> {
  return await Promise.all(dirs.map((dir: string) =>
    fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 10 }).catch(e => e)
  ));
}

export function canAccessFile(file: string) {
  if (!file)
    return false;

  try {
    fs.accessSync(file);
    return true;
  } catch (e) {
    return false;
  }
}

export async function copyFileAndMakeWritable(from: string, to: string) {
  await fs.promises.copyFile(from, to);
  await fs.promises.chmod(to, 0o664);
}

export function sanitizeForFilePath(s: string) {
  return s.replace(/[\x00-\x2C\x2E-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, '-');
}

export function toPosixPath(aPath: string): string {
  return aPath.split(path.sep).join(path.posix.sep);
}

type NameValue = { name: string, value: string };
type SerializedFSOperation = {
  op: 'mkdir', dir: string,
} | {
  op: 'writeFile', file: string, content: string | Buffer, skipIfExists?: boolean,
} | {
  op: 'appendFile', file: string, content: string,
} | {
  op: 'copyFile', from: string, to: string,
} | {
  op: 'zip', entries: NameValue[], zipFileName: string,
};

export class SerializedFS {
  private _buffers = new Map<string, string[]>(); // Should never be accessed from within appendOperation.
  private _error: Error | undefined;
  private _operations: SerializedFSOperation[] = [];
  private _operationsDone: ManualPromise<void>;

  constructor() {
    this._operationsDone = new ManualPromise();
    this._operationsDone.resolve();  // No operations scheduled yet.
  }

  mkdir(dir: string) {
    this._appendOperation({ op: 'mkdir', dir });
  }

  writeFile(file: string, content: string | Buffer, skipIfExists?: boolean) {
    this._buffers.delete(file); // No need to flush the buffer since we'll overwrite anyway.
    this._appendOperation({ op: 'writeFile', file, content, skipIfExists });
  }

  appendFile(file: string, text: string, flush?: boolean) {
    if (!this._buffers.has(file))
      this._buffers.set(file, []);
    this._buffers.get(file)!.push(text);
    if (flush)
      this._flushFile(file);
  }

  private _flushFile(file: string) {
    const buffer = this._buffers.get(file);
    if (buffer === undefined)
      return;
    const content = buffer.join('');
    this._buffers.delete(file);
    this._appendOperation({ op: 'appendFile', file, content });
  }

  copyFile(from: string, to: string) {
    this._flushFile(from);
    this._buffers.delete(to); // No need to flush the buffer since we'll overwrite anyway.
    this._appendOperation({ op: 'copyFile', from, to });
  }

  async syncAndGetError() {
    for (const file of this._buffers.keys())
      this._flushFile(file);
    await this._operationsDone;
    return this._error;
  }

  zip(entries: NameValue[], zipFileName: string) {
    for (const file of this._buffers.keys())
      this._flushFile(file);

    // Chain the export operation against write operations,
    // so that files do not change during the export.
    this._appendOperation({ op: 'zip', entries, zipFileName });
  }

  // This method serializes all writes to the trace.
  private _appendOperation(op: SerializedFSOperation): void {
    const last = this._operations[this._operations.length - 1];
    if (last?.op === 'appendFile' && op.op === 'appendFile' && last.file === op.file) {
      // Merge pending appendFile operations for performance.
      last.content += op.content;
      return;
    }

    this._operations.push(op);
    if (this._operationsDone.isDone())
      this._performOperations();
  }

  private async _performOperations() {
    this._operationsDone = new ManualPromise();
    while (this._operations.length) {
      const op = this._operations.shift()!;
      // Ignore all operations after the first error.
      if (this._error)
        continue;
      try {
        await this._performOperation(op);
      } catch (e) {
        this._error = e;
      }
    }
    this._operationsDone.resolve();
  }

  private async _performOperation(op: SerializedFSOperation) {
    switch (op.op) {
      case 'mkdir': {
        await fs.promises.mkdir(op.dir, { recursive: true });
        return;
      }
      case 'writeFile': {
        // Note: 'wx' flag only writes when the file does not exist.
        // See https://nodejs.org/api/fs.html#file-system-flags.
        // This way tracing never have to write the same resource twice.
        if (op.skipIfExists)
          await fs.promises.writeFile(op.file, op.content, { flag: 'wx' }).catch(() => {});
        else
          await fs.promises.writeFile(op.file, op.content);
        return;
      }
      case 'copyFile': {
        await fs.promises.copyFile(op.from, op.to);
        return;
      }
      case 'appendFile': {
        await fs.promises.appendFile(op.file, op.content);
        return;
      }
      case 'zip': {
        const zipFile = new yazl.ZipFile();
        const result = new ManualPromise<void>();
        (zipFile as any as EventEmitter).on('error', error => result.reject(error));
        for (const entry of op.entries)
          zipFile.addFile(entry.value, entry.name);
        zipFile.end();
        zipFile.outputStream
            .pipe(fs.createWriteStream(op.zipFileName))
            .on('close', () => result.resolve())
            .on('error', error => result.reject(error));
        await result;
        return;
      }
    }
  }
}
