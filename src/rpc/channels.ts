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
import * as types from '../types';

export type Binary = string;
export type BrowserContextOptions = {
  viewport?: types.Size | null,
  ignoreHTTPSErrors?: boolean,
  javaScriptEnabled?: boolean,
  bypassCSP?: boolean,
  userAgent?: string,
  locale?: string,
  timezoneId?: string,
  geolocation?: types.Geolocation,
  permissions?: string[],
  extraHTTPHeaders?: types.HeadersArray,
  offline?: boolean,
  httpCredentials?: types.Credentials,
  deviceScaleFactor?: number,
  isMobile?: boolean,
  hasTouch?: boolean,
  colorScheme?: types.ColorScheme,
  acceptDownloads?: boolean,
};

export interface Channel extends EventEmitter {
}

export interface PlaywrightChannel extends Channel {
}
export type PlaywrightInitializer = {
  chromium: BrowserTypeChannel,
  firefox: BrowserTypeChannel,
  webkit: BrowserTypeChannel,
  electron?: ElectronChannel,
  deviceDescriptors: { name: string, descriptor: types.DeviceDescriptor }[],
  selectors: SelectorsChannel,
};


export interface SelectorsChannel extends Channel {
  register(params: { name: string, source: string, options: { contentScript?: boolean } }): Promise<void>;
  createSelector(params: { name: string, handle: ElementHandleChannel }): Promise<{ value?: string }>;
}
export type SelectorsInitializer = {};


export type LaunchPersistentContextOptions = { userDataDir: string } & types.LaunchOptions & BrowserContextOptions;
export interface BrowserTypeChannel extends Channel {
  connect(params: types.ConnectOptions): Promise<{ browser: BrowserChannel }>;
  launch(params: types.LaunchOptions): Promise<{ browser: BrowserChannel }>;
  launchServer(params: types.LaunchServerOptions): Promise<{ server: BrowserServerChannel }>;
  launchPersistentContext(params: LaunchPersistentContextOptions): Promise<{ context: BrowserContextChannel }>;
}
export type BrowserTypeInitializer = {
  executablePath: string,
  name: string
};


export interface BrowserServerChannel extends Channel {
  on(event: 'close', callback: () => void): this;

  close(): Promise<void>;
  kill(): Promise<void>;
}
export type BrowserServerInitializer = {
  wsEndpoint: string,
  pid: number
};


export interface BrowserChannel extends Channel {
  on(event: 'close', callback: () => void): this;

  close(): Promise<void>;
  newContext(params: BrowserContextOptions): Promise<{ context: BrowserContextChannel }>;

  crNewBrowserCDPSession(): Promise<{ session: CDPSessionChannel }>;
  crStartTracing(params: { page?: PageChannel, path?: string, screenshots?: boolean, categories?: string[] }): Promise<void>;
  crStopTracing(): Promise<{ binary: Binary }>;
}
export type BrowserInitializer = {};


export interface BrowserContextChannel extends Channel {
  on(event: 'bindingCall', callback: (params: { binding: BindingCallChannel }) => void): this;
  on(event: 'close', callback: () => void): this;
  on(event: 'page', callback: (params: { page: PageChannel }) => void): this;
  on(event: 'route', callback: (params: { route: RouteChannel, request: RequestChannel }) => void): this;

  addCookies(params: { cookies: types.SetNetworkCookieParam[] }): Promise<void>;
  addInitScript(params: { source: string }): Promise<void>;
  clearCookies(): Promise<void>;
  clearPermissions(): Promise<void>;
  close(): Promise<void>;
  cookies(params: { urls: string[] }): Promise<{ cookies: types.NetworkCookie[] }>;
  exposeBinding(params: { name: string }): Promise<void>;
  grantPermissions(params: { permissions: string[], origin?: string }): Promise<void>;
  newPage(): Promise<{ page: PageChannel }>;
  setDefaultNavigationTimeoutNoReply(params: { timeout: number }): void;
  setDefaultTimeoutNoReply(params: { timeout: number }): void;
  setExtraHTTPHeaders(params: { headers: types.HeadersArray }): Promise<void>;
  setGeolocation(params: { geolocation: types.Geolocation | null }): Promise<void>;
  setHTTPCredentials(params: { httpCredentials: types.Credentials | null }): Promise<void>;
  setNetworkInterceptionEnabled(params: { enabled: boolean }): Promise<void>;
  setOffline(params: { offline: boolean }): Promise<void>;

  on(event: 'crBackgroundPage', callback: (params: { page: PageChannel }) => void): this;
  on(event: 'crServiceWorker', callback: (params: { worker: WorkerChannel }) => void): this;
  crNewCDPSession(params: { page: PageChannel }): Promise<{ session: CDPSessionChannel }>;
}
export type BrowserContextInitializer = {};


export interface PageChannel extends Channel {
  on(event: 'bindingCall', callback: (params: { binding: BindingCallChannel }) => void): this;
  on(event: 'close', callback: () => void): this;
  on(event: 'console', callback: (params: { message: ConsoleMessageChannel }) => void): this;
  on(event: 'crash', callback: () => void): this;
  on(event: 'dialog', callback: (params: { dialog: DialogChannel }) => void): this;
  on(event: 'download', callback: (params: { download: DownloadChannel }) => void): this;
  on(event: 'domcontentloaded', callback: () => void): this;
  on(event: 'fileChooser', callback: (params: { element: ElementHandleChannel, isMultiple: boolean }) => void): this;
  on(event: 'frameAttached', callback: (params: { frame: FrameChannel }) => void): this;
  on(event: 'frameDetached', callback: (params: { frame: FrameChannel }) => void): this;
  on(event: 'load', callback: () => void): this;
  on(event: 'pageError', callback: (params: { error: types.Error }) => void): this;
  on(event: 'popup', callback: (params: { page: PageChannel }) => void): this;
  on(event: 'request', callback: (params: { request: RequestChannel }) => void): this;
  on(event: 'requestFailed', callback: (params: { request: RequestChannel, failureText: string | null }) => void): this;
  on(event: 'requestFinished', callback: (params: { request: RequestChannel }) => void): this;
  on(event: 'response', callback: (params: { response: ResponseChannel }) => void): this;
  on(event: 'route', callback: (params: { route: RouteChannel, request: RequestChannel }) => void): this;
  on(event: 'worker', callback: (params: { worker: WorkerChannel }) => void): this;

  setDefaultNavigationTimeoutNoReply(params: { timeout: number }): void;
  setDefaultTimeoutNoReply(params: { timeout: number }): Promise<void>;
  setFileChooserInterceptedNoReply(params: { intercepted: boolean }): Promise<void>;

  addInitScript(params: { source: string }): Promise<void>;
  close(params: { runBeforeUnload?: boolean }): Promise<void>;
  emulateMedia(params: { media?: 'screen' | 'print', colorScheme?: 'dark' | 'light' | 'no-preference' }): Promise<void>;
  exposeBinding(params: { name: string }): Promise<void>;
  goBack(params: types.NavigateOptions): Promise<{ response: ResponseChannel | null }>;
  goForward(params: types.NavigateOptions): Promise<{ response: ResponseChannel | null }>;
  opener(): Promise<{ page: PageChannel | null }>;
  reload(params: types.NavigateOptions): Promise<{ response: ResponseChannel | null }>;
  screenshot(params: types.ScreenshotOptions): Promise<{ binary: Binary }>;
  setExtraHTTPHeaders(params: { headers: types.HeadersArray }): Promise<void>;
  setNetworkInterceptionEnabled(params: { enabled: boolean }): Promise<void>;
  setViewportSize(params: { viewportSize: types.Size }): Promise<void>;

  // Input
  keyboardDown(params: { key: string }): Promise<void>;
  keyboardUp(params: { key: string }): Promise<void>;
  keyboardInsertText(params: { text: string }): Promise<void>;
  keyboardType(params: { text: string, delay?: number }): Promise<void>;
  keyboardPress(params: { key: string, delay?: number }): Promise<void>;
  mouseMove(params: { x: number, y: number, steps?: number }): Promise<void>;
  mouseDown(params: { button?: types.MouseButton, clickCount?: number }): Promise<void>;
  mouseUp(params: { button?: types.MouseButton, clickCount?: number }): Promise<void>;
  mouseClick(params: { x: number, y: number, delay?: number, button?: types.MouseButton, clickCount?: number }): Promise<void>;

  accessibilitySnapshot(params: { interestingOnly?: boolean, root?: ElementHandleChannel }): Promise<{ rootAXNode: types.SerializedAXNode | null }>;
  pdf: (params: PDFOptions) => Promise<{ pdf: Binary }>;

  crStartJSCoverage(params: types.JSCoverageOptions): Promise<void>;
  crStopJSCoverage(): Promise<{ entries: types.JSCoverageEntry[] }>;
  crStartCSSCoverage(params: types.CSSCoverageOptions): Promise<void>;
  crStopCSSCoverage(): Promise<{ entries: types.CSSCoverageEntry[] }>;
}

export type PageInitializer = {
  mainFrame: FrameChannel,
  viewportSize: types.Size | null,
  isClosed: boolean
};

export type FrameNavigatedEvent = { url: string, name: string, newDocument?: { request?: RequestChannel }, error?: string };

export interface FrameChannel extends Channel {
  on(event: 'loadstate', callback: (params: { add?: types.LifecycleEvent, remove?: types.LifecycleEvent }) => void): this;
  on(event: 'navigated', callback: (params: FrameNavigatedEvent) => void): this;

  evalOnSelector(params: { selector: string; expression: string, isFunction: boolean, arg: any}): Promise<{ value: any }>;
  evalOnSelectorAll(params: { selector: string; expression: string, isFunction: boolean, arg: any}): Promise<{ value: any }>;
  addScriptTag(params: { url?: string, content?: string, type?: string }): Promise<{ element: ElementHandleChannel }>;
  addStyleTag(params: { url?: string, content?: string }): Promise<{ element: ElementHandleChannel }>;
  check(params: { selector: string, force?: boolean, noWaitAfter?: boolean } & types.TimeoutOptions): Promise<void>;
  click(params: { selector: string, force?: boolean, noWaitAfter?: boolean } & types.PointerActionOptions & types.MouseClickOptions & types.TimeoutOptions): Promise<void>;
  content(): Promise<{ value: string }>;
  dblclick(params: { selector: string, force?: boolean } & types.PointerActionOptions & types.MouseMultiClickOptions & types.TimeoutOptions): Promise<void>;
  dispatchEvent(params: { selector: string, type: string, eventInit: any } & types.TimeoutOptions): Promise<void>;
  evaluateExpression(params: { expression: string, isFunction: boolean, arg: any}): Promise<{ value: any }>;
  evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: any}): Promise<{ handle: JSHandleChannel }>;
  fill(params: { selector: string, value: string } & types.NavigatingActionWaitOptions): Promise<void>;
  focus(params: { selector: string } & types.TimeoutOptions): Promise<void>;
  frameElement(): Promise<{ element: ElementHandleChannel }>;
  getAttribute(params: { selector: string, name: string } & types.TimeoutOptions): Promise<{ value: string | null }>;
  goto(params: { url: string } & types.GotoOptions): Promise<{ response: ResponseChannel | null }>;
  hover(params: { selector: string, force?: boolean } & types.PointerActionOptions & types.TimeoutOptions): Promise<void>;
  innerHTML(params: { selector: string } & types.TimeoutOptions): Promise<{ value: string }>;
  innerText(params: { selector: string } & types.TimeoutOptions): Promise<{ value: string }>;
  press(params: { selector: string, key: string, delay?: number, noWaitAfter?: boolean } & types.TimeoutOptions): Promise<void>;
  querySelector(params: { selector: string}): Promise<{ element: ElementHandleChannel | null }>;
  querySelectorAll(params: { selector: string}): Promise<{ elements: ElementHandleChannel[] }>;
  selectOption(params: { selector: string, elements?: ElementHandleChannel[], options?: types.SelectOption[] } & types.NavigatingActionWaitOptions): Promise<{ values: string[] }>;
  setContent(params: { html: string } & types.NavigateOptions): Promise<void>;
  setInputFiles(params: { selector: string, files: { name: string, mimeType: string, buffer: Binary }[] } & types.NavigatingActionWaitOptions): Promise<void>;
  textContent(params: { selector: string } & types.TimeoutOptions): Promise<{ value: string | null }>;
  title(): Promise<{ value: string }>;
  type(params: { selector: string, text: string, delay?: number, noWaitAfter?: boolean } & types.TimeoutOptions): Promise<void>;
  uncheck(params: { selector: string, force?: boolean, noWaitAfter?: boolean } & types.TimeoutOptions): Promise<void>;
  waitForFunction(params: { expression: string, isFunction: boolean, arg: any } & types.WaitForFunctionOptions): Promise<{ handle: JSHandleChannel }>;
  waitForSelector(params: { selector: string } & types.WaitForElementOptions): Promise<{ element: ElementHandleChannel | null }>;
}
export type FrameInitializer = {
  url: string,
  name: string,
  parentFrame: FrameChannel | null,
  loadStates: types.LifecycleEvent[],
};


export interface WorkerChannel extends Channel {
  evaluateExpression(params: { expression: string, isFunction: boolean, arg: any }): Promise<{ value: any }>;
  evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: any }): Promise<{ handle: JSHandleChannel }>;
}
export type WorkerInitializer = {
  url: string,
};


export interface JSHandleChannel extends Channel {
  on(event: 'previewUpdated', callback: (params: { preview: string }) => void): this;

  dispose(): Promise<void>;
  evaluateExpression(params: { expression: string, isFunction: boolean, arg: any }): Promise<{ value: any }>;
  evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: any}): Promise<{ handle: JSHandleChannel }>;
  getPropertyList(): Promise<{ properties: { name: string, value: JSHandleChannel}[] }>;
  getProperty(params: { name: string }): Promise<{ handle: JSHandleChannel }>;
  jsonValue(): Promise<{ value: any }>;
}
export type JSHandleInitializer = {
  preview: string,
};


export interface ElementHandleChannel extends JSHandleChannel {
  evalOnSelector(params: { selector: string; expression: string, isFunction: boolean, arg: any }): Promise<{ value: any }>;
  evalOnSelectorAll(params: { selector: string; expression: string, isFunction: boolean, arg: any }): Promise<{ value: any }>;
  boundingBox(): Promise<{ value: types.Rect | null }>;
  check(params: { force?: boolean } & { noWaitAfter?: boolean } & types.TimeoutOptions): Promise<void>;
  click(params: { force?: boolean, noWaitAfter?: boolean } & types.PointerActionOptions & types.MouseClickOptions & types.TimeoutOptions): Promise<void>;
  contentFrame(): Promise<{ frame: FrameChannel | null }>;
  dblclick(params: { force?: boolean, noWaitAfter?: boolean } & types.PointerActionOptions & types.MouseMultiClickOptions & types.TimeoutOptions): Promise<void>;
  dispatchEvent(params: { type: string, eventInit: any }): Promise<void>;
  fill(params: { value: string } & types.NavigatingActionWaitOptions): Promise<void>;
  focus(): Promise<void>;
  getAttribute(params: { name: string }): Promise<{ value: string | null }>;
  hover(params: { force?: boolean } & types.PointerActionOptions & types.TimeoutOptions): Promise<void>;
  innerHTML(): Promise<{ value: string }>;
  innerText(): Promise<{ value: string }>;
  ownerFrame(): Promise<{ frame: FrameChannel | null }>;
  press(params: { key: string, delay?: number } & types.TimeoutOptions & { noWaitAfter?: boolean }): Promise<void>;
  querySelector(params: { selector: string }): Promise<{ element: ElementHandleChannel | null }>;
  querySelectorAll(params: { selector: string }): Promise<{ elements: ElementHandleChannel[] }>;
  screenshot(params: types.ElementScreenshotOptions): Promise<{ binary: Binary }>;
  scrollIntoViewIfNeeded(params: types.TimeoutOptions): Promise<void>;
  selectOption(params: { elements?: ElementHandleChannel[], options?: types.SelectOption[] } & types.NavigatingActionWaitOptions): Promise<{ values: string[] }>;
  selectText(params: types.TimeoutOptions): Promise<void>;
  setInputFiles(params: { files: { name: string, mimeType: string, buffer: Binary }[] } & types.NavigatingActionWaitOptions): Promise<void>;
  textContent(): Promise<{ value: string | null }>;
  type(params: { text: string, delay?: number, noWaitAfter?: boolean } & types.TimeoutOptions): Promise<void>;
  uncheck(params: { force?: boolean, noWaitAfter?: boolean } & types.TimeoutOptions): Promise<void>;
}


export interface RequestChannel extends Channel {
  response(): Promise<{ response: ResponseChannel | null }>;
}
export type RequestInitializer = {
  frame: FrameChannel,
  url: string,
  resourceType: string,
  method: string,
  postData: string | null,
  headers: types.HeadersArray,
  isNavigationRequest: boolean,
  redirectedFrom: RequestChannel | null,
};


export interface RouteChannel extends Channel {
  abort(params: { errorCode: string }): Promise<void>;
  continue(params: types.NormalizedContinueOverrides): Promise<void>;
  fulfill(params: types.NormalizedFulfillResponse): Promise<void>;
}
export type RouteInitializer = {
  request: RequestChannel,
};


export interface ResponseChannel extends Channel {
  body(): Promise<{ binary: Binary }>;
  finished(): Promise<{ error: Error | null }>;
}
export type ResponseInitializer = {
  request: RequestChannel,
  url: string,
  status: number,
  statusText: string,
  headers: types.HeadersArray,
};


export interface ConsoleMessageChannel extends Channel {
}
export type ConsoleMessageInitializer = {
  type: string,
  text: string,
  args: JSHandleChannel[],
  location: types.ConsoleMessageLocation,
};


export interface BindingCallChannel extends Channel {
  reject(params: { error: types.Error }): void;
  resolve(params: { result: any }): void;
}
export type BindingCallInitializer = {
  frame: FrameChannel,
  name: string,
  args: any[]
};


export interface DialogChannel extends Channel {
  accept(params: { promptText?: string }): Promise<void>;
  dismiss(): Promise<void>;
}
export type DialogInitializer = {
	type: string,
  message: string,
  defaultValue: string,
};


export interface DownloadChannel extends Channel {
  path(): Promise<{ value: string | null }>;
  failure(): Promise<{ error: string | null }>;
  stream(): Promise<{ stream: StreamChannel | null }>;
  delete(): Promise<void>;
}
export type DownloadInitializer = {
	url: string,
  suggestedFilename: string,
};


export interface StreamChannel extends Channel {
  read(params: { size?: number }): Promise<{ binary: Binary }>;
}
export type StreamInitializer = {
}


// Chromium-specific.
export interface CDPSessionChannel extends Channel {
  on(event: 'event', callback: (params: { method: string, params?: Object }) => void): this;
  on(event: 'disconnected', callback: () => void): this;

  send(params: { method: string, params?: Object }): Promise<{ result: Object }>;
  detach(): Promise<void>;
}
export type CDPSessionInitializer = {};

export type PDFOptions = {
  scale?: number,
  displayHeaderFooter?: boolean,
  headerTemplate?: string,
  footerTemplate?: string,
  printBackground?: boolean,
  landscape?: boolean,
  pageRanges?: string,
  format?: string,
  width?: string,
  height?: string,
  preferCSSPageSize?: boolean,
  margin?: {top?: string, bottom?: string, left?: string, right?: string},
};


export type ElectronLaunchOptions = {
  args?: string[],
  cwd?: string,
  env?: {[key: string]: string|number|boolean},
  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  timeout?: number,
};
export interface ElectronChannel extends Channel {
  launch(params: { executablePath: string } & ElectronLaunchOptions): Promise<{ electronApplication: ElectronApplicationChannel }>;
}
export type ElectronInitializer = {};


export interface ElectronApplicationChannel extends Channel {
  on(event: 'close', callback: () => void): this;
  on(event: 'window', callback: (params: { page: PageChannel, browserWindow: JSHandleChannel }) => void): this;

  newBrowserWindow(params: { arg: any }): Promise<{ page: PageChannel }>;
  evaluateExpression(params: { expression: string, isFunction: boolean, arg: any }): Promise<{ value: any }>;
  evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: any }): Promise<{ handle: JSHandleChannel }>;
  close(): Promise<void>;
}
export type ElectronApplicationInitializer = {
  context: BrowserContextChannel,
};
