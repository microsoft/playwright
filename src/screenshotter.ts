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
import * as dom from './dom';
import { assert, helper } from './helper';
import * as types from './types';

const writeFileAsync = helper.promisify(fs.writeFile);

export interface Page {
  viewport(): types.Viewport | null;
  setViewport(v: types.Viewport): Promise<void>;
  evaluate(f: () => any): Promise<types.Rect>;
}

export interface ScreenshotterDelegate {
  getBoundingBox(handle: dom.ElementHandle<Node>): Promise<types.Rect | null>;
  canCaptureOutsideViewport(): boolean;
  setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void>;
  screenshot(format: string, options: types.ScreenshotOptions, viewport: types.Viewport): Promise<Buffer>;
}

export class Screenshotter {
  private _queue = new TaskQueue();
  private _delegate: ScreenshotterDelegate;
  private _page: Page;

  constructor(page: Page, delegate: ScreenshotterDelegate, browserObject: any) {
    this._delegate = delegate;
    this._page = page;

    this._queue = browserObject[taskQueueSymbol];
    if (!this._queue) {
      this._queue = new TaskQueue();
      browserObject[taskQueueSymbol] = this._queue;
    }
  }

  async screenshotPage(options: types.ScreenshotOptions = {}): Promise<Buffer> {
    const format = validateScreeshotOptions(options);
    return this._queue.postTask(async () => {
      let overridenViewport: types.Viewport | undefined;
      const viewport = this._page.viewport();
      if (viewport && options.fullPage && !this._delegate.canCaptureOutsideViewport()) {
        const fullPage = await this._page.evaluate(() => ({
          width: Math.max(
              document.body.scrollWidth, document.documentElement.scrollWidth,
              document.body.offsetWidth, document.documentElement.offsetWidth,
              document.body.clientWidth, document.documentElement.clientWidth
          ),
          height: Math.max(
              document.body.scrollHeight, document.documentElement.scrollHeight,
              document.body.offsetHeight, document.documentElement.offsetHeight,
              document.body.clientHeight, document.documentElement.clientHeight
          )
        }));
        overridenViewport = { ...viewport, ...fullPage };
        await this._page.setViewport(overridenViewport);
      } else if (options.clip) {
        options.clip = trimClipToViewport(viewport, options.clip);
      }

      const result = await this._screenshot(format, options, overridenViewport || viewport);

      if (overridenViewport)
        await this._page.setViewport(viewport);
      return result;
    });
  }

  async screenshotElement(handle: dom.ElementHandle, options: types.ElementScreenshotOptions = {}): Promise<Buffer> {
    const format = validateScreeshotOptions(options);
    const rewrittenOptions: types.ScreenshotOptions = { ...options };
    return this._queue.postTask(async () => {
      let overridenViewport: types.Viewport | undefined;

      let boundingBox = await this._delegate.getBoundingBox(handle);
      assert(boundingBox, 'Node is either not visible or not an HTMLElement');
      assert(boundingBox.width !== 0, 'Node has 0 width.');
      assert(boundingBox.height !== 0, 'Node has 0 height.');
      boundingBox = enclosingIntRect(boundingBox);
      const viewport = this._page.viewport();

      if (!this._delegate.canCaptureOutsideViewport()) {
        if (boundingBox.width > viewport.width || boundingBox.height > viewport.height) {
          overridenViewport = {
            ...viewport,
            width: Math.max(viewport.width, boundingBox.width),
            height: Math.max(viewport.height, boundingBox.height),
          };
          await this._page.setViewport(overridenViewport);
        }

        await handle._scrollIntoViewIfNeeded();
        boundingBox = enclosingIntRect(await this._delegate.getBoundingBox(handle));
      }

      if (!overridenViewport)
        rewrittenOptions.clip = boundingBox;

      const result = await this._screenshot(format, rewrittenOptions, overridenViewport || viewport);

      if (overridenViewport)
        await this._page.setViewport(viewport);

      return result;
    });
  }

  private async _screenshot(format: 'png' | 'jpeg', options: types.ScreenshotOptions, viewport: types.Viewport): Promise<Buffer> {
    const shouldSetDefaultBackground = options.omitBackground && format === 'png';
    if (shouldSetDefaultBackground)
      await this._delegate.setBackgroundColor({ r: 0, g: 0, b: 0, a: 0});
    const buffer = await this._delegate.screenshot(format, options, viewport);
    if (shouldSetDefaultBackground)
      await this._delegate.setBackgroundColor();
    if (options.path)
      await writeFileAsync(options.path, buffer);
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

function trimClipToViewport(viewport: types.Viewport | null, clip: types.Rect | null): types.Rect | null {
  if (!clip || !viewport)
    return clip;
  const p1 = { x: Math.min(clip.x, viewport.width), y: Math.min(clip.y, viewport.height) };
  const p2 = { x: Math.min(clip.x + clip.width, viewport.width), y: Math.min(clip.y + clip.height, viewport.height) };
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
