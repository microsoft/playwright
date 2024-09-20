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

import type { Mode, Source } from '@recorder/recorderTypes';
import { gracefullyProcessExitDoNotHang } from '../utils/processLauncher';
import type { Browser } from './browser';
import type { BrowserContext } from './browserContext';
import { createInstrumentation, SdkObject, serverSideCallMetadata } from './instrumentation';
import type { InstrumentationListener } from './instrumentation';
import type { Playwright } from './playwright';
import { Recorder } from './recorder';
import { EmptyRecorderApp } from './recorder/recorderApp';
import { asLocator, type Language } from '../utils';

const internalMetadata = serverSideCallMetadata();

export class DebugController extends SdkObject {
  static Events = {
    StateChanged: 'stateChanged',
    InspectRequested: 'inspectRequested',
    SourceChanged: 'sourceChanged',
    Paused: 'paused',
    SetModeRequested: 'setModeRequested',
  };

  private _autoCloseTimer: NodeJS.Timeout | undefined;
  // TODO: remove in 1.27
  private _autoCloseAllowed = false;
  private _trackHierarchyListener: InstrumentationListener | undefined;
  private _playwright: Playwright;
  _sdkLanguage: Language = 'javascript';
  _codegenId: string = 'playwright-test';

  constructor(playwright: Playwright) {
    super({ attribution: { isInternalPlaywright: true }, instrumentation: createInstrumentation() } as any, undefined, 'DebugController');
    this._playwright = playwright;
  }

  initialize(codegenId: string, sdkLanguage: Language) {
    this._codegenId = codegenId;
    this._sdkLanguage = sdkLanguage;
  }

  setAutoCloseAllowed(allowed: boolean) {
    this._autoCloseAllowed = allowed;
  }

  dispose() {
    this.setReportStateChanged(false);
    this.setAutoCloseAllowed(false);
  }

  setReportStateChanged(enabled: boolean) {
    if (enabled && !this._trackHierarchyListener) {
      this._trackHierarchyListener = {
        onPageOpen: () => this._emitSnapshot(),
        onPageClose: () => this._emitSnapshot(),
      };
      this._playwright.instrumentation.addListener(this._trackHierarchyListener, null);
    } else if (!enabled && this._trackHierarchyListener) {
      this._playwright.instrumentation.removeListener(this._trackHierarchyListener);
      this._trackHierarchyListener = undefined;
    }
  }

  async resetForReuse() {
    const contexts = new Set<BrowserContext>();
    for (const page of this._playwright.allPages())
      contexts.add(page.context());
    for (const context of contexts)
      await context.resetForReuse(internalMetadata, null);
  }

  async navigate(url: string) {
    for (const p of this._playwright.allPages())
      await p.mainFrame().goto(internalMetadata, url);
  }

  async setRecorderMode(params: { mode: Mode, file?: string, testIdAttributeName?: string }) {
    // TODO: |file| is only used in the legacy mode.
    await this._closeBrowsersWithoutPages();

    if (params.mode === 'none') {
      for (const recorder of await this._allRecorders()) {
        recorder.hideHighlightedSelector();
        recorder.setMode('none');
      }
      this.setAutoCloseEnabled(true);
      return;
    }

    if (!this._playwright.allBrowsers().length)
      await this._playwright.chromium.launch(internalMetadata, { headless: !!process.env.PW_DEBUG_CONTROLLER_HEADLESS });
    // Create page if none.
    const pages = this._playwright.allPages();
    if (!pages.length) {
      const [browser] = this._playwright.allBrowsers();
      const { context } = await browser.newContextForReuse({}, internalMetadata);
      await context.newPage(internalMetadata);
    }
    // Update test id attribute.
    if (params.testIdAttributeName) {
      for (const page of this._playwright.allPages())
        page.context().selectors().setTestIdAttributeName(params.testIdAttributeName);
    }
    // Toggle the mode.
    for (const recorder of await this._allRecorders()) {
      recorder.hideHighlightedSelector();
      if (params.mode !== 'inspecting')
        recorder.setOutput(this._codegenId, params.file);
      recorder.setMode(params.mode);
    }
    this.setAutoCloseEnabled(true);
  }

  async setAutoCloseEnabled(enabled: boolean) {
    if (!this._autoCloseAllowed)
      return;
    if (this._autoCloseTimer)
      clearTimeout(this._autoCloseTimer);
    if (!enabled)
      return;
    const heartBeat = () => {
      if (!this._playwright.allPages().length)
        gracefullyProcessExitDoNotHang(0);
      else
        this._autoCloseTimer = setTimeout(heartBeat, 5000);
    };
    this._autoCloseTimer = setTimeout(heartBeat, 30000);
  }

  async highlight(selector: string) {
    for (const recorder of await this._allRecorders())
      recorder.setHighlightedSelector(this._sdkLanguage, selector);
  }

  async hideHighlight() {
    // Hide all active recorder highlights.
    for (const recorder of await this._allRecorders())
      recorder.hideHighlightedSelector();
    // Hide all locator.highlight highlights.
    await this._playwright.hideHighlight();
  }

  allBrowsers(): Browser[] {
    return [...this._playwright.allBrowsers()];
  }

  async resume() {
    for (const recorder of await this._allRecorders())
      recorder.resume();
  }

  async kill() {
    gracefullyProcessExitDoNotHang(0);
  }

  async closeAllBrowsers() {
    await Promise.all(this.allBrowsers().map(browser => browser.close({ reason: 'Close all browsers requested' })));
  }

  private _emitSnapshot() {
    const browsers = [];
    let pageCount = 0;
    for (const browser of this._playwright.allBrowsers()) {
      const b = {
        contexts: [] as any[]
      };
      browsers.push(b);
      for (const context of browser.contexts()) {
        const c = {
          pages: [] as any[]
        };
        b.contexts.push(c);
        for (const page of context.pages())
          c.pages.push(page.mainFrame().url());
        pageCount += context.pages().length;
      }
    }
    this.emit(DebugController.Events.StateChanged, { pageCount });
  }

  private async _allRecorders(): Promise<Recorder[]> {
    const contexts = new Set<BrowserContext>();
    for (const page of this._playwright.allPages())
      contexts.add(page.context());
    const result = await Promise.all([...contexts].map(c => Recorder.show(c, () => Promise.resolve(new InspectingRecorderApp(this)), { omitCallTracking: true })));
    return result.filter(Boolean) as Recorder[];
  }

  private async _closeBrowsersWithoutPages() {
    for (const browser of this._playwright.allBrowsers()) {
      for (const context of browser.contexts()) {
        if (!context.pages().length)
          await context.close({ reason: 'Browser collected' });
      }
      if (!browser.contexts())
        await browser.close({ reason: 'Browser collected' });
    }
  }
}

class InspectingRecorderApp extends EmptyRecorderApp {
  private _debugController: DebugController;

  constructor(debugController: DebugController) {
    super();
    this._debugController = debugController;
  }

  override async setSelector(selector: string): Promise<void> {
    const locator: string = asLocator(this._debugController._sdkLanguage, selector);
    this._debugController.emit(DebugController.Events.InspectRequested, { selector, locator });
  }

  override async setSources(sources: Source[]): Promise<void> {
    const source = sources.find(s => s.id === this._debugController._codegenId);
    const { text, header, footer, actions } = source || { text: '' };
    this._debugController.emit(DebugController.Events.SourceChanged, { text, header, footer, actions });
  }

  override async setPaused(paused: boolean) {
    this._debugController.emit(DebugController.Events.Paused, { paused });
  }

  override async setMode(mode: Mode) {
    this._debugController.emit(DebugController.Events.SetModeRequested, { mode });
  }
}
