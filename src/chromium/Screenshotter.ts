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
import { Page } from './Page';
import { assert, helper } from '../helper';
import * as mime from 'mime';
import { Protocol } from './protocol';
import * as dom from '../dom';

const writeFileAsync = helper.promisify(fs.writeFile);

export type ScreenshotOptions = {
  type?: 'png' | 'jpeg',
  path?: string,
  fullPage?: boolean,
  clip?: {x: number, y: number, width: number, height: number},
  quality?: number,
  omitBackground?: boolean,
  encoding?: string,
}

export class Screenshotter {
  private _queue = new TaskQueue();

  async screenshotPage(page: Page, options: ScreenshotOptions = {}): Promise<Buffer | string> {
    const format = this._format(options);
    return this._queue.postTask(() => this._screenshot(page, format, options));
  }

  async screenshotElement(page: Page, handle: dom.ElementHandle, options: ScreenshotOptions = {}): Promise<string | Buffer> {
    const format = this._format(options);
    return this._queue.postTask(async () => {
      let needsViewportReset = false;

      let boundingBox = await handle.boundingBox();
      assert(boundingBox, 'Node is either not visible or not an HTMLElement');

      const viewport = page.viewport();

      if (viewport && (boundingBox.width > viewport.width || boundingBox.height > viewport.height)) {
        const newViewport = {
          width: Math.max(viewport.width, Math.ceil(boundingBox.width)),
          height: Math.max(viewport.height, Math.ceil(boundingBox.height)),
        };
        await page.setViewport(Object.assign({}, viewport, newViewport));

        needsViewportReset = true;
      }

      await handle._scrollIntoViewIfNeeded();

      boundingBox = await handle.boundingBox();
      assert(boundingBox, 'Node is either not visible or not an HTMLElement');
      assert(boundingBox.width !== 0, 'Node has 0 width.');
      assert(boundingBox.height !== 0, 'Node has 0 height.');

      const { layoutViewport: { pageX, pageY } } = await page._client.send('Page.getLayoutMetrics');

      const clip = Object.assign({}, boundingBox);
      clip.x += pageX;
      clip.y += pageY;

      const imageData = await this._screenshot(page, format, {...options, clip});

      if (needsViewportReset)
        await page.setViewport(viewport);

      return imageData;
    });
  }

  private async _screenshot(page: Page, format: 'png' | 'jpeg', options: ScreenshotOptions): Promise<Buffer | string> {
    await page.browser()._activatePage(page);
    let clip = options.clip ? processClip(options.clip) : undefined;
    const viewport = page.viewport();

    if (options.fullPage) {
      const metrics = await page._client.send('Page.getLayoutMetrics');
      const width = Math.ceil(metrics.contentSize.width);
      const height = Math.ceil(metrics.contentSize.height);

      // Overwrite clip for full page at all times.
      clip = { x: 0, y: 0, width, height, scale: 1 };
      const {
        isMobile = false,
        deviceScaleFactor = 1,
        isLandscape = false
      } = viewport || {};
      const screenOrientation: Protocol.Emulation.ScreenOrientation = isLandscape ? { angle: 90, type: 'landscapePrimary' } : { angle: 0, type: 'portraitPrimary' };
      await page._client.send('Emulation.setDeviceMetricsOverride', { mobile: isMobile, width, height, deviceScaleFactor, screenOrientation });
    }
    const shouldSetDefaultBackground = options.omitBackground && format === 'png';
    if (shouldSetDefaultBackground)
      await page._client.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    const result = await page._client.send('Page.captureScreenshot', { format, quality: options.quality, clip });
    if (shouldSetDefaultBackground)
      await page._client.send('Emulation.setDefaultBackgroundColorOverride');

    if (options.fullPage && viewport)
      await page.setViewport(viewport);

    const buffer = options.encoding === 'base64' ? result.data : Buffer.from(result.data, 'base64');
    if (options.path)
      await writeFileAsync(options.path, buffer);
    return buffer;

    function processClip(clip) {
      const x = Math.round(clip.x);
      const y = Math.round(clip.y);
      const width = Math.round(clip.width + clip.x - x);
      const height = Math.round(clip.height + clip.y - y);
      return {x, y, width, height, scale: 1};
    }
  }

  private _format(options: ScreenshotOptions): 'png' | 'jpeg' {
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
}

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
