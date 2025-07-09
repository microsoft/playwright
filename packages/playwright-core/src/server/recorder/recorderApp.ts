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
import path from 'path';

import { isUnderTest } from '../utils/debug';
import { mime } from '../../utilsBundle';
import { serverSideCallMetadata } from '../instrumentation';
import { syncLocalStorageWithSettings } from '../launchApp';
import { launchApp } from '../launchApp';
import { ProgressController } from '../progress';
import { ThrottledFile } from './throttledFile';
import { languageSet } from '../codegen/languages';
import { collapseActions, shouldMergeAction } from './recorderUtils';
import { generateCode } from '../codegen/language';
import { Recorder, RecorderEvent } from '../recorder';
import { monotonicTime } from '../../utils/isomorphic/time';
import { BrowserContext } from '../browserContext';

import type { Page } from '../page';
import type * as actions from '@recorder/actions';
import type { CallLog, ElementInfo, Mode, Source } from '@recorder/recorderTypes';
import type { Language, LanguageGeneratorOptions } from '../codegen/types';
import type * as channels from '@protocol/channels';

export type RecorderAppParams = channels.BrowserContextEnableRecorderParams & {
  browserName: string;
  sdkLanguage: Language;
  headed: boolean;
  executablePath?: string;
  channel?: string;
};

export class RecorderApp {
  private _recorder: Recorder;
  private _page: Page;
  readonly wsEndpointForTest: string | undefined;
  private _languageGeneratorOptions: LanguageGeneratorOptions;
  private _throttledOutputFile: ThrottledFile | null = null;
  private _actions: actions.ActionInContext[] = [];
  private _userSources: Source[] = [];
  private _recorderSources: Source[] = [];
  private _primaryLanguage: string;

  private constructor(recorder: Recorder, params: RecorderAppParams, page: Page, wsEndpointForTest: string | undefined) {
    this._page = page;
    this._recorder = recorder;
    this.wsEndpointForTest = wsEndpointForTest;

    // Make a copy of options to modify them later.
    this._languageGeneratorOptions = {
      browserName: params.browserName,
      launchOptions: { headless: false, ...params.launchOptions, tracesDir: undefined },
      contextOptions: { ...params.contextOptions },
      deviceName: params.device,
      saveStorage: params.saveStorage,
    };

    this._throttledOutputFile = params.outputFile ? new ThrottledFile(params.outputFile) : null;
    this._primaryLanguage = process.env.TEST_INSPECTOR_LANGUAGE || params.language || params.sdkLanguage;
  }

  private async _init(inspectedContext: BrowserContext) {
    await syncLocalStorageWithSettings(this._page, 'recorder');

    const controller = new ProgressController(serverSideCallMetadata(), this._page);
    await controller.run(async progress => {
      await this._page.addRequestInterceptor(progress, route => {
        if (!route.request().url().startsWith('https://playwright/')) {
          route.continue({ isFallback: true }).catch(() => {});
          return;
        }

        const uri = route.request().url().substring('https://playwright/'.length);
        const file = require.resolve('../../vite/recorder/' + uri);
        fs.promises.readFile(file).then(buffer => {
          route.fulfill({
            status: 200,
            headers: [
              { name: 'Content-Type', value: mime.getType(path.extname(file)) || 'application/octet-stream' }
            ],
            body: buffer.toString('base64'),
            isBase64: true
          }).catch(() => {});
        });
      });

      await this._page.exposeBinding(progress, 'dispatch', false, (_, data: any) => this._handleUIEvent(data));

      this._page.once('close', () => {
        this._recorder.close();
        this._page.browserContext.close({ reason: 'Recorder window closed' }).catch(() => {});
        delete (inspectedContext as any)[recorderAppSymbol];
      });

      await this._page.mainFrame().goto(progress, process.env.PW_HMR ? 'http://localhost:44225' : 'https://playwright/index.html');
    });

    const url = this._recorder.url();
    if (url)
      this._onPageNavigated(url);
    this._onModeChanged(this._recorder.mode());
    this._onPausedStateChanged(this._recorder.paused());
    this._onUserSourcesChanged(this._recorder.userSources());
    this._onCallLogsUpdated(this._recorder.callLog());
    this._wireListeners(this._recorder);

    this._updateActions(true);
  }

  private _handleUIEvent(data: any) {
    if (data.event === 'clear') {
      this._actions = [];
      this._updateActions();
      this._recorder.clear();
      return;
    }
    if (data.event === 'fileChanged') {
      const source = [...this._recorderSources, ...this._userSources].find(s => s.id === data.params.fileId);
      if (source)
        this._recorder.setLanguage(source.language);
      return;
    }
    if (data.event === 'setMode') {
      this._recorder.setMode(data.params.mode);
      return;
    }
    if (data.event === 'resume') {
      this._recorder.resume();
      return;
    }
    if (data.event === 'pause') {
      this._recorder.pause();
      return;
    }
    if (data.event === 'step') {
      this._recorder.step();
      return;
    }
    if (data.event === 'highlightRequested') {
      if (data.params.selector)
        this._recorder.setHighlightedSelector(data.params.selector);
      if (data.params.ariaTemplate)
        this._recorder.setHighlightedAriaTemplate(data.params.ariaTemplate);
      return;
    }
    throw new Error(`Unknown event: ${data.event}`);
  }

  static async show(context: BrowserContext, params: channels.BrowserContextEnableRecorderParams) {
    if (process.env.PW_CODEGEN_NO_INSPECTOR)
      return;
    const recorder = await Recorder.forContext(context, params);
    if (params.recorderMode === 'api') {
      await ProgrammaticRecorderApp.run(context, recorder);
      return;
    }
    await RecorderApp._show(recorder, context, params);
  }

  async close() {
    await this._page.close();
  }

  static showInspectorNoReply(context: BrowserContext) {
    if (process.env.PW_CODEGEN_NO_INSPECTOR)
      return;
    void Recorder.forContext(context, {}).then(recorder => RecorderApp._show(recorder, context, {})).catch(() => {});
  }

  private static async _show(recorder: Recorder, inspectedContext: BrowserContext, params: channels.BrowserContextEnableRecorderParams) {
    if ((inspectedContext as any)[recorderAppSymbol])
      return;
    (inspectedContext as any)[recorderAppSymbol] = true;
    const sdkLanguage = inspectedContext._browser.sdkLanguage();
    const headed = !!inspectedContext._browser.options.headful;
    const recorderPlaywright = (require('../playwright').createPlaywright as typeof import('../playwright').createPlaywright)({ sdkLanguage: 'javascript', isInternalPlaywright: true });
    const { context: appContext, page } = await launchApp(recorderPlaywright.chromium, {
      sdkLanguage,
      windowSize: { width: 600, height: 600 },
      windowPosition: { x: 1020, y: 10 },
      persistentContextOptions: {
        noDefaultViewport: true,
        headless: !!process.env.PWTEST_CLI_HEADLESS || (isUnderTest() && !headed),
        cdpPort: isUnderTest() ? 0 : undefined,
        handleSIGINT: params.handleSIGINT,
        executablePath: inspectedContext._browser.options.isChromium ? inspectedContext._browser.options.customExecutablePath : undefined,
        // Use the same channel as the inspected context to guarantee that the browser is installed.
        channel: inspectedContext._browser.options.isChromium ? inspectedContext._browser.options.channel : undefined,
      }
    });
    const controller = new ProgressController(serverSideCallMetadata(), appContext._browser);
    await controller.run(async progress => {
      await appContext._browser._defaultContext!._loadDefaultContextAsIs(progress);
    });

    const appParams = {
      browserName: inspectedContext._browser.options.name,
      sdkLanguage: inspectedContext._browser.sdkLanguage(),
      wsEndpointForTest: inspectedContext._browser.options.wsEndpoint,
      headed: !!inspectedContext._browser.options.headful,
      executablePath: inspectedContext._browser.options.isChromium ? inspectedContext._browser.options.customExecutablePath : undefined,
      channel: inspectedContext._browser.options.isChromium ? inspectedContext._browser.options.channel : undefined,
      ...params,
    };

    const recorderApp = new RecorderApp(recorder, appParams, page, appContext._browser.options.wsEndpoint);
    await recorderApp._init(inspectedContext);
    (inspectedContext as any).recorderAppForTest = recorderApp;
  }

  private _wireListeners(recorder: Recorder) {
    recorder.on(RecorderEvent.ActionAdded, (action: actions.ActionInContext) => {
      this._onActionAdded(action);
    });

    recorder.on(RecorderEvent.SignalAdded, (signal: actions.SignalInContext) => {
      this._onSignalAdded(signal);
    });

    recorder.on(RecorderEvent.PageNavigated, (url: string) => {
      this._onPageNavigated(url);
    });

    recorder.on(RecorderEvent.ContextClosed, () => {
      this._onContextClosed();
    });

    recorder.on(RecorderEvent.ModeChanged, (mode: Mode) => {
      this._onModeChanged(mode);
    });

    recorder.on(RecorderEvent.PausedStateChanged, (paused: boolean) => {
      this._onPausedStateChanged(paused);
    });

    recorder.on(RecorderEvent.UserSourcesChanged, (sources: Source[]) => {
      this._onUserSourcesChanged(sources);
    });

    recorder.on(RecorderEvent.ElementPicked, (elementInfo: ElementInfo, userGesture?: boolean) => {
      this._onElementPicked(elementInfo, userGesture);
    });

    recorder.on(RecorderEvent.CallLogsUpdated, (callLogs: CallLog[]) => {
      this._onCallLogsUpdated(callLogs);
    });
  }

  private _onActionAdded(action: actions.ActionInContext) {
    this._actions.push(action);
    this._updateActions();
  }

  private _onSignalAdded(signal: actions.SignalInContext) {
    const lastAction = this._actions.findLast(a => a.frame.pageGuid === signal.frame.pageGuid);
    if (lastAction)
      lastAction.action.signals.push(signal.signal);
    this._updateActions();
  }

  private _onPageNavigated(url: string) {
    this._page.mainFrame().evaluateExpression((({ url }: { url: string }) => {
      window.playwrightSetPageURL(url);
    }).toString(), { isFunction: true }, { url }).catch(() => {});
  }

  private _onContextClosed() {
    this._throttledOutputFile?.flush();
    this._page.browserContext.close({ reason: 'Recorder window closed' }).catch(() => {});
  }

  private _onModeChanged(mode: Mode) {
    this._page.mainFrame().evaluateExpression(((mode: Mode) => {
      window.playwrightSetMode(mode);
    }).toString(), { isFunction: true }, mode).catch(() => {});
  }

  private _onPausedStateChanged(paused: boolean) {
    this._page.mainFrame().evaluateExpression(((paused: boolean) => {
      window.playwrightSetPaused(paused);
    }).toString(), { isFunction: true }, paused).catch(() => {});
  }

  private _onUserSourcesChanged(sources: Source[]) {
    if (!sources.length && !this._userSources.length)
      return;
    this._userSources = sources;
    this._pushAllSources();
  }

  private _onElementPicked(elementInfo: ElementInfo, userGesture?: boolean) {
    if (userGesture)
      this._page.bringToFront();
    this._page.mainFrame().evaluateExpression(((param: { elementInfo: ElementInfo, userGesture?: boolean }) => {
      window.playwrightElementPicked(param.elementInfo, param.userGesture);
    }).toString(), { isFunction: true }, { elementInfo, userGesture }).catch(() => {});
  }

  private _onCallLogsUpdated(callLogs: CallLog[]) {
    this._page.mainFrame().evaluateExpression(((callLogs: CallLog[]) => {
      window.playwrightUpdateLogs(callLogs);
    }).toString(), { isFunction: true }, callLogs).catch(() => {});
  }

  private async _pushAllSources() {
    const sources = [...this._userSources, ...this._recorderSources];
    this._page.mainFrame().evaluateExpression((({ sources }: { sources: Source[] }) => {
      window.playwrightSetSources(sources);
    }).toString(), { isFunction: true }, { sources }).catch(() => {});

    // Testing harness for runCLI mode.
    if (process.env.PWTEST_CLI_IS_UNDER_TEST && sources.length) {
      const primarySource = sources.find(s => s.isPrimary);
      if ((process as any)._didSetSourcesForTest(primarySource?.text ?? ''))
        this._page.close().catch(() => {});
    }
  }

  private _updateActions(initial: boolean = false) {
    const timestamp = initial ? 0 : monotonicTime();
    const recorderSources = [];
    const actions = collapseActions(this._actions);

    for (const languageGenerator of languageSet()) {
      const { header, footer, actionTexts, text } = generateCode(actions, languageGenerator, this._languageGeneratorOptions);
      const source: Source = {
        isPrimary: languageGenerator.id === this._primaryLanguage,
        timestamp,
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
      if (languageGenerator.id === this._primaryLanguage)
        this._throttledOutputFile?.setContent(source.text);
    }

    this._recorderSources = recorderSources;
    this._pushAllSources();
  }
}

export class ProgrammaticRecorderApp {
  static async run(inspectedContext: BrowserContext, recorder: Recorder) {
    let lastAction: actions.ActionInContext | null = null;
    recorder.on(RecorderEvent.ActionAdded, action => {
      const page = findPageByGuid(inspectedContext, action.frame.pageGuid);
      if (!page)
        return;
      if (!lastAction || !shouldMergeAction(action, lastAction))
        inspectedContext.emit(BrowserContext.Events.RecorderEvent, { event: 'actionAdded', data: action, page });
      else
        inspectedContext.emit(BrowserContext.Events.RecorderEvent, { event: 'actionUpdated', data: action, page });
      lastAction = action;
    });
    recorder.on(RecorderEvent.SignalAdded, signal => {
      const page = findPageByGuid(inspectedContext, signal.frame.pageGuid);
      inspectedContext.emit(BrowserContext.Events.RecorderEvent, { event: 'signalAdded', data: signal, page });
    });
  }
}

function findPageByGuid(context: BrowserContext, guid: string) {
  return context.pages().find(p => p.guid === guid);
}

const recorderAppSymbol = Symbol('recorderApp');
