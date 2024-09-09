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

import type * as channels from '@protocol/channels';
import type { Size } from '../common/types';
export type { Size, Point, Rect, Quad, TimeoutOptions, HeadersArray } from '../common/types';

type LoggerSeverity = 'verbose' | 'info' | 'warning' | 'error';
export interface Logger {
  isEnabled(name: string, severity: LoggerSeverity): boolean;
  log(name: string, severity: LoggerSeverity, message: string | Error, args: any[], hints: { color?: string }): void;
}

export type StrictOptions = { strict?: boolean };
export type Headers = { [key: string]: string };
export type Env = { [key: string]: string | number | boolean | undefined };

export type WaitForEventOptions = Function | { predicate?: Function, timeout?: number };
export type WaitForFunctionOptions = { timeout?: number, polling?: 'raf' | number };

export type SelectOption = { value?: string, label?: string, index?: number, valueOrLabel?: string };
export type SelectOptionOptions = { force?: boolean, timeout?: number };
export type FilePayload = { name: string, mimeType: string, buffer: Buffer };
export type StorageState = {
  cookies: channels.NetworkCookie[],
  origins: channels.OriginStorage[]
};
export type SetStorageState = {
  cookies?: channels.SetNetworkCookie[],
  origins?: channels.OriginStorage[]
};

export type LifecycleEvent = channels.LifecycleEvent;
export const kLifecycleEvents: Set<LifecycleEvent> = new Set(['load', 'domcontentloaded', 'networkidle', 'commit']);

export type ClientCertificate = {
  origin: string;
  cert?: Buffer;
  certPath?: string;
  key?: Buffer;
  keyPath?: string;
  pfx?: Buffer;
  pfxPath?: string;
  passphrase?: string;
};

export type BrowserContextOptions = Omit<channels.BrowserNewContextOptions, 'viewport' | 'noDefaultViewport' | 'extraHTTPHeaders' | 'clientCertificates' | 'storageState' | 'recordHar' | 'colorScheme' | 'reducedMotion' | 'forcedColors' | 'acceptDownloads'> & {
  viewport?: Size | null;
  extraHTTPHeaders?: Headers;
  logger?: Logger;
  videosPath?: string;
  videoSize?: Size;
  storageState?: string | SetStorageState;
  har?: {
    path: string;
    fallback?: 'abort'|'continue';
    urlFilter?: string|RegExp;
  };
  recordHar?: {
    path: string,
    omitContent?: boolean,
    content?: 'omit' | 'embed' | 'attach',
    mode?: 'full' | 'minimal',
    urlFilter?: string | RegExp,
  };
  colorScheme?: 'dark' | 'light' | 'no-preference' | null;
  reducedMotion?: 'reduce' | 'no-preference' | null;
  forcedColors?: 'active' | 'none' | null;
  acceptDownloads?: boolean;
  clientCertificates?: ClientCertificate[];
};

type LaunchOverrides = {
  ignoreDefaultArgs?: boolean | string[];
  env?: Env;
  logger?: Logger;
  firefoxUserPrefs?: { [key: string]: string | number | boolean };
};

export type LaunchOptions = Omit<channels.BrowserTypeLaunchOptions, 'ignoreAllDefaultArgs' | 'ignoreDefaultArgs' | 'env' | 'firefoxUserPrefs'> & LaunchOverrides;
export type LaunchPersistentContextOptions = Omit<LaunchOptions & BrowserContextOptions, 'storageState'>;

export type ConnectOptions = {
  wsEndpoint: string,
  headers?: { [key: string]: string; };
  exposeNetwork?: string,
  _exposeNetwork?: string,
  slowMo?: number,
  timeout?: number,
  logger?: Logger,
};
export type LaunchServerOptions = {
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
  host?: string,
  port?: number,
  wsPath?: string,
  logger?: Logger,
  firefoxUserPrefs?: { [key: string]: string | number | boolean };
};

export type LaunchAndroidServerOptions = {
  deviceSerialNumber?: string,
  adbHost?: string,
  adbPort?: number,
  omitDriverInstall?: boolean,
  host?: string,
  port?: number,
  wsPath?: string,
};

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

export type FrameExpectOptions = channels.FrameExpectOptions & { isNot?: boolean };
