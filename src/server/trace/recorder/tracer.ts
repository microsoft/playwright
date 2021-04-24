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
import util from 'util';
import yazl from 'yazl';
import { createGuid, mkdirIfNeeded, monotonicTime } from '../../../utils/utils';
import { Artifact } from '../../artifact';
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
const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));
const fsMkdirAsync = util.promisify(fs.mkdir.bind(fs));

export type TracerOptions = {
  name?: string;
  snapshots?: boolean;
  screenshots?: boolean;
};

export class Tracer implements InstrumentationListener {
  private _appendEventChain = Promise.resolve();
  private _snapshotter: TraceSnapshotter | undefined;
  private _eventListeners: RegisteredListener[] = [];
  private _pendingCalls = new Map<string, { sdkObject: SdkObject, metadata: CallMetadata }>();
  private _context: BrowserContext;
  private _traceFile: string | undefined;
  private _resourcesDir: string | undefined;
  private _sha1s: string[] = [];
  private _started = false;
  private _traceDir: string | undefined;

  constructor(context: BrowserContext) {
    this._context = context;
    this._traceDir = context._browser.options.traceDir;
  }

  async start(options: TracerOptions): Promise<void> {
    if (!this._traceDir)
      throw new Error('Tracing directory is not specified when launching the browser');
    if (this._started)
      throw new Error('Tracing has already been started');
    this._started = true;
    this._traceFile = path.join(this._traceDir, (options.name || createGuid()) + '.trace');
    if (options.screenshots || options.snapshots) {
      this._resourcesDir = path.join(this._traceDir, 'resources');
      await fsMkdirAsync(this._resourcesDir, { recursive: true });
    }

    this._appendEventChain = mkdirIfNeeded(this._traceFile);
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
    this._eventListeners.push(
        helper.addEventListener(this._context, BrowserContext.Events.Page, this._onPage.bind(this, options.screenshots)),
    );
    this._context.instrumentation.addListener(this);
    if (options.snapshots)
      this._snapshotter = new TraceSnapshotter(this._context, this._resourcesDir!, traceEvent => this._appendTraceEvent(traceEvent));
    await this._snapshotter?.start();
  }

  async stop(): Promise<void> {
    if (!this._started)
      return;
    this._started = false;
    this._context.instrumentation.removeListener(this);
    helper.removeEventListeners(this._eventListeners);
    await this._snapshotter?.dispose();
    this._snapshotter = undefined;
    for (const { sdkObject, metadata } of this._pendingCalls.values())
      this.onAfterCall(sdkObject, metadata);
    for (const page of this._context.pages())
      page.setScreencastEnabled(false);

    // Ensure all writes are finished.
    await this._appendEventChain;
  }

  async export(): Promise<Artifact> {
    if (!this._traceFile)
      throw new Error('Tracing directory is not specified when launching the browser');
    const zipFile = new yazl.ZipFile();
    zipFile.addFile(this._traceFile, 'trace.trace');
    const zipFileName = this._traceFile + '.zip';
    for (const sha1 of this._sha1s)
      zipFile.addFile(path.join(this._resourcesDir!, sha1), path.join('resources', sha1));
    const zipPromise = new Promise(f => {
      zipFile.outputStream.pipe(fs.createWriteStream(zipFileName)).on('close', f);
    });
    zipFile.end();
    await zipPromise;
    const artifact = new Artifact(this._context, zipFileName);
    artifact.reportFinished();
    return artifact;
  }

  _captureSnapshot(name: 'before' | 'after' | 'action' | 'event', sdkObject: SdkObject, metadata: CallMetadata, element?: ElementHandle) {
    if (!sdkObject.attribution.page)
      return;
    if (!this._snapshotter)
      return;
    const snapshotName = `${name}@${metadata.id}`;
    metadata.snapshots.push({ title: name, snapshotName });
    this._snapshotter!.captureSnapshot(sdkObject.attribution.page, snapshotName, element);
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

  private _onPage(screenshots: boolean | undefined, page: Page) {
    const pageId = page.guid;

    const event: trace.PageCreatedTraceEvent = {
      timestamp: monotonicTime(),
      type: 'page-created',
      pageId,
    };
    this._appendTraceEvent(event);
    if (screenshots)
      page.setScreencastEnabled(true);

    this._eventListeners.push(
        helper.addEventListener(page, Page.Events.Dialog, (dialog: Dialog) => {
          const event: trace.DialogOpenedEvent = {
            timestamp: monotonicTime(),
            type: 'dialog-opened',
            pageId,
            dialogType: dialog.type(),
            message: dialog.message(),
          };
          this._appendTraceEvent(event);
        }),

        helper.addEventListener(page, Page.Events.InternalDialogClosed, (dialog: Dialog) => {
          const event: trace.DialogClosedEvent = {
            timestamp: monotonicTime(),
            type: 'dialog-closed',
            pageId,
            dialogType: dialog.type(),
          };
          this._appendTraceEvent(event);
        }),

        helper.addEventListener(page.mainFrame(), Frame.Events.Navigation, (navigationEvent: NavigationEvent) => {
          if (page.mainFrame().url() === 'about:blank')
            return;
          const event: trace.NavigationEvent = {
            timestamp: monotonicTime(),
            type: 'navigation',
            pageId,
            url: navigationEvent.url,
            sameDocument: !navigationEvent.newDocument,
          };
          this._appendTraceEvent(event);
        }),

        helper.addEventListener(page, Page.Events.Load, () => {
          if (page.mainFrame().url() === 'about:blank')
            return;
          const event: trace.LoadEvent = {
            timestamp: monotonicTime(),
            type: 'load',
            pageId,
          };
          this._appendTraceEvent(event);
        }),

        helper.addEventListener(page, Page.Events.ScreencastFrame, params => {
          const guid = createGuid();
          const event: trace.ScreencastFrameTraceEvent = {
            type: 'screencast-frame',
            pageId: page.guid,
            sha1: guid,  // no need to compute sha1 for screenshots
            pageTimestamp: params.timestamp,
            width: params.width,
            height: params.height,
            timestamp: monotonicTime()
          };
          this._appendTraceEvent(event);
          this._appendEventChain = this._appendEventChain.then(async () => {
            await fsWriteFileAsync(path.join(this._resourcesDir!, guid), params.buffer).catch(() => {});
          });
        }),

        helper.addEventListener(page, Page.Events.Close, () => {
          const event: trace.PageDestroyedTraceEvent = {
            timestamp: monotonicTime(),
            type: 'page-destroyed',
            pageId,
          };
          this._appendTraceEvent(event);
        })
    );
  }

  private _appendTraceEvent(event: any) {
    const visit = (object: any) => {
      if (Array.isArray(object)) {
        object.forEach(visit);
        return;
      }
      if (typeof object === 'object') {
        for (const key in object) {
          if (key === 'sha1' || key.endsWith('Sha1')) {
            const sha1 = object[key];
            if (sha1)
              this._sha1s.push(sha1);
          }
          visit(object[key]);
        }
        return;
      }
    };
    visit(event);

    // Serialize all writes to the trace file.
    this._appendEventChain = this._appendEventChain.then(async () => {
      await fsAppendFileAsync(this._traceFile!, JSON.stringify(event) + '\n');
    });
  }
}
