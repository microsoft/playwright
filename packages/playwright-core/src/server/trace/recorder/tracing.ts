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
import type { SnapshotterBlob, SnapshotterDelegate } from './snapshotter';
import { Snapshotter } from './snapshotter';
import { yazl } from '../../../zipBundle';
import type { ConsoleMessage } from '../../console';

const version: trace.VERSION = 4;

export type TracerOptions = {
  name?: string;
  snapshots?: boolean;
  screenshots?: boolean;
};

type RecordingState = {
  options: TracerOptions,
  traceName: string,
  networkFile: { file: string, buffer: trace.TraceEvent[] },
  traceFile: { file: string, buffer: trace.TraceEvent[] },
  tracesDir: string,
  resourcesDir: string,
  chunkOrdinal: number,
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
  private _eventListeners: RegisteredListener[] = [];
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
      if (!o.screenshots !== !options.screenshots || !o.snapshots !== !options.snapshots)
        throw new Error('Tracing has been already started with different options');
      if (options.name && options.name !== this._state.traceName)
        await this._changeTraceName(this._state, options.name);
      return;
    }
    // TODO: passing the same name for two contexts makes them write into a single file
    // and conflict.
    const traceName = options.name || createGuid();

    const tracesDir = this._createTracesDirIfNeeded();

    // Init the state synchronously.
    this._state = {
      options,
      traceName,
      tracesDir,
      traceFile: { file: path.join(tracesDir, traceName + '.trace'), buffer: [] },
      networkFile: { file: path.join(tracesDir, traceName + '.network'), buffer: [] },
      resourcesDir: path.join(tracesDir, 'resources'),
      chunkOrdinal: 0,
      traceSha1s: new Set(),
      networkSha1s: new Set(),
      recording: false
    };
    const state = this._state;
    this._writeChain = fs.promises.mkdir(state.resourcesDir, { recursive: true }).then(() => fs.promises.writeFile(state.networkFile.file, ''));
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
    state.traceFile = {
      file: path.join(state.tracesDir, `${state.traceName}${suffix}.trace`),
      buffer: [],
    };
    state.recording = true;

    if (options.name && options.name !== this._state.traceName)
      this._changeTraceName(this._state, options.name);

    this._appendTraceOperation(async () => {
      await mkdirIfNeeded(state.traceFile.file);
      const event: trace.TraceEvent = { ...this._contextCreatedEvent, title: options.title, wallTime: Date.now() };
      await appendEventAndFlushIfNeeded(state.traceFile, event);
    });

    this._context.instrumentation.addListener(this, this._context);
    this._eventListeners.push(
        eventsHelper.addEventListener(this._context, BrowserContext.Events.Console, this._onConsoleMessage.bind(this)),
    );
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
    await this._appendTraceOperation(async () => {
      await flushTraceFile(state.traceFile);
      await flushTraceFile(state.networkFile);

      const oldNetworkFile = state.networkFile;
      state.traceName = name;
      state.traceFile = {
        file: path.join(state.tracesDir, name + '.trace'),
        buffer: [],
      };
      state.networkFile = {
        file: path.join(state.tracesDir, name + '.network'),
        buffer: [],
      };
      // Network file survives across chunks, so make a copy with the new name.
      await fs.promises.copyFile(oldNetworkFile.file, state.networkFile.file);
    });
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

  private _createTracesDirIfNeeded() {
    if (this._precreatedTracesDir)
      return this._precreatedTracesDir;
    this._tracesTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-tracing-'));
    return this._tracesTmpDir;
  }

  async dispose() {
    this._snapshotter?.dispose();
    this._harTracer.stop();
    await this._writeChain;
  }

  async stopChunk(params: TracingTracingStopChunkParams): Promise<{ artifact?: Artifact, entries?: NameValue[] }> {
    if (this._isStopping)
      throw new Error(`Tracing is already stopping`);
    this._isStopping = true;

    if (!this._state || !this._state.recording) {
      this._isStopping = false;
      if (params.mode !== 'discard')
        throw new Error(`Must start tracing before stopping`);
      return {};
    }

    const state = this._state!;
    this._context.instrumentation.removeListener(this);
    eventsHelper.removeEventListeners(this._eventListeners);
    if (this._state?.options.screenshots)
      this._stopScreencast();

    if (state.options.snapshots)
      await this._snapshotter?.stop();

    // Chain the export operation against write operations,
    // so that neither trace files nor sha1s change during the export.
    return await this._appendTraceOperation(async () => {
      if (params.mode === 'discard')
        return {};

      await flushTraceFile(state.traceFile);
      await flushTraceFile(state.networkFile);

      // Network file survives across chunks, make a snapshot before returning the resulting entries.
      // We should pick a name starting with "traceName" and ending with .network.
      // Something like <traceName>someSuffixHere.network.
      // However, this name must not clash with any other "traceName".network in the same tracesDir.
      // We can use <traceName>-<guid>.network, but "-pwnetcopy-0" suffix is more readable
      // and makes it easier to debug future issues.
      const networkFile = path.join(state.tracesDir, state.traceName + `-pwnetcopy-${state.chunkOrdinal}.network`);
      await fs.promises.copyFile(state.networkFile.file, networkFile);

      const entries: NameValue[] = [];
      entries.push({ name: 'trace.trace', value: state.traceFile.file });
      entries.push({ name: 'trace.network', value: networkFile });
      for (const sha1 of new Set([...state.traceSha1s, ...state.networkSha1s]))
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
    }) || { };
  }

  private _exportZip(entries: NameValue[], state: RecordingState): Promise<Artifact | undefined> {
    const zipFile = new yazl.ZipFile();
    const result = new ManualPromise<Artifact | undefined>();
    (zipFile as any as EventEmitter).on('error', error => result.reject(error));
    for (const entry of entries)
      zipFile.addFile(entry.value, entry.name);
    zipFile.end();
    const zipFileName = state.traceFile.file + '.zip';
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
    if (event.method === 'console' || (event.method === '__create__' && event.class === 'ConsoleMessage')) {
      // Console messages are handled separately.
      return;
    }
    this._appendTraceEvent(event);
  }

  onEntryStarted(entry: har.Entry) {
  }

  onEntryFinished(entry: har.Entry) {
    const event: trace.ResourceSnapshotTraceEvent = { type: 'resource-snapshot', snapshot: entry };
    this._appendTraceOperation(async () => {
      const visited = visitTraceEvent(event, this._state!.networkSha1s);
      await appendEventAndFlushIfNeeded(this._state!.networkFile, visited);
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

  private _onConsoleMessage(message: ConsoleMessage) {
    const object: trace.ObjectTraceEvent = {
      type: 'object',
      class: 'ConsoleMessage',
      guid: message.guid,
      initializer: {
        type: message.type(),
        text: message.text(),
        location: message.location(),
      },
    };
    this._appendTraceEvent(object);

    const event: trace.EventTraceEvent = {
      type: 'event',
      class: 'BrowserContext',
      method: 'console',
      params: { message: { guid: message.guid } },
      time: monotonicTime(),
      pageId: message.page().guid,
    };
    this._appendTraceEvent(event);
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
      await appendEventAndFlushIfNeeded(this._state!.traceFile, visited);
    });
  }

  private _appendResource(sha1: string, buffer: Buffer) {
    if (this._allResources.has(sha1))
      return;
    this._allResources.add(sha1);
    const resourcePath = path.join(this._state!.resourcesDir, sha1);
    this._appendTraceOperation(async () => {
      // Note: 'wx' flag only writes when the file does not exist.
      // See https://nodejs.org/api/fs.html#file-system-flags.
      // This way tracing never have to write the same resource twice.
      await fs.promises.writeFile(resourcePath, buffer, { flag: 'wx' }).catch(() => {});
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

async function appendEventAndFlushIfNeeded(file: { file: string, buffer: trace.TraceEvent[] }, event: trace.TraceEvent) {
  file.buffer.push(event);

  // Do not flush events, they are too noisy.
  if (event.type === 'event' || event.type === 'object')
    return;

  await flushTraceFile(file);
}

async function flushTraceFile(file: { file: string, buffer: trace.TraceEvent[] }) {
  const data = file.buffer.map(e => Buffer.from(JSON.stringify(e) + '\n'));
  await fs.promises.appendFile(file.file, Buffer.concat(data));
  file.buffer = [];
}
