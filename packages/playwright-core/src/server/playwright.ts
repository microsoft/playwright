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

import { Android } from './android/android';
import { AdbBackend } from './android/backendAdb';
import type { PlaywrightOptions } from './browser';
import { Chromium } from './chromium/chromium';
import { Electron } from './electron/electron';
import { Firefox } from './firefox/firefox';
import { Selectors } from './selectors';
import { WebKit } from './webkit/webkit';
import type { CallMetadata } from './instrumentation';
import { createInstrumentation, SdkObject } from './instrumentation';
import { debugLogger } from '../common/debugLogger';
import type { Page } from './page';

export class Playwright extends SdkObject {
  readonly selectors: Selectors;
  readonly chromium: Chromium;
  readonly android: Android;
  readonly electron: Electron;
  readonly firefox: Firefox;
  readonly webkit: WebKit;
  readonly options: PlaywrightOptions;
  private _allPages = new Set<Page>();

  constructor(sdkLanguage: string, isInternalPlaywright: boolean) {
    super({ attribution: { isInternalPlaywright }, instrumentation: createInstrumentation() } as any, undefined, 'Playwright');
    this.instrumentation.addListener({
      onPageOpen: page => this._allPages.add(page),
      onPageClose: page => this._allPages.delete(page),
      onCallLog: (sdkObject: SdkObject, metadata: CallMetadata, logName: string, message: string) => {
        debugLogger.log(logName as any, message);
      }
    }, null);
    this.options = {
      rootSdkObject: this,
      selectors: new Selectors(),
      sdkLanguage: sdkLanguage,
    };
    this.chromium = new Chromium(this.options);
    this.firefox = new Firefox(this.options);
    this.webkit = new WebKit(this.options);
    this.electron = new Electron(this.options);
    this.android = new Android(new AdbBackend(), this.options);
    this.selectors = this.options.selectors;
  }

  async hideHighlight() {
    await Promise.all([...this._allPages].map(p => p.hideHighlight().catch(() => {})));
  }
}

export function createPlaywright(sdkLanguage: string, isInternalPlaywright: boolean = false) {
  return new Playwright(sdkLanguage, isInternalPlaywright);
}
