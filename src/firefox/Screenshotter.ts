// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as fs from 'fs';
import { Page } from './Page';
import { assert, helper } from '../helper';
import * as dom from '../dom';
import * as types from '../types';
import { JugglerSession } from './Connection';

const writeFileAsync = helper.promisify(fs.writeFile);

export class Screenshotter {
  private _session: JugglerSession;

  constructor(session: JugglerSession) {
    this._session = session;
  }

  async screenshotPage(page: Page, options: types.ScreenshotOptions = {}): Promise<Buffer | string> {
    const format = helper.validateScreeshotOptions(options);
    const {data} = await this._session.send('Page.screenshot', {
      mimeType: ('image/' + format) as ('image/png' | 'image/jpeg'),
      fullPage: options.fullPage,
      clip: processClip(options.clip),
    });
    const buffer = options.encoding === 'base64' ? data : Buffer.from(data, 'base64');
    if (options.path)
      await writeFileAsync(options.path, buffer);
    return buffer;

    function processClip(clip) {
      if (!clip)
        return undefined;
      const x = Math.round(clip.x);
      const y = Math.round(clip.y);
      const width = Math.round(clip.width + clip.x - x);
      const height = Math.round(clip.height + clip.y - y);
      return {x, y, width, height};
    }
  }

  async screenshotElement(page: Page, handle: dom.ElementHandle, options: types.ScreenshotOptions = {}): Promise<string | Buffer> {
    const frameId = page._frameManager._frameData(handle.executionContext().frame()).frameId;
    const clip = await this._session.send('Page.getBoundingBox', {
      frameId,
      objectId: handle._remoteObject.objectId,
    });
    if (!clip)
      throw new Error('Node is either not visible or not an HTMLElement');
    assert(clip.width, 'Node has 0 width.');
    assert(clip.height, 'Node has 0 height.');
    await handle._scrollIntoViewIfNeeded();
    return this.screenshotPage(page, {
      ...options,
      clip: {
        x: clip.x,
        y: clip.y,
        width: clip.width,
        height: clip.height,
      },
    });
  }
}
