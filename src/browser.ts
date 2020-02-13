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

import { BrowserContext, BrowserContextOptions } from './browserContext';
import * as platform from './platform';
import { Page } from './page';

export interface Browser extends platform.EventEmitterType {
  newContext(options?: BrowserContextOptions): Promise<BrowserContext>;
  contexts(): BrowserContext[];
  newPage(options?: BrowserContextOptions): Promise<Page>;
  isConnected(): boolean;
  close(): Promise<void>;
  _setDebugFunction(debugFunction: (message: string) => void): void;
}

export type ConnectOptions = {
  slowMo?: number,
  wsEndpoint: string
};

export async function createPageInNewContext(browser: Browser, options?: BrowserContextOptions): Promise<Page> {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page._ownedContext = context;
  return page;
}

export type LaunchType = 'local' | 'server' | 'persistent';
