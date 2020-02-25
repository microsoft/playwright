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

import * as pw from './playwright';

/**
 * Serializable value can be passed to evaluation functions or returned from it.
 */
type Serializable = boolean | number | string | null | undefined | SerializableArray | SerializableObject;
type SerializableArray = Array<Serializable>;
type SerializableObject = { [key: string]: Serializable };

/**
 * Evaluation type-inference helpers.
 */
export type Boxed<Args extends any[]> = { [Index in keyof Args]: Extract<Args[Index], Serializable> | pw.JSHandle<Args[Index]> };
export type PageFunction<Args extends any[], R = any> = string | ((...args: Args) => R | Promise<R>);
export type PageFunctionOn<On, Args extends any[], R = any> = string | ((on: On, ...args: Args) => R | Promise<R>);
export type PageFunctionOn2<On1, On2, Args extends any[], R = any> = string | ((on1: On1, on2: On2, ...args: Args) => R | Promise<R>);
export type SmartHandle<T> = T extends Node ? pw.ElementHandle<T> : pw.JSHandle<T>;

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
