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

import { EventEmitter } from 'events';
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
import { collapseActions } from './recorderUtils';
import { generateCode } from '../codegen/language';
import { Recorder } from '../recorder';
import { monotonicTime } from '../../utils/isomorphic/time';

import type { BrowserContext } from '../browserContext';
import type { Page } from '../page';
import type { IRecorder, IRecorderApp, IRecorderAppFactory, RecorderAppParams } from './recorderFrontend';
import type * as actions from '@recorder/actions';
import type { CallLog, ElementInfo, Mode, Source } from '@recorder/recorderTypes';
import type { LanguageGeneratorOptions } from '../codegen/types';
import type * as channels from '@protocol/channels';

export class EmptyRecorderApp extends EventEmitter implements IRecorderApp {
  wsEndpointForTest: undefined;
  async close(): Promise<void> {}
  async setPaused(paused: boolean): Promise<void> {}
  async setMode(mode: Mode): Promise<void> {}
  async elementPicked(elementInfo: ElementInfo, userGesture?: boolean): Promise<void> {}
  async updateCallLogs(callLogs: CallLog[]): Promise<void> {}
  async userSourcesChanged(sources: Source[]): Promise<void> {}
  async start() {}
  async actionAdded(action: actions.ActionInContext): Promise<void> {}
  async signalAdded(signal: actions.Signal): Promise<void> {}
  async pageNavigated(url: string): Promise<void> {}
  async flushOutput(): Promise<void> {}
}

export class RecorderApp extends EventEmitter implements IRecorderApp {
  private _page: Page;
  readonly wsEndpointForTest: string | undefined;
  private _languageGeneratorOptions: LanguageGeneratorOptions;
  private _throttledOutputFile: ThrottledFile | null = null;
  private _actions: actions.ActionInContext[] = [];
  private _userSources: Source[] = [];
  private _recorderSources: Source[] = [];
  private _primaryLanguage: string;

  constructor(params: RecorderAppParams, page: Page, wsEndpointForTest: string | undefined) {
    super();
    this.setMaxListeners(0);
    this._page = page;
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

  private async _init() {
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
        this.emit('close');
        this._page.browserContext.close({ reason: 'Recorder window closed' }).catch(() => {});
      });

      await this._page.mainFrame().goto(progress, process.env.PW_HMR ? 'http://localhost:44225' : 'https://playwright/index.html');
    });
  }

  start() {
    this._updateActions(true);
  }

  async actionAdded(action: actions.ActionInContext): Promise<void> {
    this._actions.push(action);
    this._updateActions();
  }

  async signalAdded(signal: actions.Signal): Promise<void> {
    const lastAction = this._actions[this._actions.length - 1];
    if (lastAction)
      lastAction.action.signals.push(signal);
    this._updateActions();
  }

  async pageNavigated(url: string): Promise<void> {
    await this._page.mainFrame().evaluateExpression((({ url }: { url: string }) => {
      window.playwrightSetPageURL(url);
    }).toString(), { isFunction: true }, { url }).catch(() => {});
  }

  private _selectedFileChanged(fileId: string) {
    const source = [...this._recorderSources, ...this._userSources].find(s => s.id === fileId);
    if (source)
      this.emit('event', { event: 'languageChanged', params: { language: source.language } });
  }

  async close() {
    await this._page.browserContext.close({ reason: 'Recorder window closed' });
  }

  private _handleUIEvent(data: any) {
    if (data.event === 'clear') {
      this._actions = [];
      this._updateActions();
      this.emit('clear');
      return;
    }
    if (data.event === 'fileChanged') {
      this._selectedFileChanged(data.params.fileId);
      return;
    }

    // Pass through events.
    this.emit('event', data);
  }

  static async show(context: BrowserContext, params: channels.BrowserContextEnableRecorderParams) {
    const factory = RecorderApp._factory(context, params);
    await Recorder.show(context, factory, params);
  }

  static showInspectorNoReply(context: BrowserContext) {
    Recorder.showInspector(context, {}, RecorderApp._factory(context, {})).catch(() => {});
  }

  private static _factory(context: BrowserContext, params: channels.BrowserContextEnableRecorderParams): IRecorderAppFactory {
    const appParams = {
      browserName: context._browser.options.name,
      sdkLanguage: context._browser.sdkLanguage(),
      wsEndpointForTest: context._browser.options.wsEndpoint,
      ...params,
    };
    return async recorder => {
      if (process.env.PW_CODEGEN_NO_INSPECTOR)
        return new EmptyRecorderApp();
      return await RecorderApp._open(appParams, recorder, context);
    };
  }

  private static async _open(params: RecorderAppParams, recorder: IRecorder, inspectedContext: BrowserContext): Promise<IRecorderApp> {
    const sdkLanguage = inspectedContext._browser.sdkLanguage();
    const headed = !!inspectedContext._browser.options.headful;
    const recorderPlaywright = (require('../playwright').createPlaywright as typeof import('../playwright').createPlaywright)({ sdkLanguage: 'javascript', isInternalPlaywright: true });
    const { context, page } = await launchApp(recorderPlaywright.chromium, {
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
    const controller = new ProgressController(serverSideCallMetadata(), context._browser);
    await controller.run(async progress => {
      await context._browser._defaultContext!._loadDefaultContextAsIs(progress);
    });

    const result = new RecorderApp(params, page, context._browser.options.wsEndpoint);
    await result._init();
    return result;
  }

  async setMode(mode: Mode): Promise<void> {
    await this._page.mainFrame().evaluateExpression(((mode: Mode) => {
      window.playwrightSetMode(mode);
    }).toString(), { isFunction: true }, mode).catch(() => {});
  }

  async setPaused(paused: boolean): Promise<void> {
    await this._page.mainFrame().evaluateExpression(((paused: boolean) => {
      window.playwrightSetPaused(paused);
    }).toString(), { isFunction: true }, paused).catch(() => {});
  }

  async userSourcesChanged(sources: Source[]): Promise<void> {
    if (!sources.length && !this._userSources.length)
      return;
    this._userSources = sources;
    this._pushAllSources();
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
        this.close();
    }
  }

  async elementPicked(elementInfo: ElementInfo, userGesture?: boolean): Promise<void> {
    if (userGesture)
      this._page.bringToFront();
    await this._page.mainFrame().evaluateExpression(((param: { elementInfo: ElementInfo, userGesture?: boolean }) => {
      window.playwrightElementPicked(param.elementInfo, param.userGesture);
    }).toString(), { isFunction: true }, { elementInfo, userGesture }).catch(() => {});
  }

  async updateCallLogs(callLogs: CallLog[]): Promise<void> {
    await this._page.mainFrame().evaluateExpression(((callLogs: CallLog[]) => {
      window.playwrightUpdateLogs(callLogs);
    }).toString(), { isFunction: true }, callLogs).catch(() => {});
  }

  async flushOutput(): Promise<void> {
    this._throttledOutputFile?.flush();
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
