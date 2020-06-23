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

export type ElementScreenshotOptions = {
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

export type CoverageEntry = {
  url: string,
  text: string,
  ranges: {start: number, end: number}[]
};

export type CSSCoverageOptions = {
  resetOnNavigation?: boolean,
};

export type JSCoverageOptions = {
  resetOnNavigation?: boolean,
  reportAnonymousScripts?: boolean,
};

export type InjectedScriptResult<T> = { error?: string, value?: T };

export type InjectedScriptProgress = {
  canceled: boolean,
  log: (message: string) => void,
  logRepeating: (message: string) => void,
};

export type InjectedScriptLogs = { current: string[], next: Promise<InjectedScriptLogs> };
export type InjectedScriptPoll<T> = {
  result: Promise<T>,
  logs: Promise<InjectedScriptLogs>,
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
