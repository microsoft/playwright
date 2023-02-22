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

import type { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { NameValue } from '../../../common/types';
import type { TracingTracingStopChunkParams } from '@protocol/channels';
import { commandsWithTracingSnapshots } from '../../../protocol/debug';
import { ManualPromise } from '../../../utils/manualPromise';
import type { RegisteredListener } from '../../../utils/eventsHelper';
import { eventsHelper } from '../../../utils/eventsHelper';
import { assert, createGuid, monotonicTime } from '../../../utils';
import { mkdirIfNeeded, removeFolders } from '../../../utils/fileUtils';
import { Artifact } from '../../artifact';
import { BrowserContext } from '../../browserContext';
import { ElementHandle } from '../../dom';
import type { APIRequestContext } from '../../fetch';
import type { CallMetadata, InstrumentationListener } from '../../instrumentation';
import { SdkObject } from '../../instrumentation';
import { Page } from '../../page';
import type * as har from '@trace/har';
import type { HarTracerDelegate } from '../../har/harTracer';
import { HarTracer } from '../../har/harTracer';
import type { FrameSnapshot } from '@trace/snapshot';
import type * as trace from '@trace/trace';
import type { VERSION } from '@trace/trace';
import type { SnapshotterBlob, SnapshotterDelegate } from './snapshotter';
import { Snapshotter } from './snapshotter';
import { yazl } from '../../../zipBundle';

const version: VERSION = 3;

export type TracerOptions = {
  name?: string;
  snapshots?: boolean;
  screenshots?: boolean;
};

type RecordingState = {
  options: TracerOptions,
  traceName: string,
  networkFile: string,
  traceFile: string,
  tracesDir: string,
  resourcesDir: string,
  filesCount: number,
  networkSha1s: Set<string>,
  traceSha1s: Set<string>,
  recording: boolean;
};

const kScreencastOptions = { width: 800, height: 600, quality: 90 };

export class Tracing extends SdkObject implements InstrumentationListener, SnapshotterDelegate, HarTracerDelegate {
  private _writeChain = Promise.resolve();
  private _snapshotter?: Snapshotter;
  private _harTracer: HarTracer;
  private _screencastListeners: RegisteredListener[] = [];
  private _pendingCalls = new Map<string, { sdkObject: SdkObject, metadata: CallMetadata, beforeSnapshot: Promise<void>, actionSnapshot?: Promise<void>, afterSnapshot?: Promise<void> }>();
  private _context: BrowserContext | APIRequestContext;
  private _state: RecordingState | undefined;
  private _isStopping = false;
  private _precreatedTracesDir: string | undefined;
  private _tracesTmpDir: string | undefined;
  private _allResources = new Set<string>();
  private _contextCreatedEvent: trace.ContextCreatedTraceEvent;

  constructor(context: BrowserContext | APIRequestContext, tracesDir: string | undefined) {
    super(context, 'tracing');
    this._context = context;
    this._precreatedTracesDir = tracesDir;
    this._harTracer = new HarTracer(context, null, this, {
      content: 'attach',
      includeTraceInfo: true,
      recordRequestOverrides: false,
      waitForContentOnStop: false,
      skipScripts: true,
    });
    const testIdAttributeName = ('selectors' in context) ? context.selectors().testIdAttributeName() : undefined;
    this._contextCreatedEvent = {
      version,
      type: 'context-options',
      browserName: '',
      options: {},
      platform: process.platform,
      wallTime: 0,
      sdkLanguage: (context as BrowserContext)?._browser?.options?.sdkLanguage,
      testIdAttributeName
    };
    if (context instanceof BrowserContext) {
      this._snapshotter = new Snapshotter(context, this);
      assert(tracesDir, 'tracesDir must be specified for BrowserContext');
      this._contextCreatedEvent.browserName = context._browser.options.name;
      this._contextCreatedEvent.options = context._options;
    }
  }

  resetForReuse() {
    this._snapshotter?.resetForReuse();
  }

  async start(options: TracerOptions) {
    if (this._isStopping)
      throw new Error('Cannot start tracing while stopping');

    // Re-write for testing.
    this._contextCreatedEvent.sdkLanguage = (this._context as BrowserContext)?._browser?.options?.sdkLanguage;

    if (this._state) {
      const o = this._state.options;
      if (o.name !== options.name || !o.screenshots !== !options.screenshots || !o.snapshots !== !options.snapshots)
        throw new Error('Tracing has been already started with different options');
      return;
    }
    // TODO: passing the same name for two contexts makes them write into a single file
    // and conflict.
    const traceName = options.name || createGuid();
    // Init the state synchrounously.
    this._state = { options, traceName, traceFile: '', networkFile: '', tracesDir: '', resourcesDir: '', filesCount: 0, traceSha1s: new Set(), networkSha1s: new Set(), recording: false };
    const state = this._state;

    state.tracesDir = await this._createTracesDirIfNeeded();
    state.resourcesDir = path.join(state.tracesDir, 'resources');
    state.traceFile = path.join(state.tracesDir, traceName + '.trace');
    state.networkFile = path.join(state.tracesDir, traceName + '.network');
    this._writeChain = fs.promises.mkdir(state.resourcesDir, { recursive: true }).then(() => fs.promises.writeFile(state.networkFile, ''));
    if (options.snapshots)
      this._harTracer.start();
  }

  async startChunk(options: { title?: string } = {}) {
    if (this._state && this._state.recording)
      await this.stopChunk({ mode: 'discard' });

    if (!this._state)
      throw new Error('Must start tracing before starting a new chunk');
    if (this._isStopping)
      throw new Error('Cannot start a trace chunk while stopping');

    const state = this._state;
    const suffix = state.filesCount ? `-${state.filesCount}` : ``;
    state.filesCount++;
    state.traceFile = path.join(state.tracesDir, `${state.traceName}${suffix}.trace`);
    state.recording = true;

    this._appendTraceOperation(async () => {
      await mkdirIfNeeded(state.traceFile);
      await fs.promises.appendFile(state.traceFile, JSON.stringify({ ...this._contextCreatedEvent, title: options.title, wallTime: Date.now() }) + '\n');
    });

    this._context.instrumentation.addListener(this, this._context);
    if (state.options.screenshots)
      this._startScreencast();
    if (state.options.snapshots)
      await this._snapshotter?.start();
  }

  private _startScreencast() {
    if (!(this._context instanceof BrowserContext))
      return;
    for (const page of this._context.pages())
      this._startScreencastInPage(page);
    this._screencastListeners.push(
        eventsHelper.addEventListener(this._context, BrowserContext.Events.Page, this._startScreencastInPage.bind(this)),
    );
  }

  private _stopScreencast() {
    eventsHelper.removeEventListeners(this._screencastListeners);
    if (!(this._context instanceof BrowserContext))
      return;
    for (const page of this._context.pages())
      page.setScreencastOptions(null);
  }

  async stop() {
    if (!this._state)
      return;
    if (this._isStopping)
      throw new Error(`Tracing is already stopping`);
    if (this._state.recording)
      throw new Error(`Must stop trace file before stopping tracing`);
    this._harTracer.stop();
    await this._writeChain;
    this._state = undefined;
  }

  async deleteTmpTracesDir() {
    if (this._tracesTmpDir)
      await removeFolders([this._tracesTmpDir]);
  }

  private async _createTracesDirIfNeeded() {
    if (this._precreatedTracesDir)
      return this._precreatedTracesDir;
    this._tracesTmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-tracing-'));
    return this._tracesTmpDir;
  }

  async dispose() {
    this._snapshotter?.dispose();
    this._harTracer.stop();
    await this._writeChain;
  }

  async stopChunk(params: TracingTracingStopChunkParams): Promise<{ artifact?: Artifact, entries?: NameValue[], sourceEntries?: NameValue[] }> {
    if (this._isStopping)
      throw new Error(`Tracing is already stopping`);
    this._isStopping = true;

    if (!this._state || !this._state.recording) {
      this._isStopping = false;
      if (params.mode !== 'discard')
        throw new Error(`Must start tracing before stopping`);
      return { sourceEntries: [] };
    }

    const state = this._state!;
    this._context.instrumentation.removeListener(this);
    if (this._state?.options.screenshots)
      this._stopScreencast();

    for (const { sdkObject, metadata, beforeSnapshot, actionSnapshot, afterSnapshot } of this._pendingCalls.values()) {
      await Promise.all([beforeSnapshot, actionSnapshot, afterSnapshot]);
      let callMetadata = metadata;
      if (!afterSnapshot) {
        // Note: we should not modify metadata here to avoid side-effects in any other place.
        callMetadata = {
          ...metadata,
          error: { error: { name: 'Error', message: 'Action was interrupted' } },
        };
      }
      await this.onAfterCall(sdkObject, callMetadata);
    }

    if (state.options.snapshots)
      await this._snapshotter?.stop();

    // Chain the export operation against write operations,
    // so that neither trace files nor sha1s change during the export.
    return await this._appendTraceOperation(async () => {
      if (params.mode === 'discard')
        return {};

      // Har files are live, make a snapshot before returning the resulting entries.
      const networkFile = path.join(state.networkFile, '..', createGuid());
      await fs.promises.copyFile(state.networkFile, networkFile);

      const entries: NameValue[] = [];
      entries.push({ name: 'trace.trace', value: state.traceFile });
      entries.push({ name: 'trace.network', value: networkFile });
      for (const sha1 of new Set([...state.traceSha1s, ...state.networkSha1s]))
        entries.push({ name: path.join('resources', sha1), value: path.join(state.resourcesDir, sha1) });

      if (params.mode === 'entries')
        return { entries };
      const artifact = await this._exportZip(entries, state).catch(() => undefined);
      return { artifact, entries };
    }).finally(() => {
      // Only reset trace sha1s, network resources are preserved between chunks.
      state.traceSha1s = new Set();
      this._isStopping = false;
      state.recording = false;
    }) || { };
  }

  private _exportZip(entries: NameValue[], state: RecordingState): Promise<Artifact | undefined> {
    const zipFile = new yazl.ZipFile();
    const result = new ManualPromise<Artifact | undefined>();
    (zipFile as any as EventEmitter).on('error', error => result.reject(error));
    for (const entry of entries)
      zipFile.addFile(entry.value, entry.name);
    zipFile.end();
    const zipFileName = state.traceFile + '.zip';
    zipFile.outputStream.pipe(fs.createWriteStream(zipFileName)).on('close', () => {
      const artifact = new Artifact(this._context, zipFileName);
      artifact.reportFinished();
      result.resolve(artifact);
    });
    return result;
  }

  async _captureSnapshot(name: 'before' | 'after' | 'action' | 'event', sdkObject: SdkObject, metadata: CallMetadata, element?: ElementHandle) {
    if (!this._snapshotter)
      return;
    if (!sdkObject.attribution.page)
      return;
    if (!this._snapshotter.started())
      return;
    if (!shouldCaptureSnapshot(metadata))
      return;
    const snapshotName = `${name}@${metadata.id}`;
    metadata.snapshots.push({ title: name, snapshotName });
    // We have |element| for input actions (page.click and handle.click)
    // and |sdkObject| element for accessors like handle.textContent.
    if (!element && sdkObject instanceof ElementHandle)
      element = sdkObject;
    await this._snapshotter.captureSnapshot(sdkObject.attribution.page, snapshotName, element).catch(() => {});
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata) {
    sdkObject.attribution.page?.temporarlyDisableTracingScreencastThrottling();
    // Set afterSnapshot name for all the actions that operate selectors.
    // Elements resolved from selectors will be marked on the snapshot.
    metadata.afterSnapshot = `after@${metadata.id}`;
    const beforeSnapshot = this._captureSnapshot('before', sdkObject, metadata);
    this._pendingCalls.set(metadata.id, { sdkObject, metadata, beforeSnapshot });
    await beforeSnapshot;
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata, element: ElementHandle) {
    sdkObject.attribution.page?.temporarlyDisableTracingScreencastThrottling();
    const actionSnapshot = this._captureSnapshot('action', sdkObject, metadata, element);
    this._pendingCalls.get(metadata.id)!.actionSnapshot = actionSnapshot;
    await actionSnapshot;
  }

  async onAfterCall(sdkObject: SdkObject, metadata: CallMetadata) {
    sdkObject.attribution.page?.temporarlyDisableTracingScreencastThrottling();
    const pendingCall = this._pendingCalls.get(metadata.id);
    if (!pendingCall || pendingCall.afterSnapshot)
      return;
    if (!sdkObject.attribution.context) {
      this._pendingCalls.delete(metadata.id);
      return;
    }
    pendingCall.afterSnapshot = this._captureSnapshot('after', sdkObject, metadata);
    await pendingCall.afterSnapshot;
    const event: trace.ActionTraceEvent = { type: 'action', metadata };
    this._appendTraceEvent(event);
    this._pendingCalls.delete(metadata.id);
  }

  onEvent(sdkObject: SdkObject, metadata: CallMetadata) {
    if (!sdkObject.attribution.context)
      return;
    const event: trace.ActionTraceEvent = { type: 'event', metadata };
    this._appendTraceEvent(event);
  }

  onEntryStarted(entry: har.Entry) {
  }

  onEntryFinished(entry: har.Entry) {
    const event: trace.ResourceSnapshotTraceEvent = { type: 'resource-snapshot', snapshot: entry };
    this._appendTraceOperation(async () => {
      const visited = visitTraceEvent(event, this._state!.networkSha1s);
      await fs.promises.appendFile(this._state!.networkFile, JSON.stringify(visited) + '\n');
    });
  }

  onContentBlob(sha1: string, buffer: Buffer) {
    this._appendResource(sha1, buffer);
  }

  onSnapshotterBlob(blob: SnapshotterBlob): void {
    this._appendResource(blob.sha1, blob.buffer);
  }

  onFrameSnapshot(snapshot: FrameSnapshot): void {
    this._appendTraceEvent({ type: 'frame-snapshot', snapshot });
  }

  private _startScreencastInPage(page: Page) {
    page.setScreencastOptions(kScreencastOptions);
    const prefix = page.guid;
    this._screencastListeners.push(
        eventsHelper.addEventListener(page, Page.Events.ScreencastFrame, params => {
          const suffix = params.timestamp || Date.now();
          const sha1 = `${prefix}-${suffix}.jpeg`;
          const event: trace.ScreencastFrameTraceEvent = {
            type: 'screencast-frame',
            pageId: page.guid,
            sha1,
            width: params.width,
            height: params.height,
            timestamp: monotonicTime()
          };
          // Make sure to write the screencast frame before adding a reference to it.
          this._appendResource(sha1, params.buffer);
          this._appendTraceEvent(event);
        }),
    );
  }

  private _appendTraceEvent(event: trace.TraceEvent) {
    this._appendTraceOperation(async () => {
      const visited = visitTraceEvent(event, this._state!.traceSha1s);
      await fs.promises.appendFile(this._state!.traceFile, JSON.stringify(visited) + '\n');
    });
  }

  private _appendResource(sha1: string, buffer: Buffer) {
    if (this._allResources.has(sha1))
      return;
    this._allResources.add(sha1);
    const resourcePath = path.join(this._state!.resourcesDir, sha1);
    this._appendTraceOperation(async () => {
      try {
        // Perhaps we've already written this resource?
        await fs.promises.access(resourcePath);
      } catch (e) {
        // If not, let's write! Note that async access is safe because we
        // never remove resources until the very end.
        await fs.promises.writeFile(resourcePath, buffer).catch(() => {});
      }
    });
  }

  private async _appendTraceOperation<T>(cb: () => Promise<T>): Promise<T | undefined> {
    // This method serializes all writes to the trace.
    let error: Error | undefined;
    let result: T | undefined;
    this._writeChain = this._writeChain.then(async () => {
      // This check is here because closing the browser removes the tracesDir and tracing
      // dies trying to archive.
      if (this._context instanceof BrowserContext && !this._context._browser.isConnected())
        return;
      try {
        result = await cb();
      } catch (e) {
        error = e;
      }
    });
    await this._writeChain;
    if (error)
      throw error;
    return result;
  }
}

function visitTraceEvent(object: any, sha1s: Set<string>): any {
  if (Array.isArray(object))
    return object.map(o => visitTraceEvent(o, sha1s));
  if (object instanceof Buffer)
    return undefined;
  if (typeof object === 'object') {
    const result: any = {};
    for (const key in object) {
      if (key === 'sha1' || key === '_sha1' || key.endsWith('Sha1')) {
        const sha1 = object[key];
        if (sha1)
          sha1s.add(sha1);
      }
      result[key] = visitTraceEvent(object[key], sha1s);
    }
    return result;
  }
  return object;
}

export function shouldCaptureSnapshot(metadata: CallMetadata): boolean {
  return commandsWithTracingSnapshots.has(metadata.type + '.' + metadata.method);
}
