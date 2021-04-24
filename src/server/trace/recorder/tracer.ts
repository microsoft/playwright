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
import * as util from 'util';
import { calculateSha1, getFromENV, mkdirIfNeeded, monotonicTime } from '../../../utils/utils';
import { BrowserContext } from '../../browserContext';
import { Dialog } from '../../dialog';
import { ElementHandle } from '../../dom';
import { Frame, NavigationEvent } from '../../frames';
import { helper, RegisteredListener } from '../../helper';
import { CallMetadata, InstrumentationListener, SdkObject } from '../../instrumentation';
import { Page } from '../../page';
import * as trace from '../common/traceEvents';
import { TraceSnapshotter } from './traceSnapshotter';

const fsAppendFileAsync = util.promisify(fs.appendFile.bind(fs));
const envTrace = getFromENV('PWTRACE_RESOURCE_DIR');

export class Tracer implements InstrumentationListener {
  private _appendEventChain: Promise<string>;
  private _snapshotter: TraceSnapshotter;
  private _eventListeners: RegisteredListener[] = [];
  private _disposed = false;
  private _pendingCalls = new Map<string, { sdkObject: SdkObject, metadata: CallMetadata }>();
  private _context: BrowserContext;

  constructor(context: BrowserContext, traceDir: string) {
    this._context = context;
    this._context.instrumentation.addListener(this);
    const resourcesDir = envTrace || path.join(traceDir, 'resources');
    const tracePrefix = path.join(traceDir, context._options._debugName!);
    const traceFile = tracePrefix + '.trace';
    this._appendEventChain = mkdirIfNeeded(traceFile).then(() => traceFile);
    this._snapshotter = new TraceSnapshotter(context, resourcesDir, traceEvent => this._appendTraceEvent(traceEvent));
  }

  async start(): Promise<void> {
    const event: trace.ContextCreatedTraceEvent = {
      timestamp: monotonicTime(),
      type: 'context-metadata',
      browserName: this._context._browser.options.name,
      isMobile: !!this._context._options.isMobile,
      deviceScaleFactor: this._context._options.deviceScaleFactor || 1,
      viewportSize: this._context._options.viewport || undefined,
      debugName: this._context._options._debugName,
    };
    this._appendTraceEvent(event);
    this._eventListeners = [
      helper.addEventListener(this._context, BrowserContext.Events.Page, this._onPage.bind(this)),
    ];
    await this._snapshotter.start();
  }

  async stop() {
    this._disposed = true;
    this._context.instrumentation.removeListener(this);
    helper.removeEventListeners(this._eventListeners);
    await this._snapshotter.dispose();
    for (const { sdkObject, metadata } of this._pendingCalls.values())
      this.onAfterCall(sdkObject, metadata);

    // Ensure all writes are finished.
    await this._appendEventChain;
  }

  _captureSnapshot(name: 'before' | 'after' | 'action' | 'event', sdkObject: SdkObject, metadata: CallMetadata, element?: ElementHandle) {
    if (!sdkObject.attribution.page)
      return;
    const snapshotName = `${name}@${metadata.id}`;
    metadata.snapshots.push({ title: name, snapshotName });
    this._snapshotter.captureSnapshot(sdkObject.attribution.page, snapshotName, element);
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata) {
    this._captureSnapshot('before', sdkObject, metadata);
    this._pendingCalls.set(metadata.id, { sdkObject, metadata });
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata, element: ElementHandle) {
    this._captureSnapshot('action', sdkObject, metadata, element);
  }

  async onAfterCall(sdkObject: SdkObject, metadata: CallMetadata) {
    if (!this._pendingCalls.has(metadata.id))
      return;
    this._captureSnapshot('after', sdkObject, metadata);
    if (!sdkObject.attribution.page)
      return;
    const event: trace.ActionTraceEvent = {
      timestamp: metadata.startTime,
      type: 'action',
      metadata,
    };
    this._appendTraceEvent(event);
    this._pendingCalls.delete(metadata.id);
  }

  onEvent(sdkObject: SdkObject, metadata: CallMetadata) {
    if (!sdkObject.attribution.page)
      return;
    const event: trace.ActionTraceEvent = {
      timestamp: metadata.startTime,
      type: 'event',
      metadata,
    };
    this._appendTraceEvent(event);
  }

  private _onPage(page: Page) {
    const pageId = page.guid;

    const event: trace.PageCreatedTraceEvent = {
      timestamp: monotonicTime(),
      type: 'page-created',
      pageId,
    };
    this._appendTraceEvent(event);

    page.on(Page.Events.Dialog, (dialog: Dialog) => {
      if (this._disposed)
        return;
      const event: trace.DialogOpenedEvent = {
        timestamp: monotonicTime(),
        type: 'dialog-opened',
        pageId,
        dialogType: dialog.type(),
        message: dialog.message(),
      };
      this._appendTraceEvent(event);
    });

    page.on(Page.Events.InternalDialogClosed, (dialog: Dialog) => {
      if (this._disposed)
        return;
      const event: trace.DialogClosedEvent = {
        timestamp: monotonicTime(),
        type: 'dialog-closed',
        pageId,
        dialogType: dialog.type(),
      };
      this._appendTraceEvent(event);
    });

    page.mainFrame().on(Frame.Events.Navigation, (navigationEvent: NavigationEvent) => {
      if (this._disposed || page.mainFrame().url() === 'about:blank')
        return;
      const event: trace.NavigationEvent = {
        timestamp: monotonicTime(),
        type: 'navigation',
        pageId,
        url: navigationEvent.url,
        sameDocument: !navigationEvent.newDocument,
      };
      this._appendTraceEvent(event);
    });

    page.on(Page.Events.Load, () => {
      if (this._disposed || page.mainFrame().url() === 'about:blank')
        return;
      const event: trace.LoadEvent = {
        timestamp: monotonicTime(),
        type: 'load',
        pageId,
      };
      this._appendTraceEvent(event);
    });

    page.on(Page.Events.ScreencastFrame, params => {
      const sha1 = calculateSha1(params.buffer);
      const event: trace.ScreencastFrameTraceEvent = {
        type: 'page-screencast-frame',
        pageId: page.guid,
        sha1,
        pageTimestamp: params.timestamp,
        width: params.width,
        height: params.height,
        timestamp: monotonicTime()
      };
      this._appendTraceEvent(event);
      this._snapshotter.onBlob({ sha1, buffer: params.buffer });
    });

    page.once(Page.Events.Close, () => {
      if (this._disposed)
        return;
      const event: trace.PageDestroyedTraceEvent = {
        timestamp: monotonicTime(),
        type: 'page-destroyed',
        pageId,
      };
      this._appendTraceEvent(event);
    });
  }

  private _appendTraceEvent(event: any) {
    // Serialize all writes to the trace file.
    this._appendEventChain = this._appendEventChain.then(async traceFile => {
      await fsAppendFileAsync(traceFile, JSON.stringify(event) + '\n');
      return traceFile;
    });
  }
}
