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
import { SnapshotData, frameSnapshotStreamer, kSnapshotBinding, kSnapshotStreamer } from './snapshotterInjected';
import { calculateSha1, createGuid } from '../../utils/utils';
import { FrameSnapshot } from './snapshot';

export type SnapshotterResource = {
  resourceId: string,
  pageId: string,
  frameId: string,
  url: string,
  contentType: string,
  responseHeaders: { name: string, value: string }[],
  requestHeaders: { name: string, value: string }[],
  method: string,
  status: number,
  requestSha1: string,
  responseSha1: string,
};

export type SnapshotterBlob = {
  buffer: Buffer,
  sha1: string,
};

export interface SnapshotterDelegate {
  onBlob(blob: SnapshotterBlob): void;
  onResource(resource: SnapshotterResource): void;
  onFrameSnapshot(snapshot: FrameSnapshot): void;
}

export class Snapshotter {
  private _context: BrowserContext;
  private _delegate: SnapshotterDelegate;
  private _eventListeners: RegisteredListener[];

  constructor(context: BrowserContext, delegate: SnapshotterDelegate) {
    this._context = context;
    this._delegate = delegate;
    this._eventListeners = [
      helper.addEventListener(this._context, BrowserContext.Events.Page, this._onPage.bind(this)),
    ];
    this._context.exposeBinding(kSnapshotBinding, false, (source, data: SnapshotData) => {
      const snapshot: FrameSnapshot = {
        snapshotId: data.snapshotId,
        pageId: source.page.idInSnapshot,
        frameId: source.frame.idInSnapshot,
        frameUrl: data.url,
        doctype: data.doctype,
        html: data.html,
        viewport: data.viewport,
        resourceOverrides: [],
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
    this._context._doAddInitScript('(' + frameSnapshotStreamer.toString() + ')()');
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
  }

  async forceSnapshot(page: Page, snapshotId: string) {
    await Promise.all([
      page.frames().forEach(async frame => {
        try {
          const context = await frame._mainContext();
          await context.evaluateInternal(({ kSnapshotStreamer, snapshotId }) => {
            // Do not block action execution on the actual snapshot.
            Promise.resolve().then(() => (window as any)[kSnapshotStreamer].forceSnapshot(snapshotId));
            return undefined;
          }, { kSnapshotStreamer, snapshotId });
        } catch (e) {
        }
      })
    ]);
  }

  private _onPage(page: Page) {
    this._eventListeners.push(helper.addEventListener(page, Page.Events.Response, (response: network.Response) => {
      this._saveResource(page, response).catch(e => debugLogger.log('error', e));
    }));
    this._eventListeners.push(helper.addEventListener(page, Page.Events.FrameAttached, async (frame: Frame) => {
      try {
        const frameElement = await frame.frameElement();
        const parent = frame.parentFrame();
        if (!parent)
          return;
        const context = await parent._mainContext();
        await context.evaluateInternal(({ kSnapshotStreamer, frameElement, frameId }) => {
          (window as any)[kSnapshotStreamer].markIframe(frameElement, frameId);
        }, { kSnapshotStreamer, frameElement, frameId: frame.idInSnapshot });
        frameElement.dispose();
      } catch (e) {
        // Ignore
      }
    }));
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
    const resource: SnapshotterResource = {
      pageId: page.idInSnapshot,
      frameId: response.frame().idInSnapshot,
      resourceId: 'resource@' + createGuid(),
      url,
      contentType,
      responseHeaders: response.headers(),
      requestHeaders,
      method,
      status,
      requestSha1,
      responseSha1,
    };
    this._delegate.onResource(resource);
    if (requestBody)
      this._delegate.onBlob({ sha1: requestSha1, buffer: requestBody });
    if (body)
      this._delegate.onBlob({ sha1: responseSha1, buffer: body });
  }
}
