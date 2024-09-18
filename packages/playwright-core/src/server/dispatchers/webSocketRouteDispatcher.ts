/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { BrowserContext } from '../browserContext';
import type { Frame } from '../frames';
import { Page } from '../page';
import type * as channels from '@protocol/channels';
import { Dispatcher } from './dispatcher';
import { createGuid, urlMatches } from '../../utils';
import { PageDispatcher } from './pageDispatcher';
import type { BrowserContextDispatcher } from './browserContextDispatcher';
import * as webSocketMockSource from '../../generated/webSocketMockSource';
import type * as ws from '../injected/webSocketMock';
import { eventsHelper } from '../../utils/eventsHelper';

const kBindingInstalledSymbol = Symbol('webSocketRouteBindingInstalled');
const kInitScriptInstalledSymbol = Symbol('webSocketRouteInitScriptInstalled');

export class WebSocketRouteDispatcher extends Dispatcher<{ guid: string }, channels.WebSocketRouteChannel, PageDispatcher | BrowserContextDispatcher> implements channels.WebSocketRouteChannel {
  _type_WebSocketRoute = true;
  private _id: string;
  private _frame: Frame;
  private static _idToDispatcher = new Map<string, WebSocketRouteDispatcher>();

  constructor(scope: PageDispatcher | BrowserContextDispatcher, id: string, url: string, frame: Frame) {
    super(scope, { guid: 'webSocketRoute@' + createGuid() }, 'WebSocketRoute', { url });
    this._id = id;
    this._frame = frame;
    this._eventListeners.push(
        // When the frame navigates or detaches, there will be no more communication
        // from the mock websocket, so pretend like it was closed.
        eventsHelper.addEventListener(frame._page, Page.Events.InternalFrameNavigatedToNewDocument, (frame: Frame) => {
          if (frame === this._frame)
            this._onClose();
        }),
        eventsHelper.addEventListener(frame._page, Page.Events.FrameDetached, (frame: Frame) => {
          if (frame === this._frame)
            this._onClose();
        }),
        eventsHelper.addEventListener(frame._page, Page.Events.Close, () => this._onClose()),
        eventsHelper.addEventListener(frame._page, Page.Events.Crash, () => this._onClose()),
    );
    WebSocketRouteDispatcher._idToDispatcher.set(this._id, this);
    (scope as any)._dispatchEvent('webSocketRoute', { webSocketRoute: this });
  }

  static async installIfNeeded(contextDispatcher: BrowserContextDispatcher, target: Page | BrowserContext) {
    const context = target instanceof Page ? target.context() : target;
    if (!(context as any)[kBindingInstalledSymbol]) {
      (context as any)[kBindingInstalledSymbol] = true;

      await context.exposeBinding('__pwWebSocketBinding', false, (source, payload: ws.BindingPayload) => {
        if (payload.type === 'onCreate') {
          const pageDispatcher = PageDispatcher.fromNullable(contextDispatcher, source.page);
          let scope: PageDispatcher | BrowserContextDispatcher | undefined;
          if (pageDispatcher && matchesPattern(pageDispatcher, context._options.baseURL, payload.url))
            scope = pageDispatcher;
          else if (matchesPattern(contextDispatcher, context._options.baseURL, payload.url))
            scope = contextDispatcher;
          if (scope) {
            new WebSocketRouteDispatcher(scope, payload.id, payload.url, source.frame);
          } else {
            const request: ws.PassthroughRequest = { id: payload.id, type: 'passthrough' };
            source.frame.evaluateExpression(`globalThis.__pwWebSocketDispatch(${JSON.stringify(request)})`).catch(() => {});
          }
          return;
        }

        const dispatcher = WebSocketRouteDispatcher._idToDispatcher.get(payload.id);
        if (payload.type === 'onMessageFromPage')
          dispatcher?._dispatchEvent('messageFromPage', { message: payload.data.data, isBase64: payload.data.isBase64 });
        if (payload.type === 'onMessageFromServer')
          dispatcher?._dispatchEvent('messageFromServer', { message: payload.data.data, isBase64: payload.data.isBase64 });
        if (payload.type === 'onClose')
          dispatcher?._onClose();
      });
    }

    if (!(target as any)[kInitScriptInstalledSymbol]) {
      (target as any)[kInitScriptInstalledSymbol] = true;
      await target.addInitScript(`
        (() => {
          const module = {};
          ${webSocketMockSource.source}
          (module.exports.inject())(globalThis);
        })();
      `);
    }
  }

  async connect(params: channels.WebSocketRouteConnectParams) {
    await this._evaluateAPIRequest({ id: this._id, type: 'connect' });
  }

  async ensureOpened(params: channels.WebSocketRouteEnsureOpenedParams) {
    await this._evaluateAPIRequest({ id: this._id, type: 'ensureOpened' });
  }

  async sendToPage(params: channels.WebSocketRouteSendToPageParams) {
    await this._evaluateAPIRequest({ id: this._id, type: 'sendToPage', data: { data: params.message, isBase64: params.isBase64 } });
  }

  async sendToServer(params: channels.WebSocketRouteSendToServerParams) {
    await this._evaluateAPIRequest({ id: this._id, type: 'sendToServer', data: { data: params.message, isBase64: params.isBase64 } });
  }

  async close(params: channels.WebSocketRouteCloseParams) {
    await this._evaluateAPIRequest({ id: this._id, type: 'close', code: params.code, reason: params.reason, wasClean: true });
  }

  private async _evaluateAPIRequest(request: ws.APIRequest) {
    await this._frame.evaluateExpression(`globalThis.__pwWebSocketDispatch(${JSON.stringify(request)})`).catch(() => {});
  }

  override _onDispose() {
    WebSocketRouteDispatcher._idToDispatcher.delete(this._id);
  }

  _onClose() {
    // We could enter here twice upon page closure:
    // - first from the recursive dispose inintiated by PageDispatcher;
    // - then from our own page.on('close') listener.
    if (this._disposed)
      return;
    this._dispatchEvent('close');
    this._dispose();
  }
}

function matchesPattern(dispatcher: PageDispatcher | BrowserContextDispatcher, baseURL: string | undefined, url: string) {
  for (const pattern of dispatcher._webSocketInterceptionPatterns || []) {
    const urlMatch = pattern.regexSource ? new RegExp(pattern.regexSource, pattern.regexFlags) : pattern.glob;
    if (urlMatches(baseURL, url, urlMatch))
      return true;
  }
  return false;
}
