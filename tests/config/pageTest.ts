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

import { newTestType } from '../folio/out';
import type { Page } from '../../index';
import type { ServerTestArgs } from './serverTest';
export { expect } from 'folio';

export type CommonTestArgs = {
  mode: 'default' | 'driver' | 'service';
  platform: 'win32' | 'darwin' | 'linux';
  video: boolean;

  playwright: typeof import('../../index');
  toImpl: (rpcObject: any) => any;
  browserName: 'chromium' | 'firefox' | 'webkit';
  browserChannel: string | undefined;

  isChromium: boolean;
  isFirefox: boolean;
  isWebKit: boolean;
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
};

export type PageTestArgs = CommonTestArgs & {
  page: Page;
};

export const test = newTestType<PageTestArgs & ServerTestArgs>();
