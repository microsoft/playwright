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
import { ManualPromise, calculateSha1, monotonicTime, createGuid, SerializedFS } from 'playwright-core/lib/utils';
import { yauzl, yazl } from 'playwright-core/lib/zipBundle';
import type { TestInfo, TestInfoError } from '../../types/test';
import { filteredStackTrace } from '../util';
import type { TraceMode, PlaywrightWorkerOptions } from '../../types/test';
import type { TestInfoImpl } from './testInfo';

export type Attachment = TestInfo['attachments'][0];
export const testTraceEntryName = 'test.trace';
const version: trace.VERSION = 7;
let traceOrdinal = 0;

type TraceFixtureValue =  PlaywrightWorkerOptions['trace'] | undefined;
type TraceOptions = { screenshots: boolean, snapshots: boolean, sources: boolean, attachments: boolean, _live: boolean, mode: TraceMode };

export class TestTracing {
  private _testInfo: TestInfoImpl;
  private _options: TraceOptions | undefined;
  private _liveTraceFile: { file: string, fs: SerializedFS } | undefined;
  private _traceEvents: trace.TraceEvent[] = [];
  private _temporaryTraceFiles: string[] = [];
  private _artifactsDir: string;
  private _tracesDir: string;
  private _contextCreatedEvent: trace.ContextCreatedTraceEvent;

  constructor(testInfo: TestInfoImpl, artifactsDir: string) {
    this._testInfo = testInfo;
    this._artifactsDir = artifactsDir;
    this._tracesDir = path.join(this._artifactsDir, 'traces');
    this._contextCreatedEvent = {
      version,
      type: 'context-options',
      origin: 'testRunner',
      browserName: '',
      options: {},
      platform: process.platform,
      wallTime: Date.now(),
      monotonicTime: monotonicTime(),
      sdkLanguage: 'javascript',
    };
    this._appendTraceEvent(this._contextCreatedEvent);
  }

  private _shouldCaptureTrace() {
    if (process.env.PW_TEST_DISABLE_TRACING)
      return false;

    if (this._options?.mode === 'on')
      return true;

    if (this._options?.mode === 'retain-on-failure')
      return true;

    if (this._options?.mode === 'on-first-retry' && this._testInfo.retry === 1)
      return true;

    if (this._options?.mode === 'on-all-retries' && this._testInfo.retry > 0)
      return true;

    if (this._options?.mode === 'retain-on-first-failure' && this._testInfo.retry === 0)
      return true;

    return false;
  }

  async startIfNeeded(value: TraceFixtureValue) {
    const defaultTraceOptions: TraceOptions = { screenshots: true, snapshots: true, sources: true, attachments: true, _live: false, mode: 'off' };

    if (!value) {
      this._options = defaultTraceOptions;
    } else if (typeof value === 'string') {
      this._options = { ...defaultTraceOptions, mode: value === 'retry-with-trace' ? 'on-first-retry' : value as TraceMode };
    } else {
      const mode = value.mode || 'off';
      this._options = { ...defaultTraceOptions, ...value, mode: (mode as string) === 'retry-with-trace' ? 'on-first-retry' : mode };
    }

    if (!this._shouldCaptureTrace()) {
      this._options = undefined;
      return;
    }

    if (!this._liveTraceFile && this._options._live) {
      // Note that trace name must start with testId for live tracing to work.
      this._liveTraceFile = { file: path.join(this._tracesDir, `${this._testInfo.testId}-test.trace`), fs: new SerializedFS() };
      this._liveTraceFile.fs.mkdir(path.dirname(this._liveTraceFile.file));
      const data = this._traceEvents.map(e => JSON.stringify(e)).join('\n') + '\n';
      this._liveTraceFile.fs.writeFile(this._liveTraceFile.file, data);
    }
  }

  artifactsDir() {
    return this._artifactsDir;
  }

  tracesDir() {
    return this._tracesDir;
  }

  traceTitle() {
    return [path.relative(this._testInfo.project.testDir, this._testInfo.file) + ':' + this._testInfo.line, ...this._testInfo.titlePath.slice(1)].join(' › ');
  }

  generateNextTraceRecordingName() {
    const ordinalSuffix = traceOrdinal ? `-recording${traceOrdinal}` : '';
    ++traceOrdinal;
    const retrySuffix = this._testInfo.retry ? `-retry${this._testInfo.retry}` : '';
    // Note that trace name must start with testId for live tracing to work.
    return `${this._testInfo.testId}${retrySuffix}${ordinalSuffix}`;
  }

  generateNextTraceRecordingPath() {
    const file = path.join(this._artifactsDir, createGuid() + '.zip');
    this._temporaryTraceFiles.push(file);
    return file;
  }

  traceOptions() {
    return this._options;
  }

  async stopIfNeeded() {
    if (!this._options)
      return;

    const error = await this._liveTraceFile?.fs.syncAndGetError();
    if (error)
      throw error;

    const testFailed = this._testInfo.status !== this._testInfo.expectedStatus;
    const shouldAbandonTrace = !testFailed && (this._options.mode === 'retain-on-failure' || this._options.mode === 'retain-on-first-failure');

    if (shouldAbandonTrace) {
      for (const file of this._temporaryTraceFiles)
        await fs.promises.unlink(file).catch(() => {});
      return;
    }

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
        zipFile.outputStream.pipe(fs.createWriteStream(this.generateNextTraceRecordingPath())).on('close', f);
      });
    });

    const tracePath = this._testInfo.outputPath('trace.zip');
    await mergeTraceFiles(tracePath, this._temporaryTraceFiles);
    this._testInfo.attachments.push({ name: 'trace', path: tracePath, contentType: 'application/zip' });
  }

  appendForError(error: TestInfoError) {
    const rawStack = error.stack?.split('\n') || [];
    const stack = rawStack ? filteredStackTrace(rawStack) : [];
    this._appendTraceEvent({
      type: 'error',
      message: error.message || String(error.value),
      stack,
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

  appendBeforeActionForStep(callId: string, parentId: string | undefined, apiName: string, params: Record<string, any> | undefined, stack: StackFrame[]) {
    this._appendTraceEvent({
      type: 'before',
      callId,
      parentId,
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
      attachments: serializeAttachments(attachments),
      error,
    });
  }

  private _appendTraceEvent(event: trace.TraceEvent) {
    this._traceEvents.push(event);
    if (this._liveTraceFile)
      this._liveTraceFile.fs.appendFile(this._liveTraceFile.file, JSON.stringify(event) + '\n', true);
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

async function mergeTraceFiles(fileName: string, temporaryTraceFiles: string[]) {
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
