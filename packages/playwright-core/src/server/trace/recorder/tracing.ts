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

import { getMetainfo } from '@isomorphic/protocolMetainfo';
import { assert } from '@isomorphic/assert';
import { monotonicTime } from '@isomorphic/time';
import { ManualPromise } from '@isomorphic/manualPromise';
import { eventsHelper  } from '@utils/eventsHelper';
import { createGuid  } from '@utils/crypto';
import { TracingSession } from '@tracing/writer/tracingSession';
import { getPlaywrightVersion } from '../../userAgent';
import { Snapshotter } from './snapshotter';
import { Artifact } from '../../artifact';
import { BrowserContext } from '../../browserContext';
import { Dispatcher } from '../../dispatchers/dispatcher';
import { serializeError } from '../../errors';
import { HarRecorder } from '../../har/harRecorder';
import { HarTracer } from '../../har/harTracer';
import { SdkObject } from '../../instrumentation';
import { Page } from '../../page';
import { isAbortError, nullProgress } from '../../progress';

import type { SnapshotterBlob, SnapshotterDelegate } from './snapshotter';
import type { NameValue } from '@isomorphic/types';
import type { RegisteredListener } from '@utils/eventsHelper';
import type { ConsoleMessage } from '../../console';
import type { Dialog } from '../../dialog';
import type { Download } from '../../download';
import type { APIRequestContext } from '../../fetch';
import type { HarTracerDelegate } from '../../har/harTracer';
import type { CallMetadata, InstrumentationListener } from '../../instrumentation';
import type { PageError } from '../../page';
import type { RecordHarOptions, StackFrame, TracingTracingStopChunkParams } from '@protocol/channels';
import type * as har from '@tracing/format/har';
import type { FrameSnapshot } from '@tracing/format/snapshot';
import type * as trace from '@tracing/format/trace';
import type { Progress } from '@protocol/progress';
import type * as types from '../../types';
import type { Screencast, ScreencastClient } from '../../screencast';

const version: trace.VERSION = 8;

export type TracerOptions = {
  name?: string;
  snapshots?: boolean;
  screenshots?: boolean;
  live?: boolean;
};

export class Tracing extends SdkObject implements InstrumentationListener, SnapshotterDelegate, HarTracerDelegate {
  private _snapshotter?: Snapshotter;
  private _harTracer: HarTracer;
  private _screencastListeners: RegisteredListener[] = [];
  private _pageTracingRecorders = new Map<Page, ScreencastTracingRecorder>();
  private _eventListeners: RegisteredListener[] = [];
  private _context: BrowserContext | APIRequestContext;
  private _contextCreatedEvent: trace.ContextCreatedTraceEvent;
  private _pendingHarEntries = new Set<har.Entry>();
  private _session: TracingSession;
  // Per-chunk: ids of calls observed since the chunk started; cleared each chunk.
  private _callIds = new Set<string>();
  // Original start() options, kept on the server side so startChunk/stopChunk
  // can decide whether to wire up screencast and snapshotter. The session
  // itself only consults the `live` and `name` fields.
  private _options: TracerOptions | undefined;
  private _started = false;
  readonly harRecorders = new Map<string, HarRecorder>();

  constructor(context: BrowserContext | APIRequestContext, tracesDir: string | undefined) {
    super(context, 'tracing');
    this._context = context;
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
      origin: 'library',
      browserName: '',
      playwrightVersion: getPlaywrightVersion(),
      options: {},
      platform: process.platform,
      wallTime: 0,
      monotonicTime: 0,
      sdkLanguage: this._sdkLanguage(),
      testIdAttributeName,
      contextId: context.guid,
    };
    if (context instanceof BrowserContext) {
      this._snapshotter = new Snapshotter(context, this);
      assert(tracesDir, 'tracesDir must be specified for BrowserContext');
      this._contextCreatedEvent.browserName = context._browser.options.name;
      this._contextCreatedEvent.channel = context._browser.options.channel;
      this._contextCreatedEvent.options = context._options;
    }
    this._session = new TracingSession({
      tracesDir,
      preserveNetworkResources: context instanceof BrowserContext,
      replacer: redactNonSerializable,
    });
  }

  private _sdkLanguage() {
    return this._context instanceof BrowserContext ? this._context._browser.sdkLanguage() : this._context.attribution.playwright.options.sdkLanguage;
  }

  async resetForReuse(progress: Progress) {
    // Discard previous chunk if any and ignore any errors there.
    await this.stopChunk(progress, { mode: 'discard' }).catch(() => {});
    await this._stop(progress);
    if (this._snapshotter)
      await progress.race(this._snapshotter.resetForReuse());
  }

  start(progress: Progress, options: TracerOptions) {
    // Re-write for testing.
    this._contextCreatedEvent.sdkLanguage = this._sdkLanguage();
    this._session.start({ name: options.name, live: options.live });
    this._options = options;
    if (options.snapshots)
      this._harTracer.start({ omitScripts: !options.live });
    this._started = true;
  }

  async startChunk(progress: Progress, options: { name?: string, title?: string } = {}): Promise<{ traceName: string }> {
    if (this._session.isRecording())
      await this.stopChunk(progress, { mode: 'discard' });

    this._callIds.clear();

    const result = this._session.startChunk({
      name: options.name,
      title: options.title,
      contextCreatedEvent: this._contextCreatedEvent,
    });

    this._context.instrumentation.addListener(this, this._context);
    this._eventListeners.push(
        eventsHelper.addEventListener(this._context, BrowserContext.Events.Console, this._onConsoleMessage.bind(this)),
        eventsHelper.addEventListener(this._context, BrowserContext.Events.PageError, this._onPageError.bind(this)),
    );
    if (this._options?.screenshots)
      this._startScreencast();
    if (this._options?.snapshots)
      await this._snapshotter?.start(progress);
    return result;
  }

  group(progress: Progress, name: string, location: { file: string, line?: number, column?: number } | undefined) {
    const metadata = progress.metadata;
    const stackFrames: StackFrame[] = [];
    const { file, line, column } = location ?? metadata.location ?? {};
    if (file) {
      stackFrames.push({
        file,
        line: line ?? 0,
        column: column ?? 0,
      });
    }
    this._session.group({
      callId: metadata.id,
      startTime: metadata.startTime,
      title: name,
      stepId: metadata.stepId,
      stack: stackFrames,
    });
  }

  groupEnd(progress: Progress) {
    this._session.groupEnd();
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
    for (const recorder of this._pageTracingRecorders.values())
      recorder.dispose();
    this._pageTracingRecorders.clear();
  }

  async stop(progress: Progress) {
    await this._stop(progress);
  }

  private async _stop(progress: Progress) {
    if (!this._session.hasState())
      return;
    if (this._session.isStopping())
      throw new Error(`Tracing is already stopping`);
    if (this._session.isRecording())
      throw new Error(`Must stop trace file before stopping tracing`);
    this._session.closeAllGroups();
    this._harTracer.stop();
    this.flushHarEntries();
    await progress.race(this._session.stop(progress.signal));
    this._options = undefined;
  }

  async deleteTmpTracesDir() {
    await this._session.deleteTmpTracesDir();
  }

  abort() {
    this._snapshotter?.dispose();
    this._harTracer.stop();
  }

  async flush() {
    this.abort();
    for (const harRecorder of this.harRecorders.values())
      await harRecorder.flush();
    await this._session.flush();
  }

  harStart(page: Page | null, options: RecordHarOptions): string {
    const harId = createGuid();
    const artifactsDir = this._context instanceof BrowserContext ? this._context._browser.options.artifactsDir : this._session.tracesDir();
    this.harRecorders.set(harId, new HarRecorder(this._context, artifactsDir, harId, page, options));
    return harId;
  }

  async harExport(progress: Progress, harId: string | undefined, mode: 'archive' | 'entries'): Promise<{ artifact?: Artifact, entries?: NameValue[] }> {
    const recorder = this.harRecorders.get(harId || '')!;
    const result = await progress.race(recorder.export(mode));
    this.harRecorders.delete(harId || '');
    return result;
  }

  async stopChunk(progress: Progress, params: TracingTracingStopChunkParams): Promise<{ artifact?: Artifact, entries?: NameValue[] }> {
    if (this._session.isStopping())
      throw new Error(`Tracing is already stopping`);

    if (!this._session.hasState() || !this._session.isRecording()) {
      if (params.mode !== 'discard')
        throw new Error(`Must start tracing before stopping`);
      return {};
    }

    this._session.closeAllGroups();

    this._context.instrumentation.removeListener(this);
    eventsHelper.removeEventListeners(this._eventListeners);
    if (this._options?.screenshots)
      this._stopScreencast();
    if (this._options?.snapshots)
      this._snapshotter?.stop();

    this.flushHarEntries();

    let result: { entries?: NameValue[]; zipFile?: string };
    try {
      result = await progress.race(this._session.stopChunk(progress.signal, params.mode));
    } catch (error) {
      // The browser may have closed while stopping (e.g. process exit). The
      // client doesn't expect an artifact in that case.
      if (!isAbortError(error as Error) && this._context instanceof BrowserContext && !this._context._browser.isConnected())
        return {};
      throw error;
    }

    if (params.mode === 'archive' && result.zipFile) {
      const artifact = new Artifact(this._context, result.zipFile);
      artifact.reportFinished();
      return { artifact };
    }
    if (params.mode === 'entries')
      return { entries: result.entries };
    return {};
  }

  private async _captureSnapshot(snapshotName: string | undefined, sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (!snapshotName || !sdkObject.attribution.page)
      return;
    await this._snapshotter?.captureSnapshot(sdkObject.attribution.page, metadata.id, snapshotName).catch(() => {});
  }

  private _shouldCaptureSnapshot(sdkObject: SdkObject, metadata: CallMetadata, phase: 'before' | 'after' | 'input') {
    if (!sdkObject.attribution.page || !this._snapshotter?.started())
      return;

    const metainfo = getMetainfo(metadata);
    if (!metainfo?.snapshot)
      return false;

    switch (phase) {
      case 'before': return !metainfo.input || !!metainfo.isAutoWaiting;
      case 'input': return !!metainfo.input;
      case 'after': return true;
    }
  }

  onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata) {
    // IMPORTANT: no awaits in this method, this._session.appendTraceEvent must be called synchronously.
    const event = createBeforeActionTraceEvent(metadata);
    if (!event)
      return Promise.resolve();
    this._temporarilyDisableThrottling(sdkObject.attribution.page);
    if (this._shouldCaptureSnapshot(sdkObject, metadata, 'before'))
      event.beforeSnapshot = `before@${metadata.id}`;
    this._callIds.add(metadata.id);
    this._session.appendTraceEvent(event);
    return this._captureSnapshot(event.beforeSnapshot, sdkObject, metadata);
  }

  onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata) {
    // IMPORTANT: no awaits in this method, this._session.appendTraceEvent must be called synchronously.
    if (!this._callIds.has(metadata.id))
      return Promise.resolve();
    const event = createInputActionTraceEvent(metadata);
    if (!event)
      return Promise.resolve();
    this._temporarilyDisableThrottling(sdkObject.attribution.page);
    if (this._shouldCaptureSnapshot(sdkObject, metadata, 'input'))
      event.inputSnapshot = `input@${metadata.id}`;
    this._session.appendTraceEvent(event);
    return this._captureSnapshot(event.inputSnapshot, sdkObject, metadata);
  }

  onCallLog(sdkObject: SdkObject, metadata: CallMetadata, logName: string, message: string) {
    if (!this._callIds.has(metadata.id))
      return;
    if (metadata.internal)
      return;
    if (logName !== 'api')
      return;
    const event = createActionLogTraceEvent(metadata, message);
    if (event)
      this._session.appendTraceEvent(event);
  }

  onAfterCall(sdkObject: SdkObject, metadata: CallMetadata) {
    // IMPORTANT: no awaits in this method, this._session.appendTraceEvent must be called synchronously.
    if (!this._callIds.has(metadata.id))
      return Promise.resolve();
    this._callIds.delete(metadata.id);
    const event = createAfterActionTraceEvent(metadata);
    if (!event)
      return Promise.resolve();
    this._temporarilyDisableThrottling(sdkObject.attribution.page);
    if (this._shouldCaptureSnapshot(sdkObject, metadata, 'after'))
      event.afterSnapshot = `after@${metadata.id}`;
    this._session.appendTraceEvent(event);
    return this._captureSnapshot(event.afterSnapshot, sdkObject, metadata);
  }

  onEntryStarted(entry: har.Entry) {
    this._pendingHarEntries.add(entry);
  }

  onEntryFinished(entry: har.Entry) {
    this._pendingHarEntries.delete(entry);
    this._session.appendNetworkEntry(entry);
  }

  flushHarEntries() {
    if (!this._pendingHarEntries.size)
      return;
    this._session.appendNetworkEntries(this._pendingHarEntries);
    this._pendingHarEntries.clear();
  }

  onContentBlob(sha1: string, buffer: Buffer) {
    this._session.appendResource(sha1, buffer);
  }

  onSnapshotterBlob(blob: SnapshotterBlob): void {
    this._session.appendResource(blob.sha1, blob.buffer);
  }

  onFrameSnapshot(snapshot: FrameSnapshot): void {
    this._session.appendTraceEvent({ type: 'frame-snapshot', snapshot });
  }

  private _onConsoleMessage(message: ConsoleMessage) {
    const event: trace.ConsoleMessageTraceEvent = {
      type: 'console',
      messageType: message.type(),
      text: message.text(),
      args: message.args().map(a => ({ preview: a.toString(), value: a.rawValue() })),
      location: message.location(),
      time: monotonicTime(),
      pageId: message.page()?.guid,
    };
    this._session.appendTraceEvent(event);
  }

  onDialog(dialog: Dialog) {
    const event: trace.EventTraceEvent = {
      type: 'event',
      time: monotonicTime(),
      class: 'BrowserContext',
      method: 'dialog',
      params: { pageId: dialog.page().guid, type: dialog.type(), message: dialog.message(), defaultValue: dialog.defaultValue() },
    };
    this._session.appendTraceEvent(event);
  }

  onDownload(page: Page, download: Download) {
    const event: trace.EventTraceEvent = {
      type: 'event',
      time: monotonicTime(),
      class: 'BrowserContext',
      method: 'download',
      params: { pageId: page.guid, url: download.url, suggestedFilename: download.suggestedFilename() },
    };
    this._session.appendTraceEvent(event);
  }

  onPageOpen(page: Page) {
    const event: trace.EventTraceEvent = {
      type: 'event',
      time: monotonicTime(),
      class: 'BrowserContext',
      method: 'page',
      params: { pageId: page.guid, openerPageId: page.opener()?.guid },
    };
    this._session.appendTraceEvent(event);
  }

  onPageClose(page: Page) {
    const event: trace.EventTraceEvent = {
      type: 'event',
      time: monotonicTime(),
      class: 'BrowserContext',
      method: 'pageClosed',
      params: { pageId: page.guid },
    };
    this._session.appendTraceEvent(event);
  }

  dispose(params: TracingTracingStopChunkParams) {
    // Avoid protocol calls for the closed context.
    if (this._started)
      this.stopChunk(nullProgress, params).then(() => this._stop(nullProgress)).catch(() => {});
    this._started = false;
  }

  private _onPageError(pageError: PageError, page: Page) {
    const event: trace.EventTraceEvent = {
      type: 'event',
      time: monotonicTime(),
      class: 'BrowserContext',
      method: 'pageError',
      params: {
        error: serializeError(pageError.error),
        location: {
          url: pageError.location.url,
          line: pageError.location.lineNumber,
          column: pageError.location.columnNumber,
        },
      },
      pageId: page.guid,
    };
    this._session.appendTraceEvent(event);
  }

  private _temporarilyDisableThrottling(page: Page | undefined) {
    if (page)
      this._pageTracingRecorders.get(page)?.temporarilyDisableThrottling();
  }

  private _startScreencastInPage(page: Page) {
    const prefix = page.guid;
    const onFrame = (params: types.ScreencastFrame) => {
      const suffix = Date.now();
      const sha1 = `${prefix}-${suffix}.jpeg`;
      const event: trace.ScreencastFrameTraceEvent = {
        type: 'screencast-frame',
        pageId: page.guid,
        sha1,
        width: params.viewportWidth,
        height: params.viewportHeight,
        timestamp: monotonicTime(),
        frameSwapWallTime: params.frameSwapWallTime,
      };
      // Make sure to write the screencast frame before adding a reference to it.
      this._session.appendResource(sha1, params.buffer);
      this._session.appendTraceEvent(event);
    };
    this._pageTracingRecorders.set(page, new ScreencastTracingRecorder(page.screencast, onFrame));
  }
}

// Pre-write replacer for the session: redacts non-serializable types into
// stable string placeholders so JSON.stringify over the trace event tree
// produces sane output. Returning the value unchanged tells the session walker
// to treat it as a leaf and stop recursing.
function redactNonSerializable(value: any): any | undefined {
  if (value instanceof Dispatcher)
    return `<${(value as Dispatcher<any, any, any>)._type}>`;
  if (value instanceof Buffer)
    return `<Buffer>`;
  if (value instanceof Date)
    return value;
  return undefined;
}

function createBeforeActionTraceEvent(metadata: CallMetadata): trace.BeforeActionTraceEvent | null {
  if (metadata.internal || metadata.method.startsWith('tracing'))
    return null;
  return {
    type: 'before',
    callId: metadata.id,
    startTime: metadata.startTime,
    title: metadata.title,
    class: metadata.type,
    method: metadata.method,
    params: metadata.params,
    stepId: metadata.stepId,
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

function createActionLogTraceEvent(metadata: CallMetadata, message: string): trace.LogTraceEvent | null {
  if (metadata.internal || metadata.method.startsWith('tracing'))
    return null;
  return {
    type: 'log',
    callId: metadata.id,
    time: monotonicTime(),
    message,
  };
}

function createAfterActionTraceEvent(metadata: CallMetadata): trace.AfterActionTraceEvent | null {
  if (metadata.internal || metadata.method.startsWith('tracing'))
    return null;
  return {
    type: 'after',
    callId: metadata.id,
    endTime: metadata.endTime,
    error: metadata.error?.error,
    result: metadata.result,
    point: metadata.point,
  };
}

const throttledRate = 200;
const unthrottleDuration = 500;

class ScreencastTracingRecorder {
  private _screencast: Screencast;
  private _client: ScreencastClient;
  private _unthrottledUntil = 0;
  private _pendingAck: ManualPromise<void> | undefined;
  private _timer: NodeJS.Timeout | undefined;

  constructor(screencast: Screencast, onFrame: (frame: types.ScreencastFrame) => void) {
    this._screencast = screencast;
    this._client = {
      onFrame: (frame: types.ScreencastFrame) => {
        const time = monotonicTime();

        if (time < this._unthrottledUntil) {
          onFrame(frame);
          return;
        }

        // We are throttling, but frames are coming => there is another client.
        if (this._pendingAck)
          return;

        onFrame(frame);
        this._pendingAck = new ManualPromise<void>();
        this._timer = setTimeout(() => this._clearPendingAck(), throttledRate);
        return this._pendingAck;
      },
      gracefulClose: () => this.dispose(),
      dispose: () => this.dispose(),
    };
    this._screencast.addClient(this._client);
  }

  dispose() {
    this._screencast.removeClient(this._client);
    this._clearPendingAck();
  }

  temporarilyDisableThrottling() {
    this._unthrottledUntil = monotonicTime() + unthrottleDuration;
    this._clearPendingAck();
  }

  private _clearPendingAck() {
    this._pendingAck?.resolve();
    this._pendingAck = undefined;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  }
}
