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
import path from 'path';
import { test, expect } from './playwright-test-fixtures';

const SIMPLE_SERVER_PATH = path.join(__dirname, 'assets', 'simple-server.js');

test('should create multiple servers', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex + 11500;
  const result = await runInlineTest({
    'test.spec.ts': `
        const { test } = pwt;
        test('connect to the server', async ({page}) => {
          await page.goto('http://localhost:${port}/port');
          await page.locator('text=${port}');

          await page.goto('http://localhost:${port + 1}/port');
          await page.locator('text=${port + 1}');
        });
      `,
    'playwright.config.ts': `
        import { webServer } from '@playwright/test/lib/plugins';
        module.exports = {
          plugins: [
            webServer({
                command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port}',
                port: ${port},
            }),
            webServer({
                command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port + 1}',
                port: ${port + 1},
            }),
           ],
           globalSetup: 'globalSetup.ts',
           globalTeardown: 'globalTeardown.ts',
          };
        `,
    'globalSetup.ts': `
          module.exports = async () => {
            const http = require("http");
            const response = await new Promise(resolve => {
              const request = http.request("http://localhost:${port}/hello", resolve);
              request.end();
            })
            console.log('globalSetup-status-'+response.statusCode)
            return async () => {
              const response = await new Promise(resolve => {
                const request = http.request("http://localhost:${port}/hello", resolve);
                request.end();
              })
              console.log('globalSetup-teardown-status-'+response.statusCode)
            };
          };
        `,
    'globalTeardown.ts': `
          module.exports = async () => {
            const http = require("http");
            const response = await new Promise(resolve => {
              const request = http.request("http://localhost:${port}/hello", resolve);
              request.end();
            })
            console.log('globalTeardown-status-'+response.statusCode)
          };
        `,
  }, undefined, { DEBUG: 'pw:webserver' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('[WebServer] listening');
  expect(result.output).toContain('[WebServer] error from server');
  expect(result.output).toContain('passed');

  const expectedLogMessages = ['globalSetup-status-200', 'globalSetup-teardown-status', 'globalTeardown-status-200'];
  const actualLogMessages = expectedLogMessages.map(log => ({
    log,
    index: result.output.indexOf(log),
  })).sort((a, b) => a.index - b.index).filter(l => l.index !== -1).map(l => l.log);
  expect(actualLogMessages).toStrictEqual(expectedLogMessages);
});
