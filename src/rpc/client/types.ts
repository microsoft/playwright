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

import { BrowserNewContextOptions, BrowserTypeLaunchOptions, BrowserTypeLaunchServerOptions, BrowserTypeConnectParams } from '../channels';

type LoggerSeverity = 'verbose' | 'info' | 'warning' | 'error';
export interface LoggerSink {
  isEnabled(name: string, severity: LoggerSeverity): boolean;
  log(name: string, severity: LoggerSeverity, message: string | Error, args: any[], hints: { color?: string }): void;
}

export type Size = { width: number, height: number };
export type Point = { x: number, y: number };
export type Rect = Size & Point;
export type Headers = { [key: string]: string };
export type Env = { [key: string]: string | number | boolean | undefined };
export type URLMatch = string | RegExp | ((url: URL) => boolean);

export type WaitForEventOptions = Function | { predicate?: Function, timeout?: number };
export type WaitForFunctionOptions = { timeout?: number, polling?: 'raf' | number };

export type SelectOption = { value?: string, label?: string, index?: number };
export type SelectOptionOptions = { timeout?: number, noWaitAfter?: boolean };
export type FilePayload = { name: string, mimeType: string, buffer: Buffer };

export type LifecycleEvent = 'load' | 'domcontentloaded' | 'networkidle';
export const kLifecycleEvents: Set<LifecycleEvent> = new Set(['load', 'domcontentloaded', 'networkidle']);

export type BrowserContextOptions = Omit<BrowserNewContextOptions, 'viewport' | 'noDefaultViewport' | 'extraHTTPHeaders'> & {
  viewport?: Size | null,
  extraHTTPHeaders?: Headers,
  logger?: LoggerSink,
};

type LaunchOverrides = {
  ignoreDefaultArgs?: boolean | string[],
  env?: Env,
  logger?: LoggerSink,
  handleSIGINT?: boolean,
  handleSIGHUP?: boolean,
  handleSIGTERM?: boolean,
};
type FirefoxUserPrefs = {
  firefoxUserPrefs?: { [key: string]: string | number | boolean },
};
type LaunchOptionsBase = Omit<BrowserTypeLaunchOptions, 'ignoreAllDefaultArgs' | 'ignoreDefaultArgs' | 'env' | 'firefoxUserPrefs'> & LaunchOverrides;
export type LaunchOptions = LaunchOptionsBase & FirefoxUserPrefs;
export type LaunchServerOptions = Omit<BrowserTypeLaunchServerOptions, 'ignoreAllDefaultArgs' | 'ignoreDefaultArgs' | 'env' | 'firefoxUserPrefs'> & LaunchOverrides & FirefoxUserPrefs;
export type LaunchPersistentContextOptions = LaunchOptionsBase & BrowserContextOptions;
export type ConnectOptions = BrowserTypeConnectParams & { logger?: LoggerSink };
