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

import { debugError } from '../helper';
import * as dom from '../dom';
import * as input from '../input';
import * as types from '../types';
import * as frames from '../frames';
import { CDPSession } from './Connection';
import { FrameManager } from './FrameManager';
import { Protocol } from './protocol';
import { ExecutionContextDelegate } from './ExecutionContext';

export class DOMWorldDelegate implements dom.DOMWorldDelegate {
  readonly keyboard: input.Keyboard;
  readonly mouse: input.Mouse;
  readonly frame: frames.Frame;
  private _client: CDPSession;
  private _frameManager: FrameManager;

  constructor(frameManager: FrameManager, frame: frames.Frame) {
    this.keyboard = frameManager.page().keyboard;
    this.mouse = frameManager.page().mouse;
    this.frame = frame;
    this._client = frameManager._client;
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

  isElement(remoteObject: any): boolean {
    return (remoteObject as Protocol.Runtime.RemoteObject).subtype === 'node';
  }

  async boundingBox(handle: dom.ElementHandle): Promise<types.Rect | null> {
    const result = await this._client.send('DOM.getBoxModel', {
      objectId: toRemoteObject(handle).objectId
    }).catch(debugError);
    if (!result)
      return null;
    const quad = result.model.border;
    const x = Math.min(quad[0], quad[2], quad[4], quad[6]);
    const y = Math.min(quad[1], quad[3], quad[5], quad[7]);
    const width = Math.max(quad[0], quad[2], quad[4], quad[6]) - x;
    const height = Math.max(quad[1], quad[3], quad[5], quad[7]) - y;
    return {x, y, width, height};
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
    const layoutMetrics = await this._client.send('Page.getLayoutMetrics');
    return { width: layoutMetrics.layoutViewport.clientWidth, height: layoutMetrics.layoutViewport.clientHeight };
  }

  screenshot(handle: dom.ElementHandle, options?: types.ScreenshotOptions): Promise<string | Buffer> {
    const page = this._frameManager.page();
    return page._screenshotter.screenshotElement(page, handle, options);
  }

  async setInputFiles(handle: dom.ElementHandle, files: input.FilePayload[]): Promise<void> {
    await handle.evaluate(input.setFileInputFunction, files);
  }

  async adoptElementHandle<T extends Node>(handle: dom.ElementHandle<T>, to: dom.DOMWorld): Promise<dom.ElementHandle<T>> {
    const nodeInfo = await this._client.send('DOM.describeNode', {
      objectId: toRemoteObject(handle).objectId,
    });
    return this.adoptBackendNodeId(nodeInfo.node.backendNodeId, to) as Promise<dom.ElementHandle<T>>;
  }

  async adoptBackendNodeId(backendNodeId: Protocol.DOM.BackendNodeId, to: dom.DOMWorld): Promise<dom.ElementHandle> {
    const result = await this._client.send('DOM.resolveNode', {
      backendNodeId,
      executionContextId: (to.context._delegate as ExecutionContextDelegate)._contextId,
    }).catch(debugError);
    if (!result)
      throw new Error('Unable to adopt element handle from a different document');
    return to.context._createHandle(result.object).asElement()!;
  }
}

function toRemoteObject(handle: dom.ElementHandle): Protocol.Runtime.RemoteObject {
  return handle._remoteObject as Protocol.Runtime.RemoteObject;
}
