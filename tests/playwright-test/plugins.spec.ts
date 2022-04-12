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

const kRawReporterPath = path.join(__dirname, '..', '..', 'packages', 'playwright-test', 'lib', 'reporters', 'raw.js');

test.only('should create a server', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
      const { test } = pwt;
      test('connect to the server via the baseURL', async ({baseURL, page}) => {
        await page.goto('/hello');
        await page.waitForURL('/hello');
        expect(page.url()).toBe('http://localhost:${port}/hello');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      const { webServer } = pwt;
      module.exports = {
        plugins: [
            webServer({
                command: 'node ${JSON.stringify(path.join(__dirname, 'assets', 'simple-server.js'))} ${port}',
                port: ${port},
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
  }, { reporter: 'json,dot,' + kRawReporterPath }, {}, { usesCustomOutputDir: true });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).not.toContain('[WebServer] listening');
  expect(result.output).not.toContain('[WebServer] error from server');
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');

  const expectedLogMessages = ['globalSetup-status-200', 'globalSetup-teardown-status', 'globalTeardown-status-200'];
  const actualLogMessages = expectedLogMessages.map(log => ({
    log,
    index: result.output.indexOf(log),
  })).sort((a, b) => a.index - b.index).filter(l => l.index !== -1).map(l => l.log);
  expect(actualLogMessages).toStrictEqual(expectedLogMessages);
});
