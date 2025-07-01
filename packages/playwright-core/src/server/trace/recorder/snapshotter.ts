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

import { frameSnapshotStreamer } from './snapshotterInjected';
import { monotonicTime } from '../../../utils/isomorphic/time';
import { calculateSha1, createGuid } from '../../utils/crypto';
import { debugLogger } from '../../utils/debugLogger';
import { eventsHelper } from '../../utils/eventsHelper';
import { mime } from '../../../utilsBundle';
import { BrowserContext } from '../../browserContext';
import { Page } from '../../page';

import type { SnapshotData } from './snapshotterInjected';
import type { RegisteredListener } from '../../utils/eventsHelper';
import type { Frame } from '../../frames';
import type { InitScript } from '../../page';
import type { FrameSnapshot } from '@trace/snapshot';

export type SnapshotterBlob = {
  buffer: Buffer,
  sha1: string,
};

export interface SnapshotterDelegate {
  onSnapshotterBlob(blob: SnapshotterBlob): void;
  onFrameSnapshot(snapshot: FrameSnapshot): void;
}

export class Snapshotter {
  private _context: BrowserContext;
  private _delegate: SnapshotterDelegate;
  private _eventListeners: RegisteredListener[] = [];
  private _snapshotStreamer: string;
  private _initScript: InitScript | undefined;
  private _started = false;

  constructor(context: BrowserContext, delegate: SnapshotterDelegate) {
    this._context = context;
    this._delegate = delegate;
    const guid = createGuid();
    this._snapshotStreamer = '__playwright_snapshot_streamer_' + guid;
  }

  started(): boolean {
    return this._started;
  }

  async start() {
    this._started = true;
    if (!this._initScript)
      await this._initialize();
    await this.reset();
  }

  async reset() {
    if (this._started)
      await this._context.safeNonStallingEvaluateInAllFrames(`window["${this._snapshotStreamer}"].reset()`, 'main');
  }

  stop() {
    this._started = false;
  }

  async resetForReuse() {
    // Next time we start recording, we will call addInitScript again.
    if (this._initScript) {
      eventsHelper.removeEventListeners(this._eventListeners);
      await this._context.removeInitScripts([this._initScript]);
      this._initScript = undefined;
    }
  }

  async _initialize() {
    for (const page of this._context.pages())
      this._onPage(page);
    this._eventListeners = [
      eventsHelper.addEventListener(this._context, BrowserContext.Events.Page, this._onPage.bind(this)),
    ];

    const { javaScriptEnabled } = this._context._options;
    const initScriptSource = `(${frameSnapshotStreamer})("${this._snapshotStreamer}", ${javaScriptEnabled || javaScriptEnabled === undefined})`;
    this._initScript = await this._context.addInitScript(undefined, initScriptSource);
    await this._context.safeNonStallingEvaluateInAllFrames(initScriptSource, 'main');
  }

  dispose() {
    eventsHelper.removeEventListeners(this._eventListeners);
  }

  async captureSnapshot(page: Page, callId: string, snapshotName: string): Promise<void> {
    // Prepare expression synchronously.
    const expression = `window["${this._snapshotStreamer}"].captureSnapshot(${JSON.stringify(snapshotName)})`;

    // In each frame, in a non-stalling manner, capture the snapshots.
    const snapshots = page.frames().map(async frame => {
      const data = await frame.nonStallingRawEvaluateInExistingMainContext(expression).catch(e => debugLogger.log('error', e)) as SnapshotData;
      // Something went wrong -> bail out, our snapshots are best-efforty.
      if (!data || !this._started)
        return;

      const snapshot: FrameSnapshot = {
        callId,
        snapshotName,
        pageId: page.guid,
        frameId: frame.guid,
        frameUrl: data.url,
        doctype: data.doctype,
        html: data.html,
        viewport: data.viewport,
        timestamp: monotonicTime(),
        wallTime: data.wallTime,
        collectionTime: data.collectionTime,
        resourceOverrides: [],
        isMainFrame: page.mainFrame() === frame
      };
      for (const { url, content, contentType } of data.resourceOverrides) {
        if (typeof content === 'string') {
          const buffer = Buffer.from(content);
          const sha1 = calculateSha1(buffer) + '.' + (mime.getExtension(contentType) || 'dat');
          this._delegate.onSnapshotterBlob({ sha1, buffer });
          snapshot.resourceOverrides.push({ url, sha1 });
        } else {
          snapshot.resourceOverrides.push({ url, ref: content });
        }
      }
      this._delegate.onFrameSnapshot(snapshot);
    });
    await Promise.all(snapshots);
  }

  private _onPage(page: Page) {
    // Annotate frame hierarchy so that snapshots could include frame ids.
    for (const frame of page.frames())
      this._annotateFrameHierarchy(frame);
    this._eventListeners.push(eventsHelper.addEventListener(page, Page.Events.FrameAttached, frame => this._annotateFrameHierarchy(frame)));
  }

  private async _annotateFrameHierarchy(frame: Frame) {
    try {
      const frameElement = await frame.frameElement();
      const parent = frame.parentFrame();
      if (!parent)
        return;
      const context = await parent._mainContext();
      await context?.evaluate(({ snapshotStreamer, frameElement, frameId }) => {
        (window as any)[snapshotStreamer].markIframe(frameElement, frameId);
      }, { snapshotStreamer: this._snapshotStreamer, frameElement, frameId: frame.guid });
      frameElement.dispose();
    } catch (e) {
    }
  }
}
