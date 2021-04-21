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
import { helper, RegisteredListener } from '../helper';
import { debugLogger } from '../../utils/debugLogger';
import { Frame } from '../frames';
import { SnapshotData, frameSnapshotStreamer } from './snapshotterInjected';
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
  private _interval = 0;
  private _snapshotStreamer: string;
  private _snapshotBinding: string;

  constructor(context: BrowserContext, delegate: SnapshotterDelegate) {
    this._context = context;
    this._delegate = delegate;
    for (const page of context.pages())
      this._onPage(page);
    this._eventListeners = [
      helper.addEventListener(this._context, BrowserContext.Events.Page, this._onPage.bind(this)),
    ];
    const guid = createGuid();
    this._snapshotStreamer = '__playwright_snapshot_streamer_' + guid;
    this._snapshotBinding = '__playwright_snapshot_binding_' + guid;
  }

  async initialize() {
    await this._context.exposeBinding(this._snapshotBinding, false, (source, data: SnapshotData) => {
      const snapshot: FrameSnapshot = {
        snapshotName: data.snapshotName,
        pageId: source.page.guid,
        frameId: source.frame.guid,
        frameUrl: data.url,
        doctype: data.doctype,
        html: data.html,
        viewport: data.viewport,
        timestamp: monotonicTime(),
        pageTimestamp: data.timestamp,
        collectionTime: data.collectionTime,
        resourceOverrides: [],
        isMainFrame: source.page.mainFrame() === source.frame
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
    const initScript = `(${frameSnapshotStreamer})("${this._snapshotStreamer}", "${this._snapshotBinding}")`;
    await this._context._doAddInitScript(initScript);
    const frames = [];
    for (const page of this._context.pages())
      frames.push(...page.frames());
    frames.map(frame => {
      frame._existingMainContext()?.rawEvaluate(initScript).catch(debugExceptionHandler);
    });
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
  }

  captureSnapshot(page: Page, snapshotName: string, element?: ElementHandle) {
    // This needs to be sync, as in not awaiting for anything before we issue the command.
    const expression = `window["${this._snapshotStreamer}"].captureSnapshot(${JSON.stringify(snapshotName)})`;
    element?.callFunctionNoReply((element: Element, snapshotName: string) => {
      element.setAttribute('__playwright_target__', snapshotName);
    }, snapshotName);
    const snapshotFrame = (frame: Frame) => {
      const context = frame._existingMainContext();
      context?.rawEvaluate(expression).catch(debugExceptionHandler);
    };
    page.frames().map(frame => snapshotFrame(frame));
  }

  async setAutoSnapshotInterval(interval: number): Promise<void> {
    this._interval = interval;
    const frames = [];
    for (const page of this._context.pages())
      frames.push(...page.frames());
    await Promise.all(frames.map(frame => this._setIntervalInFrame(frame, interval)));
  }

  private _onPage(page: Page) {
    const processNewFrame = (frame: Frame) => {
      this._annotateFrameHierarchy(frame);
      this._setIntervalInFrame(frame, this._interval);
      const initScript = `(${frameSnapshotStreamer})("${this._snapshotStreamer}", "${this._snapshotBinding}")`;
      frame._existingMainContext()?.rawEvaluate(initScript).catch(debugExceptionHandler);
    };
    for (const frame of page.frames())
      processNewFrame(frame);
    this._eventListeners.push(helper.addEventListener(page, Page.Events.FrameAttached, processNewFrame));

    // Push streamer interval on navigation.
    this._eventListeners.push(helper.addEventListener(page, Page.Events.InternalFrameNavigatedToNewDocument, frame => {
      this._setIntervalInFrame(frame, this._interval);
    }));

    // Capture resources.
    this._eventListeners.push(helper.addEventListener(page, Page.Events.Response, (response: network.Response) => {
      this._saveResource(page, response).catch(e => debugLogger.log('error', e));
    }));
    page.setScreencastEnabled(true);
  }

  private async _saveResource(page: Page, response: network.Response) {
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
    const requestSha1 = requestBody ? calculateSha1(requestBody) : 'none';
    const requestHeaders = original.headers();
    const body = await response.body().catch(e => debugLogger.log('error', e));
    const responseSha1 = body ? calculateSha1(body) : 'none';
    const resource: ResourceSnapshot = {
      pageId: page.guid,
      frameId: response.frame().guid,
      resourceId: 'resource@' + createGuid(),
      url,
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
    if (requestBody)
      this._delegate.onBlob({ sha1: requestSha1, buffer: requestBody });
    if (body)
      this._delegate.onBlob({ sha1: responseSha1, buffer: body });
  }

  private async _setIntervalInFrame(frame: Frame, interval: number) {
    const context = frame._existingMainContext();
    await context?.evaluate(({ snapshotStreamer, interval }) => {
      (window as any)[snapshotStreamer].setSnapshotInterval(interval);
    }, { snapshotStreamer: this._snapshotStreamer, interval }).catch(debugExceptionHandler);
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

function debugExceptionHandler(e: Error) {
  // console.error(e);
}
