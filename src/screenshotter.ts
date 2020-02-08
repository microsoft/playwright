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

import * as dom from './dom';
import { assert } from './helper';
import * as types from './types';
import { Page } from './page';
import * as platform from './platform';

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
      const maybeViewportSize = await this._page.evaluate(() => {
        if (!document.body || !document.documentElement)
          return;
        return {
          width: Math.max(document.body.offsetWidth, document.documentElement.offsetWidth),
          height: Math.max(document.body.offsetHeight, document.documentElement.offsetHeight),
        };
      });
      if (!maybeViewportSize)
        throw new Error(kScreenshotDuringNavigationError);
      viewportSize = maybeViewportSize;
    }
    return { viewportSize, originalViewportSize };
  }

  async screenshotPage(options: types.ScreenshotOptions = {}): Promise<platform.BufferType> {
    const format = validateScreeshotOptions(options);
    return this._queue.postTask(async () => {
      const { viewportSize, originalViewportSize } = await this._originalViewportSize();
      let overridenViewportSize: types.Size | null = null;
      if (options.fullPage && !this._page._delegate.canScreenshotOutsideViewport()) {
        const fullPageRect = await this._page.evaluate(() => {
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
        if (!fullPageRect)
          throw new Error(kScreenshotDuringNavigationError);
        overridenViewportSize = fullPageRect;
        await this._page.setViewportSize(overridenViewportSize);
      } else if (options.clip) {
        options.clip = trimClipToViewport(viewportSize, options.clip);
      }

      return await this._screenshot(format, options, viewportSize, overridenViewportSize, originalViewportSize);
    }).catch(rewriteError);
  }

  async screenshotElement(handle: dom.ElementHandle, options: types.ElementScreenshotOptions = {}): Promise<platform.BufferType> {
    const format = validateScreeshotOptions(options);
    const rewrittenOptions: types.ScreenshotOptions = { ...options };
    return this._queue.postTask(async () => {
      let maybeBoundingBox = await this._page._delegate.getBoundingBoxForScreenshot(handle);
      assert(maybeBoundingBox, 'Node is either not visible or not an HTMLElement');
      let boundingBox = maybeBoundingBox;
      assert(boundingBox.width !== 0, 'Node has 0 width.');
      assert(boundingBox.height !== 0, 'Node has 0 height.');
      boundingBox = enclosingIntRect(boundingBox);

      const { viewportSize, originalViewportSize } = await this._originalViewportSize();

      let overridenViewportSize: types.Size | null = null;
      if (!this._page._delegate.canScreenshotOutsideViewport()) {
        if (boundingBox.width > viewportSize.width || boundingBox.height > viewportSize.height) {
          overridenViewportSize = {
            width: Math.max(viewportSize.width, boundingBox.width),
            height: Math.max(viewportSize.height, boundingBox.height),
          };
          await this._page.setViewportSize(overridenViewportSize);
        }

        await handle.scrollIntoViewIfNeeded();
        maybeBoundingBox = await this._page._delegate.getBoundingBoxForScreenshot(handle);
        assert(maybeBoundingBox, 'Node is either not visible or not an HTMLElement');
        boundingBox = enclosingIntRect(maybeBoundingBox);
      }

      if (!overridenViewportSize)
        rewrittenOptions.clip = boundingBox;

      return await this._screenshot(format, rewrittenOptions, viewportSize, overridenViewportSize, originalViewportSize);
    }).catch(rewriteError);
  }

  private async _screenshot(format: 'png' | 'jpeg', options: types.ScreenshotOptions, viewportSize: types.Size, overridenViewportSize: types.Size | null, originalViewportSize: types.Size | null): Promise<platform.BufferType> {
    const shouldSetDefaultBackground = options.omitBackground && format === 'png';
    if (shouldSetDefaultBackground)
      await this._page._delegate.setBackgroundColor({ r: 0, g: 0, b: 0, a: 0});
    const buffer = await this._page._delegate.takeScreenshot(format, options, overridenViewportSize || viewportSize);
    if (shouldSetDefaultBackground)
      await this._page._delegate.setBackgroundColor();
    if (options.path)
      await platform.writeFileAsync(options.path, buffer);

    if (overridenViewportSize) {
      if (originalViewportSize)
        await this._page.setViewportSize(originalViewportSize);
      else
        await this._page._delegate.resetViewport(viewportSize);
    }

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

function trimClipToViewport(viewportSize: types.Size, clip: types.Rect | undefined): types.Rect | undefined {
  if (!clip)
    return clip;
  const p1 = { x: Math.min(clip.x, viewportSize.width), y: Math.min(clip.y, viewportSize.height) };
  const p2 = { x: Math.min(clip.x + clip.width, viewportSize.width), y: Math.min(clip.y + clip.height, viewportSize.height) };
  const result = { x: p1.x, y: p1.y, width: p2.x - p1.x, height: p2.y - p1.y };
  assert(result.width && result.height, 'Clipped area is either empty or outside the viewport');
  return result;
}

function validateScreeshotOptions(options: types.ScreenshotOptions): 'png' | 'jpeg' {
  let format: 'png' | 'jpeg' | null = null;
  // options.type takes precedence over inferring the type from options.path
  // because it may be a 0-length file with no extension created beforehand (i.e. as a temp file).
  if (options.type) {
    assert(options.type === 'png' || options.type === 'jpeg', 'Unknown options.type value: ' + options.type);
    format = options.type;
  } else if (options.path) {
    const mimeType = platform.getMimeType(options.path);
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
  assert(!options.clip || !options.fullPage, 'options.clip and options.fullPage are exclusive');
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

function enclosingIntRect(rect: types.Rect): types.Rect {
  const x = Math.floor(rect.x + 1e-3);
  const y = Math.floor(rect.y + 1e-3);
  const x2 = Math.ceil(rect.x + rect.width - 1e-3);
  const y2 = Math.ceil(rect.y + rect.height - 1e-3);
  return { x, y, width: x2 - x, height: y2 - y };
}

export const kScreenshotDuringNavigationError = 'Cannot take a screenshot while page is navigating';
function rewriteError(e: any) {
  if (typeof e === 'object' && e instanceof Error && e.message.includes('Execution context was destroyed'))
    e.message = kScreenshotDuringNavigationError;
  throw e;
}
