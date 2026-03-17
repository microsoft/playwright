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

import { test as baseTest, expect } from './fixtures';
import { chromium } from 'playwright-core';

export { expect };

type TraceCliWorkerFixtures = {
  traceFile: string;
};

type TraceCliFixtures = {
  runTraceCli: (args: string[]) => Promise<{ stdout: string, stderr: string, exitCode: number | null }>;
};

export const test = baseTest
    .extend<{}, TraceCliWorkerFixtures>({
      traceFile: [async ({ __servers }, use, workerInfo) => {
        const server = __servers.server;
        // Record a trace with various actions for testing.
        const browser = await chromium.launch();
        const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
        await context.tracing.start({ screenshots: true, snapshots: true });

        const page = await context.newPage();
        server.setContent('/', `
          <html>
            <head><title>Test Page</title></head>
            <body>
              <h1>Hello World</h1>
              <button id="btn">Click me</button>
              <input id="search" type="text" placeholder="Search..." />
              <a href="/page2">Go to page 2</a>
            </body>
          </html>
        `, 'text/html');

        server.setContent('/page2', `
          <html>
            <head><title>Page 2</title></head>
            <body><h1>Page 2</h1></body>
          </html>
        `, 'text/html');

        // Navigate
        await page.goto(server.PREFIX);

        // Click
        await page.locator('#btn').click();

        // Fill
        await page.locator('#search').fill('test query');

        // Console messages
        await page.evaluate(() => {
          console.log('info message');
          console.warn('warning message');
          console.error('error message');
        });

        // Navigate to another page
        await page.locator('a').click();
        await page.waitForURL('**/page2');

        await page.close();
        const tmpDir = path.join(workerInfo.project.outputDir, 'pw-trace-cli-' + workerInfo.workerIndex);
        const tracePath = path.join(tmpDir, 'trace.zip');
        await context.tracing.stop({ path: tracePath });
        await browser.close();

        await use(tracePath);

        await fs.promises.rm(tmpDir, { recursive: true, force: true });
      }, { scope: 'worker' }],
    })
    .extend<TraceCliFixtures>({
      runTraceCli: async ({ childProcess }, use) => {
        await use(async (args: string[]) => {
          const cliPath = path.resolve(__dirname, '../../packages/playwright-core/cli.js');
          const child = childProcess({
            command: [process.execPath, cliPath, 'trace', ...args],
          });
          await child.exited;
          return {
            stdout: child.stdout.trim(),
            stderr: child.stderr.trim(),
            exitCode: await child.exitCode,
          };
        });
      },
    });
