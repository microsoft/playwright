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
import { Page, Worker } from '../page';
import type * as channels from '../../protocol/channels';
import type { DispatcherScope } from './dispatcher';
import { Dispatcher, existingDispatcher, lookupDispatcher, lookupNullableDispatcher } from './dispatcher';
import { parseError, serializeError } from '../../protocol/serializers';
import { ConsoleMessageDispatcher } from './consoleMessageDispatcher';
import { DialogDispatcher } from './dialogDispatcher';
import { FrameDispatcher } from './frameDispatcher';
import type { ResponseDispatcher } from './networkDispatchers';
import { RequestDispatcher, RouteDispatcher, WebSocketDispatcher } from './networkDispatchers';
import { serializeResult, parseArgument } from './jsHandleDispatcher';
import { ElementHandleDispatcher } from './elementHandlerDispatcher';
import type { FileChooser } from '../fileChooser';
import type { CRCoverage } from '../chromium/crCoverage';
import type { JSHandle } from '../javascript';
import type { CallMetadata } from '../instrumentation';
import type { Artifact } from '../artifact';
import { ArtifactDispatcher } from './artifactDispatcher';
import type { Download } from '../download';
import { createGuid } from '../../utils';

export class PageDispatcher extends Dispatcher<Page, channels.PageChannel> implements channels.PageChannel {
  _type_EventTarget = true;
  _type_Page = true;
  private _page: Page;

  static fromNullable(scope: DispatcherScope, page: Page | undefined): PageDispatcher | undefined {
    if (!page)
      return undefined;
    const result = existingDispatcher<PageDispatcher>(page);
    return result || new PageDispatcher(scope, page);
  }

  constructor(scope: DispatcherScope, page: Page) {
    // TODO: theoretically, there could be more than one frame already.
    // If we split pageCreated and pageReady, there should be no main frame during pageCreated.
    super(scope, page, 'Page', {
      mainFrame: FrameDispatcher.from(scope, page.mainFrame()),
      viewportSize: page.viewportSize() || undefined,
      isClosed: page.isClosed(),
      opener: PageDispatcher.fromNullable(scope, page.opener())
    }, true);
    this._page = page;
    page.on(Page.Events.Close, () => {
      this._dispatchEvent('close');
      this._dispose();
    });
    page.on(Page.Events.Console, message => this._dispatchEvent('console', { message: new ConsoleMessageDispatcher(this._scope, message) }));
    page.on(Page.Events.Crash, () => this._dispatchEvent('crash'));
    page.on(Page.Events.DOMContentLoaded, () => this._dispatchEvent('domcontentloaded'));
    page.on(Page.Events.Dialog, dialog => this._dispatchEvent('dialog', { dialog: new DialogDispatcher(this._scope, dialog) }));
    page.on(Page.Events.Download, (download: Download) => {
      this._dispatchEvent('download', { url: download.url, suggestedFilename: download.suggestedFilename(), artifact: new ArtifactDispatcher(scope, download.artifact) });
    });
    this._page.on(Page.Events.FileChooser, (fileChooser: FileChooser) => this._dispatchEvent('fileChooser', {
      element: ElementHandleDispatcher.from(this._scope, fileChooser.element()),
      isMultiple: fileChooser.isMultiple()
    }));
    page.on(Page.Events.FrameAttached, frame => this._onFrameAttached(frame));
    page.on(Page.Events.FrameDetached, frame => this._onFrameDetached(frame));
    page.on(Page.Events.Load, () => this._dispatchEvent('load'));
    page.on(Page.Events.PageError, error => this._dispatchEvent('pageError', { error: serializeError(error) }));
    page.on(Page.Events.WebSocket, webSocket => this._dispatchEvent('webSocket', { webSocket: new WebSocketDispatcher(this._scope, webSocket) }));
    page.on(Page.Events.Worker, worker => this._dispatchEvent('worker', { worker: new WorkerDispatcher(this._scope, worker) }));
    page.on(Page.Events.Video, (artifact: Artifact) => this._dispatchEvent('video', { artifact: existingDispatcher<ArtifactDispatcher>(artifact) }));
    if (page._video)
      this._dispatchEvent('video', { artifact: existingDispatcher<ArtifactDispatcher>(page._video) });
    // Ensure client knows about all frames.
    const frames = page._frameManager.frames();
    for (let i = 1; i < frames.length; i++)
      this._onFrameAttached(frames[i]);
  }

  page(): Page {
    return this._page;
  }

  async setDefaultNavigationTimeoutNoReply(params: channels.PageSetDefaultNavigationTimeoutNoReplyParams, metadata: CallMetadata): Promise<void> {
    this._page.setDefaultNavigationTimeout(params.timeout);
  }

  async setDefaultTimeoutNoReply(params: channels.PageSetDefaultTimeoutNoReplyParams, metadata: CallMetadata): Promise<void> {
    this._page.setDefaultTimeout(params.timeout);
  }

  async exposeBinding(params: channels.PageExposeBindingParams, metadata: CallMetadata): Promise<void> {
    await this._page.exposeBinding(params.name, !!params.needsHandle, (source, ...args) => {
      const binding = new BindingCallDispatcher(this._scope, params.name, !!params.needsHandle, source, args);
      this._dispatchEvent('bindingCall', { binding });
      return binding.promise();
    });
  }

  async removeExposedBindings() {
    await this._page.removeExposedBindings();
  }

  async setExtraHTTPHeaders(params: channels.PageSetExtraHTTPHeadersParams, metadata: CallMetadata): Promise<void> {
    await this._page.setExtraHTTPHeaders(params.headers);
  }

  async reload(params: channels.PageReloadParams, metadata: CallMetadata): Promise<channels.PageReloadResult> {
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._page.reload(metadata, params)) };
  }

  async goBack(params: channels.PageGoBackParams, metadata: CallMetadata): Promise<channels.PageGoBackResult> {
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._page.goBack(metadata, params)) };
  }

  async goForward(params: channels.PageGoForwardParams, metadata: CallMetadata): Promise<channels.PageGoForwardResult> {
    return { response: lookupNullableDispatcher<ResponseDispatcher>(await this._page.goForward(metadata, params)) };
  }

  async emulateMedia(params: channels.PageEmulateMediaParams, metadata: CallMetadata): Promise<void> {
    await this._page.emulateMedia({
      media: params.media === 'null' ? null : params.media,
      colorScheme: params.colorScheme === 'null' ? null : params.colorScheme,
      reducedMotion: params.reducedMotion === 'null' ? null : params.reducedMotion,
      forcedColors: params.forcedColors === 'null' ? null : params.forcedColors,
    });
  }

  async setViewportSize(params: channels.PageSetViewportSizeParams, metadata: CallMetadata): Promise<void> {
    await this._page.setViewportSize(params.viewportSize);
  }

  async addInitScript(params: channels.PageAddInitScriptParams, metadata: CallMetadata): Promise<void> {
    await this._page.addInitScript(params.source);
  }

  async removeInitScripts(): Promise<void> {
    await this._page.removeInitScripts();
  }

  async setNetworkInterceptionEnabled(params: channels.PageSetNetworkInterceptionEnabledParams, metadata: CallMetadata): Promise<void> {
    if (!params.enabled) {
      await this._page.setClientRequestInterceptor(undefined);
      return;
    }
    await this._page.setClientRequestInterceptor((route, request) => {
      this._dispatchEvent('route', { route: RouteDispatcher.from(this._scope, route), request: RequestDispatcher.from(this._scope, request) });
    });
  }

  async expectScreenshot(params: channels.PageExpectScreenshotParams, metadata: CallMetadata): Promise<channels.PageExpectScreenshotResult> {
    const mask: { frame: Frame, selector: string }[] = (params.screenshotOptions?.mask || []).map(({ frame, selector }) => ({
      frame: (frame as FrameDispatcher)._object,
      selector,
    }));
    const locator: { frame: Frame, selector: string } | undefined = params.locator ? {
      frame: (params.locator.frame as FrameDispatcher)._object,
      selector: params.locator.selector,
    } : undefined;
    const expected = params.expected ? Buffer.from(params.expected, 'base64') : undefined;
    const result = await this._page.expectScreenshot(metadata, {
      ...params,
      expected,
      locator,
      screenshotOptions: {
        ...params.screenshotOptions,
        mask,
      },
    });
    return {
      diff: result.diff?.toString('base64'),
      errorMessage: result.errorMessage,
      actual: result.actual?.toString('base64'),
      previous: result.previous?.toString('base64'),
      log: result.log,
    };
  }

  async screenshot(params: channels.PageScreenshotParams, metadata: CallMetadata): Promise<channels.PageScreenshotResult> {
    const mask: { frame: Frame, selector: string }[] = (params.mask || []).map(({ frame, selector }) => ({
      frame: (frame as FrameDispatcher)._object,
      selector,
    }));
    return { binary: (await this._page.screenshot(metadata, { ...params, mask })).toString('base64') };
  }

  async close(params: channels.PageCloseParams, metadata: CallMetadata): Promise<void> {
    await this._page.close(metadata, params);
  }

  async setFileChooserInterceptedNoReply(params: channels.PageSetFileChooserInterceptedNoReplyParams, metadata: CallMetadata): Promise<void> {
    await this._page.setFileChooserIntercepted(params.intercepted);
  }

  async keyboardDown(params: channels.PageKeyboardDownParams, metadata: CallMetadata): Promise<void> {
    await this._page.keyboard.down(params.key);
  }

  async keyboardUp(params: channels.PageKeyboardUpParams, metadata: CallMetadata): Promise<void> {
    await this._page.keyboard.up(params.key);
  }

  async keyboardImeSetComposition(params: channels.PageKeyboardImeSetCompositionParams, metadata: CallMetadata): Promise<void> {
    await this._page.keyboard.imeSetComposition(params.text, params.selectionStart, params.selectionEnd, params);
  }

  async keyboardInsertText(params: channels.PageKeyboardInsertTextParams, metadata: CallMetadata): Promise<void> {
    await this._page.keyboard.insertText(params.text);
  }

  async keyboardType(params: channels.PageKeyboardTypeParams, metadata: CallMetadata): Promise<void> {
    await this._page.keyboard.type(params.text, params);
  }

  async keyboardPress(params: channels.PageKeyboardPressParams, metadata: CallMetadata): Promise<void> {
    await this._page.keyboard.press(params.key, params);
  }

  async mouseMove(params: channels.PageMouseMoveParams, metadata: CallMetadata): Promise<void> {
    await this._page.mouse.move(params.x, params.y, params);
  }

  async mouseDown(params: channels.PageMouseDownParams, metadata: CallMetadata): Promise<void> {
    await this._page.mouse.down(params);
  }

  async mouseUp(params: channels.PageMouseUpParams, metadata: CallMetadata): Promise<void> {
    await this._page.mouse.up(params);
  }

  async mouseClick(params: channels.PageMouseClickParams, metadata: CallMetadata): Promise<void> {
    await this._page.mouse.click(params.x, params.y, params);
  }

  async mouseWheel(params: channels.PageMouseWheelParams, metadata: CallMetadata): Promise<void> {
    await this._page.mouse.wheel(params.deltaX, params.deltaY);
  }

  async touchscreenTap(params: channels.PageTouchscreenTapParams, metadata: CallMetadata): Promise<void> {
    await this._page.touchscreen.tap(params.x, params.y);
  }

  async accessibilitySnapshot(params: channels.PageAccessibilitySnapshotParams, metadata: CallMetadata): Promise<channels.PageAccessibilitySnapshotResult> {
    const rootAXNode = await this._page.accessibility.snapshot({
      interestingOnly: params.interestingOnly,
      root: params.root ? (params.root as ElementHandleDispatcher)._elementHandle : undefined
    });
    return { rootAXNode: rootAXNode || undefined };
  }

  async pdf(params: channels.PagePdfParams, metadata: CallMetadata): Promise<channels.PagePdfResult> {
    if (!this._page.pdf)
      throw new Error('PDF generation is only supported for Headless Chromium');
    const buffer = await this._page.pdf(params);
    return { pdf: buffer.toString('base64') };
  }

  async bringToFront(params: channels.PageBringToFrontParams, metadata: CallMetadata): Promise<void> {
    await this._page.bringToFront();
  }

  async startJSCoverage(params: channels.PageStartJSCoverageParams, metadata: CallMetadata): Promise<void> {
    const coverage = this._page.coverage as CRCoverage;
    await coverage.startJSCoverage(params);
  }

  async stopJSCoverage(params: channels.PageStopJSCoverageParams, metadata: CallMetadata): Promise<channels.PageStopJSCoverageResult> {
    const coverage = this._page.coverage as CRCoverage;
    return { entries: await coverage.stopJSCoverage() };
  }

  async startCSSCoverage(params: channels.PageStartCSSCoverageParams, metadata: CallMetadata): Promise<void> {
    const coverage = this._page.coverage as CRCoverage;
    await coverage.startCSSCoverage(params);
  }

  async stopCSSCoverage(params: channels.PageStopCSSCoverageParams, metadata: CallMetadata): Promise<channels.PageStopCSSCoverageResult> {
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


export class WorkerDispatcher extends Dispatcher<Worker, channels.WorkerChannel> implements channels.WorkerChannel {
  _type_Worker = true;
  constructor(scope: DispatcherScope, worker: Worker) {
    super(scope, worker, 'Worker', {
      url: worker.url()
    });
    worker.on(Worker.Events.Close, () => this._dispatchEvent('close'));
  }

  async evaluateExpression(params: channels.WorkerEvaluateExpressionParams, metadata: CallMetadata): Promise<channels.WorkerEvaluateExpressionResult> {
    return { value: serializeResult(await this._object.evaluateExpression(params.expression, params.isFunction, parseArgument(params.arg))) };
  }

  async evaluateExpressionHandle(params: channels.WorkerEvaluateExpressionHandleParams, metadata: CallMetadata): Promise<channels.WorkerEvaluateExpressionHandleResult> {
    return { handle: ElementHandleDispatcher.fromJSHandle(this._scope, await this._object.evaluateExpressionHandle(params.expression, params.isFunction, parseArgument(params.arg))) };
  }
}

export class BindingCallDispatcher extends Dispatcher<{ guid: string }, channels.BindingCallChannel> implements channels.BindingCallChannel {
  _type_BindingCall = true;
  private _resolve: ((arg: any) => void) | undefined;
  private _reject: ((error: any) => void) | undefined;
  private _promise: Promise<any>;

  constructor(scope: DispatcherScope, name: string, needsHandle: boolean, source: { context: BrowserContext, page: Page, frame: Frame }, args: any[]) {
    super(scope, { guid: 'bindingCall@' + createGuid() }, 'BindingCall', {
      frame: lookupDispatcher<FrameDispatcher>(source.frame),
      name,
      args: needsHandle ? undefined : args.map(serializeResult),
      handle: needsHandle ? ElementHandleDispatcher.fromJSHandle(scope, args[0] as JSHandle) : undefined,
    });
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  promise() {
    return this._promise;
  }

  async resolve(params: channels.BindingCallResolveParams, metadata: CallMetadata): Promise<void> {
    this._resolve!(parseArgument(params.result));
  }

  async reject(params: channels.BindingCallRejectParams, metadata: CallMetadata): Promise<void> {
    this._reject!(parseError(params.error));
  }
}
