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

import { BrowserContext } from '../server/browserContext';
import type { SanpshotterResource, SnapshotterBlob, SnapshotterDelegate } from './snapshotter';
import { ContextCreatedTraceEvent, ContextDestroyedTraceEvent, NetworkResourceTraceEvent, ActionTraceEvent, PageCreatedTraceEvent, PageDestroyedTraceEvent } from './traceTypes';
import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';
import { calculateSha1, createGuid, mkdirIfNeeded, monotonicTime } from '../utils/utils';
import { ActionResult, InstrumentingAgent, instrumentingAgents, ActionMetadata } from '../server/instrumentation';
import { Page } from '../server/page';
import { Snapshotter } from './snapshotter';
import * as types from '../server/types';
import type { ElementHandle } from '../server/dom';
import { helper, RegisteredListener } from '../server/helper';
import { DEFAULT_TIMEOUT } from '../utils/timeoutSettings';

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
    try {
      const contextTracer = this._contextTracers.get(context);
      if (contextTracer) {
        await contextTracer.dispose();
        this._contextTracers.delete(context);
      }
    } catch (e) {
      // Do not throw from instrumentation.
    }
  }

  async onAfterAction(result: ActionResult, metadata?: ActionMetadata): Promise<void> {
    try {
      if (!metadata)
        return;
      const contextTracer = this._contextTracers.get(metadata.page.context());
      if (!contextTracer)
        return;
      await contextTracer.recordAction(result, metadata);
    } catch (e) {
      // Do not throw from instrumentation.
    }
  }
}

class ContextTracer implements SnapshotterDelegate {
  private _contextId: string;
  private _traceStoragePromise: Promise<string>;
  private _appendEventChain: Promise<string>;
  private _writeArtifactChain: Promise<void>;
  private _snapshotter: Snapshotter;
  private _eventListeners: RegisteredListener[];
  private _disposed = false;
  private _pageToId = new Map<Page, string>();

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
    this._eventListeners = [
      helper.addEventListener(context, BrowserContext.Events.Page, this._onPage.bind(this)),
    ];
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
    const snapshot = await this._takeSnapshot(page, options.timeout);
    if (!snapshot)
      return;
    const event: ActionTraceEvent = {
      type: 'action',
      contextId: this._contextId,
      action: 'snapshot',
      label: options.label || 'snapshot',
      snapshot,
    };
    this._appendTraceEvent(event);
  }

  async recordAction(result: ActionResult, metadata: ActionMetadata) {
    const snapshot = await this._takeSnapshot(metadata.page);
    const event: ActionTraceEvent = {
      type: 'action',
      contextId: this._contextId,
      pageId: this._pageToId.get(metadata.page),
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

  private _onPage(page: Page) {
    const pageId = 'page@' + createGuid();
    this._pageToId.set(page, pageId);

    const event: PageCreatedTraceEvent = {
      type: 'page-created',
      contextId: this._contextId,
      pageId,
    };
    this._appendTraceEvent(event);

    page.once(Page.Events.Close, () => {
      this._pageToId.delete(page);
      if (this._disposed)
        return;
      const event: PageDestroyedTraceEvent = {
        type: 'page-destroyed',
        contextId: this._contextId,
        pageId,
      };
      this._appendTraceEvent(event);
    });
  }

  private async _targetToString(target: ElementHandle | string): Promise<string> {
    return typeof target === 'string' ? target : await target._previewPromise;
  }

  private async _takeSnapshot(page: Page, timeout: number = 0): Promise<{ sha1: string, duration: number } | undefined> {
    if (!timeout) {
      // Never use zero timeout to avoid stalling because of snapshot.
      // Use 20% of the default timeout.
      timeout = (page._timeoutSettings.timeout({}) || DEFAULT_TIMEOUT) / 5;
    }
    const startTime = monotonicTime();
    const snapshot = await this._snapshotter.takeSnapshot(page, timeout);
    if (!snapshot)
      return;
    const buffer = Buffer.from(JSON.stringify(snapshot));
    const sha1 = calculateSha1(buffer);
    this._writeArtifact(sha1, buffer);
    return { sha1, duration: monotonicTime() - startTime };
  }

  async dispose() {
    this._disposed = true;
    helper.removeEventListeners(this._eventListeners);
    this._pageToId.clear();
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
