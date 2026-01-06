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
import { syncLocalStorageWithSettings } from '../launchApp';
import { launchApp } from '../launchApp';
import { ProgressController } from '../progress';
import { ThrottledFile } from './throttledFile';
import { languageSet } from '../codegen/languages';
import { collapseActions, shouldMergeAction } from './recorderUtils';
import { generateCode } from '../codegen/language';
import { Recorder, RecorderEvent } from '../recorder';
import { BrowserContext } from '../browserContext';

import type { Page } from '../page';
import type * as actions from '@recorder/actions';
import type { CallLog, ElementInfo, Mode, RecorderBackend, RecorderFrontend, Source } from '@recorder/recorderTypes';
import type { Language, LanguageGeneratorOptions } from '../codegen/types';
import type * as channels from '@protocol/channels';
import type { Progress } from '../progress';
import type { AriaTemplateNode } from '@isomorphic/ariaSnapshot';

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
  private _primaryGeneratorId: string;
  private _selectedGeneratorId: string;
  private _frontend: RecorderFrontend;

  private constructor(recorder: Recorder, params: RecorderAppParams, page: Page, wsEndpointForTest: string | undefined) {
    this._page = page;
    this._recorder = recorder;
    this._frontend = createRecorderFrontend(page);
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
    this._primaryGeneratorId = process.env.TEST_INSPECTOR_LANGUAGE || params.language || determinePrimaryGeneratorId(params.sdkLanguage);
    this._selectedGeneratorId = this._primaryGeneratorId;
    for (const languageGenerator of languageSet()) {
      if (languageGenerator.id === this._primaryGeneratorId)
        this._recorder.setLanguage(languageGenerator.highlighter);
    }
  }

  private async _init(inspectedContext: BrowserContext) {
    await syncLocalStorageWithSettings(this._page, 'recorder');

    const controller = new ProgressController();
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

      await this._createDispatcher(progress);

      this._page.once('close', () => {
        this._recorder.close();
        this._page.browserContext.close({ reason: 'Recorder window closed' }).catch(() => {});
        delete (inspectedContext as any)[recorderAppSymbol];
      });

      await this._page.mainFrame().goto(progress, 'https://playwright/index.html');
    });

    const url = this._recorder.url();
    if (url)
      this._frontend.pageNavigated({ url });
    this._frontend.modeChanged({ mode: this._recorder.mode() });
    this._frontend.pauseStateChanged({ paused: this._recorder.paused() });
    this._updateActions('reveal');
    // Update paused sources *after* generated ones, to reveal the currently paused source if any.
    this._onUserSourcesChanged(this._recorder.userSources(), this._recorder.pausedSourceId());
    this._frontend.callLogsUpdated({ callLogs: this._recorder.callLog() });
    this._wireListeners(this._recorder);
  }

  private async _createDispatcher(progress: Progress) {
    const dispatcher: RecorderBackend = {
      clear: async () => {
        this._actions = [];
        this._updateActions('reveal');
        this._recorder.clear();
      },
      fileChanged: async (params: { fileId: string }) => {
        const source = [...this._recorderSources, ...this._userSources].find(s => s.id === params.fileId);
        if (source) {
          if (source.isRecorded)
            this._selectedGeneratorId = source.id;
          this._recorder.setLanguage(source.language);
        }
      },
      setAutoExpect: async (params: { autoExpect: boolean }) => {
        this._languageGeneratorOptions.generateAutoExpect = params.autoExpect;
        this._updateActions();
      },
      setMode: async (params: { mode: Mode }) => {
        this._recorder.setMode(params.mode);
      },
      resume: async () => {
        this._recorder.resume();
      },
      pause: async () => {
        this._recorder.pause();
      },
      step: async () => {
        this._recorder.step();
      },
      highlightRequested: async (params: { selector?: string; ariaTemplate?: AriaTemplateNode }) => {
        if (params.selector)
          this._recorder.setHighlightedSelector(params.selector);
        if (params.ariaTemplate)
          this._recorder.setHighlightedAriaTemplate(params.ariaTemplate);
      },
    };

    await this._page.exposeBinding(progress, 'sendCommand', false, async (_, data: any) => {
      const { method, params } = data as { method: string; params: any };
      return await (dispatcher as any)[method].call(dispatcher, params);
    });
  }

  static async show(context: BrowserContext, params: channels.BrowserContextEnableRecorderParams) {
    if (process.env.PW_CODEGEN_NO_INSPECTOR)
      return;
    const recorder = await Recorder.forContext(context, params);
    if (params.recorderMode === 'api') {
      const browserName = context._browser.options.name;
      await ProgrammaticRecorderApp.run(context, recorder, browserName, params);
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
    const controller = new ProgressController();
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
      this._frontend.pageNavigated({ url });
    });

    recorder.on(RecorderEvent.ContextClosed, () => {
      this._throttledOutputFile?.flush();
      this._page.browserContext.close({ reason: 'Recorder window closed' }).catch(() => {});
    });

    recorder.on(RecorderEvent.ModeChanged, (mode: Mode) => {
      this._frontend.modeChanged({ mode });
    });

    recorder.on(RecorderEvent.PausedStateChanged, (paused: boolean) => {
      this._frontend.pauseStateChanged({ paused });
    });

    recorder.on(RecorderEvent.UserSourcesChanged, (sources: Source[], pausedSourceId?: string) => {
      this._onUserSourcesChanged(sources, pausedSourceId);
    });

    recorder.on(RecorderEvent.ElementPicked, (elementInfo: ElementInfo, userGesture?: boolean) => {
      if (userGesture)
        this._page.bringToFront();
      this._frontend.elementPicked({ elementInfo, userGesture });
    });

    recorder.on(RecorderEvent.CallLogsUpdated, (callLogs: CallLog[]) => {
      this._frontend.callLogsUpdated({ callLogs });
    });
  }

  private _onActionAdded(action: actions.ActionInContext) {
    this._actions.push(action);
    this._updateActions('reveal');
  }

  private _onSignalAdded(signal: actions.SignalInContext) {
    const lastAction = this._actions.findLast(a => a.frame.pageGuid === signal.frame.pageGuid);
    if (lastAction)
      lastAction.action.signals.push(signal.signal);
    this._updateActions();
  }

  private _onUserSourcesChanged(sources: Source[], pausedSourceId: string | undefined) {
    if (!sources.length && !this._userSources.length)
      return;
    this._userSources = sources;
    this._pushAllSources();
    this._revealSource(pausedSourceId);
  }

  private _pushAllSources() {
    const sources = [...this._userSources, ...this._recorderSources];
    this._frontend.sourcesUpdated({ sources });
  }

  private _revealSource(sourceId: string | undefined) {
    if (!sourceId)
      return;
    this._frontend.sourceRevealRequested({ sourceId });
  }

  private _updateActions(reveal?: 'reveal') {
    const recorderSources = [];
    const actions = collapseActions(this._actions);

    let revealSourceId: string | undefined;
    for (const languageGenerator of languageSet()) {
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
      if (languageGenerator.id === this._primaryGeneratorId)
        this._throttledOutputFile?.setContent(source.text);
      if (reveal === 'reveal' && source.id === this._selectedGeneratorId)
        revealSourceId = source.id;
    }

    this._recorderSources = recorderSources;
    this._pushAllSources();
    this._revealSource(revealSourceId);
  }
}

// For example, if the SDK language is 'javascript', this returns 'playwright-test'.
function determinePrimaryGeneratorId(sdkLanguage: Language): string {
  for (const language of languageSet()) {
    if (language.highlighter === sdkLanguage)
      return language.id;
  }
  return sdkLanguage;
}

export class ProgrammaticRecorderApp {
  static async run(inspectedContext: BrowserContext, recorder: Recorder, browserName: string, params: channels.BrowserContextEnableRecorderParams) {
    let lastAction: actions.ActionInContext | null = null;
    const languages = [...languageSet()];

    const languageGeneratorOptions = {
      browserName: browserName,
      launchOptions: { headless: false, ...params.launchOptions, tracesDir: undefined },
      contextOptions: { ...params.contextOptions },
      deviceName: params.device,
      saveStorage: params.saveStorage,
    };
    const languageGenerator = languages.find(l => l.id === params.language) ?? languages.find(l => l.id === 'playwright-test')!;

    recorder.on(RecorderEvent.ActionAdded, action => {
      const page = findPageByGuid(inspectedContext, action.frame.pageGuid);
      if (!page)
        return;
      const { actionTexts } = generateCode([action], languageGenerator, languageGeneratorOptions);
      if (!lastAction || !shouldMergeAction(action, lastAction))
        inspectedContext.emit(BrowserContext.Events.RecorderEvent, { event: 'actionAdded', data: action, page, code: actionTexts.join('\n') });
      else
        inspectedContext.emit(BrowserContext.Events.RecorderEvent, { event: 'actionUpdated', data: action, page, code: actionTexts.join('\n') });
      lastAction = action;
    });
    recorder.on(RecorderEvent.SignalAdded, signal => {
      const page = findPageByGuid(inspectedContext, signal.frame.pageGuid);
      if (!page)
        return;
      inspectedContext.emit(BrowserContext.Events.RecorderEvent, { event: 'signalAdded', data: signal, page, code: '' });
    });
  }
}

function findPageByGuid(context: BrowserContext, guid: string) {
  return context.pages().find(p => p.guid === guid);
}

function createRecorderFrontend(page: Page): RecorderFrontend {
  return new Proxy({} as RecorderFrontend, {
    get: (_target, prop: string | symbol) => {
      if (typeof prop !== 'string')
        return undefined;
      return (params: any) => {
        page.mainFrame().evaluateExpression(((event: { method: string, params?: any }) => {
          window.dispatch(event);
        }).toString(), { isFunction: true }, { method: prop, params }).catch(() => {});
      };
    },
  });
}

const recorderAppSymbol = Symbol('recorderApp');
