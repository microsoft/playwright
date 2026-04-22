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

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { test as base, expect } from '../mcp/fixtures';
import { kTargetClosedErrorMessage } from '../config/errors';

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { BrowserContext, Page } from 'playwright';
import type { StartClient } from '../mcp/fixtures';

export type BrowserWithExtension = {
  userDataDir: string;
  launch: (mode?: 'disable-extension') => Promise<BrowserContext>;
};

export type CliResult = {
  output: string;
  error: string;
};

export type ExtensionTestOptions = {
  protocolVersion: 1 | 2;
};

export type TestFixtures = {
  browserWithExtension: BrowserWithExtension,
  pathToExtension: string,
  startExtensionClient: (env?: Record<string, string>) => Promise<{ browserContext: BrowserContext, client: Client }>,
  cli: (...args: string[]) => Promise<CliResult>;
};

type WorkerFixtures = {
  _protocolEnv: void;
};

export const extensionId = 'mmlmfjhmonkocbjadbfplnigmagldckm';

export const test = base.extend<TestFixtures, WorkerFixtures & ExtensionTestOptions>({
  protocolVersion: [2, { option: true, scope: 'worker' }],

  _protocolEnv: [async ({ protocolVersion }, use) => {
    // Default is 1.
    if (protocolVersion === 2)
      process.env.PLAYWRIGHT_EXTENSION_PROTOCOL = '2';
    else
      delete process.env.PLAYWRIGHT_EXTENSION_PROTOCOL;
    await use();
  }, { auto: true, scope: 'worker' }],

  pathToExtension: async ({}, use, testInfo) => {
    const extensionDir = testInfo.outputPath('extension');
    const srcDir = path.resolve(__dirname, '../../packages/extension/dist');
    await fs.cp(srcDir, extensionDir, { recursive: true });
    await use(extensionDir);
  },

  browserWithExtension: async ({ mcpBrowser, pathToExtension }, use, testInfo) => {
    // The flags no longer work in Chrome since
    // https://chromium.googlesource.com/chromium/src/+/290ed8046692651ce76088914750cb659b65fb17%5E%21/chrome/browser/extensions/extension_service.cc?pli=1#
    test.skip('chromium' !== mcpBrowser, '--load-extension is not supported for official builds of Chromium');

    let browserContext: BrowserContext | undefined;
    const userDataDir = testInfo.outputPath('extension-user-data-dir');
    await use({
      userDataDir,
      launch: async (mode?: 'disable-extension') => {
        browserContext = await chromium.launchPersistentContext(userDataDir, {
          channel: mcpBrowser,
          // Opening the browser singleton only works in headed.
          headless: false,
          // Automation disables singleton browser process behavior, which is necessary for the extension.
          ignoreDefaultArgs: ['--enable-automation'],
          args: mode === 'disable-extension' ? [] : [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
          ],
        });

        // MV3 service workers start lazily; wait for the extension's
        // background to be ready so tests can reach `chrome.*` via it.
        if (!browserContext.serviceWorkers().length)
          await browserContext.waitForEvent('serviceworker');

        return browserContext;
      }
    });
    await browserContext?.close();

    // Free up disk space.
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  },

  startExtensionClient: async ({ browserWithExtension, startClient }, use) => {
    await use(async (env?: Record<string, string>) => {
      const browserContext = await browserWithExtension.launch();
      const client = await startWithExtensionFlag(browserWithExtension, startClient, env);
      return { browserContext, client };
    });
  },

  cli: async ({ mcpBrowser }, use, testInfo) => {
    await use(async (...args: string[]) => {
      return await runCli(args, { mcpBrowser, testInfo });
    });

    // Cleanup sessions
    await runCli(['close-all'], { mcpBrowser, testInfo }).catch(() => {});

    const daemonDir = path.join(testInfo.outputDir, 'daemon');
    await fs.rm(daemonDir, { recursive: true, force: true }).catch(() => {});
  },
});

export { expect };

export const testWithOldExtensionVersion = test.extend({
  pathToExtension: async ({ pathToExtension }, use) => {
    const manifestPath = path.join(pathToExtension, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    manifest.version = '0.0.1';
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await use(pathToExtension);
  },
});

function cliEnv() {
  return {
    PLAYWRIGHT_SERVER_REGISTRY: test.info().outputPath('registry'),
    PLAYWRIGHT_DAEMON_SESSION_DIR: test.info().outputPath('daemon'),
    // Short path because macOS caps unix socket paths at 104 chars; the
    // long `project.outputDir` path overflows and causes EADDRINUSE.
    PLAYWRIGHT_SOCKETS_DIR: path.join(os.tmpdir(), 'pwmcp-sock', String(test.info().parallelIndex)),
  };
}

async function runCli(
  args: string[],
  options: { mcpBrowser?: string, testInfo: any },
): Promise<CliResult> {
  const stepTitle = `cli ${args.join(' ')}`;

  return await test.step(stepTitle, async () => {
    const testInfo = options.testInfo;

    // Path to the terminal CLI
    const cliPath = require.resolve('../../packages/playwright-core/lib/tools/cli-client/cli.js');

    return new Promise<CliResult>((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const childProcess = spawn(process.execPath, [cliPath, ...args], {
        cwd: testInfo.outputPath(),
        env: {
          ...process.env,
          ...cliEnv(),
          PLAYWRIGHT_MCP_BROWSER: options.mcpBrowser,
          PLAYWRIGHT_MCP_HEADLESS: 'false',
        },
        detached: true,
      });

      childProcess.stdout?.on('data', data => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', data => {
        if (process.env.PWMCP_DEBUG)
          process.stderr.write(data);
        stderr += data.toString();
      });

      childProcess.on('close', async code => {
        await testInfo.attach(stepTitle, { body: stdout, contentType: 'text/plain' });
        resolve({
          output: stdout.trim(),
          error: stderr.trim(),
        });
      });

      childProcess.on('error', reject);
    });
  });
}

export async function startWithExtensionFlag(browserWithExtension: BrowserWithExtension, startClient: StartClient, env?: Record<string, string>): Promise<Client> {
  const { client } = await startClient({
    args: [`--extension`],
    env,
    config: {
      browser: {
        userDataDir: browserWithExtension.userDataDir,
      }
    },
  });
  return client;
}

// The connect page closes itself once a different tab is selected, which races
// with the click — the request reaches the background while the page is being
// torn down. Swallow the resulting "Target closed" error.
export async function clickAllowAndSelect(connectPage: Page, tabTitle: RegExp | string): Promise<void> {
  await connectPage.locator('.tab-item', { hasText: tabTitle }).getByRole('button', { name: 'Allow & select' }).click().catch(e => {
    if (!e?.message?.includes(kTargetClosedErrorMessage))
      throw e;
  });
}

export async function connectAndNavigate(
  browserContext: BrowserContext,
  client: Client,
  url: string,
  tabTitle: RegExp | string = 'Welcome',
): Promise<Awaited<ReturnType<Client['callTool']>>> {
  const confirmationPagePromise = browserContext.waitForEvent('page', page =>
    page.url().startsWith(`chrome-extension://${extensionId}/connect.html`)
  );
  const navigatePromise = client.callTool({ name: 'browser_navigate', arguments: { url } });
  const selectorPage = await confirmationPagePromise;
  await clickAllowAndSelect(selectorPage, tabTitle);
  return await navigatePromise;
}
