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

import type { Size, Point, TimeoutOptions, HeadersArray } from '../common/types';
export type { Size, Point, Rect, Quad, TimeoutOptions, HeadersArray } from '../common/types';
import type * as channels from '@protocol/channels';

export type StrictOptions = {
  strict?: boolean,
};

export type QueryOnSelectorOptions = StrictOptions & TimeoutOptions;

export type WaitForElementOptions = TimeoutOptions & StrictOptions & { state?: 'attached' | 'detached' | 'visible' | 'hidden' } & { omitReturnValue?: boolean };

export type WaitForFunctionOptions = TimeoutOptions & { pollingInterval?: number };

export type LifecycleEvent = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
export const kLifecycleEvents: Set<LifecycleEvent> = new Set(['load', 'domcontentloaded', 'networkidle', 'commit']);

export type NavigateOptions = TimeoutOptions & {
  waitUntil?: LifecycleEvent,
};

export type CommonActionOptions = TimeoutOptions & StrictOptions & {
  force?: boolean,
};

export type PointerActionWaitOptions = CommonActionOptions & {
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
  origin?: string;
  sendImmediately?: boolean;
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
  lastModifiedMs?: number,
};

export type MediaType = 'screen' | 'print' | 'no-override';

export type ColorScheme = 'dark' | 'light' | 'no-preference' | 'no-override';

export type ReducedMotion = 'no-preference' | 'reduce' | 'no-override';

export type ForcedColors = 'active' | 'none' | 'no-override';

export type DeviceDescriptor = {
  userAgent: string,
  viewport: Size,
  deviceScaleFactor: number,
  isMobile: boolean,
  hasTouch: boolean,
  defaultBrowserType: 'chromium' | 'firefox' | 'webkit'
};
export type Devices = { [name: string]: DeviceDescriptor };

export type ProxySettings = {
  server: string,
  bypass?: string,
  username?: string,
  password?: string
};

export type KeyboardModifier = 'Alt' | 'Control' | 'Meta' | 'Shift';
export type SmartKeyboardModifier = KeyboardModifier |  'ControlOrMeta';
export type MouseButton = 'left' | 'right' | 'middle';

export type PointerActionOptions = {
  modifiers?: SmartKeyboardModifier[];
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
  isFallback: boolean,
};

export type EmulatedSize = { viewport: Size, screen: Size };

export type LaunchOptions = channels.BrowserTypeLaunchOptions & { useWebSocket?: boolean };

export type ProtocolLogger = (direction: 'send' | 'receive', message: object) => void;

export type ConsoleMessageLocation = {
  url: string,
  lineNumber: number,
  columnNumber: number,
};
