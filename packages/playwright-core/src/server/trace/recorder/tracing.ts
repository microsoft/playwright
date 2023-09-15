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
import type { ElementHandle } from '../../dom';
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
  live?: boolean;
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
  callIds: Set<string>;
};

const kScreencastOptions = { width: 800, height: 600, quality: 90 };

export class Tracing extends SdkObject implements InstrumentationListener, SnapshotterDelegate, HarTracerDelegate {
  private _fs = new SerializedFS();
  private _snapshotter?: Snapshotter;
  private _harTracer: HarTracer;
  private _screencastListeners: RegisteredListener[] = [];
  private _eventListeners: RegisteredListener[] = [];
  private _context: BrowserContext | APIRequestContext;
  // Note: state should only be touched inside API methods, but not inside trace operations.
  private _state: RecordingState | undefined;
  private _isStopping = false;
  private _precreatedTracesDir: string | undefined;
  private _tracesTmpDir: string | undefined;
  private _allResources = new Set<string>();
  private _contextCreatedEvent: trace.ContextCreatedTraceEvent;
  private _pendingHarEntries = new Set<har.Entry>();

  constructor(context: BrowserContext | APIRequestContext, tracesDir: string | undefined) {
    super(context, 'tracing');
    this._context = context;
    this._precreatedTracesDir = tracesDir;
    this._harTracer = new HarTracer(context, null, this, {
      content: 'attach',
      includeTraceInfo: true,
      recordRequestOverrides: false,
      waitForContentOnStop: false,
    });
    const testIdAttributeName = ('selectors' in context) ? context.selectors().testIdAttributeName() : undefined;
    this._contextCreatedEvent = {
      version,
      type: 'context-options',
      browserName: '',
      options: {},
      platform: process.platform,
      wallTime: 0,
      sdkLanguage: context.attribution.playwright.options.sdkLanguage,
      testIdAttributeName
    };
    if (context instanceof BrowserContext) {
      this._snapshotter = new Snapshotter(context, this);
      assert(tracesDir, 'tracesDir must be specified for BrowserContext');
      this._contextCreatedEvent.browserName = context._browser.options.name;
      this._contextCreatedEvent.channel = context._browser.options.channel;
      this._contextCreatedEvent.options = context._options;
    }
  }

  async resetForReuse() {
    // Discard previous chunk if any and ignore any errors there.
    await this.stopChunk({ mode: 'discard' }).catch(() => {});
    await this.stop();
    this._snapshotter?.resetForReuse();
  }

  async start(options: TracerOptions) {
    if (this._isStopping)
      throw new Error('Cannot start tracing while stopping');
    if (this._state)
      throw new Error('Tracing has been already started');

    // Re-write for testing.
    this._contextCreatedEvent.sdkLanguage = this._context.attribution.playwright.options.sdkLanguage;

    // TODO: passing the same name for two contexts makes them write into a single file
    // and conflict.
    const traceName = options.name || createGuid();

    const tracesDir = this._createTracesDirIfNeeded();

    // Init the state synchronously.
    this._state = {
      options,
      traceName,
      tracesDir,
      traceFile: path.join(tracesDir, traceName + '.trace'),
      networkFile: path.join(tracesDir, traceName + '.network'),
      resourcesDir: path.join(tracesDir, 'resources'),
      chunkOrdinal: 0,
      traceSha1s: new Set(),
      networkSha1s: new Set(),
      recording: false,
      callIds: new Set(),
    };
    this._fs.mkdir(this._state.resourcesDir);
    this._fs.writeFile(this._state.networkFile, '');
    // Tracing is 10x bigger if we include scripts in every trace.
    if (options.snapshots)
      this._harTracer.start({ omitScripts: !options.live });
  }

  async startChunk(options: { name?: string, title?: string } = {}): Promise<{ traceName: string }> {
    if (this._state && this._state.recording)
      await this.stopChunk({ mode: 'discard' });

    if (!this._state)
      throw new Error('Must start tracing before starting a new chunk');
    if (this._isStopping)
      throw new Error('Cannot start a trace chunk while stopping');

    this._state.recording = true;
    this._state.callIds.clear();

    if (options.name && options.name !== this._state.traceName)
      this._changeTraceName(this._state, options.name);
    else
      this._allocateNewTraceFile(this._state);

    this._fs.mkdir(path.dirname(this._state.traceFile));
    const event: trace.TraceEvent = { ...this._contextCreatedEvent, title: options.title, wallTime: Date.now() };
    this._fs.appendFile(this._state.traceFile, JSON.stringify(event) + '\n');

    this._context.instrumentation.addListener(this, this._context);
    this._eventListeners.push(
        eventsHelper.addEventListener(this._context, BrowserContext.Events.Console, this._onConsoleMessage.bind(this)),
    );
    if (this._state.options.screenshots)
      this._startScreencast();
    if (this._state.options.snapshots)
      await this._snapshotter?.start();
    return { traceName: this._state.traceName };
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

  private _allocateNewTraceFile(state: RecordingState) {
    const suffix = state.chunkOrdinal ? `-chunk${state.chunkOrdinal}` : ``;
    state.chunkOrdinal++;
    state.traceFile = path.join(state.tracesDir, `${state.traceName}${suffix}.trace`);
  }

  private _changeTraceName(state: RecordingState, name: string) {
    state.traceName = name;
    state.chunkOrdinal = 0;  // Reset ordinal for the new name.
    this._allocateNewTraceFile(state);

    // Network file survives across chunks, so make a copy with the new name.
    const newNetworkFile = path.join(state.tracesDir, name + '.network');
    this._fs.copyFile(state.networkFile, newNetworkFile);
    state.networkFile = newNetworkFile;
  }

  async stop() {
    if (!this._state)
      return;
    if (this._isStopping)
      throw new Error(`Tracing is already stopping`);
    if (this._state.recording)
      throw new Error(`Must stop trace file before stopping tracing`);
    this._harTracer.stop();
    this.flushHarEntries();
    await this._fs.syncAndGetError();
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
    await this._fs.syncAndGetError();
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

    this._context.instrumentation.removeListener(this);
    eventsHelper.removeEventListeners(this._eventListeners);
    if (this._state.options.screenshots)
      this._stopScreencast();

    if (this._state.options.snapshots)
      await this._snapshotter?.stop();

    this.flushHarEntries();

    // Network file survives across chunks, make a snapshot before returning the resulting entries.
    // We should pick a name starting with "traceName" and ending with .network.
    // Something like <traceName>someSuffixHere.network.
    // However, this name must not clash with any other "traceName".network in the same tracesDir.
    // We can use <traceName>-<guid>.network, but "-pwnetcopy-0" suffix is more readable
    // and makes it easier to debug future issues.
    const newNetworkFile = path.join(this._state.tracesDir, this._state.traceName + `-pwnetcopy-${this._state.chunkOrdinal}.network`);

    const entries: NameValue[] = [];
    entries.push({ name: 'trace.trace', value: this._state.traceFile });
    entries.push({ name: 'trace.network', value: newNetworkFile });
    for (const sha1 of new Set([...this._state.traceSha1s, ...this._state.networkSha1s]))
      entries.push({ name: path.join('resources', sha1), value: path.join(this._state.resourcesDir, sha1) });

    // Only reset trace sha1s, network resources are preserved between chunks.
    this._state.traceSha1s = new Set();

    if (params.mode === 'discard') {
      this._isStopping = false;
      this._state.recording = false;
      return {};
    }

    this._fs.copyFile(this._state.networkFile, newNetworkFile);

    const zipFileName = this._state.traceFile + '.zip';
    if (params.mode === 'archive')
      this._fs.zip(entries, zipFileName);

    // Make sure all file operations complete.
    const error = await this._fs.syncAndGetError();

    this._isStopping = false;
    if (this._state)
      this._state.recording = false;

    // IMPORTANT: no awaits after this point, to make sure recording state is correct.

    if (error) {
      // This check is here because closing the browser removes the tracesDir and tracing
      // cannot access removed files. Clients are ready for the missing artifact.
      if (this._context instanceof BrowserContext && !this._context._browser.isConnected())
        return {};
      throw error;
    }

    if (params.mode === 'entries')
      return { entries };

    const artifact = new Artifact(this._context, zipFileName);
    artifact.reportFinished();
    return { artifact };
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
    await this._snapshotter.captureSnapshot(sdkObject.attribution.page, metadata.id, snapshotName, element).catch(() => {});
  }

  onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata) {
    // IMPORTANT: no awaits before this._appendTraceEvent in this method.
    const event = createBeforeActionTraceEvent(metadata);
    if (!event)
      return Promise.resolve();
    sdkObject.attribution.page?.temporarlyDisableTracingScreencastThrottling();
    event.beforeSnapshot = `before@${metadata.id}`;
    this._state?.callIds.add(metadata.id);
    this._appendTraceEvent(event);
    return this._captureSnapshot(event.beforeSnapshot, sdkObject, metadata);
  }

  onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata, element: ElementHandle) {
    if (!this._state?.callIds.has(metadata.id))
      return Promise.resolve();
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
    if (!this._state?.callIds.has(metadata.id))
      return;
    this._state?.callIds.delete(metadata.id);
    const event = createAfterActionTraceEvent(metadata);
    if (!event)
      return;
    sdkObject.attribution.page?.temporarlyDisableTracingScreencastThrottling();
    event.afterSnapshot = `after@${metadata.id}`;
    this._appendTraceEvent(event);
    return this._captureSnapshot(event.afterSnapshot, sdkObject, metadata);
  }

  onEvent(sdkObject: SdkObject, event: trace.EventTraceEvent) {
    if (!sdkObject.attribution.context)
      return;
    if (event.method === 'console' ||
        (event.method === '__create__' && event.class === 'ConsoleMessage') ||
        (event.method === '__create__' && event.class === 'JSHandle')) {
      // Console messages are handled separately.
      return;
    }
    this._appendTraceEvent(event);
  }

  onEntryStarted(entry: har.Entry) {
    this._pendingHarEntries.add(entry);
  }

  onEntryFinished(entry: har.Entry) {
    this._pendingHarEntries.delete(entry);
    const event: trace.ResourceSnapshotTraceEvent = { type: 'resource-snapshot', snapshot: entry };
    const visited = visitTraceEvent(event, this._state!.networkSha1s);
    this._fs.appendFile(this._state!.networkFile, JSON.stringify(visited) + '\n', true /* flush */);
  }

  flushHarEntries() {
    const harLines: string[] = [];
    for (const entry of this._pendingHarEntries) {
      const event: trace.ResourceSnapshotTraceEvent = { type: 'resource-snapshot', snapshot: entry };
      const visited = visitTraceEvent(event, this._state!.networkSha1s);
      harLines.push(JSON.stringify(visited));
    }
    this._pendingHarEntries.clear();
    if (harLines.length)
      this._fs.appendFile(this._state!.networkFile, harLines.join('\n') + '\n', true /* flush */);
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
    const object: trace.ConsoleMessageTraceEvent = {
      type: 'object',
      class: 'ConsoleMessage',
      guid: message.guid,
      initializer: {
        type: message.type(),
        text: message.text(),
        args: message.args().map(a => ({ preview: a.toString(), value: a.rawValue() })),
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
    const visited = visitTraceEvent(event, this._state!.traceSha1s);
    // Do not flush (console) events, they are too noisy, unless we are in ui mode (live).
    const flush = this._state!.options.live || (event.type !== 'event' && event.type !== 'object');
    this._fs.appendFile(this._state!.traceFile, JSON.stringify(visited) + '\n', flush);
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
  if (object instanceof Date)
    return object;
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

class SerializedFS {
  private _writeChain = Promise.resolve();
  private _buffers = new Map<string, string[]>(); // Should never be accessed from within appendOperation.
  private _error: Error | undefined;

  mkdir(dir: string) {
    this._appendOperation(() => fs.promises.mkdir(dir, { recursive: true }));
  }

  writeFile(file: string, content: string | Buffer, skipIfExists?: boolean) {
    this._buffers.delete(file); // No need to flush the buffer since we'll overwrite anyway.

    // Note: 'wx' flag only writes when the file does not exist.
    // See https://nodejs.org/api/fs.html#file-system-flags.
    // This way tracing never have to write the same resource twice.
    this._appendOperation(async () => {
      if (skipIfExists)
        await fs.promises.writeFile(file, content, { flag: 'wx' }).catch(() => {});
      else
        await fs.promises.writeFile(file, content);
    });
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
    const text = buffer.join('');
    this._buffers.delete(file);
    this._appendOperation(() => fs.promises.appendFile(file, text));
  }

  copyFile(from: string, to: string) {
    this._flushFile(from);
    this._buffers.delete(to); // No need to flush the buffer since we'll overwrite anyway.
    this._appendOperation(() => fs.promises.copyFile(from, to));
  }

  async syncAndGetError() {
    for (const file of this._buffers.keys())
      this._flushFile(file);
    await this._writeChain;
    return this._error;
  }

  zip(entries: NameValue[], zipFileName: string) {
    for (const file of this._buffers.keys())
      this._flushFile(file);

    // Chain the export operation against write operations,
    // so that files do not change during the export.
    this._appendOperation(async () => {
      const zipFile = new yazl.ZipFile();
      const result = new ManualPromise<void>();
      (zipFile as any as EventEmitter).on('error', error => result.reject(error));
      for (const entry of entries)
        zipFile.addFile(entry.value, entry.name);
      zipFile.end();
      zipFile.outputStream
          .pipe(fs.createWriteStream(zipFileName))
          .on('close', () => result.resolve())
          .on('error', error => result.reject(error));
      await result;
    });
  }

  private _appendOperation(cb: () => Promise<unknown>): void {
    // This method serializes all writes to the trace.
    this._writeChain = this._writeChain.then(async () => {
      // Ignore all operations after the first error.
      if (this._error)
        return;
      try {
        await cb();
      } catch (e) {
        this._error = e;
      }
    });
  }
}
