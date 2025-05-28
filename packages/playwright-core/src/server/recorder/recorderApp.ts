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

import type { BrowserContext } from '../browserContext';
import type { Page } from '../page';
import type { IRecorder, IRecorderApp, IRecorderAppFactory } from './recorderFrontend';
import type * as actions from '@recorder/actions';
import type { CallLog, ElementInfo, Mode, Source } from '@recorder/recorderTypes';

export class EmptyRecorderApp extends EventEmitter implements IRecorderApp {
  wsEndpointForTest: undefined;
  async close(): Promise<void> {}
  async setPaused(paused: boolean): Promise<void> {}
  async setMode(mode: Mode): Promise<void> {}
  async setRunningFile(file: string | undefined): Promise<void> {}
  async elementPicked(elementInfo: ElementInfo, userGesture?: boolean): Promise<void> {}
  async updateCallLogs(callLogs: CallLog[]): Promise<void> {}
  async setSources(sources: Source[], primaryPageURL: string | undefined): Promise<void> {}
  async setActions(actions: actions.ActionInContext[], sources: Source[]): Promise<void> {}
}

export class RecorderApp extends EventEmitter implements IRecorderApp {
  private _page: Page;
  readonly wsEndpointForTest: string | undefined;
  private _recorder: IRecorder;

  constructor(recorder: IRecorder, page: Page, wsEndpoint: string | undefined) {
    super();
    this.setMaxListeners(0);
    this._recorder = recorder;
    this._page = page;
    this.wsEndpointForTest = wsEndpoint;
  }

  async close() {
    await this._page.browserContext.close({ reason: 'Recorder window closed' });
  }

  private async _init() {
    await syncLocalStorageWithSettings(this._page, 'recorder');

    await this._page.setServerRequestInterceptor(route => {
      if (!route.request().url().startsWith('https://playwright/'))
        return false;

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
      return true;
    });

    await this._page.exposeBinding('dispatch', false, (_, data: any) => this.emit('event', data));

    this._page.once('close', () => {
      this.emit('close');
      this._page.browserContext.close({ reason: 'Recorder window closed' }).catch(() => {});
    });

    const mainFrame = this._page.mainFrame();
    await mainFrame.goto(serverSideCallMetadata(), process.env.PW_HMR ? 'http://localhost:44225' : 'https://playwright/index.html', { timeout: 0 });
  }

  static factory(context: BrowserContext): IRecorderAppFactory {
    return async recorder => {
      if (process.env.PW_CODEGEN_NO_INSPECTOR)
        return new EmptyRecorderApp();
      return await RecorderApp._open(recorder, context);
    };
  }

  private static async _open(recorder: IRecorder, inspectedContext: BrowserContext): Promise<IRecorderApp> {
    const sdkLanguage = inspectedContext.attribution.playwright.options.sdkLanguage;
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
        handleSIGINT: recorder.handleSIGINT,
        executablePath: inspectedContext._browser.options.isChromium ? inspectedContext._browser.options.customExecutablePath : undefined,
        // Use the same channel as the inspected context to guarantee that the browser is installed.
        channel: inspectedContext._browser.options.isChromium ? inspectedContext._browser.options.channel : undefined,
        timeout: 0,
      }
    });
    const controller = new ProgressController(serverSideCallMetadata(), context._browser);
    await controller.run(async progress => {
      await context._browser._defaultContext!._loadDefaultContextAsIs(progress);
    });

    const result = new RecorderApp(recorder, page, context._browser.options.wsEndpoint);
    await result._init();
    return result;
  }

  async setMode(mode: Mode): Promise<void> {
    await this._page.mainFrame().evaluateExpression(((mode: Mode) => {
      window.playwrightSetMode(mode);
    }).toString(), { isFunction: true }, mode).catch(() => {});
  }

  async setRunningFile(file: string | undefined): Promise<void> {
    await this._page.mainFrame().evaluateExpression(((file: string) => {
      window.playwrightSetRunningFile(file);
    }).toString(), { isFunction: true }, file).catch(() => {});
  }

  async setPaused(paused: boolean): Promise<void> {
    await this._page.mainFrame().evaluateExpression(((paused: boolean) => {
      window.playwrightSetPaused(paused);
    }).toString(), { isFunction: true }, paused).catch(() => {});
  }

  async setSources(sources: Source[], primaryPageURL: string | undefined): Promise<void> {
    await this._page.mainFrame().evaluateExpression((({ sources, primaryPageURL }: { sources: Source[], primaryPageURL: string | undefined }) => {
      window.playwrightSetSources(sources, primaryPageURL);
    }).toString(), { isFunction: true }, { sources, primaryPageURL }).catch(() => {});

    // Testing harness for runCLI mode.
    if (process.env.PWTEST_CLI_IS_UNDER_TEST && sources.length) {
      if ((process as any)._didSetSourcesForTest(sources[0].text))
        this.close();
    }
  }

  async setActions(actions: actions.ActionInContext[], sources: Source[]): Promise<void> {
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
}
