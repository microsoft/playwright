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

export interface Channel extends EventEmitter {
  _type: string;
  _guid: string;
  _object: any;
}

export interface BrowserTypeChannel extends Channel {
  launch(params: { options?: types.LaunchOptions }): Promise<BrowserChannel>;
  launchPersistentContext(params: { userDataDir: string, options?: types.LaunchOptions & types.BrowserContextOptions }): Promise<BrowserContextChannel>;
  connect(params: { options: types.ConnectOptions }): Promise<BrowserChannel>;
}

export interface BrowserChannel extends Channel {
  newContext(params: { options?: types.BrowserContextOptions }): Promise<BrowserContextChannel>;
  newPage(params: { options?: types.BrowserContextOptions }): Promise<PageChannel>;
  close(): Promise<void>;
}

export interface BrowserContextChannel extends Channel {
  setDefaultNavigationTimeoutNoReply(params: { timeout: number }): void;
  setDefaultTimeoutNoReply(params: { timeout: number }): void;
  exposeBinding(params: { name: string }): Promise<void>;
  newPage(): Promise<PageChannel>;
  cookies(params: { urls: string[] }): Promise<types.NetworkCookie[]>;
  addCookies(params: { cookies: types.SetNetworkCookieParam[] }): Promise<void>;
  clearCookies(): Promise<void>;
  grantPermissions(params: { permissions: string[]; options?: { origin?: string } }): Promise<void>;
  clearPermissions(): Promise<void>;
  setGeolocation(params: { geolocation: types.Geolocation | null }): Promise<void>;
  setExtraHTTPHeaders(params: { headers: types.Headers }): Promise<void>;
  setOffline(params: { offline: boolean }): Promise<void>;
  setHTTPCredentials(params: { httpCredentials: types.Credentials | null }): Promise<void>;
  addInitScript(params: { source: string }): Promise<void>;
  setNetworkInterceptionEnabled(params: { enabled: boolean }): Promise<void>;
  waitForEvent(params: { event: string }): Promise<any>;
  close(): Promise<void>;
}

export interface PageChannel extends Channel {
  on(event: 'frameAttached', callback: (params: FrameChannel) => void): this;
  on(event: 'frameDetached', callback: (params: FrameChannel) => void): this;
  on(event: 'frameNavigated', callback: (params: { frame: FrameChannel, url: string }) => void): this;
  on(event: 'request', callback: (params: RequestChannel) => void): this;
  on(event: 'response', callback: (params: ResponseChannel) => void): this;
  on(event: 'requestFinished', callback: (params: RequestChannel) => void): this;
  on(event: 'requestFailed', callback: (params: RequestChannel) => void): this;
  on(event: 'close', callback: () => void): this;

  setDefaultNavigationTimeoutNoReply(params: { timeout: number }): void;
  setDefaultTimeoutNoReply(params: { timeout: number }): Promise<void>;
  setFileChooserInterceptedNoReply(params: { intercepted: boolean }): Promise<void>;

  opener(): Promise<PageChannel | null>;
  exposeBinding(params: { name: string }): Promise<void>;
  setExtraHTTPHeaders(params: { headers: types.Headers }): Promise<void>;
  reload(params: { options?: types.NavigateOptions }): Promise<ResponseChannel | null>;
  waitForEvent(params: { event: string }): Promise<any>;
  goBack(params: { options?: types.NavigateOptions }): Promise<ResponseChannel | null>;
  goForward(params: { options?: types.NavigateOptions }): Promise<ResponseChannel | null>;
  emulateMedia(params: { options: { media?: 'screen' | 'print', colorScheme?: 'dark' | 'light' | 'no-preference' } }): Promise<void>;
  setViewportSize(params: { viewportSize: types.Size }): Promise<void>;
  addInitScript(params: { source: string }): Promise<void>;
  setNetworkInterceptionEnabled(params: { enabled: boolean }): Promise<void>;
  screenshot(params: { options?: types.ScreenshotOptions }): Promise<Buffer>;
  close(params: { options?: { runBeforeUnload?: boolean } }): Promise<void>;
}

export interface FrameChannel extends Channel {
  goto(params: { url: string, options: types.GotoOptions }): Promise<ResponseChannel | null>;
  waitForNavigation(params: { options: types.WaitForNavigationOptions }): Promise<ResponseChannel | null>;
  waitForLoadState(params: { state: types.LifecycleEvent, options: types.TimeoutOptions }): Promise<void>;
  frameElement(): Promise<ElementHandleChannel>;
  evaluateExpression(params: { expression: string, isFunction: boolean, arg: any }): Promise<any>;
  evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: any}): Promise<JSHandleChannel>;
  querySelector(params: { selector: string }): Promise<ElementHandleChannel | null>;
  waitForSelector(params: { selector: string, options: types.WaitForElementOptions }): Promise<ElementHandleChannel | null>;
  dispatchEvent(params: { selector: string, type: string, eventInit: Object | undefined, options: types.TimeoutOptions }): Promise<void>;
  $eval(params: { selector: string; expression: string, isFunction: boolean, arg: any }): Promise<any>;
  $$eval(params: { selector: string; expression: string, isFunction: boolean, arg: any }): Promise<any>;
  querySelectorAll(params: { selector: string }): Promise<ElementHandleChannel[]>;
  content(): Promise<string>;
  setContent(params: { html: string, options: types.NavigateOptions }): Promise<void>;
  addScriptTag(params: { options: { url?: string | undefined, path?: string | undefined, content?: string | undefined, type?: string | undefined } }): Promise<ElementHandleChannel>;
  addStyleTag(params: { options: { url?: string | undefined, path?: string | undefined, content?: string | undefined } }): Promise<ElementHandleChannel>;
  click(params: { selector: string, options: types.PointerActionOptions & types.MouseClickOptions & types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } }): Promise<void>;
  dblclick(params: { selector: string, options: types.PointerActionOptions & types.MouseMultiClickOptions & types.TimeoutOptions & { force?: boolean }}): Promise<void>;
  fill(params: { selector: string, value: string, options: types.NavigatingActionWaitOptions }): Promise<void>;
  focus(params: { selector: string, options: types.TimeoutOptions }): Promise<void>;
  textContent(params: { selector: string, options: types.TimeoutOptions }): Promise<string | null>;
  innerText(params: { selector: string, options: types.TimeoutOptions }): Promise<string>;
  innerHTML(params: { selector: string, options: types.TimeoutOptions }): Promise<string>;
  getAttribute(params: { selector: string, name: string, options: types.TimeoutOptions }): Promise<string | null>;
  hover(params: { selector: string, options: types.PointerActionOptions & types.TimeoutOptions & { force?: boolean } }): Promise<void>;
  selectOption(params: { selector: string, values: string | ElementHandleChannel | types.SelectOption | string[] | ElementHandleChannel[] | types.SelectOption[] | null, options: types.NavigatingActionWaitOptions }): Promise<string[]>;
  setInputFiles(params: { selector: string, files: string | string[] | types.FilePayload | types.FilePayload[], options: types.NavigatingActionWaitOptions }): Promise<void>;
  type(params: { selector: string, text: string, options: { delay?: number | undefined } & types.TimeoutOptions & { noWaitAfter?: boolean } }): Promise<void>;
  press(params: { selector: string, key: string, options: { delay?: number | undefined } & types.TimeoutOptions & { noWaitAfter?: boolean } }): Promise<void>;
  check(params: { selector: string, options: types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } }): Promise<void>;
  uncheck(params: { selector: string, options: types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } }): Promise<void>;
  waitForFunction(params: { expression: string, isFunction: boolean, arg: any; options: types.WaitForFunctionOptions }): Promise<JSHandleChannel>;
  title(): Promise<string>;
}

export interface JSHandleChannel extends Channel {
  evaluateExpression(params: { expression: string, isFunction: boolean, arg: any }): Promise<any>;
  evaluateExpressionHandle(params: { expression: string, isFunction: boolean, arg: any}): Promise<JSHandleChannel>;
  getPropertyList(): Promise<{ name: string, value: JSHandleChannel}[]>;
  jsonValue(): Promise<any>;
  dispose(): Promise<void>;
}

export interface ElementHandleChannel extends JSHandleChannel {
  ownerFrame(): Promise<FrameChannel | null>;
  contentFrame(): Promise<FrameChannel | null>;

  getAttribute(params: { name: string }): Promise<string | null>;
  textContent(): Promise<string | null>;
  innerText(): Promise<string>;
  innerHTML(): Promise<string>;
  boundingBox(): Promise<types.Rect | null>;

  hover(params: { options?: types.PointerActionOptions & types.TimeoutOptions & { force?: boolean } }): Promise<void>;
  click(params: { options?: types.PointerActionOptions & types.MouseClickOptions & types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } }): Promise<void>;
  dblclick(params: { options?: types.PointerActionOptions & types.MouseMultiClickOptions & types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } }): Promise<void>;
  selectOption(params: { values: string | ElementHandleChannel | types.SelectOption | string[] | ElementHandleChannel[] | types.SelectOption[] | null; options?: types.NavigatingActionWaitOptions }): string[] | Promise<string[]>;
  fill(params: { value: string; options?: types.NavigatingActionWaitOptions }): Promise<void>;
  selectText(params: { options?: types.TimeoutOptions }): Promise<void>;
  setInputFiles(params: { files: string | string[] | types.FilePayload | types.FilePayload[], options?: types.NavigatingActionWaitOptions }): Promise<void>;
  focus(): Promise<void>;
  type(params: { text: string; options?: { delay?: number } & types.TimeoutOptions & { noWaitAfter?: boolean } }): Promise<void>;
  press(params: { key: string; options?: { delay?: number } & types.TimeoutOptions & { noWaitAfter?: boolean } }): Promise<void>;
  check(params: { options?: types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } }): Promise<void>;
  uncheck(params: { options?: types.TimeoutOptions & { force?: boolean } & { noWaitAfter?: boolean } }): Promise<void>;
  dispatchEvent(params: { type: string, eventInit: any }): Promise<void>;

  scrollIntoViewIfNeeded(params: { options?: types.TimeoutOptions }): Promise<void>;
  screenshot(params: { options?: types.ElementScreenshotOptions }): Promise<Buffer>;

  querySelector(params: { selector: string }): Promise<ElementHandleChannel | null>;
  querySelectorAll(params: { selector: string }): Promise<ElementHandleChannel[]>;
  $eval(params: { selector: string; expression: string, isFunction: boolean, arg: any }): Promise<any>;
  $$eval(params: { selector: string; expression: string, isFunction: boolean, arg: any }): Promise<any>;
}

export interface RequestChannel extends Channel {
  continue(params: { overrides: { method?: string, headers?: types.Headers, postData?: string } }): Promise<void>;
  fulfill(params: { response: types.FulfillResponse & { path?: string } }): Promise<void>;
  abort(params: { errorCode: string }): Promise<void>;
  response(): Promise<ResponseChannel | null>;
}

export interface ResponseChannel extends Channel {
  body(): Promise<Buffer>;
  finished(): Promise<Error | null>;
}

