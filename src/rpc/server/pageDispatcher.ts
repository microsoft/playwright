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

import { BrowserContext } from '../../browserContext';
import { Events } from '../../events';
import { Frame } from '../../frames';
import { parseError, serializeError } from '../../helper';
import { Request } from '../../network';
import { Page } from '../../page';
import * as types from '../../types';
import { BindingCallChannel, BindingCallInitializer, ElementHandleChannel, PageChannel, PageInitializer, ResponseChannel } from '../channels';
import { Dispatcher, DispatcherScope } from '../dispatcher';
import { ConsoleMessageDispatcher } from './consoleMessageDispatcher';
import { DialogDispatcher } from './dialogDispatcher';
import { DownloadDispatcher } from './downloadDispatcher';
import { FrameDispatcher } from './frameDispatcher';
import { RequestDispatcher, ResponseDispatcher, RouteDispatcher } from './networkDispatchers';

export class PageDispatcher extends Dispatcher<Page, PageInitializer> implements PageChannel {
  private _page: Page;

  static from(scope: DispatcherScope, page: Page): PageDispatcher {
    if ((page as any)[scope.dispatcherSymbol])
      return (page as any)[scope.dispatcherSymbol];
    return new PageDispatcher(scope, page);
  }

  static fromNullable(scope: DispatcherScope, page: Page | null): PageDispatcher | null {
    if (!page)
      return null;
    return PageDispatcher.from(scope, page);
  }

  constructor(scope: DispatcherScope, page: Page) {
    super(scope, page, 'page', {
      mainFrame: FrameDispatcher.from(scope, page.mainFrame()),
      viewportSize: page.viewportSize()
    });
    this._page = page;
    page.on(Events.Page.Close, () => this._dispatchEvent('close'));
    page.on(Events.Page.Console, message => this._dispatchEvent('console', ConsoleMessageDispatcher.from(this._scope, message)));
    page.on(Events.Page.Crash, () => this._dispatchEvent('crash'));
    page.on(Events.Page.DOMContentLoaded, () => this._dispatchEvent('domcontentloaded'));
    page.on(Events.Page.Dialog, dialog => this._dispatchEvent('dialog', DialogDispatcher.from(this._scope, dialog)));
    page.on(Events.Page.Download, dialog => this._dispatchEvent('download', DownloadDispatcher.from(this._scope, dialog)));
    page.on(Events.Page.FrameAttached, frame => this._onFrameAttached(frame));
    page.on(Events.Page.FrameDetached, frame => this._onFrameDetached(frame));
    page.on(Events.Page.FrameNavigated, frame => this._onFrameNavigated(frame));
    page.on(Events.Page.Load, () => this._dispatchEvent('load'));
    page.on(Events.Page.PageError, error => this._dispatchEvent('pageError', { error: serializeError(error) }));
    page.on(Events.Page.Popup, page => this._dispatchEvent('popup', PageDispatcher.from(this._scope, page)));
    page.on(Events.Page.Request, request => this._dispatchEvent('request', RequestDispatcher.from(this._scope, request)));
    page.on(Events.Page.RequestFailed, (request: Request) => this._dispatchEvent('requestFailed', {
      request: RequestDispatcher.from(this._scope, request),
      failureText: request._failureText
    }));
    page.on(Events.Page.RequestFinished, request => this._dispatchEvent('requestFinished', RequestDispatcher.from(this._scope, request)));
    page.on(Events.Page.Response, response => this._dispatchEvent('response', ResponseDispatcher.from(this._scope, response)));
  }

  async setDefaultNavigationTimeoutNoReply(params: { timeout: number }) {
    this._page.setDefaultNavigationTimeout(params.timeout);
  }

  async setDefaultTimeoutNoReply(params: { timeout: number }) {
    this._page.setDefaultTimeout(params.timeout);
  }

  async opener(): Promise<PageChannel | null> {
    return PageDispatcher.fromNullable(this._scope, await this._page.opener());
  }

  async exposeBinding(params: { name: string }): Promise<void> {
    this._page.exposeBinding(params.name, (source, ...args) => {
      const bindingCall = new BindingCallDispatcher(this._scope, params.name, source, args);
      this._dispatchEvent('bindingCall', bindingCall);
      return bindingCall.promise();
    });
  }

  async setExtraHTTPHeaders(params: { headers: types.Headers }): Promise<void> {
    await this._page.setExtraHTTPHeaders(params.headers);
  }

  async reload(params: { options?: types.NavigateOptions }): Promise<ResponseChannel | null> {
    return ResponseDispatcher.fromNullable(this._scope, await this._page.reload(params.options));
  }

  async goBack(params: { options?: types.NavigateOptions }): Promise<ResponseChannel | null> {
    return ResponseDispatcher.fromNullable(this._scope, await this._page.goBack(params.options));
  }

  async goForward(params: { options?: types.NavigateOptions }): Promise<ResponseChannel | null> {
    return ResponseDispatcher.fromNullable(this._scope, await this._page.goForward(params.options));
  }

  async emulateMedia(params: { options: { media?: 'screen' | 'print', colorScheme?: 'dark' | 'light' | 'no-preference' } }): Promise<void> {
    await this._page.emulateMedia(params.options);
  }

  async setViewportSize(params: { viewportSize: types.Size }): Promise<void> {
    await this._page.setViewportSize(params.viewportSize);
  }

  async addInitScript(params: { source: string }): Promise<void> {
    await this._page._addInitScriptExpression(params.source);
  }

  async setNetworkInterceptionEnabled(params: { enabled: boolean }): Promise<void> {
    if (!params.enabled) {
      await this._page.unroute('**/*');
      return;
    }
    this._page.route('**/*', (route, request) => {
      this._dispatchEvent('route', { route: RouteDispatcher.from(this._scope, route), request: RequestDispatcher.from(this._scope, request) });
    });
  }

  async screenshot(params: { options?: types.ScreenshotOptions }): Promise<Buffer> {
    return await this._page.screenshot(params.options);
  }

  async close(params: { options?: { runBeforeUnload?: boolean } }): Promise<void> {
    await this._page.close(params.options);
  }

  async setFileChooserInterceptedNoReply(params: { intercepted: boolean }) {
  }

  async title() {
    return await this._page.title();
  }

  async keyboardDown(params: { key: string }): Promise<void> {
    await this._page.keyboard.down(params.key);
  }

  async keyboardUp(params: { key: string }): Promise<void> {
    await this._page.keyboard.up(params.key);
  }

  async keyboardInsertText(params: { text: string }): Promise<void> {
    await this._page.keyboard.insertText(params.text);
  }

  async keyboardType(params: { text: string, options?: { delay?: number } }): Promise<void> {
    await this._page.keyboard.type(params.text, params.options);
  }

  async keyboardPress(params: { key: string, options?: { delay?: number } }): Promise<void> {
    await this._page.keyboard.press(params.key, params.options);
  }

  async mouseMove(params: { x: number, y: number, options?: { steps?: number } }): Promise<void> {
    await this._page.mouse.move(params.x, params.y, params.options);
  }

  async mouseDown(params: { options?: { button?: types.MouseButton, clickCount?: number } }): Promise<void> {
    await this._page.mouse.down(params.options);
  }

  async mouseUp(params: { options?: { button?: types.MouseButton, clickCount?: number } }): Promise<void> {
    await this._page.mouse.up(params.options);
  }

  async mouseClick(params: { x: number, y: number, options?: { delay?: number, button?: types.MouseButton, clickCount?: number } }): Promise<void> {
    await this._page.mouse.click(params.x, params.y, params.options);
  }

  async accessibilitySnapshot(params: { options: { interestingOnly?: boolean, root?: ElementHandleChannel } }): Promise<types.SerializedAXNode | null> {
    return await this._page.accessibility.snapshot({
      interestingOnly: params.options.interestingOnly,
      root: params.options.root ? params.options.root._object : undefined
    });
  }

  _onFrameAttached(frame: Frame) {
    this._dispatchEvent('frameAttached', FrameDispatcher.from(this._scope, frame));
  }

  _onFrameNavigated(frame: Frame) {
    this._dispatchEvent('frameNavigated', { frame: FrameDispatcher.from(this._scope, frame), url: frame.url(), name: frame.name() });
  }

  _onFrameDetached(frame: Frame) {
    this._dispatchEvent('frameDetached', FrameDispatcher.from(this._scope, frame));
  }
}


export class BindingCallDispatcher extends Dispatcher<{}, BindingCallInitializer> implements BindingCallChannel {
  private _resolve: ((arg: any) => void) | undefined;
  private _reject: ((error: any) => void) | undefined;
  private _promise: Promise<any>;

  constructor(scope: DispatcherScope, name: string, source: { context: BrowserContext, page: Page, frame: Frame }, args: any[]) {
    super(scope, {}, 'bindingCall', {
      frame: FrameDispatcher.from(scope, source.frame),
      name,
      args
    });
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  promise() {
    return this._promise;
  }

  resolve(params: { result: any }) {
    this._resolve!(params.result);
  }

  reject(params: { error: types.Error }) {
    this._reject!(parseError(params.error));
  }
}
