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

import { EventEmitter } from 'events';
import { Frame } from './frame';

export class Page extends EventEmitter {

  static Events = {
    Close: 'close',
    InternalFrameNavigatedToNewDocument: 'internalframenavigatedtonewdocument',
  };

  readonly _tabId: number;
  private _mainFrame: Frame;
  readonly _frames: Map<number, Frame> = new Map();
  _opener: Page | undefined;

  constructor(tabId: number, url?: string) {
    super();
    this._tabId = tabId;
    // main frame is always frameId = 0
    this._mainFrame = this._frameFor(0);
    this._mainFrame._url = url;
  }

  async _onCompleted({ url, frameId }: chrome.webNavigation.WebNavigationFramedCallbackDetails) {
    const frame = this._frameFor(frameId);
    frame._url = url;
    const page = frame._page;
    if (frame === this._mainFrame) {
      // remove all except main frame
      this._frames.clear();
      this._frames.set(frame._frameId, frame);
    }

    frame.emit(Frame.Events.InternalNavigation, { url, isPublic: true });
    page.emit(Page.Events.InternalFrameNavigatedToNewDocument, frame);
  }

  opener() {
    return this._opener;
  }

  mainFrame() {
    return this._mainFrame;
  }

  async bringToFront() {
    await chrome.tabs.update(this._tabId, { active: true });
  }

  private _frameFor(frameId: number) {
    let frame = this._frames.get(frameId);
    if (!frame) {
      frame = new Frame(this, frameId);
      this._frames.set(frameId, frame);
    }
    return frame;
  }
}
