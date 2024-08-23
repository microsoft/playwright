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
import type * as actions from './recorder/recorderActions';
import type * as channels from '@protocol/channels';
import type { ActionInContext } from './recorder/codeGenerator';
import { CodeGenerator } from './recorder/codeGenerator';
import { toClickOptions, toModifiers } from './recorder/utils';
import { Page } from './page';
import { Frame } from './frames';
import { BrowserContext } from './browserContext';
import { JavaLanguageGenerator } from './recorder/java';
import { JavaScriptLanguageGenerator } from './recorder/javascript';
import { JsonlLanguageGenerator } from './recorder/jsonl';
import { CSharpLanguageGenerator } from './recorder/csharp';
import { PythonLanguageGenerator } from './recorder/python';
import * as recorderSource from '../generated/recorderSource';
import * as consoleApiSource from '../generated/consoleApiSource';
import { EmptyRecorderApp } from './recorder/recorderApp';
import type { IRecorderApp } from './recorder/recorderApp';
import { RecorderApp } from './recorder/recorderApp';
import type { CallMetadata, InstrumentationListener, SdkObject } from './instrumentation';
import type { Point } from '../common/types';
import type { CallLog, CallLogStatus, EventData, Mode, OverlayState, Source, UIState } from '@recorder/recorderTypes';
import { createGuid, isUnderTest, monotonicTime, serializeExpectedTextValues } from '../utils';
import { metadataToCallLog } from './recorder/recorderUtils';
import { Debugger } from './debugger';
import { EventEmitter } from 'events';
import { raceAgainstDeadline } from '../utils/timeoutRunner';
import type { Language, LanguageGenerator } from './recorder/language';
import { locatorOrSelectorAsSelector } from '../utils/isomorphic/locatorParser';
import { quoteCSSAttributeValue, eventsHelper, type RegisteredListener } from '../utils';
import type { Dialog } from './dialog';

type BindingSource = { frame: Frame, page: Page };

const recorderSymbol = Symbol('recorderSymbol');

export class Recorder implements InstrumentationListener {
  private _context: BrowserContext;
  private _mode: Mode;
  private _highlightedSelector = '';
  private _overlayState: OverlayState = { offsetX: 0 };
  private _recorderApp: IRecorderApp | null = null;
  private _currentCallsMetadata = new Map<CallMetadata, SdkObject>();
  private _recorderSources: Source[] = [];
  private _userSources = new Map<string, Source>();
  private _debugger: Debugger;
  private _contextRecorder: ContextRecorder;
  private _handleSIGINT: boolean | undefined;
  private _omitCallTracking = false;
  private _currentLanguage: Language;

  private static recorderAppFactory: ((recorder: Recorder) => Promise<IRecorderApp>) | undefined;

  static setAppFactory(recorderAppFactory: ((recorder: Recorder) => Promise<IRecorderApp>) | undefined) {
    Recorder.recorderAppFactory = recorderAppFactory;
  }

  static showInspector(context: BrowserContext) {
    const params: channels.BrowserContextRecorderSupplementEnableParams = {};
    if (isUnderTest())
      params.language = process.env.TEST_INSPECTOR_LANGUAGE;
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
    this._omitCallTracking = !!params.omitCallTracking;
    this._debugger = context.debugger();
    this._handleSIGINT = params.handleSIGINT;
    context.instrumentation.addListener(this, context);
    this._currentLanguage = this._contextRecorder.languageName();

    if (isUnderTest()) {
      // Most of our tests put elements at the top left, so get out of the way.
      this._overlayState.offsetX = 200;
    }
  }

  private static async defaultRecorderAppFactory(recorder: Recorder) {
    if (process.env.PW_CODEGEN_NO_INSPECTOR)
      return new EmptyRecorderApp();
    return await RecorderApp.open(recorder, recorder._context, recorder._handleSIGINT);
  }

  async install() {
    const recorderApp = await (Recorder.recorderAppFactory || Recorder.defaultRecorderAppFactory)(this);
    this._recorderApp = recorderApp;
    recorderApp.once('close', () => {
      this._debugger.resume(false);
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
      if (data.event === 'step') {
        this._debugger.resume(true);
        return;
      }
      if (data.event === 'fileChanged') {
        this._currentLanguage = this._contextRecorder.languageName(data.params.file);
        this._refreshOverlay();
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
      this._context.instrumentation.removeListener(this);
      recorderApp.close().catch(() => {});
    });
    this._contextRecorder.on(ContextRecorder.Events.Change, (data: { sources: Source[], primaryFileName: string }) => {
      this._recorderSources = data.sources;
      this._pushAllSources();
      this._recorderApp?.setFileIfNeeded(data.primaryFileName);
    });

    await this._context.exposeBinding('__pw_recorderState', false, source => {
      let actionSelector = '';
      let actionPoint: Point | undefined;
      const hasActiveScreenshotCommand = [...this._currentCallsMetadata.keys()].some(isScreenshotCommand);
      if (!hasActiveScreenshotCommand) {
        actionSelector = this._highlightedSelector;
        for (const [metadata, sdkObject] of this._currentCallsMetadata) {
          if (source.page === sdkObject.attribution.page) {
            actionPoint = metadata.point || actionPoint;
            actionSelector = actionSelector || metadata.params.selector;
          }
        }
      }
      const uiState: UIState = {
        mode: this._mode,
        actionPoint,
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

    await this._context.exposeBinding('__pw_resume', false, () => {
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

  setMode(mode: Mode) {
    if (this._mode === mode)
      return;
    this._highlightedSelector = '';
    this._mode = mode;
    this._recorderApp?.setMode(this._mode);
    this._contextRecorder.setEnabled(this._mode === 'recording' || this._mode === 'assertingText' || this._mode === 'assertingVisibility' || this._mode === 'assertingValue');
    this._debugger.setMuted(this._mode === 'recording' || this._mode === 'assertingText' || this._mode === 'assertingVisibility' || this._mode === 'assertingValue');
    if (this._mode !== 'none' && this._mode !== 'standby' && this._context.pages().length === 1)
      this._context.pages()[0].bringToFront().catch(() => {});
    this._refreshOverlay();
  }

  resume() {
    this._debugger.resume(false);
  }

  mode() {
    return this._mode;
  }

  setHighlightedSelector(language: Language, selector: string) {
    this._highlightedSelector = locatorOrSelectorAsSelector(language, selector, this._context.selectors().testIdAttributeName());
    this._refreshOverlay();
  }

  hideHighlightedSelector() {
    this._highlightedSelector = '';
    this._refreshOverlay();
  }

  setOutput(codegenId: string, outputFile: string | undefined) {
    this._contextRecorder.setOutput(codegenId, outputFile);
  }

  private _refreshOverlay() {
    for (const page of this._context.pages())
      page.mainFrame().evaluateExpression('window.__pw_refreshOverlay()').catch(() => {});
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata) {
    if (this._omitCallTracking || this._mode === 'recording' || this._mode === 'assertingText' || this._mode === 'assertingVisibility' || this._mode === 'assertingValue')
      return;
    this._currentCallsMetadata.set(metadata, sdkObject);
    this._updateUserSources();
    this.updateCallLog([metadata]);
    if (isScreenshotCommand(metadata)) {
      this.hideHighlightedSelector();
    } else if (metadata.params && metadata.params.selector) {
      this._highlightedSelector = metadata.params.selector;
      this._recorderApp?.setSelector(this._highlightedSelector).catch(() => {});
    }
  }

  async onAfterCall(sdkObject: SdkObject, metadata: CallMetadata) {
    if (this._omitCallTracking || this._mode === 'recording' || this._mode === 'assertingText' || this._mode === 'assertingVisibility' || this._mode === 'assertingValue')
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
      if (!metadata.location)
        continue;
      const { file, line } = metadata.location;
      let source = this._userSources.get(file);
      if (!source) {
        source = { isRecorded: false, label: file, id: file, text: this._readSource(file), highlight: [], language: languageForFile(file) };
        this._userSources.set(file, source);
      }
      if (line) {
        const paused = this._debugger.isPaused(metadata);
        source.highlight.push({ line, type: metadata.error ? 'error' : (paused ? 'paused' : 'running') });
        source.revealLine = line;
        fileToSelect = source.id;
      }
    }
    this._pushAllSources();
    if (fileToSelect)
      this._recorderApp?.setFileIfNeeded(fileToSelect);
  }

  private _pushAllSources() {
    this._recorderApp?.setSources([...this._recorderSources, ...this._userSources.values()]);
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata) {
  }

  async onCallLog(sdkObject: SdkObject, metadata: CallMetadata, logName: string, message: string): Promise<void> {
    this.updateCallLog([metadata]);
  }

  updateCallLog(metadatas: CallMetadata[]) {
    if (this._mode === 'recording' || this._mode === 'assertingText' || this._mode === 'assertingVisibility' || this._mode === 'assertingValue')
      return;
    const logs: CallLog[] = [];
    for (const metadata of metadatas) {
      if (!metadata.method || metadata.internal)
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
  private _lastDialogOrdinal = -1;
  private _lastDownloadOrdinal = -1;
  private _timers = new Set<NodeJS.Timeout>();
  private _context: BrowserContext;
  private _params: channels.BrowserContextRecorderSupplementEnableParams;
  private _recorderSources: Source[];
  private _throttledOutputFile: ThrottledFile | null = null;
  private _orderedLanguages: LanguageGenerator[] = [];
  private _listeners: RegisteredListener[] = [];

  constructor(context: BrowserContext, params: channels.BrowserContextRecorderSupplementEnableParams) {
    super();
    this._context = context;
    this._params = params;
    this._recorderSources = [];
    const language = params.language || context.attribution.playwright.options.sdkLanguage;
    this.setOutput(language, params.outputFile);
    const generator = new CodeGenerator(context._browser.options.name, params.mode === 'recording', params.launchOptions || {}, params.contextOptions || {}, params.device, params.saveStorage);
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
        if (languageGenerator === this._orderedLanguages[0])
          this._throttledOutputFile?.setContent(source.text);
      }
      this.emit(ContextRecorder.Events.Change, {
        sources: this._recorderSources,
        primaryFileName: this._orderedLanguages[0].id
      });
    });
    context.on(BrowserContext.Events.BeforeClose, () => {
      this._throttledOutputFile?.flush();
    });
    this._listeners.push(eventsHelper.addEventListener(process, 'exit', () => {
      this._throttledOutputFile?.flush();
    }));
    this._generator = generator;
  }

  setOutput(codegenId: string, outputFile?: string) {
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
    this._throttledOutputFile = outputFile ? new ThrottledFile(outputFile) : null;
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
    this._context.on(BrowserContext.Events.Dialog, (dialog: Dialog) => this._onDialog(dialog.page()));

    // Input actions that potentially lead to navigation are intercepted on the page and are
    // performed by the Playwright.
    await this._context.exposeBinding('__pw_recorderPerformAction', false,
        (source: BindingSource, action: actions.PerformOnRecordAction) => this._performAction(source.frame, action));

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
    page.on('close', () => {
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
    page.on(Page.Events.Download, () => this._onDownload(page));
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
    return this._params.testIdAttributeName || this._context.selectors().testIdAttributeName() || 'data-testid';
  }

  private async _performAction(frame: Frame, action: actions.PerformOnRecordAction) {
    // Commit last action so that no further signals are added to it.
    this._generator.commitLastAction();

    const frameDescription = await this._describeFrame(frame);
    const actionInContext: ActionInContext = {
      frame: frameDescription,
      action
    };

    this._generator.willPerformAction(actionInContext);
    const success = await performAction(frame, action);
    if (success) {
      this._generator.didPerformAction(actionInContext);
      this._setCommittedAfterTimeout(actionInContext);
    } else {
      this._generator.performedActionFailed(actionInContext);
    }
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
    }, isUnderTest() ? 500 : 5000);
    this._timers.add(timer);
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
    ++this._lastDownloadOrdinal;
    this._generator.signal(pageAlias, page.mainFrame(), { name: 'download', downloadAlias: this._lastDownloadOrdinal ? String(this._lastDownloadOrdinal) : '' });
  }

  private _onDialog(page: Page) {
    const pageAlias = this._pageAliases.get(page)!;
    ++this._lastDialogOrdinal;
    this._generator.signal(pageAlias, page.mainFrame(), { name: 'dialog', dialogAlias: this._lastDialogOrdinal ? String(this._lastDialogOrdinal) : '' });
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

class ThrottledFile {
  private _file: string;
  private _timer: NodeJS.Timeout | undefined;
  private _text: string | undefined;

  constructor(file: string) {
    this._file = file;
  }

  setContent(text: string) {
    this._text = text;
    if (!this._timer)
      this._timer = setTimeout(() => this.flush(), 250);
  }

  flush(): void {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
    if (this._text)
      fs.writeFileSync(this._file, this._text);
    this._text = undefined;
  }
}

function isScreenshotCommand(metadata: CallMetadata) {
  return metadata.method.toLowerCase().includes('screenshot');
}

async function findFrameSelector(frame: Frame): Promise<string | undefined> {
  try {
    const parent = frame.parentFrame();
    const frameElement = await frame.frameElement();
    if (!frameElement || !parent)
      return;
    const utility = await parent._utilityContext();
    const injected = await utility.injectedScript();
    const selector = await injected.evaluate((injected, element) => {
      return injected.generateSelectorSimple(element as Element, { testIdAttributeName: '', omitInternalEngines: true });
    }, frameElement);
    return selector;
  } catch (e) {
  }
}

async function innerPerformAction(frame: Frame, action: string, params: any, cb: (callMetadata: CallMetadata) => Promise<any>): Promise<boolean> {
  const callMetadata: CallMetadata = {
    id: `call@${createGuid()}`,
    apiName: 'frame.' + action,
    objectId: frame.guid,
    pageId: frame._page.guid,
    frameId: frame.guid,
    startTime: monotonicTime(),
    endTime: 0,
    type: 'Frame',
    method: action,
    params,
    log: [],
  };

  try {
    await frame.instrumentation.onBeforeCall(frame, callMetadata);
    await cb(callMetadata);
  } catch (e) {
    callMetadata.endTime = monotonicTime();
    await frame.instrumentation.onAfterCall(frame, callMetadata);
    return false;
  }

  callMetadata.endTime = monotonicTime();
  await frame.instrumentation.onAfterCall(frame, callMetadata);
  return true;
}

async function performAction(frame: Frame, action: actions.Action): Promise<boolean> {
  const kActionTimeout = 5000;
  if (action.name === 'click') {
    const { options } = toClickOptions(action);
    return await innerPerformAction(frame, 'click', { selector: action.selector }, callMetadata => frame.click(callMetadata, action.selector, { ...options, timeout: kActionTimeout, strict: true }));
  }
  if (action.name === 'press') {
    const modifiers = toModifiers(action.modifiers);
    const shortcut = [...modifiers, action.key].join('+');
    return await innerPerformAction(frame, 'press', { selector: action.selector, key: shortcut }, callMetadata => frame.press(callMetadata, action.selector, shortcut, { timeout: kActionTimeout, strict: true }));
  }
  if (action.name === 'fill')
    return await innerPerformAction(frame, 'fill', { selector: action.selector, text: action.text }, callMetadata => frame.fill(callMetadata, action.selector, action.text, { timeout: kActionTimeout, strict: true }));
  if (action.name === 'setInputFiles')
    return await innerPerformAction(frame, 'setInputFiles', { selector: action.selector, files: action.files }, callMetadata => frame.setInputFiles(callMetadata, action.selector, { selector: action.selector, payloads: [], timeout: kActionTimeout, strict: true }));
  if (action.name === 'check')
    return await innerPerformAction(frame, 'check', { selector: action.selector }, callMetadata => frame.check(callMetadata, action.selector, { timeout: kActionTimeout, strict: true }));
  if (action.name === 'uncheck')
    return await innerPerformAction(frame, 'uncheck', { selector: action.selector }, callMetadata => frame.uncheck(callMetadata, action.selector, { timeout: kActionTimeout, strict: true }));
  if (action.name === 'select') {
    const values = action.options.map(value => ({ value }));
    return await innerPerformAction(frame, 'selectOption', { selector: action.selector, values }, callMetadata => frame.selectOption(callMetadata, action.selector, [], values, { timeout: kActionTimeout, strict: true }));
  }
  if (action.name === 'navigate')
    return await innerPerformAction(frame, 'goto', { url: action.url }, callMetadata => frame.goto(callMetadata, action.url, { timeout: kActionTimeout }));
  if (action.name === 'closePage')
    return await innerPerformAction(frame, 'close', {}, callMetadata => frame._page.close(callMetadata));
  if (action.name === 'openPage')
    throw Error('Not reached');
  if (action.name === 'assertChecked') {
    return await innerPerformAction(frame, 'expect', { selector: action.selector }, callMetadata => frame.expect(callMetadata, action.selector, {
      selector: action.selector,
      expression: 'to.be.checked',
      isNot: !action.checked,
      timeout: kActionTimeout,
    }));
  }
  if (action.name === 'assertText') {
    return await innerPerformAction(frame, 'expect', { selector: action.selector }, callMetadata => frame.expect(callMetadata, action.selector, {
      selector: action.selector,
      expression: 'to.have.text',
      expectedText: serializeExpectedTextValues([action.text], { matchSubstring: true, normalizeWhiteSpace: true }),
      isNot: false,
      timeout: kActionTimeout,
    }));
  }
  if (action.name === 'assertValue') {
    return await innerPerformAction(frame, 'expect', { selector: action.selector }, callMetadata => frame.expect(callMetadata, action.selector, {
      selector: action.selector,
      expression: 'to.have.value',
      expectedValue: action.value,
      isNot: false,
      timeout: kActionTimeout,
    }));
  }
  if (action.name === 'assertVisible') {
    return await innerPerformAction(frame, 'expect', { selector: action.selector }, callMetadata => frame.expect(callMetadata, action.selector, {
      selector: action.selector,
      expression: 'to.be.visible',
      isNot: false,
      timeout: kActionTimeout,
    }));
  }
  throw new Error('Internal error: unexpected action ' + (action as any).name);
}
