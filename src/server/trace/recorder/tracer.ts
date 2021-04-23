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
import { calculateSha1, createGuid, getFromENV, mkdirIfNeeded, monotonicTime } from '../../../utils/utils';
import { BrowserContext } from '../../browserContext';
import { Dialog } from '../../dialog';
import { ElementHandle } from '../../dom';
import { Frame, NavigationEvent } from '../../frames';
import { helper, RegisteredListener } from '../../helper';
import { CallMetadata, InstrumentationListener, SdkObject } from '../../instrumentation';
import { Page } from '../../page';
import { PersistentSnapshotter } from '../../snapshot/persistentSnapshotter';
import * as trace from '../common/traceEvents';

const fsAppendFileAsync = util.promisify(fs.appendFile.bind(fs));
const envTrace = getFromENV('PWTRACE_RESOURCE_DIR');

export class Tracer implements InstrumentationListener {
  private _contextTracers = new Map<BrowserContext, ContextTracer>();

  async onContextCreated(context: BrowserContext): Promise<void> {
    const traceDir = context._options._traceDir;
    if (!traceDir)
      return;
    const resourcesDir = envTrace || path.join(traceDir, 'resources');
    const tracePath = path.join(traceDir, context._options._debugName!);
    const contextTracer = new ContextTracer(context, resourcesDir, tracePath);
    await contextTracer.start();
    this._contextTracers.set(context, contextTracer);
  }

  async onContextDidDestroy(context: BrowserContext): Promise<void> {
    const contextTracer = this._contextTracers.get(context);
    if (contextTracer) {
      await contextTracer.dispose().catch(e => {});
      this._contextTracers.delete(context);
    }
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata, element: ElementHandle): Promise<void> {
    this._contextTracers.get(sdkObject.attribution.context!)?.onBeforeInputAction(sdkObject, metadata, element);
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    this._contextTracers.get(sdkObject.attribution.context!)?.onBeforeCall(sdkObject, metadata);
  }

  async onAfterCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    this._contextTracers.get(sdkObject.attribution.context!)?.onAfterCall(sdkObject, metadata);
  }

  async onEvent(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    this._contextTracers.get(sdkObject.attribution.context!)?.onEvent(sdkObject, metadata);
  }
}

class ContextTracer {
  private _contextId: string;
  private _appendEventChain: Promise<string>;
  private _snapshotter: PersistentSnapshotter;
  private _eventListeners: RegisteredListener[];
  private _disposed = false;
  private _pendingCalls = new Map<string, { sdkObject: SdkObject, metadata: CallMetadata }>();

  constructor(context: BrowserContext, resourcesDir: string, tracePrefix: string) {
    const traceFile = tracePrefix + '-actions.trace';
    this._contextId = 'context@' + createGuid();
    this._appendEventChain = mkdirIfNeeded(traceFile).then(() => traceFile);
    const event: trace.ContextCreatedTraceEvent = {
      timestamp: monotonicTime(),
      type: 'context-created',
      browserName: context._browser.options.name,
      contextId: this._contextId,
      isMobile: !!context._options.isMobile,
      deviceScaleFactor: context._options.deviceScaleFactor || 1,
      viewportSize: context._options.viewport || undefined,
      debugName: context._options._debugName,
    };
    this._appendTraceEvent(event);
    this._snapshotter = new PersistentSnapshotter(context, tracePrefix, resourcesDir);
    this._eventListeners = [
      helper.addEventListener(context, BrowserContext.Events.Page, this._onPage.bind(this)),
    ];
  }

  async start() {
    await this._snapshotter.start(false);
  }

  _captureSnapshot(name: 'before' | 'after' | 'action' | 'event', sdkObject: SdkObject, metadata: CallMetadata, element?: ElementHandle) {
    if (!sdkObject.attribution.page)
      return;
    const snapshotName = `${name}@${metadata.id}`;
    metadata.snapshots.push({ title: name, snapshotName });
    this._snapshotter.captureSnapshot(sdkObject.attribution.page, snapshotName, element);
  }

  onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata) {
    this._captureSnapshot('before', sdkObject, metadata);
    this._pendingCalls.set(metadata.id, { sdkObject, metadata });
  }

  onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata, element: ElementHandle) {
    this._captureSnapshot('action', sdkObject, metadata, element);
  }

  onAfterCall(sdkObject: SdkObject, metadata: CallMetadata) {
    this._captureSnapshot('after', sdkObject, metadata);
    if (!sdkObject.attribution.page)
      return;
    const event: trace.ActionTraceEvent = {
      timestamp: metadata.startTime,
      type: 'action',
      contextId: this._contextId,
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
      contextId: this._contextId,
      metadata,
    };
    this._appendTraceEvent(event);
  }

  private _onPage(page: Page) {
    const pageId = page.guid;

    const event: trace.PageCreatedTraceEvent = {
      timestamp: monotonicTime(),
      type: 'page-created',
      contextId: this._contextId,
      pageId,
    };
    this._appendTraceEvent(event);

    page.on(Page.Events.Dialog, (dialog: Dialog) => {
      if (this._disposed)
        return;
      const event: trace.DialogOpenedEvent = {
        timestamp: monotonicTime(),
        type: 'dialog-opened',
        contextId: this._contextId,
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
        contextId: this._contextId,
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
        contextId: this._contextId,
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
        contextId: this._contextId,
        pageId,
      };
      this._appendTraceEvent(event);
    });

    page.on(Page.Events.ScreencastFrame, params => {
      const sha1 = calculateSha1(params.buffer);
      const event: trace.ScreencastFrameTraceEvent = {
        type: 'page-screencast-frame',
        pageId: page.guid,
        contextId: this._contextId,
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
        contextId: this._contextId,
        pageId,
      };
      this._appendTraceEvent(event);
    });
  }

  async dispose() {
    this._disposed = true;
    helper.removeEventListeners(this._eventListeners);
    await this._snapshotter.dispose();
    for (const { sdkObject, metadata } of this._pendingCalls.values())
      this.onAfterCall(sdkObject, metadata);
    const event: trace.ContextDestroyedTraceEvent = {
      timestamp: monotonicTime(),
      type: 'context-destroyed',
      contextId: this._contextId,
    };
    this._appendTraceEvent(event);

    // Ensure all writes are finished.
    await this._appendEventChain;
  }

  private _appendTraceEvent(event: any) {
    // Serialize all writes to the trace file.
    this._appendEventChain = this._appendEventChain.then(async traceFile => {
      await fsAppendFileAsync(traceFile, JSON.stringify(event) + '\n');
      return traceFile;
    });
  }
}
