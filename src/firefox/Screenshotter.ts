// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ScreenshotterDelegate } from '../screenshotter';
import * as types from '../types';
import * as dom from '../dom';
import { JugglerSession } from './Connection';
import { FrameManager } from './FrameManager';

export class FFScreenshotDelegate implements ScreenshotterDelegate {
  private _session: JugglerSession;
  private _frameManager: FrameManager;

  constructor(session: JugglerSession, frameManager: FrameManager) {
    this._session = session;
    this._frameManager = frameManager;
  }

  getBoundingBox(handle: dom.ElementHandle<Node>): Promise<types.Rect | undefined> {
    const frameId = this._frameManager._frameData(handle.executionContext().frame()).frameId;
    return this._session.send('Page.getBoundingBox', {
      frameId,
      objectId: handle._remoteObject.objectId,
    });
  }

  canCaptureOutsideViewport(): boolean {
    return true;
  }

  async setBackgroundColor(color?: { r: number; g: number; b: number; a: number; }): Promise<void> {
  }

  async screenshot(format: 'png' | 'jpeg', options: types.ScreenshotOptions): Promise<Buffer> {
    const { data } = await this._session.send('Page.screenshot', {
      mimeType: ('image/' + format) as ('image/png' | 'image/jpeg'),
      fullPage: options.fullPage,
      clip: options.clip,
    });
    return Buffer.from(data, 'base64');
  }
}
