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
import { ElementHandle, FrameExecutionContext } from '../server/dom';
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

  dispose(): void {
    helper.removeEventListeners(this._eventListeners);
  }

  private _onPage(page: Page): void {
    this._eventListeners.push(helper.addEventListener(page, Page.Events.Response, (response: network.Response) => {
      this._saveResource(page, response).catch(e => debugLogger.log('error', e));
    }));
  }

  private async _saveResource(page: Page, response: network.Response): Promise<void> {
    const isRedirect: boolean = response.status() >= 300 && response.status() <= 399;
    if (isRedirect)
      return;

    // Shortcut all redirects - we cannot intercept them properly.
    let original: network.Request = response.request();
    while (original.redirectedFrom())
      original = original.redirectedFrom()!;
    const url: string = original.url();

    let contentType: string = '';
    for (const { name, value } of response.headers()) {
      if (name.toLowerCase() === 'content-type')
        contentType = value;
    }

    const body: void | Buffer = await response.body().catch(e => debugLogger.log('error', e));
    const sha1: string = body ? calculateSha1(body) : 'none';
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

    const frames: Frame[] = page.frames();
    const frameSnapshotPromises: Promise<FrameSnapshotAndMapping>[] = frames.map(async frame => {
      // TODO: use different timeout depending on the frame depth/origin
      // to avoid waiting for too long for some useless frame.
      const frameResult: FrameSnapshotAndMapping | null = await runAbortableTask(progress => this._snapshotFrame(progress, target, frame), timeout).catch(e => null);
      if (frameResult)
        return frameResult;
      const frameSnapshot: FrameSnapshot = {
        frameId: frame._id,
        url: removeHash(frame.url()),
        html: '<body>Snapshot is not available</body>',
        resourceOverrides: [],
      };
      return { snapshot: frameSnapshot, mapping: new Map<Frame, string>() };
    });

    const viewportSize: types.Size | null = await this._getViewportSize(page, timeout);
    const results: FrameSnapshotAndMapping[] = await Promise.all(frameSnapshotPromises);

    if (!viewportSize)
      return null;

    const mainFrame: FrameSnapshotAndMapping = results[0];
    if (!mainFrame.snapshot.url.startsWith('http'))
      mainFrame.snapshot.url = 'http://playwright.snapshot/';

    const mapping: Map<Frame, string> = new Map<Frame, string>();
    for (const result of results) {
      for (const [key, value] of result.mapping)
        mapping.set(key, value);
    }

    const childFrames: FrameSnapshot[] = [];
    for (let i = 1; i < results.length; i++) {
      const result: FrameSnapshotAndMapping = results[i];
      const frame: Frame = frames[i];
      if (!mapping.has(frame))
        continue;
      const frameSnapshot: FrameSnapshot = result.snapshot;
      frameSnapshot.url = mapping.get(frame)!;
      childFrames.push(frameSnapshot);
    }

    return {
      viewportSize,
      frames: [mainFrame.snapshot, ...childFrames],
    };
  }

  private async _getViewportSize(page: Page, timeout: number): Promise<types.Size | null> {
    return runAbortableTask(async () => {
      const viewportSize: types.Size | null = page.viewportSize();
      if (viewportSize)
        return viewportSize;
      const context: FrameExecutionContext = await page.mainFrame()._utilityContext();
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
    const context: FrameExecutionContext = await frame._utilityContext();
    const guid: string = createGuid();
    const removeNoScript: boolean = !frame._page.context()._options.javaScriptEnabled;
    const result: js.JSHandle<any> = await js.evaluate(context, false /* returnByValue */, takeSnapshotInFrame, guid, removeNoScript, target) as js.JSHandle;
    if (!progress.isRunning())
      return null;

    const properties: Map<string, js.JSHandle<any>> = await result.getProperties();
    const data: SnapshotData = await properties.get('data')!.jsonValue() as SnapshotData;
    const frameElements: Map<string, js.JSHandle<any>> = await properties.get('frameElements')!.getProperties();
    result.dispose();

    const snapshot: FrameSnapshot = {
      frameId: frame._id,
      url: removeHash(frame.url()),
      html: data.html,
      resourceOverrides: [],
    };
    const mapping: Map<Frame, string> = new Map<Frame, string>();

    for (const { url, content } of data.resourceOverrides) {
      const buffer: Buffer = Buffer.from(content);
      const sha1: string = calculateSha1(buffer);
      this._delegate.onBlob({ sha1, buffer });
      snapshot.resourceOverrides.push({ url, sha1 });
    }

    for (let i = 0; i < data.frameUrls.length; i++) {
      const element: ElementHandle<Node> | null = frameElements.get(String(i))!.asElement();
      if (!element)
        continue;
      const frame: Frame | null = await element.contentFrame().catch(e => null);
      if (frame)
        mapping.set(frame, data.frameUrls[i]);
    }

    return { snapshot, mapping };
  }
}

function removeHash(url: string): string {
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
