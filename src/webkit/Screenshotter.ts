// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import * as dom from '../dom';
import { ScreenshotterDelegate } from '../screenshotter';
import * as types from '../types';
import { TargetSession } from './Connection';

export class WKScreenshotDelegate implements ScreenshotterDelegate {
  private _session: TargetSession;

  setSession(session: TargetSession) {
    this._session = session;
  }

  getBoundingBox(handle: dom.ElementHandle<Node>): Promise<types.Rect | null> {
    return handle.boundingBox();
  }

  canCaptureOutsideViewport(): boolean {
    return false;
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
    // TODO: line below crashes, sort it out.
    this._session.send('Page.setDefaultBackgroundColorOverride', { color });
  }

  async screenshot(format: string, options: types.ScreenshotOptions, viewport: types.Viewport): Promise<Buffer> {
    const rect = options.clip || { x: 0, y: 0, width: viewport.width, height: viewport.height };
    const result = await this._session.send('Page.snapshotRect', { ...rect, coordinateSystem: options.fullPage ? 'Page' : 'Viewport' });
    const prefix = 'data:image/png;base64,';
    let buffer = Buffer.from(result.dataURL.substr(prefix.length), 'base64');
    if (format === 'jpeg')
      buffer = jpeg.encode(PNG.sync.read(buffer)).data;
    return buffer;
  }
}
