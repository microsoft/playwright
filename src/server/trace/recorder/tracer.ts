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

import { BrowserContext, Video } from '../../browserContext';
import type { SnapshotterResource as SnapshotterResource, SnapshotterBlob, SnapshotterDelegate } from '../../snapshot/snapshotter';
import * as trace from '../common/traceEvents';
import path from 'path';
import * as util from 'util';
import fs from 'fs';
import { createGuid, getFromENV, mkdirIfNeeded, monotonicTime } from '../../../utils/utils';
import { Page } from '../../page';
import { Snapshotter } from '../../snapshot/snapshotter';
import { helper, RegisteredListener } from '../../helper';
import { Dialog } from '../../dialog';
import { Frame, NavigationEvent } from '../../frames';
import { CallMetadata, InstrumentationListener, SdkObject } from '../../instrumentation';
import { FrameSnapshot } from '../../snapshot/snapshot';

const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));
const fsAppendFileAsync = util.promisify(fs.appendFile.bind(fs));
const fsAccessAsync = util.promisify(fs.access.bind(fs));
const envTrace = getFromENV('PW_TRACE_DIR');

export class Tracer implements InstrumentationListener {
  private _contextTracers = new Map<BrowserContext, ContextTracer>();

  async onContextCreated(context: BrowserContext): Promise<void> {
    const traceDir = envTrace || context._options._traceDir;
    if (!traceDir)
      return;
    const traceStorageDir = path.join(traceDir, 'resources');
    const tracePath = path.join(traceDir, createGuid() + '.trace');
    const contextTracer = new ContextTracer(context, traceStorageDir, tracePath);
    this._contextTracers.set(context, contextTracer);
  }

  async onContextDidDestroy(context: BrowserContext): Promise<void> {
    const contextTracer = this._contextTracers.get(context);
    if (contextTracer) {
      await contextTracer.dispose().catch(e => {});
      this._contextTracers.delete(context);
    }
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    this._contextTracers.get(sdkObject.attribution.context!)?.onActionCheckpoint('before', sdkObject, metadata);
  }

  async onAfterInputAction(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    this._contextTracers.get(sdkObject.attribution.context!)?.onActionCheckpoint('after', sdkObject, metadata);
  }

  async onAfterCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    this._contextTracers.get(sdkObject.attribution.context!)?.onAfterCall(sdkObject, metadata);
  }
}

const snapshotsSymbol = Symbol('snapshots');

// This is an official way to pass snapshots between onBefore/AfterInputAction and onAfterCall.
function snapshotsForMetadata(metadata: CallMetadata): { name: string, snapshotId: string }[] {
  if (!(metadata as any)[snapshotsSymbol])
    (metadata as any)[snapshotsSymbol] = [];
  return (metadata as any)[snapshotsSymbol];
}

class ContextTracer implements SnapshotterDelegate {
  private _contextId: string;
  private _traceStoragePromise: Promise<string>;
  private _appendEventChain: Promise<string>;
  private _writeArtifactChain: Promise<void>;
  private _snapshotter: Snapshotter;
  private _eventListeners: RegisteredListener[];
  private _disposed = false;
  private _traceFile: string;

  constructor(context: BrowserContext, traceStorageDir: string, traceFile: string) {
    this._contextId = 'context@' + createGuid();
    this._traceFile = traceFile;
    this._traceStoragePromise = mkdirIfNeeded(path.join(traceStorageDir, 'sha1')).then(() => traceStorageDir);
    this._appendEventChain = mkdirIfNeeded(traceFile).then(() => traceFile);
    this._writeArtifactChain = Promise.resolve();
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
    this._snapshotter = new Snapshotter(context, this);
    this._eventListeners = [
      helper.addEventListener(context, BrowserContext.Events.Page, this._onPage.bind(this)),
    ];
  }

  onBlob(blob: SnapshotterBlob): void {
    this._writeArtifact(blob.sha1, blob.buffer);
  }

  onResource(resource: SnapshotterResource): void {
    const event: trace.NetworkResourceTraceEvent = {
      timestamp: monotonicTime(),
      type: 'resource',
      contextId: this._contextId,
      pageId: resource.pageId,
      frameId: resource.frameId,
      resourceId: resource.resourceId,
      url: resource.url,
      contentType: resource.contentType,
      responseHeaders: resource.responseHeaders,
      requestHeaders: resource.requestHeaders,
      method: resource.method,
      status: resource.status,
      requestSha1: resource.requestSha1,
      responseSha1: resource.responseSha1,
    };
    this._appendTraceEvent(event);
  }

  onFrameSnapshot(snapshot: FrameSnapshot): void {
    const event: trace.FrameSnapshotTraceEvent = {
      timestamp: monotonicTime(),
      type: 'snapshot',
      contextId: this._contextId,
      pageId: snapshot.pageId,
      frameId: snapshot.frameId,
      snapshot: snapshot,
    };
    this._appendTraceEvent(event);
  }

  async onActionCheckpoint(name: string, sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (!sdkObject.attribution.page)
      return;
    const snapshotId = createGuid();
    snapshotsForMetadata(metadata).push({ name, snapshotId });
    await this._snapshotter.forceSnapshot(sdkObject.attribution.page, snapshotId);
  }

  async onAfterCall(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (!sdkObject.attribution.page)
      return;
    const event: trace.ActionTraceEvent = {
      timestamp: monotonicTime(),
      type: 'action',
      contextId: this._contextId,
      pageId: sdkObject.attribution.page.idInSnapshot,
      objectType: metadata.type,
      method: metadata.method,
      // FIXME: filter out evaluation snippets, binary
      params: metadata.params,
      stack: metadata.stack,
      startTime: metadata.startTime,
      endTime: metadata.endTime,
      logs: metadata.log.slice(),
      error: metadata.error,
      snapshots: snapshotsForMetadata(metadata),
    };
    this._appendTraceEvent(event);
  }

  private _onPage(page: Page) {
    const pageId = page.idInSnapshot;

    const event: trace.PageCreatedTraceEvent = {
      timestamp: monotonicTime(),
      type: 'page-created',
      contextId: this._contextId,
      pageId,
    };
    this._appendTraceEvent(event);

    page.on(Page.Events.VideoStarted, (video: Video) => {
      if (this._disposed)
        return;
      const event: trace.PageVideoTraceEvent = {
        timestamp: monotonicTime(),
        type: 'page-video',
        contextId: this._contextId,
        pageId,
        fileName: path.relative(path.dirname(this._traceFile), video._path),
      };
      this._appendTraceEvent(event);
    });

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
    this._snapshotter.dispose();
    const event: trace.ContextDestroyedTraceEvent = {
      timestamp: monotonicTime(),
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
    this._appendEventChain = this._appendEventChain.then(async traceFile => {
      await fsAppendFileAsync(traceFile, JSON.stringify(event) + '\n');
      return traceFile;
    });
  }
}
