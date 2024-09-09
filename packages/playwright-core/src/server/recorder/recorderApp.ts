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
import type { Page } from '../page';
import { ProgressController } from '../progress';
import { EventEmitter } from 'events';
import { serverSideCallMetadata } from '../instrumentation';
import type { CallLog, EventData, Mode, Source } from '@recorder/recorderTypes';
import { isUnderTest } from '../../utils';
import { mime } from '../../utilsBundle';
import { syncLocalStorageWithSettings } from '../launchApp';
import type { Recorder, RecorderAppFactory } from '../recorder';
import type { BrowserContext } from '../browserContext';
import { launchApp } from '../launchApp';

declare global {
  interface Window {
    playwrightSetFileIfNeeded: (file: string) => void;
    playwrightSetMode: (mode: Mode) => void;
    playwrightSetPaused: (paused: boolean) => void;
    playwrightSetSources: (sources: Source[]) => void;
    playwrightSetOverlayVisible: (visible: boolean) => void;
    playwrightSetSelector: (selector: string, focus?: boolean) => void;
    playwrightUpdateLogs: (callLogs: CallLog[]) => void;
    dispatch(data: EventData): Promise<void>;
    saveSettings?(): Promise<void>;
  }
}

export interface IRecorderApp extends EventEmitter {
  close(): Promise<void>;
  setPaused(paused: boolean): Promise<void>;
  setMode(mode: Mode): Promise<void>;
  setFileIfNeeded(file: string): Promise<void>;
  setSelector(selector: string, userGesture?: boolean): Promise<void>;
  updateCallLogs(callLogs: CallLog[]): Promise<void>;
  setSources(sources: Source[]): Promise<void>;
}

export class EmptyRecorderApp extends EventEmitter implements IRecorderApp {
  async close(): Promise<void> {}
  async setPaused(paused: boolean): Promise<void> {}
  async setMode(mode: Mode): Promise<void> {}
  async setFileIfNeeded(file: string): Promise<void> {}
  async setSelector(selector: string, userGesture?: boolean): Promise<void> {}
  async updateCallLogs(callLogs: CallLog[]): Promise<void> {}
  async setSources(sources: Source[]): Promise<void> {}
}

export class RecorderApp extends EventEmitter implements IRecorderApp {
  private _page: Page;
  readonly wsEndpoint: string | undefined;
  private _recorder: Recorder;

  constructor(recorder: Recorder, page: Page, wsEndpoint: string | undefined) {
    super();
    this.setMaxListeners(0);
    this._recorder = recorder;
    this._page = page;
    this.wsEndpoint = wsEndpoint;
  }

  async close() {
    await this._page.context().close({ reason: 'Recorder window closed' });
  }

  private async _init() {
    await syncLocalStorageWithSettings(this._page, 'recorder');

    await this._page._setServerRequestInterceptor(route => {
      if (!route.request().url().startsWith('https://playwright/'))
        return false;

      const uri = route.request().url().substring('https://playwright/'.length);
      const file = require.resolve('../../vite/recorder/' + uri);
      fs.promises.readFile(file).then(buffer => {
        route.fulfill({
          requestUrl: route.request().url(),
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
      this._page.context().close({ reason: 'Recorder window closed' }).catch(() => {});
    });

    const mainFrame = this._page.mainFrame();
    await mainFrame.goto(serverSideCallMetadata(), 'https://playwright/index.html');
  }

  static factory(context: BrowserContext): RecorderAppFactory {
    return async recorder => {
      if (process.env.PW_CODEGEN_NO_INSPECTOR)
        return new EmptyRecorderApp();
      return await RecorderApp._open(recorder, context);
    };
  }

  private static async _open(recorder: Recorder, inspectedContext: BrowserContext): Promise<IRecorderApp> {
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
        useWebSocket: !!process.env.PWTEST_RECORDER_PORT,
        handleSIGINT: false,
        args: process.env.PWTEST_RECORDER_PORT ? [`--remote-debugging-port=${process.env.PWTEST_RECORDER_PORT}`] : [],
        executablePath: inspectedContext._browser.options.isChromium ? inspectedContext._browser.options.customExecutablePath : undefined,
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

  async setFileIfNeeded(file: string): Promise<void> {
    await this._page.mainFrame().evaluateExpression(((file: string) => {
      window.playwrightSetFileIfNeeded(file);
    }).toString(), { isFunction: true }, file).catch(() => {});
  }

  async setPaused(paused: boolean): Promise<void> {
    await this._page.mainFrame().evaluateExpression(((paused: boolean) => {
      window.playwrightSetPaused(paused);
    }).toString(), { isFunction: true }, paused).catch(() => {});
  }

  async setSources(sources: Source[]): Promise<void> {
    await this._page.mainFrame().evaluateExpression(((sources: Source[]) => {
      window.playwrightSetSources(sources);
    }).toString(), { isFunction: true }, sources).catch(() => {});

    // Testing harness for runCLI mode.
    if (process.env.PWTEST_CLI_IS_UNDER_TEST && sources.length)
      (process as any)._didSetSourcesForTest(sources[0].text);
  }

  async setSelector(selector: string, userGesture?: boolean): Promise<void> {
    if (userGesture) {
      if (this._recorder?.mode() === 'inspecting') {
        this._recorder.setMode('standby');
        this._page.bringToFront();
      } else {
        this._recorder?.setMode('recording');
      }
    }
    await this._page.mainFrame().evaluateExpression(((data: { selector: string, userGesture?: boolean }) => {
      window.playwrightSetSelector(data.selector, data.userGesture);
    }).toString(), { isFunction: true }, { selector, userGesture }).catch(() => {});
  }

  async updateCallLogs(callLogs: CallLog[]): Promise<void> {
    await this._page.mainFrame().evaluateExpression(((callLogs: CallLog[]) => {
      window.playwrightUpdateLogs(callLogs);
    }).toString(), { isFunction: true }, callLogs).catch(() => {});
  }
}
