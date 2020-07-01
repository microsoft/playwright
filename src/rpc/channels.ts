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

export interface Channel extends EventEmitter {
}


export interface BrowserTypeChannel extends Channel {
  connect(params: { options: types.ConnectOptions }): Promise<BrowserChannel>;
  launch(params: { options?: types.LaunchOptions }): Promise<BrowserChannel>;
  launchServer(params: { options?: types.LaunchServerOptions }): Promise<BrowserServerChannel>;
  launchPersistentContext(params: { userDataDir: string, options?: types.LaunchOptions & types.BrowserContextOptions }): Promise<BrowserContextChannel>;
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
  newContext(params: { options?: types.BrowserContextOptions }): Promise<BrowserContextChannel>;
}
export type BrowserInitializer = {};


export interface BrowserContextChannel extends Channel {
  on(event: 'bindingCall', callback: (params: BindingCallChannel) => void): this;
  on(event: 'close', callback: () => void): this;
  on(event: 'page', callback: (params: PageChannel) => void): this;
  on(event: 'route', callback: (params: { route: RouteChannel, request: RequestChannel }) => void): this;

  addCookies(params: { cookies: types.SetNetworkCookieParam[] }): Promise<void>;
  addInitScript(params: { source: string }): Promise<void>;
  clearCookies(): Promise<void>;
  clearPermissions(): Promise<void>;
  close(): Promise<void>;
  cookies(params: { urls: string[] }): Promise<types.NetworkCookie[]>;
  exposeBinding(params: { name: string }): Promise<void>;
  grantPermissions(params: { permissions: string[]; options?: { origin?: string } }): Promise<void>;
  newPage(): Promise<PageChannel>;
  setDefaultNavigationTimeoutNoReply(params: { timeout: number }): void;
  setDefaultTimeoutNoReply(params: { timeout: number }): void;
  setExtraHTTPHeaders(params: { headers: types.Headers }): Promise<void>;
  setGeolocation(params: { geolocation: types.Geolocation | null }): Promise<void>;
  setHTTPCredentials(params: { httpCredentials: types.Credentials | null }): Promise<void>;
  setNetworkInterceptionEnabled(params: { enabled: boolean }): Promise<void>;
  setOffline(params: { offline: boolean }): Promise<void>;
  waitForEvent(params: { event: string }): Promise<any>;
}
export type BrowserContextInitializer = {
  pages: PageChannel[]
};


export interface PageChannel extends Channel {
  on(event: 'bindingCall', callback: (params: BindingCallChannel) => void): this;
  on(event: 'close', callback: () => void): this;
  on(event: 'console', callback: (params: ConsoleMessageChannel) => void): this;
  on(event: 'crash', callback: () => void): this;
  on(event: 'dialog', callback: (params: DialogChannel) => void): this;
  on(event: 'download', callback: (params: DownloadChannel) => void): this;
  on(event: 'domcontentloaded', callback: () => void): this;
  on(event: 'fileChooser', callback: (params: { element: ElementHandleChannel, isMultiple: boolean }) => void): this;
  on(event: 'frameAttached', callback: (params: FrameChannel) => void): this;
  on(event: 'frameDetached', callback: (params: FrameChannel) => void): this;
  on(event: 'frameNavigated', callback: (params: { frame: FrameChannel, url: string, name: string }) => void): this;
  on(event: 'frameNavigated', callback: (params: { frame: FrameChannel, url: string, name: string }) => void): this;
  on(event: 'load', callback: () => void): this;
  on(event: 'pageError', callback: (params: { error: types.Error }) => void): this;
  on(event: 'popup', callback: (params: PageChannel) => void): this;
  on(event: 'request', callback: (params: RequestChannel) => void): this;
  on(event: 'requestFailed', callback: (params: { request: RequestChannel, failureText: string | null }) => void): this;
  on(event: 'requestFinished', callback: (params: RequestChannel) => void): this;
  on(event: 'response', callback: (params: ResponseChannel) => void): this;
  on(event: 'route', callback: (params: { route: RouteChannel, request: RequestChannel }) => void): this;
  on(event: 'worker', callback: (params: WorkerChannel) => void): this;

  setDefaultNavigationTimeoutNoReply(params: { timeout: number }): void;
  setDefaultTimeoutNoReply(params: { timeout: number }): Promise<void>;
  setFileChooserInterceptedNoReply(params: { intercepted: boolean }): Promise<void>;

  addInitScript(params: { source: string }): Promise<void>;
  close(params: { options?: { runBeforeUnload?: boolean } }): Promise<void>;
  emulateMedia(params: { options: { media?: 'screen' | 'print', colorScheme?: 'dark' | 'light' | 'no-preference' } }): Promise<void>;
  exposeBinding(params: { name: string }): Promise<void>;
  goBack(params: { options?: types.NavigateOptions }): Promise<ResponseChannel | null>;
  goForward(params: { options?: types.NavigateOptions }): Promise<ResponseChannel | null>;
  opener(): Promise<PageChannel | null>;
  reload(params: { options?: types.NavigateOptions }): Promise<ResponseChannel | null>;
  screenshot(params: { options?: types.ScreenshotOptions }): Promise<Binary>;
  setExtraHTTPHeaders(params: { headers: types.Headers }): Promise<void>;
  setNetworkInterceptionEnabled(params: { enabled: boolean }): Promise<void>;
  setViewportSize(params: { viewportSize: types.Size }): Promise<void>;

  // Input
  keyboardDown(params: { key: string }): Promise<void>;
  keyboardUp(params: { key: string }): Promise<void>;
  keyboardInsertText(params: { text: string }): Promise<void>;
  keyboardType(params: { text: string, options?: { delay?: number } }): Promise<void>;
  keyboardPress(params: { key: string, options?: { delay?: number } }): Promise<void>;
  mouseMove(params: { x: number, y: number, options?: { steps?: number } }): Promise<void>;
  mouseDown(params: { options?: { button?: types.MouseButton, clickCount?: number } }): Promise<void>;
  mouseUp(params: { options?: { button?: types.MouseButton, clickCount?: number } }): Promise<void>;
  mouseClick(params: { x: number, y: number, options?: { delay?: number, button?: types.MouseButton, clickCount?: number } }): Promise<void>;

  // A11Y
  accessibilitySnapshot(params: { options: { interestingOnly?: boolean, root?: ElementHandleChannel } }): Promise<types.SerializedAXNode | null>;
  pdf: (params: { options?: types.PDFOptions }) => Promise<Binary>;
}

export type PageInitializer = {
  mainFrame: FrameChannel,
  viewportSize: types.Size | null
};


export interface FrameChannel extends Channel {
  $$eval(params: { selector: string; expression: string, isFunction: boolean, arg: any, isPage?: boolean }): Promise<any>;
  $eval(params: { selector: string; expression: string, isFunction: boolean, arg: any, isPage?: boolean }): Promise<any>;
  addScriptTag(params: { options: { url?: string | undefined, path?: string | undefined, content?: string | undefined, type?: string | undefined }, isPage?: boolean }): Promise<ElementHandleChannel>;
  addStyleTag(params: { options: { url?: string | undefined, path?: string | undefined, content?: string | undefined }, isPage?: boolean }): Promise<ElementHandleChannel>;
  check(params: { selector: string, options: types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean }, isPage?: boolean }): Promise<void>;
  click(params: { selector: string, options: types.PointerActionOptions & types.MouseClickOptions & types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean }, isPage?: boolean }): Promise<void>;
  content(): Promise<string>;
  dblclick(params: { selector: string, options: types.PointerActionOptions & types.MouseMultiClickOptions & types.TimeoutOptions & { force?: boolean }, isPage?: boolean}): Promise<void>;
  dispatchEvent(params: { selector: string, type: string, eventInit: any, options: types.TimeoutOptions, isPage?: boolean }): Promise<void>;
  evaluateExpression(params: { expression: string, isFunction: boolean, arg: any, isPage?: boolean }): Promise<any>;
  evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: any, isPage?: boolean }): Promise<JSHandleChannel>;
  fill(params: { selector: string, value: string, options: types.NavigatingActionWaitOptions, isPage?: boolean }): Promise<void>;
  focus(params: { selector: string, options: types.TimeoutOptions, isPage?: boolean }): Promise<void>;
  frameElement(): Promise<ElementHandleChannel>;
  getAttribute(params: { selector: string, name: string, options: types.TimeoutOptions, isPage?: boolean }): Promise<string | null>;
  goto(params: { url: string, options: types.GotoOptions, isPage?: boolean }): Promise<ResponseChannel | null>;
  hover(params: { selector: string, options: types.PointerActionOptions & types.TimeoutOptions & { force?: boolean }, isPage?: boolean }): Promise<void>;
  innerHTML(params: { selector: string, options: types.TimeoutOptions, isPage?: boolean }): Promise<string>;
  innerText(params: { selector: string, options: types.TimeoutOptions, isPage?: boolean }): Promise<string>;
  press(params: { selector: string, key: string, options: { delay?: number | undefined } & types.TimeoutOptions & { noWaitAfter?: boolean }, isPage?: boolean }): Promise<void>;
  querySelector(params: { selector: string, isPage?: boolean }): Promise<ElementHandleChannel | null>;
  querySelectorAll(params: { selector: string, isPage?: boolean }): Promise<ElementHandleChannel[]>;
  selectOption(params: { selector: string, values: string | ElementHandleChannel | types.SelectOption | string[] | ElementHandleChannel[] | types.SelectOption[] | null, options: types.NavigatingActionWaitOptions, isPage?: boolean }): Promise<string[]>;
  setContent(params: { html: string, options: types.NavigateOptions, isPage?: boolean }): Promise<void>;
  setInputFiles(params: { selector: string, files: { name: string, mimeType: string, buffer: string }[], options: types.NavigatingActionWaitOptions, isPage?: boolean }): Promise<void>;
  textContent(params: { selector: string, options: types.TimeoutOptions, isPage?: boolean }): Promise<string | null>;
  title(): Promise<string>;
  type(params: { selector: string, text: string, options: { delay?: number | undefined } & types.TimeoutOptions & { noWaitAfter?: boolean }, isPage?: boolean }): Promise<void>;
  uncheck(params: { selector: string, options: types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean }, isPage?: boolean }): Promise<void>;
  waitForFunction(params: { expression: string, isFunction: boolean, arg: any; options: types.WaitForFunctionOptions, isPage?: boolean }): Promise<JSHandleChannel>;
  waitForLoadState(params: { state: types.LifecycleEvent, options: types.TimeoutOptions, isPage?: boolean }): Promise<void>;
  waitForNavigation(params: { options: types.WaitForNavigationOptions, isPage?: boolean }): Promise<ResponseChannel | null>;
  waitForSelector(params: { selector: string, options: types.WaitForElementOptions, isPage?: boolean }): Promise<ElementHandleChannel | null>;
}
export type FrameInitializer = {
  url: string,
  name: string,
  parentFrame: FrameChannel | null
};


export interface WorkerChannel extends Channel {
  evaluateExpression(params: { expression: string, isFunction: boolean, arg: any }): Promise<any>;
  evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: any }): Promise<JSHandleChannel>;
}
export type WorkerInitializer = {
  url: string,
};


export interface JSHandleChannel extends Channel {
  on(event: 'previewUpdated', callback: (preview: string) => void): this;

  dispose(): Promise<void>;
  evaluateExpression(params: { expression: string, isFunction: boolean, arg: any }): Promise<any>;
  evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: any}): Promise<JSHandleChannel>;
  getPropertyList(): Promise<{ name: string, value: JSHandleChannel}[]>;
  jsonValue(): Promise<any>;
}
export type JSHandleInitializer = {
  preview: string,
};


export interface ElementHandleChannel extends JSHandleChannel {
  $$evalExpression(params: { selector: string; expression: string, isFunction: boolean, arg: any }): Promise<any>;
  $evalExpression(params: { selector: string; expression: string, isFunction: boolean, arg: any }): Promise<any>;
  boundingBox(): Promise<types.Rect | null>;
  check(params: { options?: types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } }): Promise<void>;
  click(params: { options?: types.PointerActionOptions & types.MouseClickOptions & types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } }): Promise<void>;
  contentFrame(): Promise<FrameChannel | null>;
  dblclick(params: { options?: types.PointerActionOptions & types.MouseMultiClickOptions & types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } }): Promise<void>;
  dispatchEvent(params: { type: string, eventInit: any }): Promise<void>;
  fill(params: { value: string; options?: types.NavigatingActionWaitOptions }): Promise<void>;
  focus(): Promise<void>;
  getAttribute(params: { name: string }): Promise<string | null>;
  hover(params: { options?: types.PointerActionOptions & types.TimeoutOptions & { force?: boolean } }): Promise<void>;
  innerHTML(): Promise<string>;
  innerText(): Promise<string>;
  ownerFrame(): Promise<FrameChannel | null>;
  press(params: { key: string; options?: { delay?: number } & types.TimeoutOptions & { noWaitAfter?: boolean } }): Promise<void>;
  querySelector(params: { selector: string }): Promise<ElementHandleChannel | null>;
  querySelectorAll(params: { selector: string }): Promise<ElementHandleChannel[]>;
  screenshot(params: { options?: types.ElementScreenshotOptions }): Promise<Binary>;
  scrollIntoViewIfNeeded(params: { options?: types.TimeoutOptions }): Promise<void>;
  selectOption(params: { values: string | ElementHandleChannel | types.SelectOption | string[] | ElementHandleChannel[] | types.SelectOption[] | null; options?: types.NavigatingActionWaitOptions }): string[] | Promise<string[]>;
  selectText(params: { options?: types.TimeoutOptions }): Promise<void>;
  setInputFiles(params: { files: string | string[] | types.FilePayload | types.FilePayload[], options?: types.NavigatingActionWaitOptions }): Promise<void>;
  textContent(): Promise<string | null>;
  type(params: { text: string; options?: { delay?: number } & types.TimeoutOptions & { noWaitAfter?: boolean } }): Promise<void>;
  uncheck(params: { options?: types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } }): Promise<void>;
}


export interface RequestChannel extends Channel {
  response(): Promise<ResponseChannel | null>;
}
export type RequestInitializer = {
  frame: FrameChannel,
  url: string,
  resourceType: string,
  method: string,
  postData: string | null,
  headers: types.Headers,
  isNavigationRequest: boolean,
  redirectedFrom: RequestChannel | null,
};


export interface RouteChannel extends Channel {
  abort(params: { errorCode: string }): Promise<void>;
  continue(params: { overrides: { method?: string, headers?: types.Headers, postData?: string } }): Promise<void>;
  fulfill(params: {
    response: {
      status?: number,
      headers?: types.Headers,
      contentType?: string,
      body: Binary,
    }
  }): Promise<void>;
}
export type RouteInitializer = {
  request: RequestChannel,
};


export interface ResponseChannel extends Channel {
  body(): Promise<Binary>;
  finished(): Promise<Error | null>;
}
export type ResponseInitializer = {
  request: RequestChannel,
  url: string,
  status: number,
  statusText: string,
  headers: types.Headers,
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
  path(): Promise<string | null>;
  failure(): Promise<string | null>;
  delete(): Promise<void>;
}
export type DownloadInitializer = {
	url: string,
  suggestedFilename: string,
};
