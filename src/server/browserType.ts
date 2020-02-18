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

import * as types from '../types';
import { TimeoutError } from '../errors';
import { Browser, ConnectOptions } from '../browser';
import { BrowserContext } from '../browserContext';
import { BrowserServer } from './browserServer';
import { OnProgressCallback } from './browserFetcher';

export type BrowserArgOptions = {
  headless?: boolean,
  args?: string[],
  devtools?: boolean,
};

export type LaunchOptions = BrowserArgOptions & {
  executablePath?: string,
  ignoreDefaultArgs?: boolean | string[],
  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  timeout?: number,
  /**
   * Whether to dump stdio of the browser, this is useful for example when
   * diagnosing browser launch issues.
   */
  dumpio?: boolean,
  env?: {[key: string]: string} | undefined
};

export interface BrowserType {
  executablePath(): string;
  name(): string;
  launch(options?: LaunchOptions & { slowMo?: number }): Promise<Browser>;
  launchServer(options?: LaunchOptions & { port?: number }): Promise<BrowserServer>;
  launchPersistent(userDataDir: string, options?: LaunchOptions): Promise<BrowserContext>;
  connect(options: ConnectOptions): Promise<Browser>;
  downloadBrowserIfNeeded(progress?: OnProgressCallback): Promise<void>;
  devices: types.Devices;
  errors: { TimeoutError: typeof TimeoutError };
}
