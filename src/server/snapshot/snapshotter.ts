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

import { BrowserContext } from '../browserContext';
import { Page } from '../page';
import * as network from '../network';
import { eventsHelper, RegisteredListener } from '../../utils/eventsHelper';
import { debugLogger } from '../../utils/debugLogger';
import { Frame } from '../frames';
import { frameSnapshotStreamer, SnapshotData } from './snapshotterInjected';
import { calculateSha1, createGuid, monotonicTime } from '../../utils/utils';
import { FrameSnapshot, ResourceSnapshot } from './snapshotTypes';
import { ElementHandle } from '../dom';

export type SnapshotterBlob = {
  buffer: Buffer,
  sha1: string,
};

export interface SnapshotterDelegate {
  onBlob(blob: SnapshotterBlob): void;
  onResourceSnapshot(resource: ResourceSnapshot): void;
  onFrameSnapshot(snapshot: FrameSnapshot): void;
}

export class Snapshotter {
  private _context: BrowserContext;
  private _delegate: SnapshotterDelegate;
  private _eventListeners: RegisteredListener[] = [];
  private _snapshotStreamer: string;
  private _initialized = false;
  private _started = false;
  private _fetchedResponses = new Map<network.Response, string>();

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
    await this._runInAllFrames(`window["${this._snapshotStreamer}"].reset()`);

    // Replay resources loaded in all pages.
    for (const page of this._context.pages()) {
      for (const response of page._frameManager._responses)
        this._saveResource(response).catch(e => debugLogger.log('error', e));
    }
  }

  async stop() {
    this._started = false;
  }

  async _initialize() {
    for (const page of this._context.pages())
      this._onPage(page);
    this._eventListeners = [
      eventsHelper.addEventListener(this._context, BrowserContext.Events.Page, this._onPage.bind(this)),
      eventsHelper.addEventListener(this._context, BrowserContext.Events.Response, (response: network.Response) => {
        this._saveResource(response).catch(e => debugLogger.log('error', e));
      }),
    ];

    const initScript = `(${frameSnapshotStreamer})("${this._snapshotStreamer}")`;
    await this._context._doAddInitScript(initScript);
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
      for (const { url, content } of data.resourceOverrides) {
        if (typeof content === 'string') {
          const buffer = Buffer.from(content);
          const sha1 = calculateSha1(buffer);
          this._delegate.onBlob({ sha1, buffer });
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

  private async _saveResource(response: network.Response) {
    if (!this._started)
      return;
    const isRedirect = response.status() >= 300 && response.status() <= 399;
    if (isRedirect)
      return;

    // Shortcut all redirects - we cannot intercept them properly.
    let original = response.request();
    while (original.redirectedFrom())
      original = original.redirectedFrom()!;
    const url = original.url();

    let contentType = '';
    for (const { name, value } of response.headers()) {
      if (name.toLowerCase() === 'content-type')
        contentType = value;
    }

    const method = original.method();
    const status = response.status();
    const requestBody = original.postDataBuffer();
    const requestSha1 = requestBody ? calculateSha1(requestBody) : '';
    if (requestBody)
      this._delegate.onBlob({ sha1: requestSha1, buffer: requestBody });
    const requestHeaders = original.headers();

    // Only fetch response bodies once.
    let responseSha1 = this._fetchedResponses.get(response);
    {
      if (responseSha1 === undefined) {
        const body = await response.body().catch(e => debugLogger.log('error', e));
        // Bail out after each async hop.
        if (!this._started)
          return;
        responseSha1 = body ? calculateSha1(body) : '';
        if (body)
          this._delegate.onBlob({ sha1: responseSha1, buffer: body });
        this._fetchedResponses.set(response, responseSha1);
      }
    }

    const resource: ResourceSnapshot = {
      pageId: response.frame()._page.guid,
      frameId: response.frame().guid,
      resourceId: response.guid,
      url,
      type: response.request().resourceType(),
      contentType,
      responseHeaders: response.headers(),
      requestHeaders,
      method,
      status,
      requestSha1,
      responseSha1,
      timestamp: monotonicTime()
    };
    this._delegate.onResourceSnapshot(resource);
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
