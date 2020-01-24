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
import { DeviceDescriptors } from '../deviceDescriptors';
import { Chromium } from './chromium';
import { WebKit } from './webkit';
import { Firefox } from './firefox';

export class Playwright {
  readonly devices: types.Devices;
  readonly errors: { TimeoutError: typeof TimeoutError };
  readonly chromium: Chromium;
  readonly firefox: Firefox;
  readonly webkit: WebKit;

  constructor(projectRoot: string, revisions: { chromium_revision: string, firefox_revision: string, webkit_revision: string }) {
    this.devices = DeviceDescriptors;
    this.errors = { TimeoutError };
    this.chromium = new Chromium(projectRoot, revisions.chromium_revision);
    this.firefox = new Firefox(projectRoot, revisions.firefox_revision);
    this.webkit = new WebKit(projectRoot, revisions.webkit_revision);
  }
}
