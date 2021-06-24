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

import * as channels from '../protocol/channels';

type LoggerSeverity = 'verbose' | 'info' | 'warning' | 'error';
export interface Logger {
  isEnabled(name: string, severity: LoggerSeverity): boolean;
  log(name: string, severity: LoggerSeverity, message: string | Error, args: any[], hints: { color?: string }): void;
}

import { Size } from '../common/types';
export { Size, Point, Rect, Quad, URLMatch, TimeoutOptions } from '../common/types';

export type Headers = { [key: string]: string };
export type Env = { [key: string]: string | number | boolean | undefined };

export type WaitForEventOptions = Function | { predicate?: Function, timeout?: number };
export type WaitForFunctionOptions = { timeout?: number, polling?: 'raf' | number };

export type SelectOption = { value?: string, label?: string, index?: number };
export type SelectOptionOptions = { force?: boolean, timeout?: number, noWaitAfter?: boolean };
export type FilePayload = { name: string, mimeType: string, buffer: Buffer };
export type StorageState = {
  cookies: channels.NetworkCookie[],
  origins: channels.OriginStorage[]
};
export type SetStorageState = {
  cookies?: channels.SetNetworkCookie[],
  origins?: channels.OriginStorage[]
};

export type LifecycleEvent = 'load' | 'domcontentloaded' | 'networkidle';
export const kLifecycleEvents: Set<LifecycleEvent> = new Set(['load', 'domcontentloaded', 'networkidle']);

export type BrowserContextOptions = Omit<channels.BrowserNewContextOptions, 'viewport' | 'noDefaultViewport' | 'extraHTTPHeaders' | 'storageState'> & {
  viewport?: Size | null,
  extraHTTPHeaders?: Headers,
  logger?: Logger,
  videosPath?: string,
  videoSize?: Size,
  storageState?: string | channels.BrowserNewContextOptions['storageState'],
};

type LaunchOverrides = {
  ignoreDefaultArgs?: boolean | string[],
  env?: Env,
  logger?: Logger,
};
type FirefoxUserPrefs = {
  firefoxUserPrefs?: { [key: string]: string | number | boolean },
};
type LaunchOptionsBase = Omit<channels.BrowserTypeLaunchOptions, 'ignoreAllDefaultArgs' | 'ignoreDefaultArgs' | 'env' | 'firefoxUserPrefs'> & LaunchOverrides;
export type LaunchOptions = LaunchOptionsBase & FirefoxUserPrefs;
export type LaunchPersistentContextOptions = Omit<LaunchOptionsBase & BrowserContextOptions, 'storageState'>;

export type ConnectOptions = {
  wsEndpoint: string,
  headers?: { [key: string]: string; };
  _forwardPorts?: number[];
  slowMo?: number,
  timeout?: number,
  logger?: Logger,
};
export type LaunchServerOptions = {
  _acceptForwardedPorts?: boolean,
  channel?: channels.BrowserTypeLaunchOptions['channel'],
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
  proxy?: {
    server: string,
    bypass?: string,
    username?: string,
    password?: string
  },
  downloadsPath?: string,
  chromiumSandbox?: boolean,
  port?: number,
  logger?: Logger,
} & FirefoxUserPrefs;

export type SelectorEngine = {
  /**
   * Returns the first element matching given selector in the root's subtree.
   */
  query(root: HTMLElement, selector: string): HTMLElement | null;
  /**
   * Returns all elements matching given selector in the root's subtree.
   */
  queryAll(root: HTMLElement, selector: string): HTMLElement[];
};

export type RemoteAddr = channels.RemoteAddr;
export type SecurityDetails = channels.SecurityDetails;
