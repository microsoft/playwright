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

import fs from 'fs';
import path from 'path';
import yazl from 'yazl';
import readline from 'readline';
import { EventEmitter } from 'events';
import { createGuid, mkdirIfNeeded, monotonicTime } from '../../../utils/utils';
import { Artifact } from '../../artifact';
import { BrowserContext } from '../../browserContext';
import { ElementHandle } from '../../dom';
import { eventsHelper, RegisteredListener } from '../../../utils/eventsHelper';
import { CallMetadata, InstrumentationListener, SdkObject } from '../../instrumentation';
import { Page } from '../../page';
import * as trace from '../common/traceEvents';
import { TraceSnapshotter } from './traceSnapshotter';
import { commandsWithTracingSnapshots } from '../../../protocol/channels';

export type TracerOptions = {
  name?: string;
  snapshots?: boolean;
  screenshots?: boolean;
};

export const VERSION = 2;

type RecordingState = {
  options: TracerOptions,
  traceFile: string,
  lastReset: number,
  sha1s: Set<string>,
};

const kScreencastOptions = { width: 800, height: 600, quality: 90 };

export class Tracing implements InstrumentationListener {
  private _appendEventChain = Promise.resolve();
  private _snapshotter: TraceSnapshotter;
  private _screencastListeners: RegisteredListener[] = [];
  private _pendingCalls = new Map<string, { sdkObject: SdkObject, metadata: CallMetadata, beforeSnapshot: Promise<void>, actionSnapshot?: Promise<void>, afterSnapshot?: Promise<void> }>();
  private _context: BrowserContext;
  private _resourcesDir: string;
  private _recording: RecordingState | undefined;
  private _isStopping = false;
  private _tracesDir: string;

  constructor(context: BrowserContext) {
    this._context = context;
    this._tracesDir = context._browser.options.tracesDir;
    this._resourcesDir = path.join(this._tracesDir, 'resources');
    this._snapshotter = new TraceSnapshotter(this._context, this._resourcesDir, traceEvent => this._appendTraceEvent(traceEvent));
  }

  async start(options: TracerOptions): Promise<void> {
    if (this._isStopping)
      throw new Error('Cannot start tracing while stopping');
    // context + page must be the first events added, this method can't have awaits before them.

    const state = this._recording;
    if (!state) {
      // TODO: passing the same name for two contexts makes them write into a single file
      // and conflict.
      const traceFile = path.join(this._tracesDir, (options.name || createGuid()) + '.trace');
      this._recording = { options, traceFile, lastReset: 0, sha1s: new Set() };
      this._appendEventChain = mkdirIfNeeded(traceFile);
      const event: trace.ContextCreatedTraceEvent = {
        version: VERSION,
        type: 'context-options',
        browserName: this._context._browser.options.name,
        options: this._context._options
      };
      this._appendTraceEvent(event);
    }

    if (!state?.options?.screenshots && options.screenshots)
      this._startScreencast();
    else if (state?.options?.screenshots && !options.screenshots)
      this._stopScreencast();

    // context + page must be the first events added, no awaits above this line.
    await fs.promises.mkdir(this._resourcesDir, { recursive: true });

    if (!state)
      this._context.instrumentation.addListener(this);

    await this._appendTraceOperation(async () => {
      if (options.snapshots && state?.options?.snapshots) {
        // Reset snapshots to avoid back-references.
        await this._snapshotter.reset();
      } else if (options.snapshots) {
        await this._snapshotter.start();
      } else if (state?.options?.snapshots) {
        await this._snapshotter.stop();
      }

      if (state) {
        state.lastReset++;
        const markerEvent: trace.MarkerTraceEvent = { type: 'marker', resetIndex: state.lastReset };
        await fs.promises.appendFile(state.traceFile, JSON.stringify(markerEvent) + '\n');
      }
    });

    if (this._recording)
      this._recording.options = options;
  }

  private _startScreencast() {
    for (const page of this._context.pages())
      this._startScreencastInPage(page);
    this._screencastListeners.push(
        eventsHelper.addEventListener(this._context, BrowserContext.Events.Page, this._startScreencastInPage.bind(this)),
    );
  }

  private _stopScreencast() {
    eventsHelper.removeEventListeners(this._screencastListeners);
    for (const page of this._context.pages())
      page.setScreencastOptions(null);
  }

  async stop(): Promise<void> {
    if (!this._recording || this._isStopping)
      return;
    this._isStopping = true;
    this._context.instrumentation.removeListener(this);
    this._stopScreencast();
    await this._snapshotter.stop();
    // Ensure all writes are finished.
    await this._appendEventChain;
    this._recording = undefined;
    this._isStopping = false;
  }

  async dispose() {
    await this._snapshotter.dispose();
  }

  async export(): Promise<Artifact> {
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

    if (!this._recording)
      throw new Error('Must start tracing before exporting');

    // Chain the export operation against write operations,
    // so that neither trace file nor sha1s change during the export.
    return await this._appendTraceOperation(async () => {
      await this._snapshotter.checkpoint();

      const recording = this._recording!;
      let state = recording;
      // Make a filtered trace if needed.
      if (recording.lastReset)
        state = await this._filterTrace(recording, recording.lastReset);

      const zipFile = new yazl.ZipFile();
      const failedPromise = new Promise<Artifact>((_, reject) => (zipFile as any as EventEmitter).on('error', reject));
      const succeededPromise = new Promise<Artifact>(async fulfill => {
        zipFile.addFile(state.traceFile, 'trace.trace');
        const zipFileName = state.traceFile + '.zip';
        for (const sha1 of state.sha1s)
          zipFile.addFile(path.join(this._resourcesDir!, sha1), path.join('resources', sha1));
        zipFile.end();
        await new Promise(f => {
          zipFile.outputStream.pipe(fs.createWriteStream(zipFileName)).on('close', f);
        });
        const artifact = new Artifact(this._context, zipFileName);
        artifact.reportFinished();
        fulfill(artifact);
      });
      return Promise.race([failedPromise, succeededPromise]).finally(async () => {
        // Remove the filtered trace.
        if (recording.lastReset)
          await fs.promises.unlink(state.traceFile).catch(() => {});
      });
    });
  }

  private async _filterTrace(state: RecordingState, sinceResetIndex: number): Promise<RecordingState> {
    const ext = path.extname(state.traceFile);
    const traceFileCopy = state.traceFile.substring(0, state.traceFile.length - ext.length) + '-copy' + sinceResetIndex + ext;
    const sha1s = new Set<string>();
    await new Promise<void>((resolve, reject) => {
      const fileStream = fs.createReadStream(state.traceFile, 'utf8');
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      let copyChain = Promise.resolve();
      let foundMarker = false;
      rl.on('line', line => {
        try {
          const event = JSON.parse(line) as trace.TraceEvent;
          if (event.type === 'marker') {
            if (event.resetIndex === sinceResetIndex)
              foundMarker = true;
          } else if ((event.type === 'resource-snapshot' && state.options.snapshots) || event.type === 'context-options' || foundMarker) {
            // We keep:
            // - old resource events for snapshots;
            // - initial context options event;
            // - all events after the marker that are not markers.
            visitSha1s(event, sha1s);
            copyChain = copyChain.then(() => fs.promises.appendFile(traceFileCopy, line + '\n'));
          }
        } catch (e) {
          reject(e);
          fileStream.close();
          rl.close();
        }
      });
      rl.on('error', reject);
      rl.on('close', async () => {
        await copyChain;
        resolve();
      });
    });
    return { options: state.options, lastReset: state.lastReset, sha1s, traceFile: traceFileCopy };
  }

  async _captureSnapshot(name: 'before' | 'after' | 'action' | 'event', sdkObject: SdkObject, metadata: CallMetadata, element?: ElementHandle) {
    if (!sdkObject.attribution.page)
      return;
    if (!this._snapshotter.started())
      return;
    if (!shouldCaptureSnapshot(metadata))
      return;
    const snapshotName = `${name}@${metadata.id}`;
    metadata.snapshots.push({ title: name, snapshotName });
    await this._snapshotter!.captureSnapshot(sdkObject.attribution.page, snapshotName, element);
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata) {
    const beforeSnapshot = this._captureSnapshot('before', sdkObject, metadata);
    this._pendingCalls.set(metadata.id, { sdkObject, metadata, beforeSnapshot });
    await beforeSnapshot;
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata, element: ElementHandle) {
    const actionSnapshot = this._captureSnapshot('action', sdkObject, metadata, element);
    this._pendingCalls.get(metadata.id)!.actionSnapshot = actionSnapshot;
    await actionSnapshot;
  }

  async onAfterCall(sdkObject: SdkObject, metadata: CallMetadata) {
    const pendingCall = this._pendingCalls.get(metadata.id);
    if (!pendingCall || pendingCall.afterSnapshot)
      return;
    if (!sdkObject.attribution.page) {
      this._pendingCalls.delete(metadata.id);
      return;
    }
    pendingCall.afterSnapshot = this._captureSnapshot('after', sdkObject, metadata);
    await pendingCall.afterSnapshot;
    const event: trace.ActionTraceEvent = { type: 'action', metadata, hasSnapshot: shouldCaptureSnapshot(metadata) };
    this._appendTraceEvent(event);
    this._pendingCalls.delete(metadata.id);
  }

  onEvent(sdkObject: SdkObject, metadata: CallMetadata) {
    if (!sdkObject.attribution.page)
      return;
    const event: trace.ActionTraceEvent = { type: 'event', metadata, hasSnapshot: false };
    this._appendTraceEvent(event);
  }

  private _startScreencastInPage(page: Page) {
    page.setScreencastOptions(kScreencastOptions);
    const prefix = page.guid;
    let frameSeq = 0;
    this._screencastListeners.push(
        eventsHelper.addEventListener(page, Page.Events.ScreencastFrame, params => {
          const suffix = String(++frameSeq).padStart(10, '0');
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
          this._appendTraceOperation(async () => {
            await fs.promises.writeFile(path.join(this._resourcesDir!, sha1), params.buffer).catch(() => {});
          });
          this._appendTraceEvent(event);
        }),
    );
  }

  private _appendTraceEvent(event: any) {
    // Serialize all writes to the trace file.
    this._appendTraceOperation(async () => {
      visitSha1s(event, this._recording!.sha1s);
      await fs.promises.appendFile(this._recording!.traceFile, JSON.stringify(event) + '\n');
    });
  }

  private async _appendTraceOperation<T>(cb: () => Promise<T>): Promise<T> {
    let error: Error | undefined;
    let result: T | undefined;
    this._appendEventChain = this._appendEventChain.then(async () => {
      try {
        result = await cb();
      } catch (e) {
        error = e;
      }
    });
    await this._appendEventChain;
    if (error)
      throw error;
    return result!;
  }
}

function visitSha1s(object: any, sha1s: Set<string>) {
  if (Array.isArray(object)) {
    object.forEach(o => visitSha1s(o, sha1s));
    return;
  }
  if (typeof object === 'object') {
    for (const key in object) {
      if (key === 'sha1' || key.endsWith('Sha1')) {
        const sha1 = object[key];
        if (sha1)
          sha1s.add(sha1);
      }
      visitSha1s(object[key], sha1s);
    }
    return;
  }
}

export function shouldCaptureSnapshot(metadata: CallMetadata): boolean {
  return commandsWithTracingSnapshots.has(metadata.type + '.' + metadata.method);
}
