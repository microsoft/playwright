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
import * as types from '../types';
import * as frames from '../frames';
import { CDPSession } from './Connection';
import { FrameManager } from './FrameManager';
import { Protocol } from './protocol';
import { ExecutionContextDelegate, markJSHandle, toRemoteObject } from './ExecutionContext';

export function createJSHandle(context: js.ExecutionContext, remoteObject: Protocol.Runtime.RemoteObject): js.JSHandle {
  const frame = context.frame();
  if (remoteObject.subtype === 'node' && frame) {
    const frameManager = frame._delegate as FrameManager;
    const page = frameManager.page();
    const delegate = new DOMWorldDelegate((context._delegate as ExecutionContextDelegate)._client, frameManager);
    const handle = new dom.ElementHandle(context, page.keyboard, page.mouse, delegate);
    markJSHandle(handle, remoteObject);
    return handle;
  }
  const handle = new js.JSHandle(context);
  markJSHandle(handle, remoteObject);
  return handle;
}

class DOMWorldDelegate implements dom.DOMWorldDelegate {
  private _client: CDPSession;
  private _frameManager: FrameManager;

  constructor(client: CDPSession, frameManager: FrameManager) {
    this._client = client;
    this._frameManager = frameManager;
  }

  async contentFrame(handle: dom.ElementHandle): Promise<frames.Frame | null> {
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: toRemoteObject(handle).objectId
    });
    if (typeof nodeInfo.node.frameId !== 'string')
      return null;
    return this._frameManager.frame(nodeInfo.node.frameId);
  }

  isJavascriptEnabled(): boolean {
    return this._frameManager.page()._javascriptEnabled;
  }

  private _getBoxModel(handle: dom.ElementHandle): Promise<void | Protocol.DOM.getBoxModelReturnValue> {
    return this._client.send('DOM.getBoxModel', {
      objectId: toRemoteObject(handle).objectId
    }).catch(error => debugError(error));
  }

  async boundingBox(handle: dom.ElementHandle): Promise<types.Rect | null> {
    const result = await this._getBoxModel(handle);
    if (!result)
      return null;
    const quad = result.model.border;
    const x = Math.min(quad[0], quad[2], quad[4], quad[6]);
    const y = Math.min(quad[1], quad[3], quad[5], quad[7]);
    const width = Math.max(quad[0], quad[2], quad[4], quad[6]) - x;
    const height = Math.max(quad[1], quad[3], quad[5], quad[7]) - y;
    return {x, y, width, height};
  }

  async screenshot(handle: dom.ElementHandle, options: any = {}): Promise<string | Buffer> {
    let needsViewportReset = false;

    let boundingBox = await this.boundingBox(handle);
    assert(boundingBox, 'Node is either not visible or not an HTMLElement');

    const viewport = this._frameManager.page().viewport();

    if (viewport && (boundingBox.width > viewport.width || boundingBox.height > viewport.height)) {
      const newViewport = {
        width: Math.max(viewport.width, Math.ceil(boundingBox.width)),
        height: Math.max(viewport.height, Math.ceil(boundingBox.height)),
      };
      await this._frameManager.page().setViewport(Object.assign({}, viewport, newViewport));

      needsViewportReset = true;
    }

    await handle._scrollIntoViewIfNeeded();

    boundingBox = await this.boundingBox(handle);
    assert(boundingBox, 'Node is either not visible or not an HTMLElement');
    assert(boundingBox.width !== 0, 'Node has 0 width.');
    assert(boundingBox.height !== 0, 'Node has 0 height.');

    const { layoutViewport: { pageX, pageY } } = await this._client.send('Page.getLayoutMetrics');

    const clip = Object.assign({}, boundingBox);
    clip.x += pageX;
    clip.y += pageY;

    const imageData = await this._frameManager.page().screenshot(Object.assign({}, {
      clip
    }, options));

    if (needsViewportReset)
      await this._frameManager.page().setViewport(viewport);

    return imageData;
  }

  async ensurePointerActionPoint(handle: dom.ElementHandle, relativePoint?: types.Point): Promise<types.Point> {
    await handle._scrollIntoViewIfNeeded();
    if (!relativePoint)
      return this._clickablePoint(handle);
    let r = await this._viewportPointAndScroll(handle, relativePoint);
    if (r.scrollX || r.scrollY) {
      const error = await handle.evaluate((element, scrollX, scrollY) => {
        if (!element.ownerDocument || !element.ownerDocument.defaultView)
          return 'Node does not have a containing window';
        element.ownerDocument.defaultView.scrollBy(scrollX, scrollY);
        return false;
      }, r.scrollX, r.scrollY);
      if (error)
        throw new Error(error);
      r = await this._viewportPointAndScroll(handle, relativePoint);
      if (r.scrollX || r.scrollY)
        throw new Error('Failed to scroll relative point into viewport');
    }
    return r.point;
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

    const [result, layoutMetrics] = await Promise.all([
      this._client.send('DOM.getContentQuads', {
        objectId: toRemoteObject(handle).objectId
      }).catch(debugError),
      this._client.send('Page.getLayoutMetrics'),
    ]);
    if (!result || !result.quads.length)
      throw new Error('Node is either not visible or not an HTMLElement');
    // Filter out quads that have too small area to click into.
    const { clientWidth, clientHeight } = layoutMetrics.layoutViewport;
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

  async _viewportPointAndScroll(handle: dom.ElementHandle, relativePoint: types.Point): Promise<{point: types.Point, scrollX: number, scrollY: number}> {
    const model = await this._getBoxModel(handle);
    let point: types.Point;
    if (!model) {
      point = relativePoint;
    } else {
      // Use padding quad to be compatible with offsetX/offsetY properties.
      const quad = model.model.padding;
      const x = Math.min(quad[0], quad[2], quad[4], quad[6]);
      const y = Math.min(quad[1], quad[3], quad[5], quad[7]);
      point = {
        x: x + relativePoint.x,
        y: y + relativePoint.y,
      };
    }
    const metrics = await this._client.send('Page.getLayoutMetrics');
    // Give one extra pixel to avoid any issues on viewport edge.
    let scrollX = 0;
    if (point.x < 1)
      scrollX = point.x - 1;
    if (point.x > metrics.layoutViewport.clientWidth - 1)
      scrollX = point.x - metrics.layoutViewport.clientWidth + 1;
    let scrollY = 0;
    if (point.y < 1)
      scrollY = point.y - 1;
    if (point.y > metrics.layoutViewport.clientHeight - 1)
      scrollY = point.y - metrics.layoutViewport.clientHeight + 1;
    return { point, scrollX, scrollY };
  }

  async setInputFiles(handle: dom.ElementHandle, files: input.FilePayload[]): Promise<void> {
    await handle.evaluate(input.setFileInputFunction, files);
  }
}
