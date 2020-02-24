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

import * as js from './javascript';
import * as dom from './dom';
import Injected from './injected/injected';

type Boxed<Args extends any[]> = { [Index in keyof Args]: Args[Index] | js.JSHandle<Args[Index]> };
type PageFunction<Args extends any[], R = any> = string | ((...args: Args) => R | Promise<R>);
type PageFunctionOn<On, Args extends any[], R = any> = string | ((on: On, ...args: Args) => R | Promise<R>);
type PageFunctionWithInjected<On, Args extends any[], R = any> = string | ((injected: Injected, on: On, ...args: Args) => R | Promise<R>);

type Handle<T> = T extends Node ? dom.ElementHandle<T> : js.JSHandle<T>;

export type Evaluate = <Args extends any[], R>(pageFunction: PageFunction<Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type EvaluateHandle = <Args extends any[], R>(pageFunction: PageFunction<Args,  R>, ...args: Boxed<Args>) => Promise<Handle<R>>;
export type $Eval = <Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<Element, Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type $$Eval = <Args extends any[], R>(selector: string, pageFunction: PageFunctionOn<Element[], Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type EvaluateOn<T> = <Args extends any[], R>(pageFunction: PageFunctionOn<T, Args, R>, ...args: Boxed<Args>) => Promise<R>;
export type EvaluateHandleOn<T> = <Args extends any[], R>(pageFunction: PageFunctionOn<T, Args, R>, ...args: Boxed<Args>) => Promise<Handle<R>>;
export type EvaluateWithInjected<T> = <Args extends any[], R>(pageFunction: PageFunctionWithInjected<T, Args, R>, ...args: Boxed<Args>) => Promise<R>;

export type Size = { width: number, height: number };
export type Point = { x: number, y: number };
export type Rect = Size & Point;
export type Quad = [ Point, Point, Point, Point ];

export type TimeoutOptions = { timeout?: number };
export type WaitForOptions = TimeoutOptions & { waitFor?: boolean };

export type Visibility = 'visible' | 'hidden' | 'any';

export type Polling = 'raf' | 'mutation' | number;
export type WaitForFunctionOptions = TimeoutOptions & { polling?: Polling };

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

export type Viewport = {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
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
  type: string,
  data: string,
};

export type MediaType = 'screen' | 'print';
export const mediaTypes: Set<MediaType> = new Set(['screen', 'print']);

export type ColorScheme = 'dark' | 'light' | 'no-preference';
export const colorSchemes: Set<ColorScheme> = new Set(['dark', 'light', 'no-preference']);

export type DeviceDescriptor = {
  name: string,
  userAgent: string,
  viewport: Viewport,
};
export type Devices = { [name: string]: DeviceDescriptor } & DeviceDescriptor[];

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
