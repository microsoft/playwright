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

import * as fs from 'fs';
import * as actions from './recorder/recorderActions';
import type * as channels from '../../protocol/channels';
import { CodeGenerator, ActionInContext } from './recorder/codeGenerator';
import { describeFrame, toClickOptions, toModifiers } from './recorder/utils';
import { Page } from '../page';
import { Frame } from '../frames';
import { BrowserContext } from '../browserContext';
import { JavaLanguageGenerator } from './recorder/java';
import { JavaScriptLanguageGenerator } from './recorder/javascript';
import { CSharpLanguageGenerator } from './recorder/csharp';
import { PythonLanguageGenerator } from './recorder/python';
import * as recorderSource from '../../generated/recorderSource';
import * as consoleApiSource from '../../generated/consoleApiSource';
import { RecorderApp } from './recorder/recorderApp';
import { CallMetadata, InstrumentationListener, SdkObject } from '../instrumentation';
import { Point } from '../../common/types';
import { CallLog, CallLogStatus, EventData, Mode, Source, UIState } from './recorder/recorderTypes';
import { createGuid, isUnderTest, monotonicTime } from '../../utils/utils';
import { metadataToCallLog } from './recorder/recorderUtils';
import { Debugger } from './debugger';
import { EventEmitter } from 'events';

type BindingSource = { frame: Frame, page: Page };

const symbol = Symbol('RecorderSupplement');

export class RecorderSupplement implements InstrumentationListener {
  private _context: BrowserContext;
  private _mode: Mode;
  private _highlightedSelector = '';
  private _recorderApp: RecorderApp | null = null;
  private _currentCallsMetadata = new Map<CallMetadata, SdkObject>();
  private _recorderSources: Source[] = [];
  private _userSources = new Map<string, Source>();
  private _allMetadatas = new Map<string, CallMetadata>();
  private _debugger: Debugger;
  private _contextRecorder: ContextRecorder;

  static showInspector(context: BrowserContext) {
    RecorderSupplement.show(context, {}).catch(() => {});
  }

  static show(context: BrowserContext, params: channels.BrowserContextRecorderSupplementEnableParams = {}): Promise<RecorderSupplement> {
    let recorderPromise = (context as any)[symbol] as Promise<RecorderSupplement>;
    if (!recorderPromise) {
      const recorder = new RecorderSupplement(context, params);
      recorderPromise = recorder.install().then(() => recorder);
      (context as any)[symbol] = recorderPromise;
    }
    return recorderPromise;
  }

  constructor(context: BrowserContext, params: channels.BrowserContextRecorderSupplementEnableParams) {
    this._mode = params.startRecording ? 'recording' : 'none';
    this._contextRecorder = new ContextRecorder(context, params);
    this._context = context;
    this._debugger = Debugger.lookup(context)!;
    context.instrumentation.addListener(this);
  }

  async install() {
    const recorderApp = await RecorderApp.open(this._context._browser.options.sdkLanguage, !!this._context._browser.options.headful);
    this._recorderApp = recorderApp;
    recorderApp.once('close', () => {
      this._debugger.resume(false);
      this._recorderApp = null;
    });
    recorderApp.on('event', (data: EventData) => {
      if (data.event === 'setMode') {
        this._setMode(data.params.mode);
        this._refreshOverlay();
        return;
      }
      if (data.event === 'selectorUpdated') {
        this._highlightedSelector = data.params.selector;
        this._refreshOverlay();
        return;
      }
      if (data.event === 'step') {
        this._debugger.resume(true);
        return;
      }
      if (data.event === 'resume') {
        this._debugger.resume(false);
        return;
      }
      if (data.event === 'pause') {
        this._debugger.pauseOnNextStatement();
        return;
      }
      if (data.event === 'clear') {
        this._contextRecorder.clearScript();
        return;
      }
    });

    await Promise.all([
      recorderApp.setMode(this._mode),
      recorderApp.setPaused(this._debugger.isPaused()),
      this._pushAllSources()
    ]);

    this._context.once(BrowserContext.Events.Close, () => {
      this._contextRecorder.dispose();
      recorderApp.close().catch(() => {});
    });
    this._contextRecorder.on(ContextRecorder.Events.Change, (data: { sources: Source[], primaryFileName: string }) => {
      this._recorderSources = data.sources;
      this._pushAllSources();
      this._recorderApp?.setFile(data.primaryFileName);
    });

    await this._context.exposeBinding('_playwrightRecorderState', false, source => {
      let actionSelector = this._highlightedSelector;
      let actionPoint: Point | undefined;
      for (const [metadata, sdkObject] of this._currentCallsMetadata) {
        if (source.page === sdkObject.attribution.page) {
          actionPoint = metadata.point || actionPoint;
          actionSelector = actionSelector || metadata.params.selector;
        }
      }
      const uiState: UIState = {
        mode: this._mode,
        actionPoint,
        actionSelector,
      };
      return uiState;
    });

    await this._context.exposeBinding('_playwrightRecorderSetSelector', false, async (_, selector: string) => {
      this._setMode('none');
      await this._recorderApp?.setSelector(selector, true);
      await this._recorderApp?.bringToFront();
    });

    await this._context.exposeBinding('_playwrightResume', false, () => {
      this._debugger.resume(false);
    });
    await this._context.extendInjectedScript(consoleApiSource.source);

    await this._contextRecorder.install();

    if (this._debugger.isPaused())
      this._pausedStateChanged();
    this._debugger.on(Debugger.Events.PausedStateChanged, () => this._pausedStateChanged());

    (this._context as any).recorderAppForTest = recorderApp;
  }

  _pausedStateChanged() {
    // If we are called upon page.pause, we don't have metadatas, populate them.
    for (const { metadata, sdkObject } of this._debugger.pausedDetails()) {
      if (!this._currentCallsMetadata.has(metadata))
        this.onBeforeCall(sdkObject, metadata);
    }
    this._recorderApp?.setPaused(this._debugger.isPaused());
    this._updateUserSources();
    this.updateCallLog([...this._currentCallsMetadata.keys()]);
  }

  private _setMode(mode: Mode) {
    this._mode = mode;
    this._recorderApp?.setMode(this._mode);
    this._contextRecorder.setEnabled(this._mode === 'recording');
    this._debugger.setMuted(this._mode === 'recording');
    if (this._mode !== 'none')
      this._context.pages()[0].bringToFront().catch(() => {});
  }

  private _refreshOverlay() {
    for (const page of this._context.pages())
      page.mainFrame().evaluateExpression('window._playwrightRefreshOverlay()', false, undefined, 'main').catch(() => {});
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata) {
    if (this._mode === 'recording')
      return;
    this._currentCallsMetadata.set(metadata, sdkObject);
    this._allMetadatas.set(metadata.id, metadata);
    this._updateUserSources();
    this.updateCallLog([metadata]);
    if (metadata.params && metadata.params.selector) {
      this._highlightedSelector = metadata.params.selector;
      this._recorderApp?.setSelector(this._highlightedSelector).catch(() => {});
    }
  }

  async onAfterCall(sdkObject: SdkObject, metadata: CallMetadata) {
    if (this._mode === 'recording')
      return;
    if (!metadata.error)
      this._currentCallsMetadata.delete(metadata);
    this._updateUserSources();
    this.updateCallLog([metadata]);
  }

  private _updateUserSources() {
    // Remove old decorations.
    for (const source of this._userSources.values()) {
      source.highlight = [];
      source.revealLine = undefined;
    }

    // Apply new decorations.
    let fileToSelect = undefined;
    for (const metadata of this._currentCallsMetadata.keys()) {
      if (!metadata.stack || !metadata.stack[0])
        continue;
      const { file, line } = metadata.stack[0];
      let source = this._userSources.get(file);
      if (!source) {
        source = { file, text: this._readSource(file), highlight: [], language: languageForFile(file) };
        this._userSources.set(file, source);
      }
      if (line) {
        const paused = this._debugger.isPaused(metadata);
        source.highlight.push({ line, type: metadata.error ? 'error' : (paused ? 'paused' : 'running') });
        source.revealLine = line;
        fileToSelect = source.file;
      }
    }
    this._pushAllSources();
    if (fileToSelect)
      this._recorderApp?.setFile(fileToSelect);
  }

  private _pushAllSources() {
    this._recorderApp?.setSources([...this._recorderSources, ...this._userSources.values()]);
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata) {
  }

  async onCallLog(logName: string, message: string, sdkObject: SdkObject, metadata: CallMetadata): Promise<void> {
    this.updateCallLog([metadata]);
  }

  updateCallLog(metadatas: CallMetadata[]) {
    if (this._mode === 'recording')
      return;
    const logs: CallLog[] = [];
    for (const metadata of metadatas) {
      if (!metadata.method)
        continue;
      let status: CallLogStatus = 'done';
      if (this._currentCallsMetadata.has(metadata))
        status = 'in-progress';
      if (this._debugger.isPaused(metadata))
        status = 'paused';
      logs.push(metadataToCallLog(metadata, status));
    }
    this._recorderApp?.updateCallLogs(logs);
  }

  private _readSource(fileName: string): string {
    try {
      return fs.readFileSync(fileName, 'utf-8');
    } catch (e) {
      return '// No source available';
    }
  }
}

class ContextRecorder extends EventEmitter {
  static Events = {
    Change: 'change'
  };

  private _generator: CodeGenerator;
  private _pageAliases = new Map<Page, string>();
  private _lastPopupOrdinal = 0;
  private _lastDialogOrdinal = 0;
  private _lastDownloadOrdinal = 0;
  private _timers = new Set<NodeJS.Timeout>();
  private _context: BrowserContext;
  private _params: channels.BrowserContextRecorderSupplementEnableParams;
  private _recorderSources: Source[];

  constructor(context: BrowserContext, params: channels.BrowserContextRecorderSupplementEnableParams) {
    super();
    this._context = context;
    this._params = params;
    const language = params.language || context._browser.options.sdkLanguage;

    const languages = new Set([
      new JavaLanguageGenerator(),
      new JavaScriptLanguageGenerator(false),
      new JavaScriptLanguageGenerator(true),
      new PythonLanguageGenerator(false),
      new PythonLanguageGenerator(true),
      new CSharpLanguageGenerator(),
    ]);
    const primaryLanguage = [...languages].find(l => l.id === language)!;
    if (!primaryLanguage)
      throw new Error(`\n===============================\nUnsupported language: '${language}'\n===============================\n`);

    languages.delete(primaryLanguage);
    const orderedLanguages = [primaryLanguage, ...languages];

    this._recorderSources = [];
    const generator = new CodeGenerator(context._browser.options.name, !!params.startRecording, params.launchOptions || {}, params.contextOptions || {}, params.device, params.saveStorage);
    let text = '';
    generator.on('change', () => {
      this._recorderSources = [];
      for (const languageGenerator of orderedLanguages) {
        const source: Source = {
          file: languageGenerator.fileName,
          text: generator.generateText(languageGenerator),
          language: languageGenerator.highlighter,
          highlight: []
        };
        source.revealLine = source.text.split('\n').length - 1;
        this._recorderSources.push(source);
        if (languageGenerator === orderedLanguages[0])
          text = source.text;
      }
      this.emit(ContextRecorder.Events.Change, {
        sources: this._recorderSources,
        primaryFileName: primaryLanguage.fileName
      });
    });
    if (params.outputFile) {
      context.on(BrowserContext.Events.BeforeClose, () => {
        fs.writeFileSync(params.outputFile!, text);
        text = '';
      });
      process.on('exit', () => {
        if (text)
          fs.writeFileSync(params.outputFile!, text);
      });
    }
    this._generator = generator;
  }

  async install() {
    this._context.on(BrowserContext.Events.Page, page => this._onPage(page));
    for (const page of this._context.pages())
      this._onPage(page);

    // Input actions that potentially lead to navigation are intercepted on the page and are
    // performed by the Playwright.
    await this._context.exposeBinding('_playwrightRecorderPerformAction', false,
        (source: BindingSource, action: actions.Action) => this._performAction(source.frame, action));

    // Other non-essential actions are simply being recorded.
    await this._context.exposeBinding('_playwrightRecorderRecordAction', false,
        (source: BindingSource, action: actions.Action) => this._recordAction(source.frame, action));

    await this._context.extendInjectedScript(recorderSource.source, { isUnderTest: isUnderTest() });
  }

  setEnabled(enabled: boolean) {
    this._generator.setEnabled(enabled);
  }

  dispose() {
    for (const timer of this._timers)
      clearTimeout(timer);
    this._timers.clear();
  }

  private async _onPage(page: Page) {
    // First page is called page, others are called popup1, popup2, etc.
    const frame = page.mainFrame();
    page.on('close', () => {
      this._pageAliases.delete(page);
      this._generator.addAction({
        pageAlias,
        ...describeFrame(page.mainFrame()),
        committed: true,
        action: {
          name: 'closePage',
          signals: [],
        }
      });
    });
    frame.on(Frame.Events.Navigation, () => this._onFrameNavigated(frame, page));
    page.on(Page.Events.Download, () => this._onDownload(page));
    page.on(Page.Events.Dialog, () => this._onDialog(page));
    const suffix = this._pageAliases.size ? String(++this._lastPopupOrdinal) : '';
    const pageAlias = 'page' + suffix;
    this._pageAliases.set(page, pageAlias);

    if (page.opener()) {
      this._onPopup(page.opener()!, page);
    } else {
      this._generator.addAction({
        pageAlias,
        ...describeFrame(page.mainFrame()),
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
    if (!!this._params.startRecording) {
      for (const page of this._context.pages())
        this._onFrameNavigated(page.mainFrame(), page);
    }
  }

  private async _performAction(frame: Frame, action: actions.Action) {
    // Commit last action so that no further signals are added to it.
    this._generator.commitLastAction();

    const page = frame._page;
    const actionInContext: ActionInContext = {
      pageAlias: this._pageAliases.get(page)!,
      ...describeFrame(frame),
      action
    };

    const perform = async (action: string, params: any, cb: (callMetadata: CallMetadata) => Promise<any>) => {
      const callMetadata: CallMetadata = {
        id: `call@${createGuid()}`,
        apiName: 'frame.' + action,
        objectId: frame.guid,
        pageId: frame._page.guid,
        frameId: frame.guid,
        wallTime: Date.now(),
        startTime: monotonicTime(),
        endTime: 0,
        type: 'Frame',
        method: action,
        params,
        log: [],
        snapshots: [],
      };
      this._generator.willPerformAction(actionInContext);

      try {
        await frame.instrumentation.onBeforeCall(frame, callMetadata);
        await cb(callMetadata);
      } catch (e) {
        callMetadata.endTime = monotonicTime();
        await frame.instrumentation.onAfterCall(frame, callMetadata);
        this._generator.performedActionFailed(actionInContext);
        return;
      }

      callMetadata.endTime = monotonicTime();
      await frame.instrumentation.onAfterCall(frame, callMetadata);

      const timer = setTimeout(() => {
        // Commit the action after 5 seconds so that no further signals are added to it.
        actionInContext.committed = true;
        this._timers.delete(timer);
      }, 5000);
      this._generator.didPerformAction(actionInContext);
      this._timers.add(timer);
    };

    const kActionTimeout = 5000;
    if (action.name === 'click') {
      const { options } = toClickOptions(action);
      await perform('click', { selector: action.selector }, callMetadata => frame.click(callMetadata, action.selector, { ...options, timeout: kActionTimeout }));
    }
    if (action.name === 'press') {
      const modifiers = toModifiers(action.modifiers);
      const shortcut = [...modifiers, action.key].join('+');
      await perform('press', { selector: action.selector, key: shortcut }, callMetadata => frame.press(callMetadata, action.selector, shortcut, { timeout: kActionTimeout }));
    }
    if (action.name === 'check')
      await perform('check', { selector: action.selector }, callMetadata => frame.check(callMetadata, action.selector, { timeout: kActionTimeout }));
    if (action.name === 'uncheck')
      await perform('uncheck', { selector: action.selector }, callMetadata => frame.uncheck(callMetadata, action.selector, { timeout: kActionTimeout }));
    if (action.name === 'select') {
      const values = action.options.map(value => ({ value }));
      await perform('selectOption', { selector: action.selector, values }, callMetadata => frame.selectOption(callMetadata, action.selector, [], values, { timeout: kActionTimeout }));
    }
  }

  private async _recordAction(frame: Frame, action: actions.Action) {
    // Commit last action so that no further signals are added to it.
    this._generator.commitLastAction();

    this._generator.addAction({
      pageAlias: this._pageAliases.get(frame._page)!,
      ...describeFrame(frame),
      action
    });
  }

  private _onFrameNavigated(frame: Frame, page: Page) {
    const pageAlias = this._pageAliases.get(page);
    this._generator.signal(pageAlias!, frame, { name: 'navigation', url: frame.url() });
  }

  private _onPopup(page: Page, popup: Page) {
    const pageAlias = this._pageAliases.get(page)!;
    const popupAlias = this._pageAliases.get(popup)!;
    this._generator.signal(pageAlias, page.mainFrame(), { name: 'popup', popupAlias });
  }

  private _onDownload(page: Page) {
    const pageAlias = this._pageAliases.get(page)!;
    this._generator.signal(pageAlias, page.mainFrame(), { name: 'download', downloadAlias: String(++this._lastDownloadOrdinal) });
  }

  private _onDialog(page: Page) {
    const pageAlias = this._pageAliases.get(page)!;
    this._generator.signal(pageAlias, page.mainFrame(), { name: 'dialog', dialogAlias: String(++this._lastDialogOrdinal) });
  }
}

function languageForFile(file: string) {
  if (file.endsWith('.py'))
    return 'python';
  if (file.endsWith('.java'))
    return 'java';
  if (file.endsWith('.cs'))
    return 'csharp';
  return 'javascript';
}
