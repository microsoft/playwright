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

import fs from 'fs';

import { isUnderTest } from '../utils';
import { BrowserContext } from './browserContext';
import { Debugger } from './debugger';
import { buildFullSelector, generateFrameSelector, metadataToCallLog } from './recorder/recorderUtils';
import { locatorOrSelectorAsSelector } from '../utils/isomorphic/locatorParser';
import { stringifySelector } from '../utils/isomorphic/selectorParser';
import { ProgressController } from './progress';
import { serverSideCallMetadata } from './instrumentation';
import { RecorderSignalProcessor } from './recorder/recorderSignalProcessor';
import * as rawRecorderSource from './../generated/pollingRecorderSource';
import { eventsHelper, monotonicTime } from './../utils';
import { languageSet } from './codegen/languages';
import { Frame } from './frames';
import { Page } from './page';
import { ThrottledFile } from './recorder/throttledFile';
import { generateCode } from './codegen/language';
import { performAction } from './recorder/recorderRunner';
import { collapseActions } from './recorder/recorderUtils';


import type { Language, LanguageGenerator, LanguageGeneratorOptions } from './codegen/types';
import type { CallMetadata, InstrumentationListener, SdkObject } from './instrumentation';
import type { IRecorder, IRecorderApp, IRecorderAppFactory } from './recorder/recorderFrontend';
import type { Point } from '../utils/isomorphic/types';
import type { AriaTemplateNode } from '@isomorphic/ariaSnapshot';
import type * as channels from '@protocol/channels';
import type * as actions from '@recorder/actions';
import type { CallLog, CallLogStatus, ElementInfo, EventData, Mode, OverlayState, Source, UIState } from '@recorder/recorderTypes';
import type { RegisteredListener } from '../utils';
import type { Signal } from '../../../recorder/src/actions';

const recorderSymbol = Symbol('recorderSymbol');

type BindingSource = { frame: Frame, page: Page };

export class Recorder implements InstrumentationListener, IRecorder {
  readonly handleSIGINT: boolean | undefined;
  private _context: BrowserContext;
  private _params: channels.BrowserContextEnableRecorderParams;
  private _mode: Mode;
  private _highlightedElement: { selector?: string, ariaTemplate?: AriaTemplateNode } = {};
  private _overlayState: OverlayState = { offsetX: 0 };
  private _recorderApp: IRecorderApp | null = null;
  private _currentCallsMetadata = new Map<CallMetadata, SdkObject>();
  private _recorderSources: Source[] = [];
  private _userSources = new Map<string, Source>();
  private _debugger: Debugger;
  private _omitCallTracking = false;
  private _currentLanguage: Language;
  private _recorderMode: 'record' | 'perform';

  private _signalProcessor: RecorderSignalProcessor;
  private _pageAliases = new Map<Page, string>();
  private _lastPopupOrdinal = 0;
  private _lastDialogOrdinal = -1;
  private _lastDownloadOrdinal = -1;
  private _throttledOutputFile: ThrottledFile | null = null;
  private _orderedLanguages: LanguageGenerator[] = [];
  private _listeners: RegisteredListener[] = [];
  private _actions: actions.ActionInContext[] = [];
  private _languageGeneratorOptions: LanguageGeneratorOptions;
  private _enabled: boolean = false;

  static async showInspector(context: BrowserContext, params: channels.BrowserContextEnableRecorderParams, recorderAppFactory: IRecorderAppFactory) {
    if (isUnderTest())
      params.language = process.env.TEST_INSPECTOR_LANGUAGE;
    return await Recorder.show(context, recorderAppFactory, params);
  }

  static showInspectorNoReply(context: BrowserContext, recorderAppFactory: IRecorderAppFactory) {
    Recorder.showInspector(context, {}, recorderAppFactory).catch(() => {});
  }

  static show(context: BrowserContext, recorderAppFactory: IRecorderAppFactory, params: channels.BrowserContextEnableRecorderParams): Promise<Recorder> {
    let recorderPromise = (context as any)[recorderSymbol] as Promise<Recorder>;
    if (!recorderPromise) {
      recorderPromise = Recorder._create(context, recorderAppFactory, params);
      (context as any)[recorderSymbol] = recorderPromise;
    }
    return recorderPromise;
  }

  private static async _create(context: BrowserContext, recorderAppFactory: IRecorderAppFactory, params: channels.BrowserContextEnableRecorderParams = {}): Promise<Recorder> {
    const recorder = new Recorder(context, params);
    const recorderApp = await recorderAppFactory(recorder);
    await recorder._install(recorderApp);
    return recorder;
  }

  constructor(context: BrowserContext, params: channels.BrowserContextEnableRecorderParams) {
    this._context = context;
    this._params = params;
    this._mode = params.mode || 'none';
    this._recorderMode = params.recorderMode ?? 'perform';
    this.handleSIGINT = params.handleSIGINT;

    // Make a copy of options to modify them later.
    this._languageGeneratorOptions = {
      browserName: context._browser.options.name,
      launchOptions: { headless: false, ...params.launchOptions, tracesDir: undefined },
      contextOptions: { ...params.contextOptions },
      deviceName: params.device,
      saveStorage: params.saveStorage,
    };

    this._signalProcessor = new RecorderSignalProcessor();
    this._signalProcessor.on('action', (actionInContext: actions.ActionInContext) => {
      if (!this._enabled)
        return;
      this._actions.push(actionInContext);
      this._updateActions();
    });
    this._signalProcessor.on('signal', (signal: Signal) => {
      if (!this._enabled)
        return;
      const lastAction = this._actions[this._actions.length - 1];
      if (lastAction)
        lastAction.action.signals.push(signal);
      this._updateActions();
    });

    context.on(BrowserContext.Events.BeforeClose, () => {
      this._throttledOutputFile?.flush();
    });
    this._listeners.push(eventsHelper.addEventListener(process, 'exit', () => {
      this._throttledOutputFile?.flush();
    }));

    const language = params.language || context._browser.sdkLanguage();
    this._innerSetOutput(language, params.outputFile);
    this._setEnabled(params.mode === 'recording');

    this._omitCallTracking = !!params.omitCallTracking;
    this._debugger = context.debugger();
    context.instrumentation.addListener(this, context);
    this._currentLanguage = this._languageName();

    if (isUnderTest()) {
      // Most of our tests put elements at the top left, so get out of the way.
      this._overlayState.offsetX = 200;
    }
  }

  private async _install(recorderApp: IRecorderApp) {
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
      if (data.event === 'highlightRequested') {
        if (data.params.selector)
          this.setHighlightedSelector(this._currentLanguage, data.params.selector);
        if (data.params.ariaTemplate)
          this.setHighlightedAriaTemplate(data.params.ariaTemplate);
        return;
      }
      if (data.event === 'step') {
        this._debugger.resume(true);
        return;
      }
      if (data.event === 'fileChanged') {
        this._currentLanguage = this._languageName(data.params.file);
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
        this._clearScript();
        return;
      }
    });

    await Promise.all([
      recorderApp.setMode(this._mode),
      recorderApp.setPaused(this._debugger.isPaused()),
      this._pushAllSources()
    ]);

    this._context.once(BrowserContext.Events.Close, () => {
      eventsHelper.removeEventListeners(this._listeners);
      this._context.instrumentation.removeListener(this);
      this._recorderApp?.close().catch(() => {});
    });

    const controller = new ProgressController(serverSideCallMetadata(), this._context);
    await controller.run(async progress => {
      await this._context.exposeBinding(progress, '__pw_recorderState', false, async source => {
        let actionSelector: string | undefined;
        let actionPoint: Point | undefined;
        const hasActiveScreenshotCommand = [...this._currentCallsMetadata.keys()].some(isScreenshotCommand);
        if (!hasActiveScreenshotCommand) {
          actionSelector = await this._scopeHighlightedSelectorToFrame(source.frame);
          for (const [metadata, sdkObject] of this._currentCallsMetadata) {
            if (source.page === sdkObject.attribution.page) {
              actionPoint = metadata.point || actionPoint;
              actionSelector = actionSelector || metadata.params.selector;
            }
          }
        }
        const uiState: UIState = {
          mode: this._mode,
          recorderMode: this._recorderMode,
          actionPoint,
          actionSelector,
          ariaTemplate: this._highlightedElement.ariaTemplate,
          language: this._currentLanguage,
          testIdAttributeName: this._testIdAttributeName(),
          overlay: this._overlayState,
        };
        return uiState;
      });

      await this._context.exposeBinding(progress, '__pw_recorderElementPicked', false, async ({ frame }, elementInfo: ElementInfo) => {
        const selectorChain = await generateFrameSelector(frame);
        await this._recorderApp?.elementPicked({ selector: buildFullSelector(selectorChain, elementInfo.selector), ariaSnapshot: elementInfo.ariaSnapshot }, true);
      });

      await this._context.exposeBinding(progress, '__pw_recorderSetMode', false, async ({ frame }, mode: Mode) => {
        if (frame.parentFrame())
          return;
        this.setMode(mode);
      });

      await this._context.exposeBinding(progress, '__pw_recorderSetOverlayState', false, async ({ frame }, state: OverlayState) => {
        if (frame.parentFrame())
          return;
        this._overlayState = state;
      });

      await this._context.exposeBinding(progress, '__pw_resume', false, () => {
        this._debugger.resume(false);
      });

      this._context.on(BrowserContext.Events.Page, (page: Page) => this._onPage(page));
      for (const page of this._context.pages())
        this._onPage(page);
      this._context.dialogManager.addDialogHandler(dialog => {
        this._onDialog(dialog.page());
        // Not handling the dialog, let it automatically close.
        return false;
      });

      // Input actions that potentially lead to navigation are intercepted on the page and are
      // performed by the Playwright.
      await this._context.exposeBinding(progress, '__pw_recorderPerformAction', false,
          (source: BindingSource, action: actions.PerformOnRecordAction) => this._performAction(source.frame, action));

      // Other non-essential actions are simply being recorded.
      await this._context.exposeBinding(progress, '__pw_recorderRecordAction', false,
          (source: BindingSource, action: actions.Action) => this._recordAction(source.frame, action));

      await this._context.extendInjectedScript(rawRecorderSource.source);
    });

    if (this._debugger.isPaused())
      this._pausedStateChanged();
    this._debugger.on(Debugger.Events.PausedStateChanged, () => this._pausedStateChanged());

    (this._context as any).recorderAppForTest = this._recorderApp;
  }

  private _pausedStateChanged() {
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
    this._highlightedElement = {};
    this._mode = mode;
    this._recorderApp?.setMode(this._mode);
    this._setEnabled(this._isRecording());
    this._debugger.setMuted(this._isRecording());
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
    this._highlightedElement = { selector: locatorOrSelectorAsSelector(language, selector, this._context.selectors().testIdAttributeName()) };
    this._refreshOverlay();
  }

  setHighlightedAriaTemplate(ariaTemplate: AriaTemplateNode) {
    this._highlightedElement = { ariaTemplate };
    this._refreshOverlay();
  }

  hideHighlightedSelector() {
    this._highlightedElement = {};
    this._refreshOverlay();
  }

  private async _scopeHighlightedSelectorToFrame(frame: Frame): Promise<string | undefined> {
    if (!this._highlightedElement.selector)
      return;
    try {
      const mainFrame = frame._page.mainFrame();
      const resolved = await mainFrame.selectors.resolveFrameForSelector(this._highlightedElement.selector);
      // selector couldn't be found, don't highlight anything
      if (!resolved)
        return '';

      // selector points to no specific frame, highlight in all frames
      if (resolved?.frame === mainFrame)
        return stringifySelector(resolved.info.parsed);

      // selector points to this frame, highlight it
      if (resolved?.frame === frame)
        return stringifySelector(resolved.info.parsed);

      // selector points to a different frame, highlight nothing
      return '';
    } catch {
      return '';
    }
  }

  setOutput(codegenId: string, outputFile: string | undefined) {
    this._innerSetOutput(codegenId, outputFile);
    this._resetActions();
  }

  private _innerSetOutput(codegenId: string, outputFile: string | undefined) {
    const languages = languageSet();
    const primaryLanguage = [...languages].find(l => l.id === codegenId);
    if (!primaryLanguage)
      throw new Error(`\n===============================\nUnsupported language: '${codegenId}'\n===============================\n`);
    languages.delete(primaryLanguage);
    this._orderedLanguages = [primaryLanguage, ...languages];
    this._throttledOutputFile = outputFile ? new ThrottledFile(outputFile) : null;
  }

  private _refreshOverlay() {
    for (const page of this._context.pages()) {
      for (const frame of page.frames())
        frame.evaluateExpression('window.__pw_refreshOverlay()').catch(() => {});
    }
  }

  async onBeforeCall(sdkObject: SdkObject, metadata: CallMetadata) {
    if (this._omitCallTracking || this._isRecording())
      return;
    this._currentCallsMetadata.set(metadata, sdkObject);
    this._updateUserSources();
    this.updateCallLog([metadata]);
    if (isScreenshotCommand(metadata))
      this.hideHighlightedSelector();
    else if (metadata.params && metadata.params.selector)
      this._highlightedElement = { selector: metadata.params.selector };
  }

  async onAfterCall(sdkObject: SdkObject, metadata: CallMetadata) {
    if (this._omitCallTracking || this._isRecording())
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
      this._recorderApp?.setRunningFile(fileToSelect);
  }

  private _pushAllSources() {
    const primaryPage: Page | undefined = this._context.pages()[0];
    this._recorderApp?.setSources([...this._recorderSources, ...this._userSources.values()], primaryPage?.mainFrame().url());
  }

  async onBeforeInputAction(sdkObject: SdkObject, metadata: CallMetadata) {
  }

  async onCallLog(sdkObject: SdkObject, metadata: CallMetadata, logName: string, message: string): Promise<void> {
    this.updateCallLog([metadata]);
  }

  updateCallLog(metadatas: CallMetadata[]) {
    if (this._isRecording())
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

  private _isRecording() {
    return ['recording', 'assertingText', 'assertingVisibility', 'assertingValue', 'assertingSnapshot'].includes(this._mode);
  }

  private _readSource(fileName: string): string {
    try {
      return fs.readFileSync(fileName, 'utf-8');
    } catch (e) {
      return '// No source available';
    }
  }

  private _resetActions() {
    this._actions = [];
    this._updateActions();
  }

  private _updateActions() {
    const actions = collapseActions(this._actions);
    const recorderSources = [];
    for (const languageGenerator of this._orderedLanguages) {
      const { header, footer, actionTexts, text } = generateCode(actions, languageGenerator, this._languageGeneratorOptions);
      const source: Source = {
        isRecorded: true,
        label: languageGenerator.name,
        group: languageGenerator.groupName,
        id: languageGenerator.id,
        text,
        header,
        footer,
        actions: actionTexts,
        language: languageGenerator.highlighter,
        highlight: []
      };
      source.revealLine = text.split('\n').length - 1;
      recorderSources.push(source);
      if (languageGenerator === this._orderedLanguages[0])
        this._throttledOutputFile?.setContent(source.text);
    }

    this._recorderSources = recorderSources;
    this._recorderApp?.setActions(actions, recorderSources);
    this._recorderApp?.setRunningFile(undefined);
    this._pushAllSources();
  }

  private _languageName(id?: string): Language {
    for (const lang of this._orderedLanguages) {
      if (!id || lang.id === id)
        return lang.highlighter;
    }
    return 'javascript';
  }

  private _setEnabled(enabled: boolean) {
    this._enabled = enabled;
  }

  private async _onPage(page: Page) {
    // First page is called page, others are called popup1, popup2, etc.
    const frame = page.mainFrame();
    page.on('close', () => {
      this._signalProcessor.addAction({
        frame: this._describeMainFrame(page),
        action: {
          name: 'closePage',
          signals: [],
        },
        startTime: monotonicTime()
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
      this._signalProcessor.addAction({
        frame: this._describeMainFrame(page),
        action: {
          name: 'openPage',
          url: page.mainFrame().url(),
          signals: [],
        },
        startTime: monotonicTime()
      });
    }
  }

  private _clearScript(): void {
    this._resetActions();
    if (this._params.mode === 'recording') {
      for (const page of this._context.pages())
        this._onFrameNavigated(page.mainFrame(), page);
    }
  }

  private _describeMainFrame(page: Page): actions.FrameDescription {
    return {
      pageAlias: this._pageAliases.get(page)!,
      framePath: [],
    };
  }

  private async _describeFrame(frame: Frame): Promise<actions.FrameDescription> {
    return {
      pageAlias: this._pageAliases.get(frame._page)!,
      framePath: await generateFrameSelector(frame),
    };
  }

  private _testIdAttributeName(): string {
    return this._params.testIdAttributeName || this._context.selectors().testIdAttributeName() || 'data-testid';
  }

  private async _createActionInContext(frame: Frame, action: actions.Action): Promise<actions.ActionInContext> {
    const frameDescription = await this._describeFrame(frame);
    const actionInContext: actions.ActionInContext = {
      frame: frameDescription,
      action,
      description: undefined,
      startTime: monotonicTime()
    };
    return actionInContext;
  }

  private async _performAction(frame: Frame, action: actions.PerformOnRecordAction) {
    const actionInContext = await this._createActionInContext(frame, action);
    this._signalProcessor.addAction(actionInContext);
    if (actionInContext.action.name !== 'openPage' && actionInContext.action.name !== 'closePage')
      await performAction(this._pageAliases, actionInContext);
    actionInContext.endTime = monotonicTime();
  }

  private async _recordAction(frame: Frame, action: actions.Action) {
    this._signalProcessor.addAction(await this._createActionInContext(frame, action));
  }

  private _onFrameNavigated(frame: Frame, page: Page) {
    const pageAlias = this._pageAliases.get(page);
    this._signalProcessor.signal(pageAlias!, frame, { name: 'navigation', url: frame.url() });
  }

  private _onPopup(page: Page, popup: Page) {
    const pageAlias = this._pageAliases.get(page)!;
    const popupAlias = this._pageAliases.get(popup)!;
    this._signalProcessor.signal(pageAlias, page.mainFrame(), { name: 'popup', popupAlias });
  }

  private _onDownload(page: Page) {
    const pageAlias = this._pageAliases.get(page)!;
    ++this._lastDownloadOrdinal;
    this._signalProcessor.signal(pageAlias, page.mainFrame(), { name: 'download', downloadAlias: this._lastDownloadOrdinal ? String(this._lastDownloadOrdinal) : '' });
  }

  private _onDialog(page: Page) {
    const pageAlias = this._pageAliases.get(page)!;
    ++this._lastDialogOrdinal;
    this._signalProcessor.signal(pageAlias, page.mainFrame(), { name: 'dialog', dialogAlias: this._lastDialogOrdinal ? String(this._lastDialogOrdinal) : '' });
  }
}

function isScreenshotCommand(metadata: CallMetadata) {
  return metadata.method.toLowerCase().includes('screenshot');
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
