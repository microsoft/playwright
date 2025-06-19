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

import { debugLogger  } from '../utils';
import { Android } from './android/android';
import { AdbBackend } from './android/backendAdb';
import { BidiChromium } from './bidi/bidiChromium';
import { BidiFirefox } from './bidi/bidiFirefox';
import { Chromium } from './chromium/chromium';
import { DebugController } from './debugController';
import { Electron } from './electron/electron';
import { Firefox } from './firefox/firefox';
import { SdkObject, createRootSdkObject } from './instrumentation';
import { WebKit } from './webkit/webkit';

import type { BrowserType } from './browserType';
import type { Language } from '../utils';
import type { Browser } from './browser';
import type { CallMetadata } from './instrumentation';
import type { Page } from './page';

type PlaywrightOptions = {
  sdkLanguage: Language;
  isInternalPlaywright?: boolean;
  isServer?: boolean;
};

export class Playwright extends SdkObject {
  readonly chromium: BrowserType;
  readonly android: Android;
  readonly electron: Electron;
  readonly firefox: BrowserType;
  readonly webkit: BrowserType;
  readonly _bidiChromium: BrowserType;
  readonly _bidiFirefox: BrowserType;
  readonly options: PlaywrightOptions;
  readonly debugController: DebugController;
  private _allPages = new Set<Page>();
  private _allBrowsers = new Set<Browser>();

  constructor(options: PlaywrightOptions) {
    super(createRootSdkObject(), undefined, 'Playwright');
    this.options = options;
    this.attribution.playwright = this;
    this.instrumentation.addListener({
      onBrowserOpen: browser => this._allBrowsers.add(browser),
      onBrowserClose: browser => this._allBrowsers.delete(browser),
      onPageOpen: page => this._allPages.add(page),
      onPageClose: page => this._allPages.delete(page),
      onCallLog: (sdkObject: SdkObject, metadata: CallMetadata, logName: string, message: string) => {
        debugLogger.log(logName as any, message);
      }
    }, null);
    this.chromium = new Chromium(this);
    this._bidiChromium = new BidiChromium(this);
    this._bidiFirefox = new BidiFirefox(this);
    this.firefox = new Firefox(this);
    this.webkit = new WebKit(this);
    this.electron = new Electron(this);
    this.android = new Android(this, new AdbBackend());
    this.debugController = new DebugController(this);
  }

  async hideHighlight() {
    await Promise.all([...this._allPages].map(p => p.hideHighlight().catch(() => {})));
  }

  allBrowsers(): Browser[] {
    return [...this._allBrowsers];
  }

  allPages(): Page[] {
    return [...this._allPages];
  }
}

export function createPlaywright(options: PlaywrightOptions) {
  return new Playwright(options);
}
