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

import { Logger, Page, JSHandle, ChromiumBrowserContext } from './types';
import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';

export type ElectronLaunchOptions = {
  args?: string[],
  cwd?: string,
  env?: {[key: string]: string|number|boolean},
  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  timeout?: number,
  logger?: Logger,
};

export interface ElectronLauncher {
  launch(executablePath: string, options?: ElectronLaunchOptions): Promise<ElectronApplication>;
}

export interface ElectronApplication {
  on(event: 'window', listener: (page : ElectronPage) => void): this;
  addListener(event: 'window', listener: (page : ElectronPage) => void): this;
  waitForEvent(event: 'window', optionsOrPredicate?: { predicate?: (page : ElectronPage) => boolean, timeout?: number }): Promise<ElectronPage>;

  on(event: 'close', listener: (exitCode? : number) => void): this;
  addListener(event: 'close', listener: (exitCode? : number) => void): this;
  waitForEvent(event: 'close', optionsOrPredicate?: { predicate?: (exitCode? : number) => boolean, timeout?: number }): Promise<number|undefined>;

  context(): ChromiumBrowserContext;
  windows(): ElectronPage[];
  firstWindow(): Promise<ElectronPage>;
  newBrowserWindow(options?: BrowserWindowConstructorOptions): Promise<ElectronPage>;
  close(): Promise<void>;
  evaluate: HandleToElectron['evaluate'];
  evaluateHandle: HandleToElectron['evaluateHandle'];
}

export interface ElectronPage extends Page {
  browserWindow: JSHandle<BrowserWindow>;
}

type HandleToElectron = JSHandle<typeof import('electron')>;
