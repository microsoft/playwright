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

import { BrowserContext } from '../../browserContext';
import { Page } from '../../page';
import type { RegisteredListener } from '../../../utils/eventsHelper';
import { eventsHelper } from '../../../utils/eventsHelper';
import { debugLogger } from '../../../common/debugLogger';
import type { Frame } from '../../frames';
import type { SnapshotData } from './snapshotterInjected';
import { frameSnapshotStreamer } from './snapshotterInjected';
import { calculateSha1, createGuid, monotonicTime } from '../../../utils';
import type { FrameSnapshot } from '../common/snapshotTypes';
import type { ElementHandle } from '../../dom';
import { mime } from '../../../utilsBundle';

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
  private _initialized = false;
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
    if (!this._initialized) {
      this._initialized = true;
      await this._initialize();
    }
    await this.reset();
  }

  async reset() {
    if (this._started)
      await this._runInAllFrames(`window["${this._snapshotStreamer}"].reset()`);
  }

  async stop() {
    this._started = false;
  }

  async _initialize() {
    for (const page of this._context.pages())
      this._onPage(page);
    this._eventListeners = [
      eventsHelper.addEventListener(this._context, BrowserContext.Events.Page, this._onPage.bind(this)),
    ];

    const initScript = `(${frameSnapshotStreamer})("${this._snapshotStreamer}")`;
    await this._context.addInitScript(initScript);
    await this._runInAllFrames(initScript);
  }

  private async _runInAllFrames(expression: string) {
    const frames = [];
    for (const page of this._context.pages())
      frames.push(...page.frames());
    await Promise.all(frames.map(frame => {
      return frame.nonStallingRawEvaluateInExistingMainContext(expression).catch(e => debugLogger.log('error', e));
    }));
  }

  dispose() {
    eventsHelper.removeEventListeners(this._eventListeners);
  }

  async captureSnapshot(page: Page, snapshotName: string, element?: ElementHandle): Promise<void> {
    // Prepare expression synchronously.
    const expression = `window["${this._snapshotStreamer}"].captureSnapshot(${JSON.stringify(snapshotName)})`;

    // In a best-effort manner, without waiting for it, mark target element.
    element?.callFunctionNoReply((element: Element, snapshotName: string) => {
      element.setAttribute('__playwright_target__', snapshotName);
    }, snapshotName);

    // In each frame, in a non-stalling manner, capture the snapshots.
    const snapshots = page.frames().map(async frame => {
      const data = await frame.nonStallingRawEvaluateInExistingMainContext(expression).catch(e => debugLogger.log('error', e)) as SnapshotData;
      // Something went wrong -> bail out, our snapshots are best-efforty.
      if (!data || !this._started)
        return;

      const snapshot: FrameSnapshot = {
        snapshotName,
        pageId: page.guid,
        frameId: frame.guid,
        frameUrl: data.url,
        doctype: data.doctype,
        html: data.html,
        viewport: data.viewport,
        timestamp: monotonicTime(),
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
