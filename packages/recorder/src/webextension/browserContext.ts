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
import type { Frame } from './frame';
import { Page } from './page';
import { eventsHelper, type RegisteredListener } from './utils';

export type FunctionWithSource = (source: { context: BrowserContext, page: Page, frame: Frame}, ...args: any) => any;

export class BrowserContext extends EventEmitter {

  static Events = {
    Close: 'close',
    Page: 'page',
  };

  private _listeners: RegisteredListener[];
  private _bindings: Map<string, FunctionWithSource> = new Map();
  private _pages: Map<number, Page> = new Map();

  constructor() {
    super();
    this._listeners = [
      eventsHelper.addEventListener(chrome.tabs.onCreated, this._onCreated.bind(this)),
      eventsHelper.addEventListener(chrome.tabs.onRemoved, this._onRemoved.bind(this)),
      eventsHelper.addEventListener(chrome.runtime.onMessage, this._onMessage.bind(this)),
      eventsHelper.addEventListener(chrome.webNavigation.onCompleted, this._onCompleted.bind(this)),
    ];
  }

  async exposeBinding(bindingName: string, _needsHandle: boolean, func: FunctionWithSource) {
    this._bindings.set(bindingName, func);
  }

  addPage(page: Page) {
    this._pages.set(page._tabId, page);
  }

  pages(): Page[] {
    return [...this._pages.values()];
  }

  async extendInjectedScript(source: string) {
    const installInFrame = (frame: Frame) => {
      chrome.scripting.executeScript({
        target: { tabId: frame._page._tabId, allFrames: false, frameIds: [frame._frameId] },
        files: [source],
      }).catch(() => {});
    };
    const installInPage = async (page: Page) => {
      page.on(Page.Events.InternalFrameNavigatedToNewDocument, installInFrame);
      await chrome.scripting.executeScript({
        target: { tabId: page._tabId, allFrames: true },
        files: [source],
      }).catch(() => {});
    };
    this.on(BrowserContext.Events.Page, installInPage);
    await Promise.all(this.pages().map(installInPage));
  }

  dispose() {
    eventsHelper.removeEventListeners(this._listeners);
  }

  private _onMessage({ bindingName, args }: any, { tab, frameId, url }: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
    const tabId = tab?.id;
    // frameId may be 0!
    if (!bindingName || !tabId || typeof frameId !== 'number')
      return;
    const frame = this._pages.get(tabId)?._frameFor(frameId);
    if (!frame)
      return;
    frame._url = url;
    const func = this._bindings.get(bindingName);
    if (!func)
      throw new Error(`No binding for ${bindingName}`);

    (async () => {
      // handles both sync and async functions
      const result = await func({ context: this, page: frame._page, frame }, ...args);
      sendResponse(result);
    })();

    // needed for asynchronous responses:
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage#sendresponse
    return true;
  }

  private _onCreated({ id: tabId, openerTabId }: chrome.tabs.Tab) {
    // for now, it only handles pages with a opener that belongs to browserContext
    if (!tabId || !openerTabId || !this._pages.has(openerTabId))
      return;
    const openerPage = this._pageFor(openerTabId);
    const page = this._pageFor(tabId);
    page._opener = openerPage;
    this.emit(BrowserContext.Events.Page, page);
  }

  private _onRemoved(tabId: number) {
    const page = this._pages.get(tabId);
    this._pages.delete(tabId);
    page?.emit(Page.Events.Close);
  }

  private _onCompleted(event: chrome.webNavigation.WebNavigationFramedCallbackDetails) {
    this._pageFor(event.tabId)._onCompleted(event);
  }

  _pageFor(tabId: number) {
    return this._pages.get(tabId) ?? new Page(tabId);
  }
}
