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

import { BrowserContext } from './browserContext';
import { Page } from './page';
import * as network from './network';
import { helper, RegisteredListener } from './helper';
import { Progress, runAbortableTask } from './progress';
import { debugLogger } from '../utils/debugLogger';
import { Frame } from './frames';
import * as js from './javascript';
import * as types from './types';
import { SnapshotData, takeSnapshotInFrame } from './snapshotterInjected';
import { assert, calculateSha1, createGuid } from '../utils/utils';

export type SanpshotterResource = {
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

export type FrameSnapshot = {
  frameId: string,
  url: string,
  html: string,
  resourceOverrides: { url: string, sha1: string }[],
};
export type PageSnapshot = {
  label: string,
  viewportSize?: { width: number, height: number },
  // First frame is the main frame.
  frames: FrameSnapshot[],
};

export interface SnapshotterDelegate {
  onContextCreated(context: BrowserContext): void;
  onContextDestroyed(context: BrowserContext): void;
  onBlob(context: BrowserContext, blob: SnapshotterBlob): void;
  onResource(context: BrowserContext, resource: SanpshotterResource): void;
  onSnapshot(context: BrowserContext, snapshot: PageSnapshot): void;
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
    this._delegate.onContextCreated(this._context);
  }

  async captureSnapshot(page: Page, options: types.TimeoutOptions & { label?: string } = {}): Promise<void> {
    return runAbortableTask(async progress => {
      await this._doSnapshot(progress, page, options.label || 'snapshot');
    }, page._timeoutSettings.timeout(options));
  }

  _dispose() {
    helper.removeEventListeners(this._eventListeners);
    this._delegate.onContextDestroyed(this._context);
  }

  async _doSnapshot(progress: Progress, page: Page, label: string): Promise<void> {
    assert(page.context() === this._context);
    const snapshot = await this._snapshotPage(progress, page, label);
    if (snapshot)
      this._delegate.onSnapshot(this._context, snapshot);
  }

  private _onPage(page: Page) {
    this._eventListeners.push(helper.addEventListener(page, Page.Events.Response, (response: network.Response) => {
      this._saveResource(response).catch(e => debugLogger.log('error', e));
    }));
  }

  private async _saveResource(response: network.Response) {
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
    const resource: SanpshotterResource = {
      frameId: response.frame()._id,
      url,
      contentType,
      responseHeaders: response.headers(),
      sha1,
    };
    this._delegate.onResource(this._context, resource);
    if (body)
      this._delegate.onBlob(this._context, { sha1, buffer: body });
  }

  private async _snapshotPage(progress: Progress, page: Page, label: string): Promise<PageSnapshot | null> {
    const frames = page.frames();
    const promises = frames.map(frame => this._snapshotFrame(progress, frame));
    const results = await Promise.all(promises);

    const mainFrame = results[0];
    if (!mainFrame)
      return null;
    if (!mainFrame.snapshot.url.startsWith('http'))
      mainFrame.snapshot.url = 'http://playwright.snapshot/';

    const mapping = new Map<Frame, string>();
    for (const result of results) {
      if (!result)
        continue;
      for (const [key, value] of result.mapping)
        mapping.set(key, value);
    }

    const childFrames: FrameSnapshot[] = [];
    for (let i = 1; i < results.length; i++) {
      const result = results[i];
      if (!result)
        continue;
      const frame = frames[i];
      if (!mapping.has(frame))
        continue;
      const frameSnapshot = result.snapshot;
      frameSnapshot.url = mapping.get(frame)!;
      childFrames.push(frameSnapshot);
    }

    let viewportSize = page.viewportSize();
    if (!viewportSize) {
      try {
        if (!progress.isRunning())
          return null;

        const context = await page.mainFrame()._utilityContext();
        viewportSize = await context.evaluateInternal(() => {
          return {
            width: Math.max(document.body.offsetWidth, document.documentElement.offsetWidth),
            height: Math.max(document.body.offsetHeight, document.documentElement.offsetHeight),
          };
        });
      } catch (e) {
        return null;
      }
    }

    return {
      label,
      viewportSize,
      frames: [mainFrame.snapshot, ...childFrames],
    };
  }

  private async _snapshotFrame(progress: Progress, frame: Frame): Promise<FrameSnapshotAndMapping | null> {
    try {
      if (!progress.isRunning())
        return null;

      const context = await frame._utilityContext();
      const guid = createGuid();
      const removeNoScript = !frame._page.context()._options.javaScriptEnabled;
      const result = await js.evaluate(context, false /* returnByValue */, takeSnapshotInFrame, guid, removeNoScript) as js.JSHandle;
      if (!progress.isRunning())
        return null;

      const properties = await result.getProperties();
      const data = await properties.get('data')!.jsonValue() as SnapshotData;
      const frameElements = await properties.get('frameElements')!.getProperties();
      result.dispose();

      const snapshot: FrameSnapshot = {
        frameId: frame._id,
        url: frame.url(),
        html: data.html,
        resourceOverrides: [],
      };
      const mapping = new Map<Frame, string>();

      for (const { url, content } of data.resourceOverrides) {
        const buffer = Buffer.from(content);
        const sha1 = calculateSha1(buffer);
        this._delegate.onBlob(this._context, { sha1, buffer });
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
    } catch (e) {
      return null;
    }
  }
}

type FrameSnapshotAndMapping = {
  snapshot: FrameSnapshot,
  mapping: Map<Frame, string>,
};
