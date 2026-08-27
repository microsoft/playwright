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
import zlib from 'zlib';

import { toPosixPath } from '@utils/fileUtils';
import { getPlaywrightVersion } from 'playwright-core/lib/coreBundle';

import { formatError, nonTerminalScreen, resolveOutputFile, CommonReporterOptions } from './base';
import { stripAnsiEscapes } from '../util';

import type { ReporterV2 } from './reporterV2';
import type { Writable } from 'stream';
import type { PerfettoReporterOptions } from '../../types/test';
import type { FullConfig, FullResult, Location, Suite, TestCase, TestError, TestResult, TestStep } from '../../types/testReporter';

type TraceEvent = {
  name: string;
  cat: string;
  ph: 'X' | 'M' | 'i';
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  s?: 'g';
  cname?: string;
  args?: Record<string, any>;
};

type Attachment = { name: string, contentType: string, path?: string };
type Annotation = { type: string, description?: string };

// Palette names understood by chrome://tracing.
const kStatusColors: Record<string, string> = {
  passed: 'good',
  failed: 'bad',
  timedOut: 'terrible',
  interrupted: 'yellow',
  skipped: 'grey',
};

const kProcessId = 1;
const kRunThreadId = 0;

class PerfettoReporter implements ReporterV2 {
  private _config!: FullConfig;
  private _suite!: Suite;
  private _resolvedOutputFile: string;
  private _events: TraceEvent[] = [];
  private _laneEndTime = new Map<number, number>();
  private _globalErrors: { error: TestError, timestamp: number }[] = [];

  constructor(options: PerfettoReporterOptions & CommonReporterOptions) {
    this._resolvedOutputFile = resolveOutputFile('PERFETTO', {
      ...options,
      default: {
        fileName: 'perfetto.json',
        outputDir: 'test-results',
      },
    })!.outputFile;
  }

  version(): 'v2' {
    return 'v2';
  }

  printsToStdio() {
    return false;
  }

  onConfigure(config: FullConfig) {
    this._config = config;
  }

  onBegin(suite: Suite) {
    this._suite = suite;
  }

  onError(error: TestError) {
    this._globalErrors.push({ error, timestamp: Date.now() });
  }

  async onEnd(result: FullResult) {
    const entries: { test: TestCase, result: TestResult }[] = [];
    for (const test of this._suite?.allTests() ?? []) {
      for (const testResult of test.results)
        entries.push({ test, result: testResult });
    }
    entries.sort((a, b) => a.result.startTime.getTime() - b.result.startTime.getTime());
    for (const entry of entries)
      this._appendTestResult(entry.test, entry.result);
    for (const { error, timestamp } of this._globalErrors) {
      this._events.push({
        name: 'error',
        cat: 'error',
        ph: 'i',
        s: 'g',
        ts: timestamp,
        pid: kProcessId,
        tid: kRunThreadId,
        cname: 'bad',
        args: { error: this._formatError(error) },
      });
    }
    await this._writeReport(result);
  }

  private _appendTestResult(test: TestCase, result: TestResult) {
    const startMs = result.startTime.getTime();
    let endMs = startMs + Math.max(0, result.duration);
    for (const step of result.steps)
      endMs = Math.max(endMs, stepEndTime(step));

    const lane = this._allocateLane(result.parallelIndex, startMs);
    this._laneEndTime.set(lane, endMs);

    const tid = lane + 1;
    this._events.push({
      name: test.title,
      cat: 'test',
      ph: 'X',
      ts: startMs,
      dur: endMs - startMs,
      pid: kProcessId,
      tid,
      cname: kStatusColors[result.status],
      args: this._testArgs(test, result),
    });
    for (const step of result.steps)
      this._appendStep(step, tid, startMs, endMs);
  }

  private _allocateLane(preferredLane: number, startMs: number): number {
    const preferred = Math.max(0, preferredLane);
    if (!(this._laneEndTime.get(preferred)! > startMs))
      return preferred;
    for (let lane = 0; ; ++lane) {
      if (!(this._laneEndTime.get(lane)! > startMs))
        return lane;
    }
  }

  private _appendStep(step: TestStep, tid: number, parentStart: number, parentEnd: number) {
    const stepStart = step.startTime.getTime();
    const startMs = clamp(stepStart, parentStart, parentEnd);
    const endMs = clamp(step.duration >= 0 ? stepStart + step.duration : parentEnd, startMs, parentEnd);
    this._events.push({
      name: step.subtitle ? `${step.title} ${step.subtitle}` : step.title,
      cat: step.category,
      ph: 'X',
      ts: startMs,
      dur: endMs - startMs,
      pid: kProcessId,
      tid,
      cname: step.error ? 'bad' : undefined,
      args: this._stepArgs(step),
    });
    for (const child of step.steps)
      this._appendStep(child, tid, startMs, endMs);
  }

  private _testArgs(test: TestCase, result: TestResult): Record<string, any> {
    // root, project, file, ...describes, test
    const [, projectName, , ...titles] = test.titlePath();
    const args: Record<string, any> = {
      status: result.status,
      expectedStatus: test.expectedStatus,
      testId: test.id,
      workerIndex: result.workerIndex,
      parallelIndex: result.parallelIndex,
      timeout: test.timeout,
      location: this._formatLocation(test.location),
    };
    if (titles.length > 1)
      args.title = titles.join(' › ');
    if (projectName)
      args.project = projectName;
    if (result.retry)
      args.retry = result.retry;
    if (test.tags.length)
      args.tags = test.tags.join(' ');
    if (result.annotations.length)
      args.annotations = result.annotations.map(annotation => formatAnnotation(annotation));
    if (result.attachments.length)
      args.attachments = result.attachments.map(attachment => this._formatAttachment(attachment));
    if (result.errors.length)
      args.errors = result.errors.map(error => this._formatError(error));
    const stdout = concatChunks(result.stdout);
    if (stdout)
      args.stdout = stdout;
    const stderr = concatChunks(result.stderr);
    if (stderr)
      args.stderr = stderr;
    return args;
  }

  private _stepArgs(step: TestStep): Record<string, any> | undefined {
    const args: Record<string, any> = {};
    if (step.params)
      args.params = step.params;
    if (step.location)
      args.location = this._formatLocation(step.location);
    if (step.annotations.length)
      args.annotations = step.annotations.map(annotation => formatAnnotation(annotation));
    if (step.attachments.length)
      args.attachments = step.attachments.map(attachment => this._formatAttachment(attachment));
    if (step.error)
      args.error = this._formatError(step.error);
    return Object.keys(args).length ? args : undefined;
  }

  private _formatAttachment(attachment: Attachment): string {
    return attachment.path ? this._relativePath(attachment.path) : attachment.name;
  }

  private _formatLocation(location: Location | undefined): string | undefined {
    if (!location)
      return undefined;
    return `${this._relativePath(location.file)}:${location.line}:${location.column}`;
  }

  private _formatError(error: TestError): string {
    return stripAnsiEscapes(formatError(nonTerminalScreen, error).message);
  }

  private _relativePath(file: string): string {
    return toPosixPath(path.relative(this._config.rootDir, file));
  }

  private async _writeReport(result: FullResult) {
    let timeOrigin = result.startTime.getTime();
    for (const event of this._events)
      timeOrigin = Math.min(timeOrigin, event.ts);

    const metadataEvents: TraceEvent[] = [
      { name: 'process_name', cat: '__metadata', ph: 'M', ts: 0, pid: kProcessId, tid: kRunThreadId, args: { name: 'Playwright Test' } },
      { name: 'process_sort_index', cat: '__metadata', ph: 'M', ts: 0, pid: kProcessId, tid: kRunThreadId, args: { sort_index: 0 } },
    ];
    for (const lane of [...this._laneEndTime.keys()].sort((a, b) => a - b)) {
      metadataEvents.push({ name: 'thread_name', cat: '__metadata', ph: 'M', ts: 0, pid: kProcessId, tid: lane + 1, args: { name: `Worker ${lane}` } });
      metadataEvents.push({ name: 'thread_sort_index', cat: '__metadata', ph: 'M', ts: 0, pid: kProcessId, tid: lane + 1, args: { sort_index: lane + 1 } });
    }

    // Sort is stable, so parent slices stay ahead of their children on ties.
    this._events.sort((a, b) => a.ts - b.ts);
    for (const event of this._events) {
      event.ts = Math.round((event.ts - timeOrigin) * 1000);
      if (event.dur !== undefined)
        event.dur = Math.round(event.dur * 1000);
    }

    const metadata = {
      'playwright-version': getPlaywrightVersion(),
      'start-time': result.startTime.toISOString(),
      'duration': result.duration,
      'status': result.status,
    };

    // Serialize event by event, the whole report does not have to fit into memory twice.
    await fs.promises.mkdir(path.dirname(this._resolvedOutputFile), { recursive: true });
    const writer = new ChunkWriter(this._resolvedOutputFile);
    await writer.write('{"traceEvents":[');
    let separator = '';
    for (const events of [metadataEvents, this._events]) {
      for (const event of events) {
        await writer.write(separator + JSON.stringify(event));
        separator = ',';
      }
    }
    await writer.write(`],"displayTimeUnit":"ms","metadata":${JSON.stringify(metadata)}}`);
    await writer.close();
  }
}

// Writes into a ".gz" file through a gzip stream, into a plain file otherwise.
class ChunkWriter {
  private _stream: Writable;
  private _closed: Promise<void>;
  private _error: Error | undefined;

  constructor(file: string) {
    const fileStream = fs.createWriteStream(file);
    const gzip = file.endsWith('.gz') ? zlib.createGzip() : undefined;
    gzip?.pipe(fileStream);
    this._stream = gzip ?? fileStream;
    // The file is only complete once the destination closes, which is later than
    // the gzip stream ending.
    this._closed = new Promise(resolve => fileStream.on('close', resolve));
    for (const stream of new Set<Writable>([this._stream, fileStream]))
      stream.on('error', error => this._error ??= error);
  }

  async write(chunk: string) {
    if (this._error)
      throw this._error;
    if (!this._stream.write(chunk))
      await new Promise<void>(resolve => this._stream.once('drain', () => resolve()));
  }

  async close() {
    this._stream.end();
    await this._closed;
    if (this._error)
      throw this._error;
  }
}

function stepEndTime(step: TestStep): number {
  let end = step.startTime.getTime() + Math.max(0, step.duration);
  for (const child of step.steps)
    end = Math.max(end, stepEndTime(child));
  return end;
}

function formatAnnotation(annotation: Annotation): string {
  return annotation.description ? `${annotation.type}: ${annotation.description}` : annotation.type;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function concatChunks(chunks: (string | Buffer)[]): string {
  return chunks.map(chunk => typeof chunk === 'string' ? chunk : chunk.toString('utf8')).join('');
}

export default PerfettoReporter;
