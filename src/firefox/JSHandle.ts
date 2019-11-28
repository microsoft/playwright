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
import * as js from '../javascript';
import * as dom from '../dom';
import * as input from '../input';
import { JugglerSession } from './Connection';
import { Frame, FrameManager } from './FrameManager';
import { ExecutionContext, markJSHandle, ExecutionContextDelegate, toPayload } from './ExecutionContext';

class DOMWorldDelegate implements dom.DOMWorldDelegate {
  private _session: JugglerSession;
  private _frameManager: FrameManager;
  private _frameId: string;

  constructor(session: JugglerSession, frameManager: FrameManager, frameId: string) {
    this._session = session;
    this._frameManager = frameManager;
    this._frameId = frameId;
  }

  async contentFrame(handle: dom.ElementHandle): Promise<Frame|null> {
    const {frameId} = await this._session.send('Page.contentFrame', {
      frameId: this._frameId,
      objectId: toPayload(handle).objectId,
    });
    if (!frameId)
      return null;
    const frame = this._frameManager.frame(frameId);
    return frame;
  }

  isJavascriptEnabled(): boolean {
    return this._frameManager._page._javascriptEnabled;
  }

  async boundingBox(handle: dom.ElementHandle): Promise<dom.Rect | null> {
    return await this._session.send('Page.getBoundingBox', {
      frameId: this._frameId,
      objectId: toPayload(handle).objectId,
    });
  }

  async screenshot(handle: dom.ElementHandle, options: any = {}): Promise<string | Buffer> {
    const clip = await this._session.send('Page.getBoundingBox', {
      frameId: this._frameId,
      objectId: toPayload(handle).objectId,
    });
    if (!clip)
      throw new Error('Node is either not visible or not an HTMLElement');
    assert(clip.width, 'Node has 0 width.');
    assert(clip.height, 'Node has 0 height.');
    await handle._scrollIntoViewIfNeeded();

    return await this._frameManager._page.screenshot(Object.assign({}, options, {
      clip: {
        x: clip.x,
        y: clip.y,
        width: clip.width,
        height: clip.height,
      },
    }));
  }

  async ensurePointerActionPoint(handle: dom.ElementHandle, relativePoint?: dom.Point): Promise<dom.Point> {
    await handle._scrollIntoViewIfNeeded();
    if (!relativePoint)
      return this._clickablePoint(handle);
    const box = await this.boundingBox(handle);
    return { x: box.x + relativePoint.x, y: box.y + relativePoint.y };
  }

  private async _clickablePoint(handle: dom.ElementHandle): Promise<dom.Point> {
    type Quad = {p1: dom.Point, p2: dom.Point, p3: dom.Point, p4: dom.Point};

    const computeQuadArea = (quad: Quad) => {
      // Compute sum of all directed areas of adjacent triangles
      // https://en.wikipedia.org/wiki/Polygon#Simple_polygons
      let area = 0;
      const points = [quad.p1, quad.p2, quad.p3, quad.p4];
      for (let i = 0; i < points.length; ++i) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        area += (p1.x * p2.y - p2.x * p1.y) / 2;
      }
      return Math.abs(area);
    };

    const computeQuadCenter = (quad: Quad) => {
      let x = 0, y = 0;
      for (const point of [quad.p1, quad.p2, quad.p3, quad.p4]) {
        x += point.x;
        y += point.y;
      }
      return {x: x / 4, y: y / 4};
    };

    const result = await this._session.send('Page.getContentQuads', {
      frameId: this._frameId,
      objectId: toPayload(handle).objectId,
    }).catch(debugError);
    if (!result || !result.quads.length)
      throw new Error('Node is either not visible or not an HTMLElement');
    // Filter out quads that have too small area to click into.
    const quads = result.quads.filter(quad => computeQuadArea(quad) > 1);
    if (!quads.length)
      throw new Error('Node is either not visible or not an HTMLElement');
    // Return the middle point of the first quad.
    return computeQuadCenter(quads[0]);
  }

  async setInputFiles(handle: dom.ElementHandle, files: input.FilePayload[]): Promise<void> {
    await handle.evaluate(input.setFileInputFunction, files);
  }
}

export function createHandle(context: ExecutionContext, result: any, exceptionDetails?: any) {
  if (exceptionDetails) {
    if (exceptionDetails.value)
      throw new Error('Evaluation failed: ' + JSON.stringify(exceptionDetails.value));
    else
      throw new Error('Evaluation failed: ' + exceptionDetails.text + '\n' + exceptionDetails.stack);
  }
  if (result.subtype === 'node') {
    const frame = context.frame();
    const frameManager = frame._delegate as FrameManager;
    const frameId = frameManager._frameData(frame).frameId;
    const session = (context._delegate as ExecutionContextDelegate)._session;
    const delegate = new DOMWorldDelegate(session, frameManager, frameId);
    const handle = new dom.ElementHandle(context, frameManager._page.keyboard, frameManager._page.mouse, delegate);
    markJSHandle(handle, result);
    return handle;
  }
  const handle = new js.JSHandle(context);
  markJSHandle(handle, result);
  return handle;
}
