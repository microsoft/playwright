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

import { isUnderTest, rewriteErrorMessage, wrapInASCIIBox } from '../utils';
import { buildPlaywrightCLICommand, findChromiumChannelBestEffort } from './registry';
import { registryDirectory } from './registry';
import { ProgressController } from './progress';

import type { BrowserType } from './browserType';
import type { CRPage } from './chromium/crPage';
import type { Page } from './page';
import type * as types from './types';

/**
 * Get Chromium rendering arguments for WSL UI mode workarounds.
 * Addresses transparent window issues in WSL with Intel iGPU + discrete GPU.
 *
 * Environment variables (in precedence order):
 * - PW_UI_DISABLE_GPU=1: Disable GPU entirely
 * - PW_UI_USE_SWIFTSHADER=1: Force SwiftShader software rendering
 * - PW_UI_USE_DISCRETE_GPU=1: Force discrete GPU selection
 * - Auto-detect WSL and use SwiftShader as fallback
 */
function getWSLRenderingArgs(): string[] {
  // Check explicit environment variable overrides first
  if (process.env.PW_UI_DISABLE_GPU === '1')
    return ['--disable-gpu', '--disable-software-rasterizer'];

  if (process.env.PW_UI_USE_SWIFTSHADER === '1')
    return ['--use-gl=swiftshader'];

  if (process.env.PW_UI_USE_DISCRETE_GPU === '1')
    return ['--use-gl=angle', '--use-angle=d3d11'];

  // Auto-detect WSL and apply SwiftShader fallback
  if (isWSL())
    return ['--use-gl=swiftshader'];

  return [];
}

/**
 * Detect if running under WSL (Windows Subsystem for Linux)
 */
function isWSL(): boolean {
  if (process.platform !== 'linux')
    return false;

  return (
    fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop') ||
    (fs.existsSync('/proc/version') &&
     fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')) ||
    !!process.env.WSL_DISTRO_NAME
  );
}

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
    // WSL UI rendering workarounds for transparent window issues
    // See: https://github.com/microsoft/playwright/issues/37287
    const gpuArgs = getWSLRenderingArgs();
    if (gpuArgs.length > 0)
      args.push(...gpuArgs);

    if (!channel && !options.persistentContextOptions?.executablePath)
      channel = findChromiumChannelBestEffort(options.sdkLanguage);
  }

  const controller = new ProgressController();
  let context;
  try {
    context = await controller.run(progress => browserType.launchPersistentContext(progress, '', {
      ignoreDefaultArgs: ['--enable-automation'],
      ...options?.persistentContextOptions,
      channel,
      noDefaultViewport: options.persistentContextOptions?.noDefaultViewport ?? true,
      acceptDownloads: options?.persistentContextOptions?.acceptDownloads ?? (isUnderTest() ? 'accept' : 'internal-browser-default'),
      colorScheme: options?.persistentContextOptions?.colorScheme ?? 'no-override',
      args,
    }), 0); // Deliberately no timeout for our apps.
  } catch (error) {
    if (channel) {
      error = rewriteErrorMessage(error, [
        `Failed to launch "${channel}" channel.`,
        'Using custom channels could lead to unexpected behavior due to Enterprise policies (chrome://policy).',
        'Install the default browser instead:',
        wrapInASCIIBox(`${buildPlaywrightCLICommand(options.sdkLanguage, 'install')}`, 2),
      ].join('\n'));
    }
    throw error;
  }
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

  const controller = new ProgressController();
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
