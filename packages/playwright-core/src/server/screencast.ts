/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { renderTitleForCall } from '@isomorphic/protocolFormatter';
import { debugLogger } from '@utils/debugLogger';
import { Page } from './page';

import type * as types from './types';
import type { CallMetadata, InstrumentationListener, SdkObject } from './instrumentation';

export type ScreencastClient = {
  onFrame: (frame: types.ScreencastFrame) => Promise<void> | void;
  gracefulClose?: () => Promise<void> | void;
  dispose: () => void;
  size?: types.Size;
  quality?: number;
};

type AnnotatePosition = 'top-left' | 'top' | 'top-right' | 'bottom-left' | 'bottom' | 'bottom-right';

type ActionOptions = {
  duration?: number,
  position?: AnnotatePosition,
  fontSize?: number,
};

export class Screencast implements InstrumentationListener {
  readonly page: Page;
  private _clients = new Set<ScreencastClient>();
  private _actions: ActionOptions | undefined;
  private _size: types.Size | undefined;

  constructor(page: Page) {
    this.page = page;
    this.page.instrumentation.addListener(this, page.browserContext);
  }

  async handlePageOrContextClose() {
    const clients = [...this._clients];
    this._clients.clear();
    for (const client of clients) {
      if (client.gracefulClose)
        await client.gracefulClose();
    }
  }

  dispose() {
    for (const client of this._clients)
      client.dispose();
    this._clients.clear();
    this.page.instrumentation.removeListener(this);
  }

  showActions(options: ActionOptions) {
    this._actions = options;
  }

  hideActions() {
    this._actions = undefined;
  }

  addClient(client: ScreencastClient): { size: types.Size } {
    this._clients.add(client);
    if (this._clients.size === 1)
      this._startScreencast(client.size, client.quality);
    return { size: this._size! };
  }

  removeClient(client: ScreencastClient) {
    if (!this._clients.has(client))
      return;
    this._clients.delete(client);
    if (!this._clients.size)
      this._stopScreencast();
  }

  private _startScreencast(size: types.Size | undefined, quality: number | undefined) {
    this._size = size;
    if (!this._size) {
      const viewport = this.page.browserContext._options.viewport || { width: 800, height: 600 };
      const scale = Math.min(1, 800 / Math.max(viewport.width, viewport.height));
      this._size = {
        width: Math.floor(viewport.width * scale),
        height: Math.floor(viewport.height * scale)
      };
    }

    // Make sure both dimensions are odd, this is required for vp8
    this._size = {
      width: this._size.width & ~1,
      height: this._size.height & ~1
    };

    this.page.delegate.startScreencast({
      width: this._size.width,
      height: this._size.height,
      quality: quality ?? 90,
    });
  }

  private _stopScreencast() {
    this.page.delegate.stopScreencast();
  }

  onScreencastFrame(frame: types.ScreencastFrame, ack?: () => void) {
    const asyncResults: Promise<void>[] = [];
    for (const client of this._clients) {
      const result = client.onFrame(frame);
      if (result)
        asyncResults.push(result);
    }
    if (ack) {
      // Ack when any client resolves (OR logic). This ensures that even if
      // tracing throttles its response, other clients (like video) that resolve
      // immediately keep frames flowing.
      if (!asyncResults.length)
        ack();
      else
        Promise.race(asyncResults).then(ack);
    }
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata, parentId?: string): Promise<void> {
    if (!this._actions)
      return;
    metadata.annotate = true;
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    if (!this._actions)
      return;

    const page = sdkObject.attribution.page;
    if (!page)
      return;

    const actionTitle = renderTitleForCall(metadata);
    const utility = await page.mainFrame().utilityContext();

    // Run this outside of the progress timer.
    await utility.evaluate(async options => {
      const { injected, duration } = options;
      injected.setScreencastAnnotation(options);
      await new Promise(f => injected.utils.builtins.setTimeout(f, duration));
      injected.setScreencastAnnotation(null);
    }, {
      injected: await utility.injectedScript(),
      duration: this._actions?.duration ?? 500,
      point: metadata.point,
      box: metadata.box,
      actionTitle,
      position: this._actions?.position,
      fontSize: this._actions?.fontSize,
    }).catch(e => debugLogger.log('error', e));
  }
}
