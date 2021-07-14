/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import http from 'http';
import path from 'path';
import { test, expect } from './playwright-test-fixtures';

test('should create a server', async ({ runInlineTest }, { workerIndex }) => {
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
      module.exports = {
        launch: {
          command: 'node ${JSON.stringify(path.join(__dirname, 'assets', 'simple-server.js'))} ${port}',
          waitForPort: ${port},
        },
        globalSetup: 'globalSetup.ts',
        globalTeardown: 'globalTeardown.ts',
      };
    `,
    'globalSetup.ts': `
      module.exports = async () => {
        console.log('globalSetup')
        return () => console.log('globalSetup teardown');
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
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');

  const expectedLogMessages = ['Launching ', 'globalSetup', 'globalSetup teardown', 'globalTeardown-status-200'];
  const actualLogMessages = expectedLogMessages.map(log => ({
    log,
    index: result.output.indexOf(log),
  })).sort((a, b) => a.index - b.index).filter(l => l.index !== -1).map(l => l.log);
  expect(actualLogMessages).toStrictEqual(expectedLogMessages);
});

test('should create a server with environment variables', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
      const { test } = pwt;
      test('connect to the server', async ({baseURL, page}) => {
        expect(baseURL).toBe('http://localhost:${port}');
        await page.goto(baseURL + '/env-FOO');
        expect(await page.textContent('body')).toBe('BAR');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        launch: {
          command: 'node ${JSON.stringify(path.join(__dirname, 'assets', 'simple-server.js'))} ${port}',
          waitForPort: ${port},
          env: {
            'FOO': 'BAR',
          }
        }
      };
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');
});

test('should time out waiting for a server', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
      const { test } = pwt;
      test('connect to the server', async ({baseURL, page}) => {
        expect(baseURL).toBe('http://localhost:${port}');
        await page.goto(baseURL + '/hello');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        launch: {
          command: 'node ${JSON.stringify(JSON.stringify(path.join(__dirname, 'assets', 'simple-server.js')))} ${port}',
          waitForPort: ${port},
          waitForPortTimeout: 100,
        }
      };
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Timed out waiting 100ms from config.launch.`);
});

test('should be able to specify the baseURL without the server', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex + 10500;
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    res.end('<html><body>hello</body></html>');
  });
  await new Promise(resolve => server.listen(port, resolve));
  const result = await runInlineTest({
    'test.spec.ts': `
      const { test } = pwt;
      test('connect to the server', async ({baseURL, page}) => {
        expect(baseURL).toBe('http://localhost:${port}');
        await page.goto(baseURL + '/hello');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        use: {
          baseURL: 'http://localhost:${port}',
        }
      };
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');
  await new Promise(resolve => server.close(resolve));
});

test('should be able to use an existing server when strict is false ', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex + 10500;
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    res.end('<html><body>hello</body></html>');
  });
  await new Promise(resolve => server.listen(port, resolve));
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
      module.exports = {
        launch: {
          command: 'node ${JSON.stringify(path.join(__dirname, 'assets', 'simple-server.js'))} ${port}',
          waitForPort: ${port},
          strict: false,
        }
      };
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).not.toContain('[Launch] ');
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');
  await new Promise(resolve => server.close(resolve));
});

test('should throw when a server is already running on the given port and strict is true ', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex + 10500;
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    res.end('<html><body>hello</body></html>');
  });
  await new Promise(resolve => server.listen(port, resolve));
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
      module.exports = {
        launch: {
          command: 'node ${JSON.stringify(path.join(__dirname, 'assets', 'simple-server.js'))} ${port}',
          waitForPort: ${port},
          strict: true,
        }
      };
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Port ${port} is used, make sure that nothing is running on the port`);
  await new Promise(resolve => server.close(resolve));
});

test('should create multiple servers', async ({ runInlineTest }, { workerIndex }) => {
  const port1 = workerIndex + 10500;
  const port2 = workerIndex + 10600;
  const result = await runInlineTest({
    'test.spec.ts': `
      const { test } = pwt;
      test('connect to the server via the baseURL', async ({baseURL, page}) => {
        await page.goto('http://localhost:${port1}/hello');
        await page.goto('http://localhost:${port2}/hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        launch: [{
          command: 'node ${JSON.stringify(path.join(__dirname, 'assets', 'simple-server.js'))} ${port1}',
          waitForPort: ${port1},
        },{
          command: 'node ${JSON.stringify(path.join(__dirname, 'assets', 'simple-server.js'))} ${port2}',
          waitForPort: ${port2},
        }],
      };
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');
});
