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
import { debugError, helper, assert } from '../helper';
import * as input from '../input';
import * as dom from '../dom';
import * as frames from '../frames';
import * as types from '../types';
import { TargetSession } from './Connection';
import { FrameManager } from './FrameManager';
import { Protocol } from './protocol';

const writeFileAsync = helper.promisify(fs.writeFile);

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
    throw new Error('boundingBox() is not implemented');
  }

  async screenshot(handle: dom.ElementHandle, options: any = {}): Promise<string | Buffer> {
    const objectId = toRemoteObject(handle).objectId;
    this._client.send('DOM.getDocument');
    const {nodeId} = await this._client.send('DOM.requestNode', {objectId});
    const result = await this._client.send('Page.snapshotNode', {nodeId});
    const prefix = 'data:image/png;base64,';
    const buffer = Buffer.from(result.dataURL.substr(prefix.length), 'base64');
    if (options.path)
      await writeFileAsync(options.path, buffer);
    return buffer;
  }

  async ensurePointerActionPoint(handle: dom.ElementHandle, relativePoint?: types.Point): Promise<types.Point> {
    await handle._scrollIntoViewIfNeeded();
    if (!relativePoint)
      return this._clickablePoint(handle);
    const box = await this.boundingBox(handle);
    return { x: box.x + relativePoint.x, y: box.y + relativePoint.y };
  }

  private async _clickablePoint(handle: dom.ElementHandle): Promise<types.Point> {
    const fromProtocolQuad = (quad: number[]): types.Point[] => {
      return [
        {x: quad[0], y: quad[1]},
        {x: quad[2], y: quad[3]},
        {x: quad[4], y: quad[5]},
        {x: quad[6], y: quad[7]}
      ];
    };

    const intersectQuadWithViewport = (quad: types.Point[], width: number, height: number): types.Point[] => {
      return quad.map(point => ({
        x: Math.min(Math.max(point.x, 0), width),
        y: Math.min(Math.max(point.y, 0), height),
      }));
    };

    const computeQuadArea = (quad: types.Point[]) => {
      // Compute sum of all directed areas of adjacent triangles
      // https://en.wikipedia.org/wiki/Polygon#Simple_polygons
      let area = 0;
      for (let i = 0; i < quad.length; ++i) {
        const p1 = quad[i];
        const p2 = quad[(i + 1) % quad.length];
        area += (p1.x * p2.y - p2.x * p1.y) / 2;
      }
      return Math.abs(area);
    };

    const [result, viewport] = await Promise.all([
      this._client.send('DOM.getContentQuads', {
        objectId: toRemoteObject(handle).objectId
      }).catch(debugError),
      handle.evaluate(() => ({ clientWidth: innerWidth, clientHeight: innerHeight })),
    ]);
    if (!result || !result.quads.length)
      throw new Error('Node is either not visible or not an HTMLElement');
    // Filter out quads that have too small area to click into.
    const {clientWidth, clientHeight} = viewport;
    const quads = result.quads.map(fromProtocolQuad)
        .map(quad => intersectQuadWithViewport(quad, clientWidth, clientHeight))
        .filter(quad => computeQuadArea(quad) > 1);
    if (!quads.length)
      throw new Error('Node is either not visible or not an HTMLElement');
    // Return the middle point of the first quad.
    const quad = quads[0];
    let x = 0;
    let y = 0;
    for (const point of quad) {
      x += point.x;
      y += point.y;
    }
    return {
      x: x / 4,
      y: y / 4
    };
  }

  async setInputFiles(handle: dom.ElementHandle, files: input.FilePayload[]): Promise<void> {
    const objectId = toRemoteObject(handle).objectId;
    await this._client.send('DOM.setInputFiles', { objectId, files });
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.DOMWorld): Promise<dom.ElementHandle<T>> {
    assert(false, 'Multiple isolated worlds are not implemented');
    return handle;
  }
}

function toRemoteObject(handle: dom.ElementHandle): Protocol.Runtime.RemoteObject {
  return handle._remoteObject as Protocol.Runtime.RemoteObject;
}
