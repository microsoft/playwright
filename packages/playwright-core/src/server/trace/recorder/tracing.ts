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
import { removeFolders } from '../../../utils/fileUtils';
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

const version: VERSION = 4;

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
  chunkOrdinal: number,
  networkSha1s: Set<string>,
  traceSha1s: Set<string>,
  recording: boolean;
};

const kScreencastOptions = { width: 800, height: 600, quality: 90 };

export class Tracing extends SdkObject implements InstrumentationListener, SnapshotterDelegate, HarTracerDelegate {
  private _snapshotter?: Snapshotter;
  private _harTracer: HarTracer;
  private _screencastListeners: RegisteredListener[] = [];
  private _context: BrowserContext | APIRequestContext;
  private _state: RecordingState | undefined;
  private _isStopping = false;
  private _precreatedTracesDir: string | undefined;
  private _tracesTmpDir: string | undefined;
  private _allResources = new Set<string>();
  private _contextCreatedEvent: trace.ContextCreatedTraceEvent;
  private _fs = new CachingFS();

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
      if (!o.screenshots !== !options.screenshots || !o.snapshots !== !options.snapshots)
        throw new Error('Tracing has been already started with different options');
      if (options.name && options.name !== this._state.traceName)
        await this._changeTraceName(this._state, options.name);
      return;
    }
    // TODO: passing the same name for two contexts makes them write into a single file
    // and conflict.
    const traceName = options.name || createGuid();
    // Init the state synchronously.
    this._state = { options, traceName, traceFile: '', networkFile: '', tracesDir: '', resourcesDir: '', chunkOrdinal: 0, traceSha1s: new Set(), networkSha1s: new Set(), recording: false };
    const state = this._state;

    state.tracesDir = await this._createTracesDirIfNeeded();
    state.resourcesDir = path.join(state.tracesDir, 'resources');
    state.traceFile = path.join(state.tracesDir, traceName + '.trace');
    state.networkFile = path.join(state.tracesDir, traceName + '.network');
    this._fs.appendText(state.networkFile, '');
    if (options.snapshots)
      this._harTracer.start();
  }

  async startChunk(options: { name?: string, title?: string } = {}): Promise<{ traceName: string }> {
    if (this._state && this._state.recording)
      await this.stopChunk({ mode: 'discard' });

    if (!this._state)
      throw new Error('Must start tracing before starting a new chunk');
    if (this._isStopping)
      throw new Error('Cannot start a trace chunk while stopping');

    const state = this._state;
    const suffix = state.chunkOrdinal ? `-${state.chunkOrdinal}` : ``;
    state.chunkOrdinal++;
    state.traceFile = path.join(state.tracesDir, `${state.traceName}${suffix}.trace`);
    state.recording = true;

    if (options.name && options.name !== this._state.traceName)
      this._changeTraceName(this._state, options.name);

    this._fs.appendText(state.traceFile, JSON.stringify({ ...this._contextCreatedEvent, title: options.title, wallTime: Date.now() }) + '\n');

    this._context.instrumentation.addListener(this, this._context);
    if (state.options.screenshots)
      this._startScreencast();
    if (state.options.snapshots)
      await this._snapshotter?.start();
    return { traceName: state.traceName };
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

  private async _changeTraceName(state: RecordingState, name: string) {
    const oldNetworkFile = state.networkFile;
    state.traceName = name;
    state.traceFile = path.join(state.tracesDir, name + '.trace');
    state.networkFile = path.join(state.tracesDir, name + '.network');
    // Network file survives across chunks, so make a copy with the new name.
    await this._fs.copyFile(oldNetworkFile, state.networkFile);
  }

  async stop() {
    if (!this._state)
      return;
    if (this._isStopping)
      throw new Error(`Tracing is already stopping`);
    if (this._state.recording)
      throw new Error(`Must stop trace file before stopping tracing`);
    this._harTracer.stop();
    await this._fs.flush();
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
    await this._fs.flush();
  }

  async stopChunk(params: TracingTracingStopChunkParams): Promise<{ artifact?: Artifact, entries?: NameValue[] }> {
    if (this._isStopping)
      throw new Error(`Tracing is already stopping`);
    this._isStopping = true;

    const state = this._state;
    if (!state || !state.recording) {
      this._isStopping = false;
      if (params.mode !== 'discard')
        throw new Error(`Must start tracing before stopping`);
      return {};
    }

    this._context.instrumentation.removeListener(this);
    if (state.options.screenshots)
      this._stopScreencast();

    if (state.options.snapshots)
      await this._snapshotter?.stop();

    // Extract the list of resources collected to this moment.
    // Network recording will keep adding to it, and we don't want any new
    // resources in this chunk.
    const sha1s = new Set([...state.traceSha1s, ...state.networkSha1s]);

    // Network file survives across chunks, make a snapshot before returning the resulting entries.
    const suffix = state.chunkOrdinal ? `-${state.chunkOrdinal}` : ``;
    const networkFile = path.join(state.tracesDir, state.traceName + `${suffix}.network`);
    this._fs.copyFile(state.networkFile, networkFile);

    // Chain the export operation against write operations,
    // so that files that are not modified while being zipped.
    return await this._fs.flushLockAndRun(async () => {
      // Closing the browser removes tracesDir and writing/archiving fails.
      // In this case, we return nothing - clients are ready for it.
      // In theory, we can also surface errors to the user.
      const hadErrors = this._fs.getAndResetHadErrorsFlag();
      if (params.mode === 'discard' || hadErrors)
        return {};

      const entries: NameValue[] = [];
      entries.push({ name: 'trace.trace', value: state.traceFile });
      entries.push({ name: 'trace.network', value: networkFile });
      for (const sha1 of sha1s)
        entries.push({ name: path.join('resources', sha1), value: path.join(state.resourcesDir, sha1) });

      if (params.mode === 'entries')
        return { entries };
      const artifact = await this._exportZip(entries, state).catch(() => undefined);
      return { artifact };
    }).finally(() => {
      // Only reset trace sha1s, network resources are preserved between chunks.
      state.traceSha1s = new Set();
      this._isStopping = false;
      state.recording = false;
    });
  }

  private _exportZip(entries: NameValue[], state: RecordingState): Promise<Artifact> {
    const zipFile = new yazl.ZipFile();
    const result = new ManualPromise<Artifact>();
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

  async _captureSnapshot(snapshotName: string, sdkObject: SdkObject, metadata: CallMetadata, element?: ElementHandle): Promise<void> {
    if (!this._snapshotter)
      return;
    if (!sdkObject.attribution.page)
      return;
    if (!this._snapshotter.started())
      return;
    if (!shouldCaptureSnapshot(metadata))
      return;
    // We have |element| for input actions (page.click and handle.click)
    // and |sdkObject| element for accessors like handle.textContent.
    if (!element && sdkObject instanceof ElementHandle)
      element = sdkObject;
    await this._snapshotter.captureSnapshot(sdkObject.attribution.page, metadata.id, snapshotName, element).catch(() => {});
  }

  onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata) {
    // IMPORTANT: no awaits before this._appendTraceEvent in this method.
    const event = createBeforeActionTraceEvent(metadata);
    if (!event)
      return Promise.resolve();
    sdkObject.attribution.page?.temporarlyDisableTracingScreencastThrottling();
    event.beforeSnapshot = `before@${metadata.id}`;
    this._appendTraceEvent(event);
    return this._captureSnapshot(event.beforeSnapshot, sdkObject, metadata);
  }

  onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata, element: ElementHandle) {
    // IMPORTANT: no awaits before this._appendTraceEvent in this method.
    const event = createInputActionTraceEvent(metadata);
    if (!event)
      return Promise.resolve();
    sdkObject.attribution.page?.temporarlyDisableTracingScreencastThrottling();
    event.inputSnapshot = `input@${metadata.id}`;
    this._appendTraceEvent(event);
    return this._captureSnapshot(event.inputSnapshot, sdkObject, metadata, element);
  }

  async onAfterCall(sdkObject: SdkObject, metadata: CallMetadata) {
    const event = createAfterActionTraceEvent(metadata);
    if (!event)
      return Promise.resolve();
    sdkObject.attribution.page?.temporarlyDisableTracingScreencastThrottling();
    event.afterSnapshot = `after@${metadata.id}`;
    this._appendTraceEvent(event);
    return this._captureSnapshot(event.afterSnapshot, sdkObject, metadata);
  }

  onEvent(sdkObject: SdkObject, event: trace.EventTraceEvent) {
    if (!sdkObject.attribution.context)
      return;
    if (event.method === '__create__' && event.class === 'ConsoleMessage') {
      const object: trace.ObjectTraceEvent = {
        type: 'object',
        class: event.class,
        guid: event.params.guid,
        initializer: event.params.initializer,
      };
      this._appendTraceEvent(object);
      return;
    }
    this._appendTraceEvent(event);
  }

  onEntryStarted(entry: har.Entry) {
  }

  onEntryFinished(entry: har.Entry) {
    const event: trace.ResourceSnapshotTraceEvent = { type: 'resource-snapshot', snapshot: entry };
    const visited = visitTraceEvent(event, this._state!.networkSha1s);
    this._fs.appendText(this._state!.networkFile, JSON.stringify(visited) + '\n');
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
    const visited = visitTraceEvent(event, this._state!.traceSha1s);
    this._fs.appendText(this._state!.traceFile, JSON.stringify(visited) + '\n');
  }

  private _appendResource(sha1: string, buffer: Buffer) {
    if (this._allResources.has(sha1))
      return;
    this._allResources.add(sha1);
    const resourcePath = path.join(this._state!.resourcesDir, sha1);
    this._fs.writeFile(resourcePath, buffer, true /* skipIfExists */);
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

function shouldCaptureSnapshot(metadata: CallMetadata): boolean {
  return commandsWithTracingSnapshots.has(metadata.type + '.' + metadata.method);
}

function createBeforeActionTraceEvent(metadata: CallMetadata): trace.BeforeActionTraceEvent | null {
  if (metadata.internal || metadata.method.startsWith('tracing'))
    return null;
  return {
    type: 'before',
    callId: metadata.id,
    startTime: metadata.startTime,
    apiName: metadata.apiName || metadata.type + '.' + metadata.method,
    class: metadata.type,
    method: metadata.method,
    params: metadata.params,
    wallTime: metadata.wallTime,
    pageId: metadata.pageId,
  };
}

function createInputActionTraceEvent(metadata: CallMetadata): trace.InputActionTraceEvent | null {
  if (metadata.internal || metadata.method.startsWith('tracing'))
    return null;
  return {
    type: 'input',
    callId: metadata.id,
    point: metadata.point,
  };
}

function createAfterActionTraceEvent(metadata: CallMetadata): trace.AfterActionTraceEvent | null {
  if (metadata.internal || metadata.method.startsWith('tracing'))
    return null;
  return {
    type: 'after',
    callId: metadata.id,
    endTime: metadata.endTime,
    log: metadata.log,
    error: metadata.error?.error,
    result: metadata.result,
  };
}

class CachingFS {
  private _writeChain = Promise.resolve();
  private _dirsCreated = new Set<string>();
  private _hadErrors = false;

  private async _appendOperation<T>(cb: () => Promise<T>): Promise<T> {
    // This method serializes all writes in a single chain.
    let result: { value: T } | { error: Error };
    this._writeChain = this._writeChain.then(async () => {
      try {
        result = { value: await cb() };
      } catch (error) {
        result = { error };
      }
    });
    await this._writeChain;
    if ('error' in result!)
      throw result.error;
    return result!.value;
  }

  private async _makeDirIfNeeded(filePath: string) {
    const dir = path.dirname(filePath);
    if (!this._dirsCreated.has(dir)) {
      await fs.promises.mkdir(dir, { recursive: true }).catch(() => this._hadErrors = true);
      this._dirsCreated.add(dir);
    }
  }

  async appendText(filePath: string, text: string) {
    return this._appendOperation(async () => {
      await this._makeDirIfNeeded(filePath);
      await fs.promises.appendFile(filePath, text).catch(() => this._hadErrors = true);
    });
  }

  async writeFile(filePath: string, data: string | Buffer, skipIfExists: boolean) {
    return this._appendOperation(async () => {
      await this._makeDirIfNeeded(filePath);
      // Note: 'wx' flag only writes when the file does not exist.
      // See https://nodejs.org/api/fs.html#file-system-flags.
      // This way tracing never have to write the same resource twice.
      await fs.promises.writeFile(filePath, data, { flag: skipIfExists ? 'wx' : 'w' }).catch(() => {});
    });
  }

  async copyFile(src: string, dst: string) {
    return this._appendOperation(async () => {
      await fs.promises.copyFile(src, dst).catch(() => this._hadErrors = true);
    });
  }

  async flushLockAndRun<T>(operation: () => Promise<T>): Promise<T> {
    return this._appendOperation(operation);
  }

  async flush() {
    return this._appendOperation(() => Promise.resolve());
  }

  getAndResetHadErrorsFlag() {
    const result = this._hadErrors;
    this._hadErrors = false;
    return result;
  }
}
