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

import type { CLITestArgs } from '../library/inspector/inspectorTest';
import { Recorder } from '../library/inspector/inspectorTest';
import type { CrxTestFixtures } from './crxTest';
import { baseCrxTest } from './crxTest';
import type { Crx } from 'playwright-core';
import path from 'path';

declare global {
  interface Window {
    _crx: Crx;
  }
}

export const test = baseCrxTest.extend<CrxTestFixtures & CLITestArgs>({
  extensionPath: path.join(__dirname, '../../packages/playwright-core/lib/webpack/recorder'),

  page: async ({ context }, run) => {
    const [page] = context.pages();
    await run(page);
  },

  recorderPageGetter: async ({ context, extensionServiceWorker }, run) => {
    await run(async () => {
      const recorderUrl = await extensionServiceWorker.evaluate(() => chrome.runtime.getURL('index.html'));
      return context.pages().find(p => p.url() === recorderUrl) ??
          await new Promise(resolve => context.on('page', p => {
            if (p.url() === recorderUrl) resolve(p);
          }));
    });
  },

  openRecorder: async ({ extensionServiceWorker, page, recorderPageGetter }, run) => {
    await run(async (options?: { testIdAttributeName?: string }) => {
      await extensionServiceWorker.evaluate(async options => {
        const crx = await self._crx.start();
        await crx.recorder.show({ language: 'javascript', mode: 'recording', ...options });
        await crx.attachAll();
      }, options);
      return new Recorder(page, await recorderPageGetter());
    });
  },

  closeRecorder: async ({ extensionServiceWorker }, run) => {
    await run(async () => {
      await extensionServiceWorker.evaluate(async () => {
        const crx = await self._crx.start();
        await crx.recorder.hide();
      });
    });
  },
});
