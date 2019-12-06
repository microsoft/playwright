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

import { assert, debugError } from '../helper';
import * as dom from '../dom';
import * as input from '../input';
import * as types from '../types';
import * as frames from '../frames';
import { JugglerSession } from './Connection';
import { FrameManager } from './FrameManager';
import { Protocol } from './protocol';

export class DOMWorldDelegate implements dom.DOMWorldDelegate {
  readonly keyboard: input.Keyboard;
  readonly mouse: input.Mouse;
  readonly frame: frames.Frame;
  private _session: JugglerSession;
  private _frameManager: FrameManager;
  private _frameId: string;

  constructor(frameManager: FrameManager, frame: frames.Frame) {
    this.keyboard = frameManager._page.keyboard;
    this.mouse = frameManager._page.mouse;
    this.frame = frame;
    this._session = frameManager._session;
    this._frameManager = frameManager;
    this._frameId = frameManager._frameData(frame).frameId;
  }

  async contentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    const {frameId} = await this._session.send('Page.contentFrame', {
      frameId: this._frameId,
      objectId: toRemoteObject(handle).objectId,
    });
    if (!frameId)
      return null;
    const frame = this._frameManager.frame(frameId);
    return frame;
  }

  isJavascriptEnabled(): boolean {
    return this._frameManager._page._javascriptEnabled;
  }

  isElement(remoteObject: any): boolean {
    return remoteObject.subtype === 'node';
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
    const result = await this._session.send('Page.getContentQuads', {
      frameId: this._frameId,
      objectId: toRemoteObject(handle).objectId,
    }).catch(debugError);
    if (!result)
      return null;
    return result.quads.map(quad => [ quad.p1, quad.p2, quad.p3, quad.p4 ]);
  }

  async layoutViewport(): Promise<{ width: number, height: number }> {
    return this._frameManager._page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  }

  async screenshot(handle: dom.ElementHandle, options?: types.ElementScreenshotOptions): Promise<Buffer> {
    const page = this._frameManager._page;
    return page._screenshotter.screenshotElement(handle, options);
  }

  async setInputFiles(handle: dom.ElementHandle, files: input.FilePayload[]): Promise<void> {
    await handle.evaluate(input.setFileInputFunction, files);
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.DOMWorld): Promise<dom.ElementHandle<T>> {
    assert(false, 'Multiple isolated worlds are not implemented');
    return handle;
  }
}

function toRemoteObject(handle: dom.ElementHandle): Protocol.RemoteObject {
  return handle._remoteObject;
}

