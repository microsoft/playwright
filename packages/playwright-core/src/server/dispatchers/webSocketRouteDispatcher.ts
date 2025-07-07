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

import { Page } from '../page';
import { Dispatcher } from './dispatcher';
import { PageDispatcher } from './pageDispatcher';
import * as rawWebSocketMockSource from '../../generated/webSocketMockSource';
import { SdkObject } from '../instrumentation';
import { urlMatches } from '../../utils/isomorphic/urlMatch';
import { eventsHelper } from '../utils/eventsHelper';

import type { BrowserContextDispatcher } from './browserContextDispatcher';
import type { BrowserContext } from '../browserContext';
import type { DispatcherConnection } from './dispatcher';
import type { Frame } from '../frames';
import type * as ws from '@injected/webSocketMock';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';
import type { InitScript, PageBinding } from '../page';

export class WebSocketRouteDispatcher extends Dispatcher<SdkObject, channels.WebSocketRouteChannel, PageDispatcher | BrowserContextDispatcher> implements channels.WebSocketRouteChannel {
  _type_WebSocketRoute = true;
  private _id: string;
  private _frame: Frame;
  private static _idToDispatcher = new Map<string, WebSocketRouteDispatcher>();

  constructor(scope: PageDispatcher | BrowserContextDispatcher, id: string, url: string, frame: Frame) {
    super(scope, new SdkObject(scope._object, 'webSocketRoute'), 'WebSocketRoute', { url });
    this._id = id;
    this._frame = frame;
    this._eventListeners.push(
        // When the frame navigates or detaches, there will be no more communication
        // from the mock websocket, so pretend like it was closed.
        eventsHelper.addEventListener(frame._page, Page.Events.InternalFrameNavigatedToNewDocument, (frame: Frame) => {
          if (frame === this._frame)
            this._executionContextGone();
        }),
        eventsHelper.addEventListener(frame._page, Page.Events.FrameDetached, (frame: Frame) => {
          if (frame === this._frame)
            this._executionContextGone();
        }),
        eventsHelper.addEventListener(frame._page, Page.Events.Close, () => this._executionContextGone()),
        eventsHelper.addEventListener(frame._page, Page.Events.Crash, () => this._executionContextGone()),
    );
    WebSocketRouteDispatcher._idToDispatcher.set(this._id, this);
    (scope as any)._dispatchEvent('webSocketRoute', { webSocketRoute: this });
  }

  static async install(progress: Progress, connection: DispatcherConnection, target: Page | BrowserContext): Promise<InitScript> {
    const context = target instanceof Page ? target.browserContext : target;
    let data = context.getBindingClient(kBindingName) as BindingData | undefined;
    if (data && data.connection !== connection)
      throw new Error('Another client is already routing WebSockets');
    if (!data) {
      data = { counter: 0, connection, binding: null as any };
      data.binding = await context.exposeBinding(progress, kBindingName, false, (source, payload: ws.BindingPayload) => {
        if (payload.type === 'onCreate') {
          const contextDispatcher = connection.existingDispatcher<BrowserContextDispatcher>(context);
          const pageDispatcher = contextDispatcher ? PageDispatcher.fromNullable(contextDispatcher, source.page) : undefined;
          let scope: PageDispatcher | BrowserContextDispatcher | undefined;
          if (pageDispatcher && matchesPattern(pageDispatcher, context._options.baseURL, payload.url))
            scope = pageDispatcher;
          else if (contextDispatcher && matchesPattern(contextDispatcher, context._options.baseURL, payload.url))
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
        if (payload.type === 'onClosePage')
          dispatcher?._dispatchEvent('closePage', { code: payload.code, reason: payload.reason, wasClean: payload.wasClean });
        if (payload.type === 'onCloseServer')
          dispatcher?._dispatchEvent('closeServer', { code: payload.code, reason: payload.reason, wasClean: payload.wasClean });
      }, data);
    }
    ++data.counter;

    return await target.addInitScript(progress, `
      (() => {
        const module = {};
        ${rawWebSocketMockSource.source}
        (module.exports.inject())(globalThis);
      })();
    `);
  }

  static async uninstall(connection: DispatcherConnection, target: Page | BrowserContext, initScript: InitScript) {
    const context = target instanceof Page ? target.browserContext : target;
    const data = context.getBindingClient(kBindingName) as BindingData | undefined;
    if (!data || data.connection !== connection)
      return;
    if (--data.counter <= 0)
      await context.removeExposedBindings([data.binding]);
    await target.removeInitScripts([initScript]);
  }

  async connect(params: channels.WebSocketRouteConnectParams, progress: Progress) {
    await this._evaluateAPIRequest(progress, { id: this._id, type: 'connect' });
  }

  async ensureOpened(params: channels.WebSocketRouteEnsureOpenedParams, progress: Progress) {
    await this._evaluateAPIRequest(progress, { id: this._id, type: 'ensureOpened' });
  }

  async sendToPage(params: channels.WebSocketRouteSendToPageParams, progress: Progress) {
    await this._evaluateAPIRequest(progress, { id: this._id, type: 'sendToPage', data: { data: params.message, isBase64: params.isBase64 } });
  }

  async sendToServer(params: channels.WebSocketRouteSendToServerParams, progress: Progress) {
    await this._evaluateAPIRequest(progress, { id: this._id, type: 'sendToServer', data: { data: params.message, isBase64: params.isBase64 } });
  }

  async closePage(params: channels.WebSocketRouteClosePageParams, progress: Progress) {
    await this._evaluateAPIRequest(progress, { id: this._id, type: 'closePage', code: params.code, reason: params.reason, wasClean: params.wasClean });
  }

  async closeServer(params: channels.WebSocketRouteCloseServerParams, progress: Progress) {
    await this._evaluateAPIRequest(progress, { id: this._id, type: 'closeServer', code: params.code, reason: params.reason, wasClean: params.wasClean });
  }

  private async _evaluateAPIRequest(progress: Progress, request: ws.APIRequest) {
    await progress.race(this._frame.evaluateExpression(`globalThis.__pwWebSocketDispatch(${JSON.stringify(request)})`).catch(() => {}));
  }

  override _onDispose() {
    WebSocketRouteDispatcher._idToDispatcher.delete(this._id);
  }

  private _executionContextGone() {
    // We could enter here after being disposed upon page closure:
    // - first from the recursive dispose inintiated by PageDispatcher;
    // - then from our own page.on('close') listener.
    if (!this._disposed) {
      this._dispatchEvent('closePage', { wasClean: true });
      this._dispatchEvent('closeServer', { wasClean: true });
    }
  }
}

function matchesPattern(dispatcher: PageDispatcher | BrowserContextDispatcher, baseURL: string | undefined, url: string) {
  for (const pattern of dispatcher._webSocketInterceptionPatterns || []) {
    const urlMatch = pattern.regexSource ? new RegExp(pattern.regexSource, pattern.regexFlags) : pattern.glob;
    if (urlMatches(baseURL, url, urlMatch, true))
      return true;
  }
  return false;
}

const kBindingName = '__pwWebSocketBinding';
type BindingData = { counter: number, connection: DispatcherConnection, binding: PageBinding };
