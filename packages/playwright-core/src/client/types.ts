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

import type { Size } from '../utils/isomorphic/types';
import type * as channels from '@protocol/channels';
export type { HeadersArray, Point, Quad, Rect, Size } from '../utils/isomorphic/types';

type LoggerSeverity = 'verbose' | 'info' | 'warning' | 'error';
export interface Logger {
  isEnabled(name: string, severity: LoggerSeverity): boolean;
  log(name: string, severity: LoggerSeverity, message: string | Error, args: any[], hints: { color?: string }): void;
}

export type TimeoutOptions = { timeout?: number };
export type StrictOptions = { strict?: boolean };
export type Headers = { [key: string]: string };
export type Env = { [key: string]: string | number | boolean | undefined };

export type WaitForEventOptions = Function | TimeoutOptions & { predicate?: Function };
export type WaitForFunctionOptions = TimeoutOptions & { polling?: 'raf' | number };

export type SelectOption = { value?: string, label?: string, index?: number, valueOrLabel?: string };
export type SelectOptionOptions = TimeoutOptions & { force?: boolean };
export type FilePayload = { name: string, mimeType: string, buffer: Buffer };
export type StorageState = {
  cookies: channels.NetworkCookie[],
  origins: (Omit<channels.OriginStorage, 'indexedDB'>)[],
};
export type SetStorageState = {
  cookies?: channels.SetNetworkCookie[],
  origins?: (Omit<channels.SetOriginStorage, 'indexedDB'> & { indexedDB?: unknown[] })[]
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

export type BrowserContextOptions = Omit<channels.BrowserNewContextOptions, 'viewport' | 'noDefaultViewport' | 'extraHTTPHeaders' | 'clientCertificates' | 'storageState' | 'recordHar' | 'colorScheme' | 'reducedMotion' | 'forcedColors' | 'acceptDownloads' | 'contrast'> & {
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
  contrast?: 'more' | 'no-preference' | null;
  acceptDownloads?: boolean;
  clientCertificates?: ClientCertificate[];
};

type LaunchOverrides = {
  ignoreDefaultArgs?: boolean | string[];
  env?: Env;
  logger?: Logger;
  firefoxUserPrefs?: { [key: string]: string | number | boolean };
} & TimeoutOptions;

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
export type LaunchServerOptions = LaunchOptions & {
  host?: string,
  port?: number,
  wsPath?: string,
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

export type FrameExpectParams = Omit<channels.FrameExpectParams, 'selector'|'expression'|'expectedValue'> & { expectedValue?: any };
