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
import { Progress } from '../progress';
import { FrameSnapshot, PageSnapshot, ContextCreatedTraceEvent, ContextDestroyedTraceEvent, SnapshotTraceEvent, NetworkResourceTraceEvent } from '../../utils/traceTypes';
import { TraceFile } from './traceFile';
import { debugLogger } from '../../utils/debugLogger';
import { Frame } from '../frames';
import * as js from '../javascript';
import { SnapshotData, takeSnapshotInFrame } from './snapshotter';

export class TraceRecorder {
  private _traceFile: TraceFile;
  private _context: BrowserContext;
  private _contextId: string;
  private _contextEventPromise: Promise<void>;
  private _eventListeners: RegisteredListener[];

  constructor(context: BrowserContext, traceStorageDir: string, traceFile: string) {
    this._traceFile = new TraceFile(traceStorageDir, traceFile);
    this._context = context;
    this._contextId = 'context@' + helper.guid();
    this._eventListeners = [
      helper.addEventListener(this._context, BrowserContext.Events.Page, this._onPage.bind(this)),
    ];

    const event: ContextCreatedTraceEvent = {
      type: 'context-created',
      browserName: context._browser._options.name,
      browserId: context._browser.id,
      contextId: this._contextId,
      isMobile: !!this._context._options.isMobile,
      deviceScaleFactor: this._context._options.deviceScaleFactor || 1,
      viewportSize: this._context._options.viewport || undefined,
    };
    this._contextEventPromise = this._traceFile.appendTraceEvent(event);
  }

  async dispose() {
    helper.removeEventListeners(this._eventListeners);
    const event: ContextDestroyedTraceEvent = {
      type: 'context-destroyed',
      contextId: this._contextId,
    };
    await this.appendTraceEvent(event);
    await this._traceFile.dispose();
  }

  async captureSnapshot(progress: Progress, page: Page, label: string): Promise<void> {
    const snapshot = await this._snapshotPage(progress, page);
    if (!snapshot)
      return;
    const buffer = Buffer.from(JSON.stringify(snapshot));
    const sha1 = helper.sha1(buffer);
    await this._traceFile.writeArtifact(sha1, buffer);
    const snapshotEvent: SnapshotTraceEvent = {
      type: 'snapshot',
      contextId: this._contextId,
      label,
      sha1,
    };
    await this.appendTraceEvent(snapshotEvent);
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
    const resourceEvent: NetworkResourceTraceEvent = {
      type: 'resource',
      frameId: response.frame()._id,
      contextId: this._contextId,
      url,
      contentType,
      responseHeaders: response.headers(),
      sha1: body ? helper.sha1(body) : 'none',
    };
    await this.appendTraceEvent(resourceEvent);
    if (body)
      await this._traceFile.writeArtifact(resourceEvent.sha1, body);
  }

  private async _snapshotPage(progress: Progress, page: Page): Promise<PageSnapshot | null> {
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
      viewportSize,
      frames: [mainFrame.snapshot, ...childFrames],
    };
  }

  private async _snapshotFrame(progress: Progress, frame: Frame): Promise<FrameSnapshotAndMapping | null> {
    try {
      if (!progress.isRunning())
        return null;

      const context = await frame._utilityContext();
      const guid = helper.guid();
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
        const sha1 = helper.sha1(buffer);
        await this._traceFile.writeArtifact(sha1, buffer);
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

  private async appendTraceEvent(event: any) {
    await this._contextEventPromise;
    await this._traceFile.appendTraceEvent(event);
  }
}

type FrameSnapshotAndMapping = {
  snapshot: FrameSnapshot,
  mapping: Map<Frame, string>,
};
