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

import type { BrowserContext } from '../server/browserContext';
import type { SanpshotterResource, SnapshotterBlob, SnapshotterDelegate } from './snapshotter';
import { ContextCreatedTraceEvent, ContextDestroyedTraceEvent, NetworkResourceTraceEvent, ActionTraceEvent } from './traceTypes';
import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';
import { calculateSha1, createGuid, mkdirIfNeeded, monotonicTime } from '../utils/utils';
import { ActionResult, InstrumentingAgent, instrumentingAgents, ActionMetadata } from '../server/instrumentation';
import type { Page } from '../server/page';
import { Progress, runAbortableTask } from '../server/progress';
import { Snapshotter } from './snapshotter';
import * as types from '../server/types';
import type { ElementHandle } from '../server/dom';

const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));
const fsAppendFileAsync = util.promisify(fs.appendFile.bind(fs));
const fsAccessAsync = util.promisify(fs.access.bind(fs));

export class Tracer implements InstrumentingAgent {
  private _contextTracers = new Map<BrowserContext, ContextTracer>();

  constructor() {
    instrumentingAgents.add(this);
  }

  dispose() {
    instrumentingAgents.delete(this);
  }

  traceContext(context: BrowserContext, traceStorageDir: string, traceFile: string) {
    const contextTracer = new ContextTracer(context, traceStorageDir, traceFile);
    this._contextTracers.set(context, contextTracer);
  }

  async captureSnapshot(page: Page, options: types.TimeoutOptions & { label?: string } = {}): Promise<void> {
    const contextTracer = this._contextTracers.get(page.context());
    if (contextTracer)
      await contextTracer.captureSnapshot(page, options);
  }

  async onContextCreated(context: BrowserContext): Promise<void> {
  }

  async onContextDestroyed(context: BrowserContext): Promise<void> {
    const contextTracer = this._contextTracers.get(context);
    if (contextTracer) {
      await contextTracer.dispose();
      this._contextTracers.delete(context);
    }
  }

  async onAfterAction(result: ActionResult, metadata?: ActionMetadata): Promise<void> {
    if (!metadata)
      return;
    const contextTracer = this._contextTracers.get(metadata.page.context());
    if (!contextTracer)
      return;
    await contextTracer.recordAction(result, metadata);
  }
}

class ContextTracer implements SnapshotterDelegate {
  private _contextId: string;
  private _traceStoragePromise: Promise<string>;
  private _appendEventChain: Promise<string>;
  private _writeArtifactChain: Promise<void>;
  readonly _snapshotter: Snapshotter;

  constructor(context: BrowserContext, traceStorageDir: string, traceFile: string) {
    this._contextId = 'context@' + createGuid();
    this._traceStoragePromise = mkdirIfNeeded(path.join(traceStorageDir, 'sha1')).then(() => traceStorageDir);
    this._appendEventChain = mkdirIfNeeded(traceFile).then(() => traceFile);
    this._writeArtifactChain = Promise.resolve();
    const event: ContextCreatedTraceEvent = {
      type: 'context-created',
      browserName: context._browser._options.name,
      contextId: this._contextId,
      isMobile: !!context._options.isMobile,
      deviceScaleFactor: context._options.deviceScaleFactor || 1,
      viewportSize: context._options.viewport || undefined,
    };
    this._appendTraceEvent(event);
    this._snapshotter = new Snapshotter(context, this);
  }

  onBlob(blob: SnapshotterBlob): void {
    this._writeArtifact(blob.sha1, blob.buffer);
  }

  onResource(resource: SanpshotterResource): void {
    const event: NetworkResourceTraceEvent = {
      type: 'resource',
      contextId: this._contextId,
      frameId: resource.frameId,
      url: resource.url,
      contentType: resource.contentType,
      responseHeaders: resource.responseHeaders,
      sha1: resource.sha1,
    };
    this._appendTraceEvent(event);
  }

  async captureSnapshot(page: Page, options: types.TimeoutOptions & { label?: string } = {}): Promise<void> {
    await runAbortableTask(async progress => {
      const label = options.label || 'snapshot';
      const snapshot = await this._takeSnapshot(progress, page);
      if (!snapshot)
        return;
      const event: ActionTraceEvent = {
        type: 'action',
        contextId: this._contextId,
        action: 'snapshot',
        label,
        snapshot,
      };
      this._appendTraceEvent(event);
    }, page._timeoutSettings.timeout(options));
  }

  async recordAction(result: ActionResult, metadata: ActionMetadata) {
    let snapshot: { sha1: string, duration: number } | undefined;
    try {
      // Use 20% of the default timeout.
      // Never use zero timeout to avoid stalling because of snapshot.
      const timeout = (metadata.page._timeoutSettings.timeout({}) / 5) || 6000;
      snapshot = await runAbortableTask(progress => this._takeSnapshot(progress, metadata.page), timeout);
    } catch (e) {
      snapshot = undefined;
    }

    const event: ActionTraceEvent = {
      type: 'action',
      contextId: this._contextId,
      action: metadata.type,
      target: await this._targetToString(metadata.target),
      value: metadata.value,
      snapshot,
      startTime: result.startTime,
      endTime: result.endTime,
      stack: metadata.stack,
      logs: result.logs.slice(),
      error: result.error ? result.error.stack : undefined,
    };
    this._appendTraceEvent(event);
  }

  private async _targetToString(target: ElementHandle | string): Promise<string> {
    return typeof target === 'string' ? target : await target._previewPromise;
  }

  private async _takeSnapshot(progress: Progress, page: Page): Promise<{ sha1: string, duration: number } | undefined> {
    const startTime = monotonicTime();
    const snapshot = await this._snapshotter.takeSnapshot(progress, page);
    if (!snapshot)
      return;
    const buffer = Buffer.from(JSON.stringify(snapshot));
    const sha1 = calculateSha1(buffer);
    this._writeArtifact(sha1, buffer);
    return { sha1, duration: monotonicTime() - startTime };
  }

  async dispose() {
    this._snapshotter.dispose();
    const event: ContextDestroyedTraceEvent = {
      type: 'context-destroyed',
      contextId: this._contextId,
    };
    this._appendTraceEvent(event);

    // Ensure all writes are finished.
    await this._appendEventChain;
    await this._writeArtifactChain;
  }

  private _writeArtifact(sha1: string, buffer: Buffer) {
    // Save all write promises to wait for them in dispose.
    const promise = this._innerWriteArtifact(sha1, buffer);
    this._writeArtifactChain = this._writeArtifactChain.then(() => promise);
  }

  private async _innerWriteArtifact(sha1: string, buffer: Buffer): Promise<void> {
    const traceDirectory = await this._traceStoragePromise;
    const filePath = path.join(traceDirectory, sha1);
    try {
      await fsAccessAsync(filePath);
    } catch (e) {
      // File does not exist - write it.
      await fsWriteFileAsync(filePath, buffer);
    }
  }

  private _appendTraceEvent(event: any) {
    // Serialize all writes to the trace file.
    const timestamp = monotonicTime();
    this._appendEventChain = this._appendEventChain.then(async traceFile => {
      await fsAppendFileAsync(traceFile, JSON.stringify({...event, timestamp}) + '\n');
      return traceFile;
    });
  }
}
