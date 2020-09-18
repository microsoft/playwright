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

import { BrowserContext } from '../server/browserContext';
import { Page } from '../server/page';
import * as network from '../server/network';
import { helper, RegisteredListener } from '../server/helper';
import { Progress, runAbortableTask } from '../server/progress';
import { debugLogger } from '../utils/debugLogger';
import { Frame } from '../server/frames';
import * as js from '../server/javascript';
import * as types from '../server/types';
import { SnapshotData, takeSnapshotInFrame } from './snapshotterInjected';
import { assert, calculateSha1, createGuid } from '../utils/utils';
import { ElementHandle } from '../server/dom';
import { FrameSnapshot, PageSnapshot } from './traceTypes';

export type SnapshotterResource = {
  pageId: string,
  frameId: string,
  url: string,
  contentType: string,
  responseHeaders: { name: string, value: string }[],
  sha1: string,
};

export type SnapshotterBlob = {
  buffer: Buffer,
  sha1: string,
};

export interface SnapshotterDelegate {
  onBlob(blob: SnapshotterBlob): void;
  onResource(resource: SnapshotterResource): void;
  pageId(page: Page): string;
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
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
  }

  private _onPage(page: Page) {
    this._eventListeners.push(helper.addEventListener(page, Page.Events.Response, (response: network.Response) => {
      this._saveResource(page, response).catch(e => debugLogger.log('error', e));
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

    const body = await response.body().catch(e => debugLogger.log('error', e));
    const sha1 = body ? calculateSha1(body) : 'none';
    const resource: SnapshotterResource = {
      pageId: this._delegate.pageId(page),
      frameId: response.frame()._id,
      url,
      contentType,
      responseHeaders: response.headers(),
      sha1,
    };
    this._delegate.onResource(resource);
    if (body)
      this._delegate.onBlob({ sha1, buffer: body });
  }

  async takeSnapshot(page: Page, target: ElementHandle | undefined, timeout: number): Promise<PageSnapshot | null> {
    assert(page.context() === this._context);

    const frames = page.frames();
    const frameSnapshotPromises = frames.map(async frame => {
      // TODO: use different timeout depending on the frame depth/origin
      // to avoid waiting for too long for some useless frame.
      const frameResult = await runAbortableTask(progress => this._snapshotFrame(progress, target, frame), timeout).catch(e => null);
      if (frameResult)
        return frameResult;
      const frameSnapshot = {
        frameId: frame._id,
        url: removeHash(frame.url()),
        html: '<body>Snapshot is not available</body>',
        resourceOverrides: [],
      };
      return { snapshot: frameSnapshot, mapping: new Map<Frame, string>() };
    });

    const viewportSize = await this._getViewportSize(page, timeout);
    const results = await Promise.all(frameSnapshotPromises);

    if (!viewportSize)
      return null;

    const mainFrame = results[0];
    if (!mainFrame.snapshot.url.startsWith('http'))
      mainFrame.snapshot.url = 'http://playwright.snapshot/';

    const mapping = new Map<Frame, string>();
    for (const result of results) {
      for (const [key, value] of result.mapping)
        mapping.set(key, value);
    }

    const childFrames: FrameSnapshot[] = [];
    for (let i = 1; i < results.length; i++) {
      const result = results[i];
      const frame = frames[i];
      if (!mapping.has(frame))
        continue;
      const frameSnapshot = result.snapshot;
      frameSnapshot.url = mapping.get(frame)!;
      childFrames.push(frameSnapshot);
    }

    return {
      viewportSize,
      frames: [mainFrame.snapshot, ...childFrames],
    };
  }

  private async _getViewportSize(page: Page, timeout: number): Promise<types.Size | null> {
    return runAbortableTask(async progress => {
      const viewportSize = page.viewportSize();
      if (viewportSize)
        return viewportSize;
      const context = await page.mainFrame()._utilityContext();
      return context.evaluateInternal(() => {
        return {
          width: Math.max(document.body.offsetWidth, document.documentElement.offsetWidth),
          height: Math.max(document.body.offsetHeight, document.documentElement.offsetHeight),
        };
      });
    }, timeout).catch(e => null);
  }

  private async _snapshotFrame(progress: Progress, target: ElementHandle | undefined, frame: Frame): Promise<FrameSnapshotAndMapping | null> {
    if (!progress.isRunning())
      return null;

    if (target && (await target.ownerFrame()) !== frame)
      target = undefined;
    const context = await frame._utilityContext();
    const guid = createGuid();
    const removeNoScript = !frame._page.context()._options.javaScriptEnabled;
    const result = await js.evaluate(context, false /* returnByValue */, takeSnapshotInFrame, guid, removeNoScript, target) as js.JSHandle;
    if (!progress.isRunning())
      return null;

    const properties = await result.getProperties();
    const data = await properties.get('data')!.jsonValue() as SnapshotData;
    const frameElements = await properties.get('frameElements')!.getProperties();
    result.dispose();

    const snapshot: FrameSnapshot = {
      frameId: frame._id,
      url: removeHash(frame.url()),
      html: data.html,
      resourceOverrides: [],
    };
    const mapping = new Map<Frame, string>();

    for (const { url, content } of data.resourceOverrides) {
      const buffer = Buffer.from(content);
      const sha1 = calculateSha1(buffer);
      this._delegate.onBlob({ sha1, buffer });
      snapshot.resourceOverrides.push({ url, sha1 });
    }

    for (let i = 0; i < data.frameUrls.length; i++) {
      const element = frameElements.get(String(i))!.asElement();
      if (!element)
        continue;
      const frame = await element.contentFrame().catch(e => null);
      if (frame)
        mapping.set(frame, data.frameUrls[i]);
    }

    return { snapshot, mapping };
  }
}

function removeHash(url: string) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch (e) {
    return url;
  }
}

type FrameSnapshotAndMapping = {
  snapshot: FrameSnapshot,
  mapping: Map<Frame, string>,
};
