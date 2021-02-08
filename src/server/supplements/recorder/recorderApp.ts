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

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { CRPage } from '../../chromium/crPage';
import { Page } from '../../page';
import { ProgressController } from '../../progress';
import { createPlaywright } from '../../playwright';
import { EventEmitter } from 'events';
import { DEFAULT_ARGS } from '../../chromium/chromium';

const readFileAsync = util.promisify(fs.readFile);

export type Mode = 'inspecting' | 'recording' | 'none';
export type EventData = {
  event: 'clear' | 'resume' | 'setMode',
  params: any
};

declare global {
  interface Window {
    playwrightSetMode: (mode: Mode) => void;
    playwrightSetPaused: (paused: boolean) => void;
    playwrightSetSource: (params: { text: string, language: string }) => void;
    dispatch(data: EventData): Promise<void>;
  }
}

export class RecorderApp extends EventEmitter {
  private _page: Page;

  constructor(page: Page) {
    super();
    this.setMaxListeners(0);
    this._page = page;
  }

  async close() {
    await this._page.context().close();
  }

  private async _init() {
    const icon = await readFileAsync(require.resolve('../../../web/recorder/app_icon.png'));
    const crPopup = this._page._delegate as CRPage;
    await crPopup._mainFrameSession._client.send('Browser.setDockTile', {
      image: icon.toString('base64')
    });

    await this._page._setServerRequestInterceptor(async route => {
      if (route.request().url().startsWith('https://playwright/')) {
        const uri = route.request().url().substring('https://playwright/'.length);
        const file = require.resolve('../../../web/recorder/' + uri);
        const buffer = await readFileAsync(file);
        await route.fulfill({
          status: 200,
          headers: [
            { name: 'Content-Type', value: extensionToMime[path.extname(file)] }
          ],
          body: buffer.toString('base64'),
          isBase64: true
        });
        return;
      }
      await route.continue();
    });

    await this._page.exposeBinding('dispatch', false, (_, data: any) => this.emit('event', data));

    this._page.once('close', () => {
      this.emit('close');
      this._page.context().close().catch(e => console.error(e));
    });

    await this._page.mainFrame().goto(new ProgressController(), 'https://playwright/index.html');
  }

  static async open(): Promise<RecorderApp> {
    const recorderPlaywright = createPlaywright(true);
    const context = await recorderPlaywright.chromium.launchPersistentContext('', {
      ignoreAllDefaultArgs: true,
      args: [
        ...DEFAULT_ARGS,
        `--user-data-dir=${path.join(os.homedir(),'.playwright-app')}`,
        '--remote-debugging-pipe',
        '--app=data:text/html,',
        '--window-size=300,800',
        '--no-sandbox',
      ],
      noDefaultViewport: true
    });

    const controller = new ProgressController();
    await controller.run(async progress => {
      await context._browser._defaultContext!._loadDefaultContextAsIs(progress);
    });

    const [page] = context.pages();
    const result = new RecorderApp(page);
    await result._init();
    return result;
  }

  async setMode(mode: 'none' | 'recording' | 'inspecting'): Promise<void> {
    await this._page.mainFrame()._evaluateExpression(((mode: Mode) => {
      window.playwrightSetMode(mode);
    }).toString(), true, mode, 'main').catch(() => {});
  }

  async setPaused(paused: boolean): Promise<void> {
    await this._page.mainFrame()._evaluateExpression(((paused: boolean) => {
      window.playwrightSetPaused(paused);
    }).toString(), true, paused, 'main').catch(() => {});
  }

  async setSource(text: string, language: string): Promise<void> {
    await this._page.mainFrame()._evaluateExpression(((param: { text: string, language: string }) => {
      window.playwrightSetSource(param);
    }).toString(), true, { text, language }, 'main').catch(() => {});
  }

  async bringToFront() {
    await this._page.bringToFront();
  }
}

const extensionToMime: { [key: string]: string } = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.jpeg': 'image/jpeg',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
