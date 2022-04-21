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

import type { Size, Point, TimeoutOptions } from '../common/types';
export type { Size, Point, Rect, Quad, URLMatch, TimeoutOptions } from '../common/types';

export type StrictOptions = {
  strict?: boolean,
};

export type QueryOnSelectorOptions = StrictOptions & TimeoutOptions;

export type WaitForElementOptions = TimeoutOptions & StrictOptions & { state?: 'attached' | 'detached' | 'visible' | 'hidden' };

export type WaitForFunctionOptions = TimeoutOptions & { pollingInterval?: number };

export type LifecycleEvent = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
export const kLifecycleEvents: Set<LifecycleEvent> = new Set(['load', 'domcontentloaded', 'networkidle', 'commit']);

export type NavigateOptions = TimeoutOptions & {
  waitUntil?: LifecycleEvent,
};

export type NavigatingActionWaitOptions = TimeoutOptions & StrictOptions & {
  noWaitAfter?: boolean,
};

export type ForceOptions = {
  force?: boolean,
};

export type PointerActionWaitOptions = TimeoutOptions & ForceOptions & StrictOptions & {
  trial?: boolean;
};

export type PageScreencastOptions = {
  width: number,
  height: number,
  outputFile: string,
};

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
  buffer: string,
};

export type MediaType = 'screen' | 'print';
export const mediaTypes: Set<MediaType> = new Set(['screen', 'print']);

export type ColorScheme = 'dark' | 'light' | 'no-preference';
export const colorSchemes: Set<ColorScheme> = new Set(['dark', 'light', 'no-preference']);

export type ReducedMotion = 'no-preference' | 'reduce';
export const reducedMotions: Set<ReducedMotion> = new Set(['no-preference', 'reduce']);

export type ForcedColors = 'active' | 'none';
export const forcedColors: Set<ForcedColors> = new Set(['active', 'none']);

export type DeviceDescriptor = {
  userAgent: string,
  viewport: Size,
  deviceScaleFactor: number,
  isMobile: boolean,
  hasTouch: boolean,
  defaultBrowserType: 'chromium' | 'firefox' | 'webkit'
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
  width?: string,
  height?: string,
  preferCSSPageSize?: boolean,
  margin?: {top?: string, bottom?: string, left?: string, right?: string},
};

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

export type ProxySettings = {
  server: string,
  bypass?: string,
  username?: string,
  password?: string
};

export type KeyboardModifier = 'Alt' | 'Control' | 'Meta' | 'Shift';
export type MouseButton = 'left' | 'right' | 'middle';

export type PointerActionOptions = {
  modifiers?: KeyboardModifier[];
  position?: Point;
};

export type DragActionOptions = {
  sourcePosition?: Point;
  targetPosition?: Point;
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

export type HeadersArray = { name: string, value: string }[];

export type GotoOptions = NavigateOptions & {
  referer?: string,
};

export type NormalizedFulfillResponse = {
  status: number,
  headers: HeadersArray,
  body: string,
  isBase64: boolean,
};

export type NormalizedContinueOverrides = {
  url?: string,
  method?: string,
  headers?: HeadersArray,
  postData?: Buffer,
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

export type EmulatedSize = { viewport: Size, screen: Size };

export type BrowserContextOptions = {
  viewport?: Size,
  screen?: Size,
  noDefaultViewport?: boolean,
  ignoreHTTPSErrors?: boolean,
  javaScriptEnabled?: boolean,
  bypassCSP?: boolean,
  userAgent?: string,
  locale?: string,
  timezoneId?: string,
  geolocation?: Geolocation,
  permissions?: string[],
  extraHTTPHeaders?: HeadersArray,
  offline?: boolean,
  httpCredentials?: Credentials,
  deviceScaleFactor?: number,
  isMobile?: boolean,
  hasTouch?: boolean,
  colorScheme?: ColorScheme,
  reducedMotion?: ReducedMotion,
  forcedColors?: ForcedColors,
  acceptDownloads?: boolean,
  recordVideo?: {
    dir: string,
    size?: Size,
  },
  recordHar?: {
    omitContent?: boolean,
    path: string
  },
  storageState?: SetStorageState,
  strictSelectors?: boolean,
  proxy?: ProxySettings,
  baseURL?: string,
};

export type EnvArray = { name: string, value: string }[];

type LaunchOptionsBase = {
  channel?: string,
  executablePath?: string,
  args?: string[],
  ignoreDefaultArgs?: string[],
  ignoreAllDefaultArgs?: boolean,
  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  timeout?: number,
  env?: EnvArray,
  headless?: boolean,
  devtools?: boolean,
  proxy?: ProxySettings,
  downloadsPath?: string,
  chromiumSandbox?: boolean,
  slowMo?: number,
  useWebSocket?: boolean,
  tracesDir?: string,
};
export type LaunchOptions = LaunchOptionsBase & {
  firefoxUserPrefs?: { [key: string]: string | number | boolean },
};
export type LaunchPersistentOptions = LaunchOptionsBase & BrowserContextOptions;

export type ProtocolLogger = (direction: 'send' | 'receive', message: object) => void;

export type SerializedAXNode = {
  role: string,
  name: string,
  valueString?: string,
  valueNumber?: number,
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

  checked?: 'checked' | 'unchecked' | 'mixed',
  pressed?: 'pressed' | 'released' | 'mixed',

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
  url: string,
  lineNumber: number,
  columnNumber: number,
};

export type Error = {
  message: string,
  name: string,
  stack?: string,
};

export type NameValueList = {
  name: string;
  value: string;
}[];

export type OriginStorage = {
  origin: string;
  localStorage: NameValueList;
};

export type StorageState = {
  cookies: NetworkCookie[],
  origins: OriginStorage[]
};

export type SetStorageState = {
  cookies?: SetNetworkCookieParam[],
  origins?: OriginStorage[]
};

export type APIResponse = {
  url: string,
  status: number,
  statusText: string,
  headers: HeadersArray,
  body: Buffer,
};

export type AndroidDeviceOptions = {
  host?: string,
  port?: number,
  omitDriverInstall?: boolean,
};
