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

import { Chromium } from './chromium/chromium';
import { WebKit } from './webkit/webkit';
import { Firefox } from './firefox/firefox';
import * as browserPaths from '../utils/browserPaths';
import { serverSelectors } from './selectors';

export class Playwright {
  readonly selectors = serverSelectors;
  readonly chromium: Chromium;
  readonly firefox: Firefox;
  readonly webkit: WebKit;

  constructor(packagePath: string, browsers: browserPaths.BrowserDescriptor[]) {
    const chromium = browsers.find(browser => browser.name === 'chromium');
    this.chromium = new Chromium(packagePath, chromium!);

    const firefox = browsers.find(browser => browser.name === 'firefox');
    this.firefox = new Firefox(packagePath, firefox!);

    const webkit = browsers.find(browser => browser.name === 'webkit');
    this.webkit = new WebKit(packagePath, webkit!);
  }
}
