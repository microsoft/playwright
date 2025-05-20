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

import { SdkObject, createInstrumentation, serverSideCallMetadata } from './instrumentation';
import { gracefullyProcessExitDoNotHang } from './utils/processLauncher';
import { Recorder } from './recorder';
import { asLocator, DEFAULT_PLAYWRIGHT_LAUNCH_TIMEOUT, DEFAULT_PLAYWRIGHT_TIMEOUT  } from '../utils';
import { parseAriaSnapshotUnsafe } from '../utils/isomorphic/ariaSnapshot';
import { yaml } from '../utilsBundle';
import { EmptyRecorderApp } from './recorder/recorderApp';
import { unsafeLocatorOrSelectorAsSelector } from '../utils/isomorphic/locatorParser';

import type { Language } from '../utils';
import type { Browser } from './browser';
import type { BrowserContext } from './browserContext';
import type { InstrumentationListener } from './instrumentation';
import type { Playwright } from './playwright';
import type { ElementInfo, Mode, Source } from '@recorder/recorderTypes';

const internalMetadata = serverSideCallMetadata();

export class DebugController extends SdkObject {
  static Events = {
    StateChanged: 'stateChanged',
    InspectRequested: 'inspectRequested',
    SourceChanged: 'sourceChanged',
    Paused: 'paused',
    SetModeRequested: 'setModeRequested',
  };

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

  dispose() {
    this.setReportStateChanged(false);
  }

  setReportStateChanged(enabled: boolean) {
    if (enabled && !this._trackHierarchyListener) {
      this._trackHierarchyListener = {
        onPageOpen: () => this._emitSnapshot(false),
        onPageClose: () => this._emitSnapshot(false),
      };
      this._playwright.instrumentation.addListener(this._trackHierarchyListener, null);
      this._emitSnapshot(true);
    } else if (!enabled && this._trackHierarchyListener) {
      this._playwright.instrumentation.removeListener(this._trackHierarchyListener);
      this._trackHierarchyListener = undefined;
    }
  }

  async resetForReuse() {
    const contexts = new Set<BrowserContext>();
    for (const page of this._playwright.allPages())
      contexts.add(page.browserContext);
    for (const context of contexts)
      await context.resetForReuse(internalMetadata, null);
  }

  async navigate(url: string) {
    for (const p of this._playwright.allPages())
      await p.mainFrame().goto(internalMetadata, url, { timeout: DEFAULT_PLAYWRIGHT_TIMEOUT });
  }

  async setRecorderMode(params: { mode: Mode, file?: string, testIdAttributeName?: string }) {
    // TODO: |file| is only used in the legacy mode.
    await this._closeBrowsersWithoutPages();

    if (params.mode === 'none') {
      for (const recorder of await this._allRecorders()) {
        recorder.hideHighlightedSelector();
        recorder.setMode('none');
      }
      return;
    }

    if (!this._playwright.allBrowsers().length)
      await this._playwright.chromium.launch(internalMetadata, { headless: !!process.env.PW_DEBUG_CONTROLLER_HEADLESS, timeout: DEFAULT_PLAYWRIGHT_LAUNCH_TIMEOUT });
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
        page.browserContext.selectors().setTestIdAttributeName(params.testIdAttributeName);
    }
    // Toggle the mode.
    for (const recorder of await this._allRecorders()) {
      recorder.hideHighlightedSelector();
      if (params.mode !== 'inspecting')
        recorder.setOutput(this._codegenId, params.file);
      recorder.setMode(params.mode);
    }
  }

  async highlight(params: { selector?: string, ariaTemplate?: string }) {
    // Assert parameters validity.
    if (params.selector)
      unsafeLocatorOrSelectorAsSelector(this._sdkLanguage, params.selector, 'data-testid');
    const ariaTemplate = params.ariaTemplate ? parseAriaSnapshotUnsafe(yaml, params.ariaTemplate) : undefined;
    for (const recorder of await this._allRecorders()) {
      if (ariaTemplate)
        recorder.setHighlightedAriaTemplate(ariaTemplate);
      else if (params.selector)
        recorder.setHighlightedSelector(this._sdkLanguage, params.selector);
    }
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

  private _emitSnapshot(initial: boolean) {
    const pageCount = this._playwright.allPages().length;
    if (initial && !pageCount)
      return;
    this.emit(DebugController.Events.StateChanged, { pageCount });
  }

  private async _allRecorders(): Promise<Recorder[]> {
    const contexts = new Set<BrowserContext>();
    for (const page of this._playwright.allPages())
      contexts.add(page.browserContext);
    const result = await Promise.all([...contexts].map(c => Recorder.showInspector(c, { omitCallTracking: true }, () => Promise.resolve(new InspectingRecorderApp(this)))));
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

  override async elementPicked(elementInfo: ElementInfo): Promise<void> {
    const locator: string = asLocator(this._debugController._sdkLanguage, elementInfo.selector);
    this._debugController.emit(DebugController.Events.InspectRequested, { selector: elementInfo.selector, locator, ariaSnapshot: elementInfo.ariaSnapshot });
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
