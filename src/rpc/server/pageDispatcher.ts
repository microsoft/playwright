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
import { Request } from '../../network';
import { Page, Worker } from '../../page';
import * as types from '../../types';
import { BindingCallChannel, BindingCallInitializer, ElementHandleChannel, PageChannel, PageInitializer, ResponseChannel, WorkerInitializer, WorkerChannel, JSHandleChannel, Binary, SerializedArgument, PagePdfParams, SerializedError, PageAccessibilitySnapshotResult, SerializedValue, PageEmulateMediaParams } from '../channels';
import { Dispatcher, DispatcherScope, lookupDispatcher, lookupNullableDispatcher } from './dispatcher';
import { parseError, serializeError } from '../serializers';
import { ConsoleMessageDispatcher } from './consoleMessageDispatcher';
import { DialogDispatcher } from './dialogDispatcher';
import { DownloadDispatcher } from './downloadDispatcher';
import { FrameDispatcher } from './frameDispatcher';
import { RequestDispatcher, ResponseDispatcher, RouteDispatcher } from './networkDispatchers';
import { serializeResult, parseArgument } from './jsHandleDispatcher';
import { ElementHandleDispatcher, createHandle } from './elementHandlerDispatcher';
import { FileChooser } from '../../fileChooser';
import { CRCoverage } from '../../chromium/crCoverage';

export class PageDispatcher extends Dispatcher<Page, PageInitializer> implements PageChannel {
  private _page: Page;

  constructor(scope: DispatcherScope, page: Page) {
    // TODO: theoretically, there could be more than one frame already.
    // If we split pageCreated and pageReady, there should be no main frame during pageCreated.
    super(scope, page, 'Page', {
      mainFrame: FrameDispatcher.from(scope, page.mainFrame()),
      viewportSize: page.viewportSize() || undefined,
      isClosed: page.isClosed()
    });
    this._page = page;
    page.on(Events.Page.Close, () => this._dispatchEvent('close'));
    page.on(Events.Page.Console, message => this._dispatchEvent('console', { message: new ConsoleMessageDispatcher(this._scope, message) }));
    page.on(Events.Page.Crash, () => this._dispatchEvent('crash'));
    page.on(Events.Page.DOMContentLoaded, () => this._dispatchEvent('domcontentloaded'));
    page.on(Events.Page.Dialog, dialog => this._dispatchEvent('dialog', { dialog: new DialogDispatcher(this._scope, dialog) }));
    page.on(Events.Page.Download, dialog => this._dispatchEvent('download', { download: new DownloadDispatcher(this._scope, dialog) }));
    this._page.on(Events.Page.FileChooser, (fileChooser: FileChooser) => this._dispatchEvent('fileChooser', {
      element: new ElementHandleDispatcher(this._scope, fileChooser.element()),
      isMultiple: fileChooser.isMultiple()
    }));
    page.on(Events.Page.FrameAttached, frame => this._onFrameAttached(frame));
    page.on(Events.Page.FrameDetached, frame => this._onFrameDetached(frame));
    page.on(Events.Page.Load, () => this._dispatchEvent('load'));
    page.on(Events.Page.PageError, error => this._dispatchEvent('pageError', { error: serializeError(error) }));
    page.on(Events.Page.Popup, page => this._dispatchEvent('popup', { page: lookupDispatcher<PageDispatcher>(page) }));
    page.on(Events.Page.Request, request => this._dispatchEvent('request', { request: RequestDispatcher.from(this._scope, request) }));
    page.on(Events.Page.RequestFailed, (request: Request) => this._dispatchEvent('requestFailed', {
      request: RequestDispatcher.from(this._scope, request),
      failureText: request._failureText
    }));
    page.on(Events.Page.RequestFinished, request => this._dispatchEvent('requestFinished', { request: RequestDispatcher.from(scope, request) }));
    page.on(Events.Page.Response, response => this._dispatchEvent('response', { response: new ResponseDispatcher(this._scope, response) }));
    page.on(Events.Page.Worker, worker => this._dispatchEvent('worker', { worker: new WorkerDispatcher(this._scope, worker) }));
  }

  async setDefaultNavigationTimeoutNoReply(params: { timeout: number }) {
    this._page.setDefaultNavigationTimeout(params.timeout);
  }

  async setDefaultTimeoutNoReply(params: { timeout: number }) {
    this._page.setDefaultTimeout(params.timeout);
  }

  async opener(): Promise<{ page?: PageChannel }> {
    return { page: lookupNullableDispatcher<PageDispatcher>(await this._page.opener()) };
  }

  async exposeBinding(params: { name: string }): Promise<void> {
    await this._page.exposeBinding(params.name, (source, ...args) => {
      const binding = new BindingCallDispatcher(this._scope, params.name, source, args);
      this._dispatchEvent('bindingCall', { binding });
      return binding.promise();
    });
  }

  async setExtraHTTPHeaders(params: { headers: types.HeadersArray }): Promise<void> {
    await this._page.setExtraHTTPHeaders(params.headers);
  }

  async reload(params: types.NavigateOptions): Promise<{ response?: ResponseChannel }> {
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._page.reload(params)) };
  }

  async goBack(params: types.NavigateOptions): Promise<{ response?: ResponseChannel }> {
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._page.goBack(params)) };
  }

  async goForward(params: types.NavigateOptions): Promise<{ response?: ResponseChannel }> {
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._page.goForward(params)) };
  }

  async emulateMedia(params: PageEmulateMediaParams): Promise<void> {
    await this._page.emulateMedia({
      media: params.media === 'null' ? null : params.media,
      colorScheme: params.colorScheme === 'null' ? null : params.colorScheme,
    });
  }

  async setViewportSize(params: { viewportSize: types.Size }): Promise<void> {
    await this._page.setViewportSize(params.viewportSize);
  }

  async addInitScript(params: { source: string }): Promise<void> {
    await this._page._addInitScriptExpression(params.source);
  }

  async setNetworkInterceptionEnabled(params: { enabled: boolean }): Promise<void> {
    if (!params.enabled) {
      await this._page._setRequestInterceptor(undefined);
      return;
    }
    this._page._setRequestInterceptor((route, request) => {
      this._dispatchEvent('route', { route: new RouteDispatcher(this._scope, route), request: RequestDispatcher.from(this._scope, request) });
    });
  }

  async screenshot(params: types.ScreenshotOptions): Promise<{ binary: Binary }> {
    return { binary: (await this._page.screenshot(params)).toString('base64') };
  }

  async close(params: { runBeforeUnload?: boolean }): Promise<void> {
    await this._page.close(params);
  }

  async setFileChooserInterceptedNoReply(params: { intercepted: boolean }) {
    await this._page._setFileChooserIntercepted(params.intercepted);
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

  async keyboardType(params: { text: string, delay?: number }): Promise<void> {
    await this._page.keyboard.type(params.text, params);
  }

  async keyboardPress(params: { key: string, delay?: number }): Promise<void> {
    await this._page.keyboard.press(params.key, params);
  }

  async mouseMove(params: { x: number, y: number, steps?: number }): Promise<void> {
    await this._page.mouse.move(params.x, params.y, params);
  }

  async mouseDown(params: { button?: types.MouseButton, clickCount?: number }): Promise<void> {
    await this._page.mouse.down(params);
  }

  async mouseUp(params: { button?: types.MouseButton, clickCount?: number }): Promise<void> {
    await this._page.mouse.up(params);
  }

  async mouseClick(params: { x: number, y: number, delay?: number, button?: types.MouseButton, clickCount?: number }): Promise<void> {
    await this._page.mouse.click(params.x, params.y, params);
  }

  async accessibilitySnapshot(params: { interestingOnly?: boolean, root?: ElementHandleChannel }): Promise<PageAccessibilitySnapshotResult> {
    const rootAXNode = await this._page.accessibility.snapshot({
      interestingOnly: params.interestingOnly,
      root: params.root ? (params.root as ElementHandleDispatcher)._elementHandle : undefined
    });
    return { rootAXNode: rootAXNode || undefined };
  }

  async pdf(params: PagePdfParams): Promise<{ pdf: Binary }> {
    if (!this._page.pdf)
      throw new Error('PDF generation is only supported for Headless Chromium');
    const buffer = await this._page.pdf(params);
    return { pdf: buffer.toString('base64') };
  }

  async bringToFront(): Promise<void> {
    await this._page.bringToFront();
  }

  async crStartJSCoverage(params: types.JSCoverageOptions): Promise<void> {
    const coverage = this._page.coverage as CRCoverage;
    await coverage.startJSCoverage(params);
  }

  async crStopJSCoverage(): Promise<{ entries: types.JSCoverageEntry[] }> {
    const coverage = this._page.coverage as CRCoverage;
    return { entries: await coverage.stopJSCoverage() };
  }

  async crStartCSSCoverage(params: types.CSSCoverageOptions): Promise<void> {
    const coverage = this._page.coverage as CRCoverage;
    await coverage.startCSSCoverage(params);
  }

  async crStopCSSCoverage(): Promise<{ entries: types.CSSCoverageEntry[] }> {
    const coverage = this._page.coverage as CRCoverage;
    return { entries: await coverage.stopCSSCoverage() };
  }

  _onFrameAttached(frame: Frame) {
    this._dispatchEvent('frameAttached', { frame: FrameDispatcher.from(this._scope, frame) });
  }

  _onFrameDetached(frame: Frame) {
    this._dispatchEvent('frameDetached', { frame: lookupDispatcher<FrameDispatcher>(frame) });
  }
}


export class WorkerDispatcher extends Dispatcher<Worker, WorkerInitializer> implements WorkerChannel {
  constructor(scope: DispatcherScope, worker: Worker) {
    super(scope, worker, 'Worker', {
      url: worker.url()
    });
    worker.on(Events.Worker.Close, () => this._dispatchEvent('close'));
  }

  async evaluateExpression(params: { expression: string, isFunction: boolean, arg: SerializedArgument }): Promise<{ value: SerializedValue }> {
    return { value: serializeResult(await this._object._evaluateExpression(params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: SerializedArgument }): Promise<{ handle: JSHandleChannel }> {
    return { handle: createHandle(this._scope, await this._object._evaluateExpressionHandle(params.expression, params.isFunction, parseArgument(params.arg))) };
  }
}

export class BindingCallDispatcher extends Dispatcher<{}, BindingCallInitializer> implements BindingCallChannel {
  private _resolve: ((arg: any) => void) | undefined;
  private _reject: ((error: any) => void) | undefined;
  private _promise: Promise<any>;

  constructor(scope: DispatcherScope, name: string, source: { context: BrowserContext, page: Page, frame: Frame }, args: any[]) {
    super(scope, {}, 'BindingCall', {
      frame: lookupDispatcher<FrameDispatcher>(source.frame),
      name,
      args: args.map(serializeResult),
    });
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  promise() {
    return this._promise;
  }

  async resolve(params: { result: SerializedArgument }) {
    this._resolve!(parseArgument(params.result));
  }

  async reject(params: { error: SerializedError }) {
    this._reject!(parseError(params.error));
  }
}
