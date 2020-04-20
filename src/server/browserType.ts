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

import { BrowserContext } from '../browserContext';
import { BrowserServer } from './browserServer';
import { LoggerSink } from '../logger';

export type BrowserArgOptions = {
  headless?: boolean,
  args?: string[],
  devtools?: boolean,
};

type LaunchOptionsBase = BrowserArgOptions & {
  executablePath?: string,
  ignoreDefaultArgs?: boolean | string[],
  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  timeout?: number,
  loggerSink?: LoggerSink,
  env?: {[key: string]: string} | undefined
};

export type ConnectOptions = {
  wsEndpoint: string,
  slowMo?: number,
  loggerSink?: LoggerSink,
};
export type LaunchOptions = LaunchOptionsBase & { slowMo?: number };
export type LaunchServerOptions = LaunchOptionsBase & { port?: number };
export interface BrowserType<Browser> {
  executablePath(): string;
  name(): string;
  launch(options?: LaunchOptions): Promise<Browser>;
  launchServer(options?: LaunchServerOptions): Promise<BrowserServer>;
  launchPersistentContext(userDataDir: string, options?: LaunchOptions): Promise<BrowserContext>;
  connect(options: ConnectOptions): Promise<Browser>;
}
