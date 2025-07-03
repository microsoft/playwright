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

import { isUnderTest } from '../utils';
import { serverSideCallMetadata } from './instrumentation';
import { findChromiumChannel } from './registry';
import { registryDirectory } from './registry';
import { ProgressController } from './progress';

import type { BrowserType } from './browserType';
import type { CRPage } from './chromium/crPage';
import type { Page } from './page';
import type * as types from './types';


export async function launchApp(browserType: BrowserType, options: {
  sdkLanguage: string,
  windowSize: types.Size,
  windowPosition?: types.Point,
  persistentContextOptions?: Parameters<BrowserType['launchPersistentContext']>[2];
}) {
  const args = [...options.persistentContextOptions?.args ?? []];

  let channel = options.persistentContextOptions?.channel;
  if (browserType.name() === 'chromium') {
    args.push(
        '--app=data:text/html,',
        `--window-size=${options.windowSize.width},${options.windowSize.height}`,
        ...(options.windowPosition ? [`--window-position=${options.windowPosition.x},${options.windowPosition.y}`] : []),
        '--test-type=',
    );
    if (!channel && !options.persistentContextOptions?.executablePath)
      channel = findChromiumChannel(options.sdkLanguage);
  }

  const controller = new ProgressController(serverSideCallMetadata(), browserType);
  const context = await controller.run(progress => browserType.launchPersistentContext(progress, '', {
    ignoreDefaultArgs: ['--enable-automation'],
    ...options?.persistentContextOptions,
    channel,
    noDefaultViewport: options.persistentContextOptions?.noDefaultViewport ?? true,
    acceptDownloads: options?.persistentContextOptions?.acceptDownloads ?? (isUnderTest() ? 'accept' : 'internal-browser-default'),
    colorScheme: options?.persistentContextOptions?.colorScheme ?? 'no-override',
    args,
  }), 0); // Deliberately no timeout for our apps.
  const [page] = context.pages();
  // Chromium on macOS opens a new tab when clicking on the dock icon.
  // See https://github.com/microsoft/playwright/issues/9434
  if (browserType.name() === 'chromium' && process.platform === 'darwin') {
    context.on('page', async (newPage: Page) => {
      if (newPage.mainFrame().url() === 'chrome://new-tab-page/') {
        await page.bringToFront();
        await newPage.close();
      }
    });
  }
  if (browserType.name() === 'chromium')
    await installAppIcon(page);
  return { context, page };
}

async function installAppIcon(page: Page) {
  const icon = await fs.promises.readFile(require.resolve('./chromium/appIcon.png'));
  const crPage = page.delegate as CRPage;
  await crPage._mainFrameSession._client.send('Browser.setDockTile', {
    image: icon.toString('base64')
  });
}

export async function syncLocalStorageWithSettings(page: Page, appName: string) {
  if (isUnderTest())
    return;
  const settingsFile = path.join(registryDirectory, '.settings', `${appName}.json`);

  const controller = new ProgressController(serverSideCallMetadata(), page);
  await controller.run(async progress => {
    await page.exposeBinding(progress, '_saveSerializedSettings', false, (_, settings) => {
      fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
      fs.writeFileSync(settingsFile, settings);
    });

    const settings = await fs.promises.readFile(settingsFile, 'utf-8').catch(() => ('{}'));
    await page.addInitScript(progress,
        `(${String((settings: any) => {
          // iframes w/ snapshots, etc.
          if (location && location.protocol === 'data:')
            return;
          if (window.top !== window)
            return;
          Object.entries(settings).map(([k, v]) => localStorage[k] = v);
          (window as any).saveSettings = () => {
            (window as any)._saveSerializedSettings(JSON.stringify({ ...localStorage }));
          };
        })})(${settings});
    `);
  });
}
