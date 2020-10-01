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

import { BrowserContext, runAction } from '../server/browserContext';
import { Frame } from '../server/frames';
import { Request } from '../server/network';
import { Page, Worker } from '../server/page';
import * as channels from '../protocol/channels';
import { Dispatcher, DispatcherScope, lookupDispatcher, lookupNullableDispatcher } from './dispatcher';
import { parseError, serializeError } from '../protocol/serializers';
import { ConsoleMessageDispatcher } from './consoleMessageDispatcher';
import { DialogDispatcher } from './dialogDispatcher';
import { DownloadDispatcher } from './downloadDispatcher';
import { FrameDispatcher } from './frameDispatcher';
import { RequestDispatcher, ResponseDispatcher, RouteDispatcher } from './networkDispatchers';
import { serializeResult, parseArgument, JSHandleDispatcher } from './jsHandleDispatcher';
import { ElementHandleDispatcher, createHandle } from './elementHandlerDispatcher';
import { FileChooser } from '../server/fileChooser';
import { CRCoverage } from '../server/chromium/crCoverage';
import { JSHandle } from '../server/javascript';

export class PageDispatcher extends Dispatcher<Page, channels.PageInitializer> implements channels.PageChannel {
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
    page.on(Page.Events.Close, () => this._dispatchEvent('close'));
    page.on(Page.Events.Console, message => this._dispatchEvent('console', { message: new ConsoleMessageDispatcher(this._scope, message) }));
    page.on(Page.Events.Crash, () => this._dispatchEvent('crash'));
    page.on(Page.Events.DOMContentLoaded, () => this._dispatchEvent('domcontentloaded'));
    page.on(Page.Events.Dialog, dialog => this._dispatchEvent('dialog', { dialog: new DialogDispatcher(this._scope, dialog) }));
    page.on(Page.Events.Download, download => this._dispatchEvent('download', { download: new DownloadDispatcher(this._scope, download) }));
    this._page.on(Page.Events.FileChooser, (fileChooser: FileChooser) => this._dispatchEvent('fileChooser', {
      element: new ElementHandleDispatcher(this._scope, fileChooser.element()),
      isMultiple: fileChooser.isMultiple()
    }));
    page.on(Page.Events.FrameAttached, frame => this._onFrameAttached(frame));
    page.on(Page.Events.FrameDetached, frame => this._onFrameDetached(frame));
    page.on(Page.Events.Load, () => this._dispatchEvent('load'));
    page.on(Page.Events.PageError, error => this._dispatchEvent('pageError', { error: serializeError(error) }));
    page.on(Page.Events.Popup, page => this._dispatchEvent('popup', { page: lookupDispatcher<PageDispatcher>(page) }));
    page.on(Page.Events.Request, request => this._dispatchEvent('request', { request: RequestDispatcher.from(this._scope, request) }));
    page.on(Page.Events.RequestFailed, (request: Request) => this._dispatchEvent('requestFailed', {
      request: RequestDispatcher.from(this._scope, request),
      failureText: request._failureText
    }));
    page.on(Page.Events.RequestFinished, request => this._dispatchEvent('requestFinished', { request: RequestDispatcher.from(scope, request) }));
    page.on(Page.Events.Response, response => this._dispatchEvent('response', { response: new ResponseDispatcher(this._scope, response) }));
    page.on(Page.Events.Worker, worker => this._dispatchEvent('worker', { worker: new WorkerDispatcher(this._scope, worker) }));
  }

  async setDefaultNavigationTimeoutNoReply(params: channels.PageSetDefaultNavigationTimeoutNoReplyParams): Promise<void> {
    this._page.setDefaultNavigationTimeout(params.timeout);
  }

  async setDefaultTimeoutNoReply(params: channels.PageSetDefaultTimeoutNoReplyParams): Promise<void> {
    this._page.setDefaultTimeout(params.timeout);
  }

  async opener(): Promise<channels.PageOpenerResult> {
    return { page: lookupNullableDispatcher<PageDispatcher>(await this._page.opener()) };
  }

  async exposeBinding(params: channels.PageExposeBindingParams): Promise<void> {
    await this._page.exposeBinding(params.name, !!params.needsHandle, (source, ...args) => {
      const binding = new BindingCallDispatcher(this._scope, params.name, !!params.needsHandle, source, args);
      this._dispatchEvent('bindingCall', { binding });
      return binding.promise();
    });
  }

  async setExtraHTTPHeaders(params: channels.PageSetExtraHTTPHeadersParams): Promise<void> {
    await this._page.setExtraHTTPHeaders(params.headers);
  }

  async reload(params: channels.PageReloadParams, metadata?: channels.Metadata): Promise<channels.PageReloadResult> {
    return await runAction(async controller => {
      return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._page.reload(controller, params)) };
    }, { ...metadata, type: 'reload', page: this._page });
  }

  async goBack(params: channels.PageGoBackParams, metadata?: channels.Metadata): Promise<channels.PageGoBackResult> {
    return await runAction(async controller => {
      return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._page.goBack(controller, params)) };
    }, { ...metadata, type: 'goBack', page: this._page });
  }

  async goForward(params: channels.PageGoForwardParams, metadata?: channels.Metadata): Promise<channels.PageGoForwardResult> {
    return await runAction(async controller => {
      return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._page.goForward(controller, params)) };
    }, { ...metadata, type: 'goForward', page: this._page });
  }

  async emulateMedia(params: channels.PageEmulateMediaParams): Promise<void> {
    await this._page.emulateMedia({
      media: params.media === 'null' ? null : params.media,
      colorScheme: params.colorScheme === 'null' ? null : params.colorScheme,
    });
  }

  async setViewportSize(params: channels.PageSetViewportSizeParams): Promise<void> {
    await this._page.setViewportSize(params.viewportSize);
  }

  async addInitScript(params: channels.PageAddInitScriptParams): Promise<void> {
    await this._page._addInitScriptExpression(params.source);
  }

  async setNetworkInterceptionEnabled(params: channels.PageSetNetworkInterceptionEnabledParams): Promise<void> {
    if (!params.enabled) {
      await this._page._setRequestInterceptor(undefined);
      return;
    }
    this._page._setRequestInterceptor((route, request) => {
      this._dispatchEvent('route', { route: new RouteDispatcher(this._scope, route), request: RequestDispatcher.from(this._scope, request) });
    });
  }

  async screenshot(params: channels.PageScreenshotParams): Promise<channels.PageScreenshotResult> {
    return { binary: (await this._page.screenshot(params)).toString('base64') };
  }

  async close(params: channels.PageCloseParams): Promise<void> {
    await this._page.close(params);
  }

  async setFileChooserInterceptedNoReply(params: channels.PageSetFileChooserInterceptedNoReplyParams): Promise<void> {
    await this._page._setFileChooserIntercepted(params.intercepted);
  }

  async keyboardDown(params: channels.PageKeyboardDownParams): Promise<void> {
    await this._page.keyboard.down(params.key);
  }

  async keyboardUp(params: channels.PageKeyboardUpParams): Promise<void> {
    await this._page.keyboard.up(params.key);
  }

  async keyboardInsertText(params: channels.PageKeyboardInsertTextParams): Promise<void> {
    await this._page.keyboard.insertText(params.text);
  }

  async keyboardType(params: channels.PageKeyboardTypeParams): Promise<void> {
    await this._page.keyboard.type(params.text, params);
  }

  async keyboardPress(params: channels.PageKeyboardPressParams): Promise<void> {
    await this._page.keyboard.press(params.key, params);
  }

  async mouseMove(params: channels.PageMouseMoveParams): Promise<void> {
    await this._page.mouse.move(params.x, params.y, params);
  }

  async mouseDown(params: channels.PageMouseDownParams): Promise<void> {
    await this._page.mouse.down(params);
  }

  async mouseUp(params: channels.PageMouseUpParams): Promise<void> {
    await this._page.mouse.up(params);
  }

  async mouseClick(params: channels.PageMouseClickParams): Promise<void> {
    await this._page.mouse.click(params.x, params.y, params);
  }

  async accessibilitySnapshot(params: channels.PageAccessibilitySnapshotParams): Promise<channels.PageAccessibilitySnapshotResult> {
    const rootAXNode = await this._page.accessibility.snapshot({
      interestingOnly: params.interestingOnly,
      root: params.root ? (params.root as ElementHandleDispatcher)._elementHandle : undefined
    });
    return { rootAXNode: rootAXNode || undefined };
  }

  async pdf(params: channels.PagePdfParams): Promise<channels.PagePdfResult> {
    if (!this._page.pdf)
      throw new Error('PDF generation is only supported for Headless Chromium');
    const buffer = await this._page.pdf(params);
    return { pdf: buffer.toString('base64') };
  }

  async bringToFront(): Promise<void> {
    await this._page.bringToFront();
  }

  async crStartJSCoverage(params: channels.PageCrStartJSCoverageParams): Promise<void> {
    const coverage = this._page.coverage as CRCoverage;
    await coverage.startJSCoverage(params);
  }

  async crStopJSCoverage(): Promise<channels.PageCrStopJSCoverageResult> {
    const coverage = this._page.coverage as CRCoverage;
    return { entries: await coverage.stopJSCoverage() };
  }

  async crStartCSSCoverage(params: channels.PageCrStartCSSCoverageParams): Promise<void> {
    const coverage = this._page.coverage as CRCoverage;
    await coverage.startCSSCoverage(params);
  }

  async crStopCSSCoverage(): Promise<channels.PageCrStopCSSCoverageResult> {
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


export class WorkerDispatcher extends Dispatcher<Worker, channels.WorkerInitializer> implements channels.WorkerChannel {
  constructor(scope: DispatcherScope, worker: Worker) {
    super(scope, worker, 'Worker', {
      url: worker.url()
    });
    worker.on(Worker.Events.Close, () => this._dispatchEvent('close'));
  }

  async evaluateExpression(params: channels.WorkerEvaluateExpressionParams): Promise<channels.WorkerEvaluateExpressionResult> {
    return { value: serializeResult(await this._object._evaluateExpression(params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evaluateExpressionHandle(params: channels.WorkerEvaluateExpressionHandleParams): Promise<channels.WorkerEvaluateExpressionHandleResult> {
    return { handle: createHandle(this._scope, await this._object._evaluateExpressionHandle(params.expression, params.isFunction, parseArgument(params.arg))) };
  }
}

export class BindingCallDispatcher extends Dispatcher<{}, channels.BindingCallInitializer> implements channels.BindingCallChannel {
  private _resolve: ((arg: any) => void) | undefined;
  private _reject: ((error: any) => void) | undefined;
  private _promise: Promise<any>;

  constructor(scope: DispatcherScope, name: string, needsHandle: boolean, source: { context: BrowserContext, page: Page, frame: Frame }, args: any[]) {
    super(scope, {}, 'BindingCall', {
      frame: lookupDispatcher<FrameDispatcher>(source.frame),
      name,
      args: needsHandle ? undefined : args.map(serializeResult),
      handle: needsHandle ? new JSHandleDispatcher(scope, args[0] as JSHandle) : undefined,
    });
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  promise() {
    return this._promise;
  }

  async resolve(params: channels.BindingCallResolveParams): Promise<void> {
    this._resolve!(parseArgument(params.result));
  }

  async reject(params: channels.BindingCallRejectParams): Promise<void> {
    this._reject!(parseError(params.error));
  }
}
