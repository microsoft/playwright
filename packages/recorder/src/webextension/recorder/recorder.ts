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

import type * as actions from '../../../../playwright-core/src/server/recorder/recorderActions';
import type * as channels from '@protocol/channels';
import { JavaLanguageGenerator } from '../../../../playwright-core/src/server/recorder/java';
import { JavaScriptLanguageGenerator } from '../../../../playwright-core/src/server/recorder/javascript';
import { JsonlLanguageGenerator } from '../../../../playwright-core/src/server/recorder/jsonl';
import { CSharpLanguageGenerator } from '../../../../playwright-core/src/server/recorder/csharp';
import { PythonLanguageGenerator } from '../../../../playwright-core/src/server/recorder/python';
import type { EventData, Mode, OverlayState, Source, UIState } from '../../recorderTypes';
import { EventEmitter } from 'events';
import { raceAgainstDeadline, monotonicTime } from '../utils';
import type { Language, LanguageGenerator } from '../../../../playwright-core/src/server/recorder/language';
import { locatorOrSelectorAsSelector } from '@isomorphic/locatorParser';
import { quoteCSSAttributeValue } from '@isomorphic/stringUtils';
import { eventsHelper, type RegisteredListener } from '../../../../playwright-core/src/utils/eventsHelper';
import type { IRecorderApp } from '../../../../playwright-core/src/server/recorder/recorderApp';
import { BrowserContext } from '../browserContext';
import { Page } from '../page';
import { Frame } from '../frame';
import { CodeGenerator } from '../../../../playwright-core/src/server/recorder/codeGenerator';
import type { ActionInContext } from '../../../../playwright-core/src/server/recorder/codeGenerator';
import { EmptyRecorderApp } from './recorderApp';

type BindingSource = { frame: Frame, page: Page };

const recorderSymbol = Symbol('recorderSymbol');

const recorderSource = { source: 'webextension/injected/recorder.js' };

export class Recorder {
  private _context: BrowserContext;
  private _mode: Mode;
  private _highlightedSelector = '';
  private _overlayState: OverlayState = { offsetX: 0 };
  private _recorderApp: IRecorderApp | null = null;
  private _recorderSources: Source[] = [];
  private _userSources = new Map<string, Source>();
  private _contextRecorder: ContextRecorder;
  private _currentLanguage: Language;

  private static recorderAppFactory: ((recorder: Recorder) => Promise<IRecorderApp>) | undefined;

  static setAppFactory(recorderAppFactory: ((recorder: Recorder) => Promise<IRecorderApp>) | undefined) {
    Recorder.recorderAppFactory = recorderAppFactory;
  }

  static showInspector(context: BrowserContext) {
    const params: channels.BrowserContextRecorderSupplementEnableParams = {};
    Recorder.show(context, params).catch(() => {});
  }

  static show(context: BrowserContext, params: channels.BrowserContextRecorderSupplementEnableParams = {}): Promise<Recorder> {
    let recorderPromise = (context as any)[recorderSymbol] as Promise<Recorder>;
    if (!recorderPromise) {
      const recorder = new Recorder(context, params);
      recorderPromise = recorder.install().then(() => recorder);
      (context as any)[recorderSymbol] = recorderPromise;
    }
    return recorderPromise;
  }

  constructor(context: BrowserContext, params: channels.BrowserContextRecorderSupplementEnableParams) {
    this._mode = params.mode || 'none';
    this._contextRecorder = new ContextRecorder(context, params);
    this._context = context;
    this._currentLanguage = this._contextRecorder.languageName();
  }

  private static async defaultRecorderAppFactory(_recorder: Recorder) {
    return new EmptyRecorderApp();
  }

  async install() {
    const recorderApp = await (Recorder.recorderAppFactory || Recorder.defaultRecorderAppFactory)(this);
    this._recorderApp = recorderApp;
    recorderApp.once('close', () => {
      this._recorderApp = null;
    });
    recorderApp.on('event', (data: EventData) => {
      if (data.event === 'setMode') {
        this.setMode(data.params.mode);
        return;
      }
      if (data.event === 'selectorUpdated') {
        this.setHighlightedSelector(this._currentLanguage, data.params.selector);
        return;
      }
      if (data.event === 'fileChanged') {
        this._currentLanguage = this._contextRecorder.languageName(data.params.file);
        this._refreshOverlay();
        return;
      }
      if (data.event === 'clear') {
        this._contextRecorder.clearScript();
        return;
      }
    });

    await Promise.all([
      recorderApp.setMode(this._mode),
      this._pushAllSources()
    ]);

    this._context.once(BrowserContext.Events.Close, () => {
      this._contextRecorder.dispose();
      recorderApp.close().catch(() => {});
    });
    this._contextRecorder.on(ContextRecorder.Events.Change, (data: { sources: Source[], primaryFileName: string }) => {
      this._recorderSources = data.sources;
      this._pushAllSources();
      this._recorderApp?.setFileIfNeeded(data.primaryFileName);
    });
    this.setOutput(this._currentLanguage);

    await this._context.exposeBinding('__pw_recorderState', false, source => {
      let actionSelector = '';
      actionSelector = this._highlightedSelector;

      const uiState: UIState = {
        mode: this._mode,
        actionSelector,
        language: this._currentLanguage,
        testIdAttributeName: this._contextRecorder.testIdAttributeName(),
        overlay: this._overlayState,
      };
      return uiState;
    });

    await this._context.exposeBinding('__pw_recorderSetSelector', false, async ({ frame }, selector: string) => {
      const selectorPromises: Promise<string | undefined>[] = [];
      let currentFrame: Frame | null = frame;
      while (currentFrame) {
        selectorPromises.push(findFrameSelector(currentFrame));
        currentFrame = currentFrame.parentFrame();
      }
      const fullSelector = (await Promise.all(selectorPromises)).filter(Boolean);
      fullSelector.push(selector);
      await this._recorderApp?.setSelector(fullSelector.join(' >> internal:control=enter-frame >> '), true);
    });

    await this._context.exposeBinding('__pw_recorderSetMode', false, async ({ frame }, mode: Mode) => {
      if (frame.parentFrame())
        return;
      this.setMode(mode);
    });

    await this._context.exposeBinding('__pw_recorderSetOverlayState', false, async ({ frame }, state: OverlayState) => {
      if (frame.parentFrame())
        return;
      this._overlayState = state;
    });

    await this._contextRecorder.install();
  }

  setMode(mode: Mode) {
    if (this._mode === mode)
      return;
    this._highlightedSelector = '';
    this._mode = mode;
    this._recorderApp?.setMode(this._mode);
    this._contextRecorder.setEnabled(this._mode === 'recording' || this._mode === 'assertingText' || this._mode === 'assertingVisibility' || this._mode === 'assertingValue');
    if (this._mode !== 'none' && this._mode !== 'standby' && this._context.pages().length === 1)
      this._context.pages()[0].bringToFront().catch(() => {});
    this._refreshOverlay();
  }

  mode() {
    return this._mode;
  }

  setHighlightedSelector(language: Language, selector: string) {
    this._highlightedSelector = locatorOrSelectorAsSelector(language, selector, 'data-testid');
    this._refreshOverlay();
  }

  hideHighlightedSelector() {
    this._highlightedSelector = '';
    this._refreshOverlay();
  }

  setOutput(codegenId: string) {
    this._contextRecorder.setOutput(codegenId);
  }

  private _refreshOverlay() {
    for (const page of this._context.pages())
      page.mainFrame().evaluateExpression(() => (window as any).__pw_refreshOverlay?.()).catch(() => {});
  }

  private _pushAllSources() {
    this._recorderApp?.setSources([...this._recorderSources, ...this._userSources.values()]);
  }
}

class ContextRecorder extends EventEmitter {
  static Events = {
    Change: 'change'
  };

  private _generator: CodeGenerator;
  private _pageAliases = new Map<Page, string>();
  private _lastPopupOrdinal = 0;
  private _timers = new Set<NodeJS.Timeout>();
  private _context: BrowserContext;
  private _params: channels.BrowserContextRecorderSupplementEnableParams;
  private _recorderSources: Source[];
  private _orderedLanguages: LanguageGenerator[] = [];
  private _listeners: RegisteredListener[] = [];

  constructor(context: BrowserContext, params: channels.BrowserContextRecorderSupplementEnableParams) {
    super();
    this._context = context;
    this._params = params;
    this._recorderSources = [];
    const language = params.language || 'javascript';
    this.setOutput(language);
    const generator = new CodeGenerator('chrome', params.mode === 'recording', params.launchOptions || {}, params.contextOptions || {}, params.device, params.saveStorage);
    generator.on('change', () => {
      this._recorderSources = [];
      for (const languageGenerator of this._orderedLanguages) {
        const { header, footer, actions, text } = generator.generateStructure(languageGenerator);
        const source: Source = {
          isRecorded: true,
          label: languageGenerator.name,
          group: languageGenerator.groupName,
          id: languageGenerator.id,
          text,
          header,
          footer,
          actions,
          language: languageGenerator.highlighter,
          highlight: []
        };
        source.revealLine = text.split('\n').length - 1;
        this._recorderSources.push(source);
      }
      this.emit(ContextRecorder.Events.Change, {
        sources: this._recorderSources,
        primaryFileName: this._orderedLanguages[0].id
      });
    });
    this._generator = generator;
  }

  setOutput(codegenId: string) {
    const languages = new Set([
      new JavaLanguageGenerator('junit'),
      new JavaLanguageGenerator('library'),
      new JavaScriptLanguageGenerator(/* isPlaywrightTest */false),
      new JavaScriptLanguageGenerator(/* isPlaywrightTest */true),
      new PythonLanguageGenerator(/* isAsync */false, /* isPytest */true),
      new PythonLanguageGenerator(/* isAsync */false, /* isPytest */false),
      new PythonLanguageGenerator(/* isAsync */true,  /* isPytest */false),
      new CSharpLanguageGenerator('mstest'),
      new CSharpLanguageGenerator('nunit'),
      new CSharpLanguageGenerator('library'),
      new JsonlLanguageGenerator(),
    ]);
    const primaryLanguage = [...languages].find(l => l.id === codegenId);
    if (!primaryLanguage)
      throw new Error(`\n===============================\nUnsupported language: '${codegenId}'\n===============================\n`);
    languages.delete(primaryLanguage);
    this._orderedLanguages = [primaryLanguage, ...languages];
    this._generator?.restart();
  }

  languageName(id?: string): Language {
    for (const lang of this._orderedLanguages) {
      if (!id || lang.id === id)
        return lang.highlighter;
    }
    return 'javascript';
  }

  async install() {
    this._context.on(BrowserContext.Events.Page, (page: Page) => this._onPage(page));
    for (const page of this._context.pages())
      this._onPage(page);

    // Other non-essential actions are simply being recorded.
    await this._context.exposeBinding('__pw_recorderRecordAction', false,
        (source: BindingSource, action: actions.Action) => this._recordAction(source.frame, action));

    await this._context.extendInjectedScript(recorderSource.source);
  }

  setEnabled(enabled: boolean) {
    this._generator.setEnabled(enabled);
  }

  dispose() {
    for (const timer of this._timers)
      clearTimeout(timer);
    this._timers.clear();
    eventsHelper.removeEventListeners(this._listeners);
  }

  private async _onPage(page: Page) {
    // First page is called page, others are called popup1, popup2, etc.
    const frame = page.mainFrame();
    page.on(Page.Events.Close, () => {
      this._generator.addAction({
        frame: this._describeMainFrame(page),
        committed: true,
        action: {
          name: 'closePage',
          signals: [],
        }
      });
      this._pageAliases.delete(page);
    });
    frame.on(Frame.Events.InternalNavigation, event => {
      if (event.isPublic)
        this._onFrameNavigated(frame, page);
    });
    const suffix = this._pageAliases.size ? String(++this._lastPopupOrdinal) : '';
    const pageAlias = 'page' + suffix;
    this._pageAliases.set(page, pageAlias);

    if (page.opener()) {
      this._onPopup(page.opener()!, page);
    } else {
      this._generator.addAction({
        frame: this._describeMainFrame(page),
        committed: true,
        action: {
          name: 'openPage',
          url: page.mainFrame().url(),
          signals: [],
        }
      });
    }
  }

  clearScript(): void {
    this._generator.restart();
    if (this._params.mode === 'recording') {
      for (const page of this._context.pages())
        this._onFrameNavigated(page.mainFrame(), page);
    }
  }

  private _describeMainFrame(page: Page): actions.FrameDescription {
    return {
      pageAlias: this._pageAliases.get(page)!,
      isMainFrame: true,
    };
  }

  private async _describeFrame(frame: Frame): Promise<actions.FrameDescription> {
    const page = frame._page;
    const pageAlias = this._pageAliases.get(page)!;
    const chain: Frame[] = [];
    for (let ancestor: Frame | null = frame; ancestor; ancestor = ancestor.parentFrame())
      chain.push(ancestor);
    chain.reverse();

    if (chain.length === 1)
      return this._describeMainFrame(page);

    const selectorPromises: Promise<string | undefined>[] = [];
    for (let i = 0; i < chain.length - 1; i++)
      selectorPromises.push(findFrameSelector(chain[i + 1]));

    const result = await raceAgainstDeadline(() => Promise.all(selectorPromises), monotonicTime() + 2000);
    if (!result.timedOut && result.result.every(selector => !!selector)) {
      return {
        pageAlias,
        isMainFrame: false,
        selectorsChain: result.result as string[],
      };
    }
    // Best effort to find a selector for the frame.
    const selectorsChain = [];
    for (let i = 0; i < chain.length - 1; i++) {
      if (chain[i].name())
        selectorsChain.push(`iframe[name=${quoteCSSAttributeValue(chain[i].name())}]`);
      else
        selectorsChain.push(`iframe[src=${quoteCSSAttributeValue(chain[i].url())}]`);
    }
    return {
      pageAlias,
      isMainFrame: false,
      selectorsChain,
    };
  }

  testIdAttributeName(): string {
    return this._params.testIdAttributeName || 'data-testid';
  }

  private async _recordAction(frame: Frame, action: actions.Action) {
    // Commit last action so that no further signals are added to it.
    this._generator.commitLastAction();

    const frameDescription = await this._describeFrame(frame);
    const actionInContext: ActionInContext = {
      frame: frameDescription,
      action
    };
    this._setCommittedAfterTimeout(actionInContext);
    this._generator.addAction(actionInContext);
  }

  private _setCommittedAfterTimeout(actionInContext: ActionInContext) {
    const timer = setTimeout(() => {
      // Commit the action after 5 seconds so that no further signals are added to it.
      actionInContext.committed = true;
      this._timers.delete(timer);
    }, 5000);
    this._timers.add(timer);
  }

  private _onFrameNavigated(frame: Frame, page: Page) {
    if (frame._page.mainFrame() !== frame)
      return;
    const pageAlias = this._pageAliases.get(page);
    this._generator.signal(pageAlias!, { name: 'navigation', url: frame.url() });
  }

  private _onPopup(page: Page, popup: Page) {
    const pageAlias = this._pageAliases.get(page)!;
    const popupAlias = this._pageAliases.get(popup)!;
    this._generator.signal(pageAlias, { name: 'popup', popupAlias });
  }
}

async function findFrameSelector(frame: Frame): Promise<string | undefined> {
  try {
    const parent = frame.parentFrame();
    if (!parent)
      return;
    return await frame.evaluateExpression(options => {
      if (window.frameElement)
        return (window as any)['__pw_injectedScript'].generateSelectorSimple(window.frameElement, options);
    }, { testIdAttributeName: '', omitInternalEngines: true });
  } catch (e) {
  }
}
