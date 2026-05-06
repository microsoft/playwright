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

import fs from 'fs';
import path from 'path';

import { monotonicTime } from '@isomorphic/time';
import { calculateSha1, createGuid } from '@utils/crypto';
import { mergeTraceFiles } from '@tracing/writer/mergeTraceFiles';
import { TracingSession } from '@tracing/writer/tracingSession';
import { getPlaywrightVersion } from 'playwright-core/lib/coreBundle';

import { filteredStackTrace } from '../util';

import type { TestStepCategory, TestInfoImpl } from './testInfo';
import type { PlaywrightWorkerOptions, TestInfo, TestInfoError, TraceMode } from '../../types/test';
import type { SerializedError, StackFrame } from '@protocol/channels';
import type * as trace from '@tracing/format/trace';

export type Attachment = TestInfo['attachments'][0];
export const testTraceEntryName = 'test.trace';
const version: trace.VERSION = 8;
let traceOrdinal = 0;

type TraceFixtureValue =  PlaywrightWorkerOptions['trace'] | undefined;
type TraceOptions = { screenshots: boolean, snapshots: boolean, sources: boolean, attachments: boolean, live: boolean, mode: TraceMode };

export class TestTracing {
  private _testInfo: TestInfoImpl;
  private _options: TraceOptions | undefined;
  private _temporaryTraceFiles: string[] = [];
  private _artifactsDir: string;
  private _tracesDir: string;
  private _contextCreatedEvent: trace.ContextCreatedTraceEvent;
  private _didFinishTestFunctionAndAfterEachHooks = false;
  private _session: TracingSession;

  constructor(testInfo: TestInfoImpl, artifactsDir: string) {
    this._testInfo = testInfo;
    this._artifactsDir = artifactsDir;
    this._tracesDir = path.join(this._artifactsDir, 'traces');
    this._contextCreatedEvent = {
      version,
      type: 'context-options',
      origin: 'testRunner',
      browserName: '',
      playwrightVersion: getPlaywrightVersion(),
      options: {},
      platform: process.platform,
      wallTime: Date.now(),
      monotonicTime: monotonicTime(),
      sdkLanguage: 'javascript',
    };
    this._session = new TracingSession({
      tracesDir: this._tracesDir,
      preserveNetworkResources: false,
      traceEntryName: testTraceEntryName,
    });
  }

  private _shouldCaptureTrace() {
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

    if (this._options?.mode === 'retain-on-failure-and-retries')
      return true;

    return false;
  }

  async startIfNeeded(value: TraceFixtureValue) {
    const defaultTraceOptions: TraceOptions = { screenshots: true, snapshots: true, sources: true, attachments: true, live: false, mode: 'off' };

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

    // Trace name for the session. Must start with testId so the live-trace
    // viewer's testId-prefix scan picks it up. Suffix '-test' avoids colliding
    // with playwright-core's per-context trace files which share tracesDir.
    const retrySuffix = this._testInfo.retry ? `-retry${this._testInfo.retry}` : '';
    const sessionTraceName = `${this._testInfo.testId}${retrySuffix}-test`;
    this._session.start({
      name: sessionTraceName,
      live: !!this._options.live,
      sources: !!this._options.sources,
    });
    this._session.startChunk({ name: sessionTraceName });
    // Initial context-options. testTimeout is unknown until stopIfNeeded — we
    // re-emit it then with the final value (the reader processes events in
    // order, last-write-wins for context-options fields).
    this._session.appendTraceEvent(this._contextCreatedEvent);
  }

  didFinishTestFunctionAndAfterEachHooks() {
    this._didFinishTestFunctionAndAfterEachHooks = true;
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

  private _generateNextTraceRecordingPath() {
    const file = path.join(this._artifactsDir, createGuid() + '.zip');
    this._temporaryTraceFiles.push(file);
    return file;
  }

  traceOptions() {
    return this._options;
  }

  maybeGenerateNextTraceRecordingPath() {
    // Forget about traces that should be saved on failure, when no failure happened
    // during the test and beforeEach/afterEach hooks.
    // This avoids downloading traces over the wire when not really needed.
    if (this._didFinishTestFunctionAndAfterEachHooks && this._shouldAbandonTrace())
      return;
    return this._generateNextTraceRecordingPath();
  }

  private _shouldAbandonTrace() {
    if (!this._options)
      return true;
    const testFailed = this._testInfo.status !== this._testInfo.expectedStatus;
    if (this._options.mode === 'retain-on-failure-and-retries')
      return !testFailed && this._testInfo.retry === 0;
    return !testFailed && (this._options.mode === 'retain-on-failure' || this._options.mode === 'retain-on-first-failure');
  }

  async stopIfNeeded() {
    this._contextCreatedEvent.testTimeout = this._testInfo.timeout;

    if (!this._options)
      return;

    // Re-emit context-options now that testTimeout (and any other late-set
    // fields) are final. The reader overwrites earlier values with these.
    this._session.appendTraceEvent(this._contextCreatedEvent);

    const signal = new AbortController().signal;

    if (this._shouldAbandonTrace()) {
      await this._session.stopChunk(signal, 'discard');
      await this._session.stop(signal);
      for (const file of this._temporaryTraceFiles)
        await fs.promises.unlink(file).catch(() => {});
      return;
    }

    const result = await this._session.stopChunk(signal, 'archive');
    await this._session.stop(signal);
    if (result.zipFile)
      this._temporaryTraceFiles.push(result.zipFile);

    const tracePath = this._testInfo.outputPath('trace.zip');
    await mergeTraceFiles(tracePath, this._temporaryTraceFiles, { keepEntryName: testTraceEntryName });
    this._testInfo.attachments.push({ name: 'trace', path: tracePath, contentType: 'application/zip' });
  }

  appendForError(error: TestInfoError) {
    const rawStack = error.stack?.split('\n') || [];
    const stack = rawStack ? filteredStackTrace(rawStack) : [];
    this._session.appendTraceEvent({
      type: 'error',
      message: this._formatError(error),
      stack,
    });
  }

  _formatError(error: TestInfoError) {
    const parts: string[] = [error.message || String(error.value)];
    if (error.cause)
      parts.push('[cause]: ' + this._formatError(error.cause));
    return parts.join('\n');
  }

  appendStdioToTrace(type: 'stdout' | 'stderr', chunk: string | Buffer) {
    this._session.appendTraceEvent({
      type,
      timestamp: monotonicTime(),
      text: typeof chunk === 'string' ? chunk : undefined,
      base64: typeof chunk === 'string' ? undefined : chunk.toString('base64'),
    });
  }

  appendBeforeActionForStep(options: { stepId: string, parentId?: string, title: string, category: TestStepCategory, params?: Record<string, any>, stack: StackFrame[], group?: string }) {
    this._session.appendTraceEvent({
      type: 'before',
      callId: options.stepId,
      stepId: options.stepId,
      parentId: options.parentId,
      startTime: monotonicTime(),
      class: 'Test',
      method: options.category,
      title: options.title,
      params: Object.fromEntries(Object.entries(options.params || {}).map(([name, value]) => [name, generatePreview(value)])),
      stack: options.stack,
      group: options.group,
    });
  }

  appendAfterActionForStep(callId: string, error?: SerializedError['error'], attachments: Attachment[] = [], annotations?: trace.AfterActionTraceEventAnnotation[]) {
    const serializedAttachments = this._options?.attachments ? this._serializeAttachmentsToResources(attachments) : undefined;
    this._session.appendTraceEvent({
      type: 'after',
      callId,
      endTime: monotonicTime(),
      attachments: serializedAttachments,
      annotations,
      error,
    });
  }

  // Pre-resolve each attachment's binary content (sync read) into a session
  // resource keyed by content sha1, and return the trace-event-shaped
  // attachment refs that point at those sha1s.
  private _serializeAttachmentsToResources(attachments: Attachment[]): trace.AfterActionTraceEvent['attachments'] {
    if (attachments.length === 0)
      return undefined;
    const result: NonNullable<trace.AfterActionTraceEvent['attachments']> = [];
    for (const a of attachments) {
      if (a.name === 'trace')
        continue;
      let buffer: Buffer | undefined;
      if (a.body) {
        buffer = a.body;
      } else if (a.path) {
        try {
          buffer = fs.readFileSync(a.path);
        } catch {
          continue;
        }
      } else {
        continue;
      }
      const sha1 = calculateSha1(buffer);
      this._session.appendResource(sha1, buffer);
      result.push({ name: a.name, contentType: a.contentType, sha1 });
    }
    return result.length ? result : undefined;
  }

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
