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
import * as api from '../api';
import { helper } from '../helper';
import { TimeoutError } from '../errors';
import { DeviceDescriptors } from '../deviceDescriptors';
import { Chromium } from './chromium';
import { WebKit } from './webkit';
import { Firefox } from './firefox';
import { selectors } from '../selectors';
import * as browserPaths from '../install/browserPaths';

for (const className in api) {
  if (typeof (api as any)[className] === 'function')
    helper.installApiHooks(className[0].toLowerCase() + className.substring(1), (api as any)[className]);
}

export class Playwright {
  readonly selectors = selectors;
  readonly devices: types.Devices;
  readonly errors: { TimeoutError: typeof TimeoutError };
  readonly chromium: (Chromium|undefined);
  readonly firefox: (Firefox|undefined);
  readonly webkit: (WebKit|undefined);

  constructor(packagePath: string, browsers: browserPaths.BrowserDescriptor[]) {
    this.devices = DeviceDescriptors;
    this.errors = { TimeoutError };

    const chromium = browsers.find(browser => browser.name === 'chromium');
    if (chromium)
      this.chromium = new Chromium(packagePath, chromium);

    const firefox = browsers.find(browser => browser.name === 'firefox');
    if (firefox)
      this.firefox = new Firefox(packagePath, firefox);

    const webkit = browsers.find(browser => browser.name === 'webkit');
    if (webkit)
      this.webkit = new WebKit(packagePath, webkit);
  }
}
