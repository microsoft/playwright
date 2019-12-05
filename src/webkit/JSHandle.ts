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

import { debugError, assert } from '../helper';
import * as input from '../input';
import * as dom from '../dom';
import * as frames from '../frames';
import * as types from '../types';
import { TargetSession } from './Connection';
import { FrameManager } from './FrameManager';
import { Protocol } from './protocol';

export class DOMWorldDelegate implements dom.DOMWorldDelegate {
  readonly keyboard: input.Keyboard;
  readonly mouse: input.Mouse;
  readonly frame: frames.Frame;
  private _client: TargetSession;
  private _frameManager: FrameManager;

  constructor(frameManager: FrameManager, frame: frames.Frame) {
    this.keyboard = frameManager.page().keyboard;
    this.mouse = frameManager.page().mouse;
    this.frame = frame;
    this._client = frameManager._session;
    this._frameManager = frameManager;
  }

  async contentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    throw new Error('contentFrame() is not implemented');
  }

  isJavascriptEnabled(): boolean {
    return this._frameManager.page()._javascriptEnabled;
  }

  isElement(remoteObject: any): boolean {
    return (remoteObject as Protocol.Runtime.RemoteObject).subtype === 'node';
  }

  async boundingBox(handle: dom.ElementHandle): Promise<types.Rect | null> {
    const quads = await this.contentQuads(handle);
    if (!quads || !quads.length)
      return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const quad of quads) {
      for (const point of quad) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  async contentQuads(handle: dom.ElementHandle): Promise<types.Quad[] | null> {
    const result = await this._client.send('DOM.getContentQuads', {
      objectId: toRemoteObject(handle).objectId
    }).catch(debugError);
    if (!result)
      return null;
    return result.quads.map(quad => [
      { x: quad[0], y: quad[1] },
      { x: quad[2], y: quad[3] },
      { x: quad[4], y: quad[5] },
      { x: quad[6], y: quad[7] }
    ]);
  }

  async layoutViewport(): Promise<{ width: number, height: number }> {
    return this._frameManager._page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  }

  screenshot(handle: dom.ElementHandle, options?: types.ScreenshotOptions): Promise<string | Buffer> {
    const page = this._frameManager._page;
    return page._screenshotter.screenshotElement(page, handle, options);
  }

  async setInputFiles(handle: dom.ElementHandle, files: input.FilePayload[]): Promise<void> {
    const objectId = toRemoteObject(handle).objectId;
    await this._client.send('DOM.setInputFiles', { objectId, files });
  }

  async adoptElementHandle(handle: dom.ElementHandle, to: dom.DOMWorld): Promise<dom.ElementHandle> {
    assert(false, 'Multiple isolated worlds are not implemented');
    return handle;
  }
}

function toRemoteObject(handle: dom.ElementHandle): Protocol.Runtime.RemoteObject {
  return handle._remoteObject as Protocol.Runtime.RemoteObject;
}
