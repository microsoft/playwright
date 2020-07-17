/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

// NOTE: No imports allowed - only primitive, self-contained types are allowed here.

export type Size = { width: number, height: number };
export type Point = { x: number, y: number };
export type Rect = Size & Point;
export type Quad = [ Point, Point, Point, Point ];

export type TimeoutOptions = { timeout?: number };

export type WaitForElementOptions = TimeoutOptions & { state?: 'attached' | 'detached' | 'visible' | 'hidden' };

export type Polling = 'raf' | number;
export type WaitForFunctionOptions = TimeoutOptions & { polling?: Polling };

export type LifecycleEvent = 'load' | 'domcontentloaded' | 'networkidle';
export const kLifecycleEvents: Set<LifecycleEvent> = new Set(['load', 'domcontentloaded', 'networkidle']);

export type NavigateOptions = TimeoutOptions & {
  waitUntil?: LifecycleEvent,
};

export type NavigatingActionWaitOptions = TimeoutOptions & {
  noWaitAfter?: boolean,
};

export type PointerActionWaitOptions = TimeoutOptions & {
  force?: boolean,
};

export type WaitForNavigationOptions = TimeoutOptions & {
  waitUntil?: LifecycleEvent,
  url?: URLMatch
};

export type ElementScreenshotOptions = TimeoutOptions & {
  type?: 'png' | 'jpeg',
  path?: string,
  quality?: number,
  omitBackground?: boolean,
};

export type ScreenshotOptions = ElementScreenshotOptions & {
  fullPage?: boolean,
  clip?: Rect,
};

export type URLMatch = string | RegExp | ((url: URL) => boolean);

export type Credentials = {
  username: string;
  password: string;
};

export type Geolocation = {
  longitude: number;
  latitude: number;
  accuracy?: number;
};

export type SelectOption = {
  value?: string;
  label?: string;
  index?: number;
};

export type FilePayload = {
  name: string,
  mimeType: string,
  buffer: Buffer,
};

export type FileTransferPayload = {
  name: string,
  type: string,
  data: string,
};

export type MediaType = 'screen' | 'print';
export const mediaTypes: Set<MediaType> = new Set(['screen', 'print']);

export type ColorScheme = 'dark' | 'light' | 'no-preference';
export const colorSchemes: Set<ColorScheme> = new Set(['dark', 'light', 'no-preference']);

export type DeviceDescriptor = {
  userAgent: string,
  viewport: Size,
  deviceScaleFactor: number,
  isMobile: boolean,
  hasTouch: boolean
};
export type Devices = { [name: string]: DeviceDescriptor };

export type PDFOptions = {
  scale?: number,
  displayHeaderFooter?: boolean,
  headerTemplate?: string,
  footerTemplate?: string,
  printBackground?: boolean,
  landscape?: boolean,
  pageRanges?: string,
  format?: string,
  width?: string|number,
  height?: string|number,
  preferCSSPageSize?: boolean,
  margin?: {top?: string|number, bottom?: string|number, left?: string|number, right?: string|number},
  path?: string,
}

export type CSSCoverageOptions = {
  resetOnNavigation?: boolean,
};

export type JSCoverageOptions = {
  resetOnNavigation?: boolean,
  reportAnonymousScripts?: boolean,
};

export type JSRange = {
  startOffset: number,
  endOffset: number,
  count: number
};

export type CSSCoverageEntry = {
  url: string,
  text?: string,
  ranges: {
    start: number,
    end: number
  }[]
};

export type JSCoverageEntry = {
  url: string,
  scriptId: string,
  source?: string,
  functions: {
    functionName: string,
    isBlockCoverage: boolean,
    ranges: JSRange[]
  }[]
};

export type InjectedScriptProgress = {
  aborted: boolean,
  log: (message: string) => void,
  logRepeating: (message: string) => void,
};

export type InjectedScriptPoll<T> = {
  result: Promise<T>,
  // Takes more logs, waiting until at least one message is available.
  takeNextLogs: () => Promise<string[]>,
  // Takes all current logs without waiting.
  takeLastLogs: () => string[],
  cancel: () => void,
};

export type ProxySettings = {
  server: string,
  bypass?: string,
  username?: string,
  password?: string
};

export type WaitForEventOptions = Function | { predicate?: Function, timeout?: number };

export type KeyboardModifier = 'Alt' | 'Control' | 'Meta' | 'Shift';
export type MouseButton = 'left' | 'right' | 'middle';

export type PointerActionOptions = {
  modifiers?: KeyboardModifier[];
  position?: Point;
};

export type MouseClickOptions = PointerActionOptions & {
  delay?: number;
  button?: MouseButton;
  clickCount?: number;
};

export type MouseMultiClickOptions = PointerActionOptions & {
  delay?: number;
  button?: MouseButton;
};

export type World = 'main' | 'utility';

export type Headers = { [key: string]: string };
export type HeadersArray = { name: string, value: string }[];

export type GotoOptions = NavigateOptions & {
  referer?: string,
};

export type FulfillResponse = {
  status?: number,
  headers?: Headers,
  contentType?: string,
  body?: string | Buffer,
};

export type NormalizedFulfillResponse = {
  status: number,
  headers: HeadersArray,
  body: string,
  isBase64: boolean,
};

export type ContinueOverrides = {
  method?: string,
  headers?: Headers,
  postData?: string,
};

export type NormalizedContinueOverrides = {
  method?: string,
  headers?: HeadersArray,
  postData?: string,
};

export type NetworkCookie = {
  name: string,
  value: string,
  domain: string,
  path: string,
  expires: number,
  httpOnly: boolean,
  secure: boolean,
  sameSite: 'Strict' | 'Lax' | 'None'
};

export type SetNetworkCookieParam = {
  name: string,
  value: string,
  url?: string,
  domain?: string,
  path?: string,
  expires?: number,
  httpOnly?: boolean,
  secure?: boolean,
  sameSite?: 'Strict' | 'Lax' | 'None'
};

export type BrowserContextOptions = {
  viewport?: Size | null,
  ignoreHTTPSErrors?: boolean,
  javaScriptEnabled?: boolean,
  bypassCSP?: boolean,
  userAgent?: string,
  locale?: string,
  timezoneId?: string,
  geolocation?: Geolocation,
  permissions?: string[],
  extraHTTPHeaders?: Headers,
  offline?: boolean,
  httpCredentials?: Credentials,
  deviceScaleFactor?: number,
  isMobile?: boolean,
  hasTouch?: boolean,
  colorScheme?: ColorScheme,
  acceptDownloads?: boolean,
};

export type Env = {[key: string]: string | number | boolean | undefined};

export type LaunchOptionsBase = {
  executablePath?: string,
  args?: string[],
  ignoreDefaultArgs?: boolean | string[],
  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  timeout?: number,
  env?: Env,
  headless?: boolean,
  devtools?: boolean,
  proxy?: ProxySettings,
  downloadsPath?: string,
};

export type LaunchOptions = LaunchOptionsBase & { slowMo?: number };
export type LaunchServerOptions = LaunchOptionsBase & { port?: number };

export type ConnectOptions = {
  wsEndpoint: string,
  slowMo?: number,
  timeout?: number,
};

export type SerializedAXNode = {
  role: string,
  name: string,
  value?: string|number,
  description?: string,

  keyshortcuts?: string,
  roledescription?: string,
  valuetext?: string,

  disabled?: boolean,
  expanded?: boolean,
  focused?: boolean,
  modal?: boolean,
  multiline?: boolean,
  multiselectable?: boolean,
  readonly?: boolean,
  required?: boolean,
  selected?: boolean,

  checked?: boolean | 'mixed',
  pressed?: boolean | 'mixed',

  level?: number,
  valuemin?: number,
  valuemax?: number,

  autocomplete?: string,
  haspopup?: string,
  invalid?: string,
  orientation?: string,

  children?: SerializedAXNode[]
};

export type ConsoleMessageLocation = {
  url?: string,
  lineNumber?: number,
  columnNumber?: number,
};

export type Error = {
  message?: string,
  name?: string,
  stack?: string,
  value?: any
};
