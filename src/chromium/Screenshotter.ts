// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as dom from '../dom';
import { ScreenshotterDelegate } from '../screenshotter';
import * as types from '../types';
import { CDPSession } from './api';

export class CRScreenshotDelegate implements ScreenshotterDelegate {
  private _session: CDPSession;

  constructor(session: CDPSession) {
    this._session = session;
  }


  async getBoundingBox(handle: dom.ElementHandle<Node>): Promise<types.Rect | null> {
    const rect = await handle.boundingBox();
    if (!rect)
      return rect;
    const { layoutViewport: { pageX, pageY } } = await this._session.send('Page.getLayoutMetrics');
    rect.x += pageX;
    rect.y += pageY;
    return rect;
  }

  canCaptureOutsideViewport(): boolean {
    return false;
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
    await this._session.send('Emulation.setDefaultBackgroundColorOverride', { color });
  }

  async screenshot(format: 'png' | 'jpeg', options: types.ScreenshotOptions): Promise<Buffer> {
    const clip = options.clip ? { ...options.clip, scale: 1 } : undefined;
    const result = await this._session.send('Page.captureScreenshot', { format, quality: options.quality, clip });
    return Buffer.from(result.data, 'base64');
  }

  async resetViewport(): Promise<void> {
    await this._session.send('Emulation.setDeviceMetricsOverride', { mobile: false, width: 0, height: 0, deviceScaleFactor: 0 });
  }
}
