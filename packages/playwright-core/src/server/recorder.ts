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

import type * as channels from '@protocol/channels';
import type { CallLog, CallLogStatus, EventData, Mode, OverlayState, Source, UIState } from '@recorder/recorderTypes';
import * as fs from 'fs';
import type { Point } from '../common/types';
import * as consoleApiSource from '../generated/consoleApiSource';
import { isUnderTest } from '../utils';
import { locatorOrSelectorAsSelector } from '../utils/isomorphic/locatorParser';
import { BrowserContext } from './browserContext';
import { type Language } from './codegen/types';
import { Debugger } from './debugger';
import type { CallMetadata, InstrumentationListener, SdkObject } from './instrumentation';
import { ContextRecorder, generateFrameSelector } from './recorder/contextRecorder';
import { type IRecorderApp } from './recorder/recorderApp';
import { buildFullSelector, metadataToCallLog } from './recorder/recorderUtils';

const recorderSymbol = Symbol('recorderSymbol');

export type RecorderAppFactory = (recorder: Recorder) => Promise<IRecorderApp>;

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
  private _omitCallTracking = false;
  private _currentLanguage: Language;

  static showInspector(context: BrowserContext, recorderAppFactory: RecorderAppFactory) {
    const params: channels.BrowserContextRecorderSupplementEnableParams = {};
    if (isUnderTest())
      params.language = process.env.TEST_INSPECTOR_LANGUAGE;
    Recorder.show(context, recorderAppFactory, params).catch(() => {});
  }

  static show(context: BrowserContext, recorderAppFactory: RecorderAppFactory, params: channels.BrowserContextRecorderSupplementEnableParams = {}): Promise<Recorder> {
    let recorderPromise = (context as any)[recorderSymbol] as Promise<Recorder>;
    if (!recorderPromise) {
      recorderPromise = Recorder._create(context, recorderAppFactory, params);
      (context as any)[recorderSymbol] = recorderPromise;
    }
    return recorderPromise;
  }

  private static async _create(context: BrowserContext, recorderAppFactory: RecorderAppFactory, params: channels.BrowserContextRecorderSupplementEnableParams = {}): Promise<Recorder> {
    const recorder = new Recorder(context, params);
    const recorderApp = await recorderAppFactory(recorder);
    await recorder._install(recorderApp);
    return recorder;
  }

  constructor(context: BrowserContext, params: channels.BrowserContextRecorderSupplementEnableParams) {
    this._mode = params.mode || 'none';
    this._contextRecorder = new ContextRecorder(context, params, {});
    this._context = context;
    this._omitCallTracking = !!params.omitCallTracking;
    this._debugger = context.debugger();
    context.instrumentation.addListener(this, context);
    this._currentLanguage = this._contextRecorder.languageName();

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
      this._recorderApp?.close().catch(() => {});
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
      const selectorChain = await generateFrameSelector(frame);
      await this._recorderApp?.setSelector(buildFullSelector(selectorChain, selector), true);
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

    (this._context as any).recorderAppForTest = this._recorderApp;
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
