/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import * as fs from 'fs';
import * as mime from 'mime';
import * as util from 'util';
import * as dom from './dom';
import { assert, helper } from './helper';
import { Page } from './page';
import * as types from './types';

export class Screenshotter {
  private _queue = new TaskQueue();
  private _page: Page;

  constructor(page: Page) {
    this._page = page;

    const browserContext = page.context();
    this._queue = (browserContext as any)[taskQueueSymbol];
    if (!this._queue) {
      this._queue = new TaskQueue();
      (browserContext as any)[taskQueueSymbol] = this._queue;
    }
  }

  private async _originalViewportSize(): Promise<{ viewportSize: types.Size, originalViewportSize: types.Size | null }> {
    const originalViewportSize = this._page.viewportSize();
    let viewportSize = originalViewportSize;
    if (!viewportSize) {
      const context = await this._page.mainFrame()._utilityContext();
      viewportSize = await context.evaluateInternal(() => {
        if (!document.body || !document.documentElement)
          return null;
        return {
          width: Math.max(document.body.offsetWidth, document.documentElement.offsetWidth),
          height: Math.max(document.body.offsetHeight, document.documentElement.offsetHeight),
        };
      });
      if (!viewportSize)
        throw new Error(kScreenshotDuringNavigationError);
    }
    return { viewportSize, originalViewportSize };
  }

  private async _fullPageSize(): Promise<types.Size> {
    const context = await this._page.mainFrame()._utilityContext();
    const fullPageSize = await context.evaluateInternal(() => {
      if (!document.body || !document.documentElement)
        return null;
      return {
        width: Math.max(
            document.body.scrollWidth, document.documentElement.scrollWidth,
            document.body.offsetWidth, document.documentElement.offsetWidth,
            document.body.clientWidth, document.documentElement.clientWidth
        ),
        height: Math.max(
            document.body.scrollHeight, document.documentElement.scrollHeight,
            document.body.offsetHeight, document.documentElement.offsetHeight,
            document.body.clientHeight, document.documentElement.clientHeight
        ),
      };
    });
    if (!fullPageSize)
      throw new Error(kScreenshotDuringNavigationError);
    return fullPageSize;
  }

  async screenshotPage(options: types.ScreenshotOptions = {}): Promise<Buffer> {
    const format = validateScreenshotOptions(options);
    return this._queue.postTask(async () => {
      const { viewportSize, originalViewportSize } = await this._originalViewportSize();

      if (options.fullPage) {
        const fullPageSize = await this._fullPageSize();
        let documentRect = { x: 0, y: 0, width: fullPageSize.width, height: fullPageSize.height };
        let overridenViewportSize: types.Size | null = null;
        const fitsViewport = fullPageSize.width <= viewportSize.width && fullPageSize.height <= viewportSize.height;
        if (!this._page._delegate.canScreenshotOutsideViewport() && !fitsViewport) {
          overridenViewportSize = fullPageSize;
          await this._page.setViewportSize(overridenViewportSize);
        }
        if (options.clip)
          documentRect = trimClipToSize(options.clip, documentRect);
        return await this._screenshot(format, documentRect, undefined, options, overridenViewportSize, originalViewportSize);
      }

      const viewportRect = options.clip ? trimClipToSize(options.clip, viewportSize) : { x: 0, y: 0, ...viewportSize };
      return await this._screenshot(format, undefined, viewportRect, options, null, originalViewportSize);
    }).catch(rewriteError);
  }

  async screenshotElement(handle: dom.ElementHandle, options: types.ElementScreenshotOptions = {}): Promise<Buffer> {
    const format = validateScreenshotOptions(options);
    return this._queue.postTask(async () => {
      const { viewportSize, originalViewportSize } = await this._originalViewportSize();

      await handle.scrollIntoViewIfNeeded();
      let boundingBox = await handle.boundingBox();
      assert(boundingBox, 'Node is either not visible or not an HTMLElement');
      assert(boundingBox.width !== 0, 'Node has 0 width.');
      assert(boundingBox.height !== 0, 'Node has 0 height.');

      let overridenViewportSize: types.Size | null = null;
      const fitsViewport = boundingBox.width <= viewportSize.width && boundingBox.height <= viewportSize.height;
      if (!this._page._delegate.canScreenshotOutsideViewport() && !fitsViewport) {
        overridenViewportSize = helper.enclosingIntSize({
          width: Math.max(viewportSize.width, boundingBox.width),
          height: Math.max(viewportSize.height, boundingBox.height),
        });
        await this._page.setViewportSize(overridenViewportSize);

        await handle.scrollIntoViewIfNeeded();
        boundingBox = await handle.boundingBox();
        assert(boundingBox, 'Node is either not visible or not an HTMLElement');
        assert(boundingBox.width !== 0, 'Node has 0 width.');
        assert(boundingBox.height !== 0, 'Node has 0 height.');
      }

      const context = await this._page.mainFrame()._utilityContext();
      const scrollOffset = await context.evaluateInternal(() => ({ x: window.scrollX, y: window.scrollY }));
      const documentRect = { ...boundingBox };
      documentRect.x += scrollOffset.x;
      documentRect.y += scrollOffset.y;
      return await this._screenshot(format, helper.enclosingIntRect(documentRect), undefined, options, overridenViewportSize, originalViewportSize);
    }).catch(rewriteError);
  }

  private async _screenshot(format: 'png' | 'jpeg', documentRect: types.Rect | undefined, viewportRect: types.Rect | undefined, options: types.ElementScreenshotOptions, overridenViewportSize: types.Size | null, originalViewportSize: types.Size | null): Promise<Buffer> {
    const shouldSetDefaultBackground = options.omitBackground && format === 'png';
    if (shouldSetDefaultBackground)
      await this._page._delegate.setBackgroundColor({ r: 0, g: 0, b: 0, a: 0});
    const buffer = await this._page._delegate.takeScreenshot(format, documentRect, viewportRect, options.quality);
    if (shouldSetDefaultBackground)
      await this._page._delegate.setBackgroundColor();
    if (overridenViewportSize) {
      assert(!this._page._delegate.canScreenshotOutsideViewport());
      if (originalViewportSize)
        await this._page.setViewportSize(originalViewportSize);
      else
        await this._page._delegate.resetViewport();
    }
    if (options.path)
      await util.promisify(fs.writeFile)(options.path, buffer);
    return buffer;
  }
}

const taskQueueSymbol = Symbol('TaskQueue');

class TaskQueue {
  private _chain: Promise<any>;

  constructor() {
    this._chain = Promise.resolve();
  }

  postTask(task: () => any): Promise<any> {
    const result = this._chain.then(task);
    this._chain = result.catch(() => {});
    return result;
  }
}

function trimClipToSize(clip: types.Rect, size: types.Size): types.Rect {
  const p1 = {
    x: Math.max(0, Math.min(clip.x, size.width)),
    y: Math.max(0, Math.min(clip.y, size.height))
  };
  const p2 = {
    x: Math.max(0, Math.min(clip.x + clip.width, size.width)),
    y: Math.max(0, Math.min(clip.y + clip.height, size.height))
  };
  const result = { x: p1.x, y: p1.y, width: p2.x - p1.x, height: p2.y - p1.y };
  assert(result.width && result.height, 'Clipped area is either empty or outside the resulting image');
  return result;
}

function validateScreenshotOptions(options: types.ScreenshotOptions): 'png' | 'jpeg' {
  let format: 'png' | 'jpeg' | null = null;
  // options.type takes precedence over inferring the type from options.path
  // because it may be a 0-length file with no extension created beforehand (i.e. as a temp file).
  if (options.type) {
    assert(options.type === 'png' || options.type === 'jpeg', 'Unknown options.type value: ' + options.type);
    format = options.type;
  } else if (options.path) {
    const mimeType = mime.getType(options.path);
    if (mimeType === 'image/png')
      format = 'png';
    else if (mimeType === 'image/jpeg')
      format = 'jpeg';
    assert(format, 'Unsupported screenshot mime type: ' + mimeType);
  }

  if (!format)
    format = 'png';

  if (options.quality) {
    assert(format === 'jpeg', 'options.quality is unsupported for the ' + format + ' screenshots');
    assert(typeof options.quality === 'number', 'Expected options.quality to be a number but found ' + (typeof options.quality));
    assert(Number.isInteger(options.quality), 'Expected options.quality to be an integer');
    assert(options.quality >= 0 && options.quality <= 100, 'Expected options.quality to be between 0 and 100 (inclusive), got ' + options.quality);
  }
  if (options.clip) {
    assert(typeof options.clip.x === 'number', 'Expected options.clip.x to be a number but found ' + (typeof options.clip.x));
    assert(typeof options.clip.y === 'number', 'Expected options.clip.y to be a number but found ' + (typeof options.clip.y));
    assert(typeof options.clip.width === 'number', 'Expected options.clip.width to be a number but found ' + (typeof options.clip.width));
    assert(typeof options.clip.height === 'number', 'Expected options.clip.height to be a number but found ' + (typeof options.clip.height));
    assert(options.clip.width !== 0, 'Expected options.clip.width not to be 0.');
    assert(options.clip.height !== 0, 'Expected options.clip.height not to be 0.');
  }
  return format;
}

export const kScreenshotDuringNavigationError = 'Cannot take a screenshot while page is navigating';
function rewriteError(e: any) {
  if (typeof e === 'object' && e instanceof Error && e.message.includes('Execution context was destroyed'))
    e.message = kScreenshotDuringNavigationError;
  throw e;
}
