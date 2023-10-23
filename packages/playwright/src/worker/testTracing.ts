/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import type { SerializedError, StackFrame } from '@protocol/channels';
import type * as trace from '@trace/trace';
import type EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { ManualPromise, calculateSha1, monotonicTime } from 'playwright-core/lib/utils';
import { yauzl, yazl } from 'playwright-core/lib/zipBundle';
import type { TestInfo } from '../../types/test';


export type Attachment = TestInfo['attachments'][0];
export const testTraceEntryName = 'test.trace';

export class TestTracing {
  private _liveTraceFile: string | undefined;
  private _traceEvents: trace.TraceEvent[] = [];
  private _options: { sources: boolean; attachments: boolean; _live: boolean; } | undefined;

  start(liveFileName: string, options: { sources: boolean, attachments: boolean, _live: boolean }) {
    this._options = options;
    if (!this._liveTraceFile && options._live) {
      this._liveTraceFile = liveFileName;
      fs.mkdirSync(path.dirname(this._liveTraceFile), { recursive: true });
      const data = this._traceEvents.map(e => JSON.stringify(e)).join('\n') + '\n';
      fs.writeFileSync(this._liveTraceFile, data);
    }
  }

  async stop(fileName: string) {
    const zipFile = new yazl.ZipFile();

    if (!this._options?.attachments) {
      for (const event of this._traceEvents) {
        if (event.type === 'after')
          delete event.attachments;
      }
    }

    if (this._options?.sources) {
      const sourceFiles = new Set<string>();
      for (const event of this._traceEvents) {
        if (event.type === 'before') {
          for (const frame of event.stack || [])
            sourceFiles.add(frame.file);
        }
      }
      for (const sourceFile of sourceFiles) {
        await fs.promises.readFile(sourceFile, 'utf8').then(source => {
          zipFile.addBuffer(Buffer.from(source), 'resources/src@' + calculateSha1(sourceFile) + '.txt');
        }).catch(() => {});
      }
    }

    const sha1s = new Set<string>();
    for (const event of this._traceEvents.filter(e => e.type === 'after') as trace.AfterActionTraceEvent[]) {
      for (const attachment of (event.attachments || [])) {
        let contentPromise: Promise<Buffer | undefined> | undefined;
        if (attachment.path)
          contentPromise = fs.promises.readFile(attachment.path).catch(() => undefined);
        else if (attachment.base64)
          contentPromise = Promise.resolve(Buffer.from(attachment.base64, 'base64'));

        const content = await contentPromise;
        if (content === undefined)
          continue;

        const sha1 = calculateSha1(content);
        attachment.sha1 = sha1;
        delete attachment.path;
        delete attachment.base64;
        if (sha1s.has(sha1))
          continue;
        sha1s.add(sha1);
        zipFile.addBuffer(content, 'resources/' + sha1);
      }
    }

    const traceContent = Buffer.from(this._traceEvents.map(e => JSON.stringify(e)).join('\n'));
    zipFile.addBuffer(traceContent, testTraceEntryName);

    await new Promise(f => {
      zipFile.end(undefined, () => {
        zipFile.outputStream.pipe(fs.createWriteStream(fileName)).on('close', f);
      });
    });
  }

  appendStdioToTrace(type: 'stdout' | 'stderr', chunk: string | Buffer) {
    this._appendTraceEvent({
      type,
      timestamp: monotonicTime(),
      text: typeof chunk === 'string' ? chunk : undefined,
      base64: typeof chunk === 'string' ? undefined : chunk.toString('base64'),
    });
  }

  appendBeforeActionForStep(callId: string, parentId: string | undefined, apiName: string, params: Record<string, any> | undefined, wallTime: number, stack: StackFrame[]) {
    this._appendTraceEvent({
      type: 'before',
      callId,
      parentId,
      wallTime,
      startTime: monotonicTime(),
      class: 'Test',
      method: 'step',
      apiName,
      params: Object.fromEntries(Object.entries(params || {}).map(([name, value]) => [name, generatePreview(value)])),
      stack,
    });
  }

  appendAfterActionForStep(callId: string, error?: SerializedError['error'], attachments: Attachment[] = []) {
    this._appendTraceEvent({
      type: 'after',
      callId,
      endTime: monotonicTime(),
      log: [],
      attachments: serializeAttachments(attachments),
      error,
    });
  }

  private _appendTraceEvent(event: trace.TraceEvent) {
    this._traceEvents.push(event);
    if (this._liveTraceFile)
      fs.appendFileSync(this._liveTraceFile, JSON.stringify(event) + '\n');
  }
}

function serializeAttachments(attachments: Attachment[]): trace.AfterActionTraceEvent['attachments'] {
  return attachments.filter(a => a.name !== 'trace').map(a => {
    return {
      name: a.name,
      contentType: a.contentType,
      path: a.path,
      base64: a.body?.toString('base64'),
    };
  });
}

function generatePreview(value: any, visited = new Set<any>()): string {
  if (visited.has(value))
    return '';
  visited.add(value);
  if (typeof value === 'string')
    return value;
  if (typeof value === 'number')
    return value.toString();
  if (typeof value === 'boolean')
    return value.toString();
  if (value === null)
    return 'null';
  if (value === undefined)
    return 'undefined';
  if (Array.isArray(value))
    return '[' + value.map(v => generatePreview(v, visited)).join(', ') + ']';
  if (typeof value === 'object')
    return 'Object';
  return String(value);
}

export async function mergeTraceFiles(fileName: string, temporaryTraceFiles: string[]) {
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
        if (entry.fileName === testTraceEntryName) {
          // Keep the name for test traces so that the last test trace
          // that contains most of the information is kept in the trace.
          // Note the reverse order of the iteration (from new traces to old).
        } else if (entry.fileName.match(/[\d-]*trace\./)) {
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
