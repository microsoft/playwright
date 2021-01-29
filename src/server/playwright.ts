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

import * as path from 'path';
import { Tracer } from '../trace/tracer';
import * as browserPaths from '../utils/browserPaths';
import { Android } from './android/android';
import { AdbBackend } from './android/backendAdb';
import { Chromium } from './chromium/chromium';
import { Electron } from './electron/electron';
import { Firefox } from './firefox/firefox';
import { serverSelectors } from './selectors';
import { HarTracer } from './supplements/har/harTracer';
import { InspectorController } from './supplements/inspectorController';
import { WebKit } from './webkit/webkit';

export class Playwright {
  readonly selectors = serverSelectors;
  readonly chromium: Chromium;
  readonly android: Android;
  readonly electron: Electron;
  readonly firefox: Firefox;
  readonly webkit: WebKit;
  readonly options = {
    contextListeners: [
      new InspectorController(),
      new Tracer(),
      new HarTracer()
    ]
  };

  constructor(packagePath: string, browsers: browserPaths.BrowserDescriptor[]) {
    const chromium = browsers.find(browser => browser.name === 'chromium');
    this.chromium = new Chromium(packagePath, chromium!, this.options);

    const firefox = browsers.find(browser => browser.name === 'firefox');
    this.firefox = new Firefox(packagePath, firefox!, this.options);

    const webkit = browsers.find(browser => browser.name === 'webkit');
    this.webkit = new WebKit(packagePath, webkit!, this.options);

    this.electron = new Electron(this.options);
    this.android = new Android(new AdbBackend(), this.options);
  }
}

export function createPlaywright() {
  return new Playwright(path.join(__dirname, '..', '..'), require('../../browsers.json')['browsers']);
}
