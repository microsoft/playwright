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

import { SdkObject, createInstrumentation } from './instrumentation';
import { gracefullyProcessExitDoNotHang } from './utils/processLauncher';
import { Recorder, RecorderEvent } from './recorder';
import { asLocator  } from '../utils';
import { parseAriaSnapshotUnsafe } from '../utils/isomorphic/ariaSnapshot';
import { yaml } from '../utilsBundle';
import { unsafeLocatorOrSelectorAsSelector } from '../utils/isomorphic/locatorParser';
import { generateCode } from './codegen/language';
import { collapseActions } from './recorder/recorderUtils';
import { JavaScriptLanguageGenerator } from './codegen/javascript';
import { Frame } from './frames';
import { Page } from './page';

import type { Language } from '../utils';
import type { BrowserContext } from './browserContext';
import type { InstrumentationListener } from './instrumentation';
import type { Playwright } from './playwright';
import type { ElementInfo, Mode } from '@recorder/recorderTypes';
import type { Progress } from '@protocol/progress';
import type * as actions from '@recorder/actions';

export class DebugController extends SdkObject {
  static Events = {
    StateChanged: 'stateChanged',
    InspectRequested: 'inspectRequested',
    SourceChanged: 'sourceChanged',
    Paused: 'paused',
    SetModeRequested: 'setModeRequested',
  };

  private _reportState = false;
  private _disposeListeners = new Set<() => void>();
  private _playwright: Playwright;
  _sdkLanguage: Language = 'javascript';
  _generateAutoExpect = false;

  constructor(playwright: Playwright) {
    super({ attribution: { isInternalPlaywright: true }, instrumentation: createInstrumentation() } as any, undefined, 'DebugController');
    this._playwright = playwright;
  }

  initialize(codegenId: string, sdkLanguage: Language) {
    this._sdkLanguage = sdkLanguage;
  }

  dispose() {
    this.setReportStateChanged(false);
  }

  setReportStateChanged(enabled: boolean) {
    if (this._reportState === enabled)
      return;
    this._reportState = enabled;
    if (enabled) {
      const listener: InstrumentationListener = {
        onPageOpen: page => {
          this._emitSnapshot(false);
          const handleNavigation = () => this._emitSnapshot(false);
          page.mainFrame().on(Frame.Events.InternalNavigation, handleNavigation);
          const dispose = () => page.mainFrame().off(Frame.Events.InternalNavigation, handleNavigation);
          this._disposeListeners.add(dispose);
          page.on(Page.Events.Close, () => this._disposeListeners.delete(dispose));
        },
        onPageClose: () => this._emitSnapshot(false),
      };
      this._playwright.instrumentation.addListener(listener, null);
      this._disposeListeners.add(() => this._playwright.instrumentation.removeListener(listener));
      this._emitSnapshot(true);
    } else {
      for (const dispose of this._disposeListeners)
        dispose();
      this._disposeListeners.clear();
    }
  }

  async setRecorderMode(progress: Progress, params: { mode: Mode, testIdAttributeName?: string, generateAutoExpect?: boolean }) {
    await progress.race(this._closeBrowsersWithoutPages());
    this._generateAutoExpect = !!params.generateAutoExpect;

    if (params.mode === 'none') {
      for (const recorder of await progress.race(this._allRecorders())) {
        recorder.hideHighlightedSelector();
        recorder.setMode('none');
      }
      return;
    }

    if (!this._playwright.allBrowsers().length)
      await this._playwright.chromium.launch(progress, { headless: !!process.env.PW_DEBUG_CONTROLLER_HEADLESS });
    // Create page if none.
    const pages = this._playwright.allPages();
    if (!pages.length) {
      const [browser] = this._playwright.allBrowsers();
      const context = await browser.newContextForReuse(progress, {});
      await context.newPage(progress);
    }
    // Update test id attribute.
    if (params.testIdAttributeName) {
      for (const page of this._playwright.allPages())
        page.browserContext.selectors().setTestIdAttributeName(params.testIdAttributeName);
    }
    // Toggle the mode.
    for (const recorder of await progress.race(this._allRecorders())) {
      recorder.hideHighlightedSelector();
      recorder.setMode(params.mode);
    }
  }

  async highlight(progress: Progress, params: { selector?: string, ariaTemplate?: string }) {
    // Assert parameters validity.
    if (params.selector)
      unsafeLocatorOrSelectorAsSelector(this._sdkLanguage, params.selector, 'data-testid');
    const ariaTemplate = params.ariaTemplate ? parseAriaSnapshotUnsafe(yaml, params.ariaTemplate) : undefined;
    for (const recorder of await progress.race(this._allRecorders())) {
      if (ariaTemplate)
        recorder.setHighlightedAriaTemplate(ariaTemplate);
      else if (params.selector)
        recorder.setHighlightedSelector(params.selector);
    }
  }

  async hideHighlight(progress: Progress) {
    // Hide all active recorder highlights.
    for (const recorder of await progress.race(this._allRecorders()))
      recorder.hideHighlightedSelector();
    // Hide all locator.highlight highlights.
    await Promise.all(this._playwright.allPages().map(p => p.hideHighlight().catch(() => {})));
  }

  async resume(progress: Progress) {
    for (const recorder of await progress.race(this._allRecorders()))
      recorder.resume();
  }

  kill() {
    gracefullyProcessExitDoNotHang(0);
  }

  private _emitSnapshot(initial: boolean) {
    const pageCount = this._playwright.allPages().length;
    if (initial && !pageCount)
      return;
    this.emit(DebugController.Events.StateChanged, {
      pageCount,
      browsers: this._playwright.allBrowsers().map(browser => ({
        id: browser.guid,
        name: browser.options.name,
        channel: browser.options.channel,
        contexts: browser.contexts().map(context => ({
          pages: context.pages().map(page => ({
            url: page.mainFrame().url(),
          }))
        }))
      }))
    });
  }

  private async _allRecorders(): Promise<Recorder[]> {
    const contexts = new Set<BrowserContext>();
    for (const page of this._playwright.allPages())
      contexts.add(page.browserContext);
    const recorders = await Promise.all([...contexts].map(c => Recorder.forContext(c, { omitCallTracking: true })));
    const nonNullRecorders = recorders.filter(Boolean) as Recorder[];
    for (const recorder of recorders)
      wireListeners(recorder, this);
    return nonNullRecorders;
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

const wiredSymbol = Symbol('wired');

function wireListeners(recorder: Recorder, debugController: DebugController) {
  if ((recorder as any)[wiredSymbol])
    return;
  (recorder as any)[wiredSymbol] = true;

  const actions: actions.ActionInContext[] = [];
  const languageGenerator = new JavaScriptLanguageGenerator(/* isPlaywrightTest */true);

  const actionsChanged = () => {
    const aa = collapseActions(actions);
    const { header, footer, text, actionTexts } = generateCode(aa, languageGenerator, {
      browserName: 'chromium',
      launchOptions: {},
      contextOptions: {},
      generateAutoExpect: debugController._generateAutoExpect,
    });
    debugController.emit(DebugController.Events.SourceChanged, { text, header, footer, actions: actionTexts });
  };

  recorder.on(RecorderEvent.ElementPicked, (elementInfo: ElementInfo) => {
    const locator: string = asLocator(debugController._sdkLanguage, elementInfo.selector);
    debugController.emit(DebugController.Events.InspectRequested, { selector: elementInfo.selector, locator, ariaSnapshot: elementInfo.ariaSnapshot });
  });
  recorder.on(RecorderEvent.PausedStateChanged, (paused: boolean) => {
    debugController.emit(DebugController.Events.Paused, { paused });
  });
  recorder.on(RecorderEvent.ModeChanged, (mode: Mode) => {
    debugController.emit(DebugController.Events.SetModeRequested, { mode });
  });
  recorder.on(RecorderEvent.ActionAdded, (action: actions.ActionInContext) => {
    actions.push(action);
    actionsChanged();
  });
  recorder.on(RecorderEvent.SignalAdded, (signal: actions.SignalInContext) => {
    const lastAction = actions.findLast(a => a.frame.pageGuid === signal.frame.pageGuid);
    if (lastAction)
      lastAction.action.signals.push(signal.signal);
    actionsChanged();
  });
}
