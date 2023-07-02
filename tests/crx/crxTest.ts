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

import * as path from 'path';
import { contextTest } from '../config/browserTest';
import type { PageTestFixtures } from '../page/pageTestApi';
import type { Worker, CrxApplication, Page } from 'playwright-core';
export { expect } from '@playwright/test';

declare global {
  interface Window {
    _setUnderTest(): void;
  }
}

declare const serviceWorker: ServiceWorker;

export type CrxTestFixtures = {
  extensionPath: string;
  extensionServiceWorker: Worker;
  crx: CrxApplication;
};

export const baseCrxTest = contextTest.extend<PageTestFixtures & CrxTestFixtures>({

  extensionPath: path.join(__dirname, './test-extension/dist'),

  context: async ({ launchPersistent, headless, extensionPath }, run) => {
    const { context } = await launchPersistent({
      headless,
      bypassCSP: true,
      args: [
        ...(headless ? [`--headless=new`] : []),
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ]
    });

    await run(context);
    await context.close();
  },

  extensionServiceWorker: async ({ context, headless }, use) => {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');

    // wait for initialization
    await worker.evaluate(() => new Promise<void>((resolve, reject) => {
      if (serviceWorker.state !== 'activated') {
        serviceWorker.addEventListener('statechange', () => {
          if (serviceWorker.state === 'activated') resolve();
        });
        serviceWorker.addEventListener('error', reject);
      } else {
        resolve();
      }
    }));

    await worker.evaluate(() => self._setUnderTest());

    if (!headless && process.env.PWDEBUG) {
      const extensionId = worker.url().split('/')[2];
      const page = await context.newPage();
      await page.goto(`chrome://extensions/?id=${extensionId}`);
      await page.locator('#devMode').click();
      await page.locator('.inspectable-view').click();
      await page.close();
    }

    await use(worker);
  },
});

export const crxTest = baseCrxTest.extend({

  crx: async ({ extensionServiceWorker }, use) => {
    // we will need crx in the browser, not here, so just mock it
    await use({ extensionServiceWorker } as unknown as CrxApplication);
  },

  // we pass extensionServiceWorker to force its instantiation
  page: async ({ extensionServiceWorker }, use) => {
    await use({ extensionServiceWorker } as unknown as Page);
  },
});

export const test = crxTest;
