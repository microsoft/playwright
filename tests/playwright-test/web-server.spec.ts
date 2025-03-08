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

import type http from 'http';
import path from 'path';
import { test, expect, parseTestRunnerOutput } from './playwright-test-fixtures';
import type { RunResult } from './playwright-test-fixtures';
import { createHttpServer } from '../../packages/playwright-core/lib/server/utils/network';

const SIMPLE_SERVER_PATH = path.join(__dirname, 'assets', 'simple-server.js');

test('should create a server', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex * 2 + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('connect to the server via the baseURL', async ({baseURL, page}) => {
        await page.goto('/hello');
        await page.waitForURL('/hello');
        expect(page.url()).toBe('http://localhost:${port}/hello');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port}',
          port: ${port},
        },
        globalSetup: 'globalSetup.ts',
        globalTeardown: 'globalTeardown.ts',
      };
    `,
    'globalSetup.ts': `
      import { expect } from '@playwright/test';
      module.exports = async (config) => {
        expect(config.webServer.port, "For backwards compatibility reasons, we ensure this shows up.").toBe(${port});
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
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).not.toContain('[WebServer] listening');
  expect(result.output).toContain('[WebServer] error from server');
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');

  const expectedLogMessages = ['globalSetup-status-200', 'globalSetup-teardown-status', 'globalTeardown-status-200'];
  const actualLogMessages = expectedLogMessages.map(log => ({
    log,
    index: result.output.indexOf(log),
  })).sort((a, b) => a.index - b.index).filter(l => l.index !== -1).map(l => l.log);
  expect(actualLogMessages).toStrictEqual(expectedLogMessages);
});

test('should create a server with environment variables', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex * 2 + 10500;
  process.env['FOOEXTERNAL'] = 'EXTERNAL-BAR';
  const result = await runInlineTest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('connect to the server', async ({baseURL, page}) => {
        expect(baseURL).toBe('http://localhost:${port}');
        await page.goto(baseURL + '/env-FOO');
        expect(await page.textContent('body')).toBe('BAR');

        await page.goto(baseURL + '/env-FOOEXTERNAL');
        expect(await page.textContent('body')).toBe('EXTERNAL-BAR');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port}',
          port: ${port},
          env: {
            'FOO': 'BAR',
          }
        }
      };
    `,
  }, {}, { DEBUG: 'pw:webserver' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('[WebServer] listening');
  expect(result.output).toContain('[WebServer] error from server');
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');
  delete process.env['FOOEXTERNAL'];
});

test('should default cwd to config directory', async ({ runInlineTest }, testInfo) => {
  const port = testInfo.workerIndex * 2 + 10500;
  const configDir = testInfo.outputPath('foo');
  const relativeSimpleServerPath = path.relative(configDir, SIMPLE_SERVER_PATH);
  const result = await runInlineTest({
    'foo/test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('connect to the server', async ({ baseURL }) => {
        expect(baseURL).toBe('http://localhost:${port}');
      });
    `,
    'foo/playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(relativeSimpleServerPath)} ${port}',
          port: ${port},
        }
      };
    `,
  }, {}, { DEBUG: 'pw:webserver' }, {
    cwd: 'foo'
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('[WebServer] listening');
  expect(result.output).toContain('[WebServer] error from server');
});

test('should resolve cwd wrt config directory', async ({ runInlineTest }, testInfo) => {
  const port = testInfo.workerIndex * 2 + 10500;
  const testdir = testInfo.outputPath();
  const relativeSimpleServerPath = path.relative(testdir, SIMPLE_SERVER_PATH);
  const result = await runInlineTest({
    'foo/test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('connect to the server', async ({ baseURL }) => {
        expect(baseURL).toBe('http://localhost:${port}');
      });
    `,
    'foo/playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(relativeSimpleServerPath)} ${port}',
          port: ${port},
          cwd: '..',
        }
      };
    `,
  }, {}, { DEBUG: 'pw:webserver' }, {
    cwd: 'foo'
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('[WebServer] listening');
  expect(result.output).toContain('[WebServer] error from server');
});


test('should create a server with url', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex * 2 + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('connect to the server', async ({baseURL, page}) => {
        expect(baseURL).toBe(undefined);
        await page.goto('http://localhost:${port}/ready');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(path.join(__dirname, 'assets', 'simple-server-with-ready-route.js'))} ${port}',
          url: 'http://localhost:${port}/ready'
        }
      };
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');
});

test('should time out waiting for a server', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex * 2 + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('connect to the server', async ({baseURL, page}) => {
        expect(baseURL).toBe('http://localhost:${port}');
        await page.goto(baseURL + '/hello');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port} 1000',
          port: ${port},
          timeout: 100,
        }
      };
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Timed out waiting 100ms from config.webServer.`);
});

test('should time out waiting for a server with url', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex * 2 + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('connect to the server', async ({baseURL, page}) => {
        expect(baseURL).toBe('http://localhost:${port}/ready');
        await page.goto(baseURL);
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(path.join(__dirname, 'assets', 'simple-server-with-ready-route.js'))} ${port}',
          url: 'http://localhost:${port}/ready',
          timeout: 300,
        }
      };
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Timed out waiting 300ms from config.webServer.`);
});

test('should be able to specify the baseURL without the server', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex * 2 + 10500;
  const server = createHttpServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    res.end('<html><body>hello</body></html>');
  });
  await new Promise<void>(resolve => server.listen(port, resolve));
  const result = await runInlineTest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
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

test('should be able to specify a custom baseURL with the server', async ({ runInlineTest }, { workerIndex }) => {
  const customWebServerPort = workerIndex * 2 + 10500;
  const webServerPort = customWebServerPort + 1;
  const server = createHttpServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    res.end('<html><body>hello</body></html>');
  });
  await new Promise<void>(resolve => server.listen(customWebServerPort, resolve));
  const result = await runInlineTest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('connect to the server', async ({baseURL, page}) => {
        expect(baseURL).toBe('http://localhost:${customWebServerPort}');
        await page.goto(baseURL + '/hello');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${webServerPort}',
          port: ${webServerPort},
        },
        use: {
          baseURL: 'http://localhost:${customWebServerPort}',
        }
      };
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');
  await new Promise(resolve => server.close(resolve));
});

test('should be able to use an existing server when reuseExistingServer:true', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex * 2 + 10500;
  const server = createHttpServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    res.end('<html><body>hello</body></html>');
  });
  await new Promise<void>(resolve => server.listen(port, resolve));
  const result = await runInlineTest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('connect to the server via the baseURL', async ({baseURL, page}) => {
        await page.goto('/hello');
        await page.waitForURL('/hello');
        expect(page.url()).toBe('http://localhost:${port}/hello');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port}',
          port: ${port},
          reuseExistingServer: true,
        }
      };
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).not.toContain('[WebServer] ');
  expect(result.report.suites[0].specs[0].tests[0].results[0].status).toContain('passed');
  await new Promise(resolve => server.close(resolve));
});

test('should throw when a server is already running on the given port and strict is true', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex * 2 + 10500;
  const server = createHttpServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    res.end('<html><body>hello</body></html>');
  });
  await new Promise<void>(resolve => server.listen(port, resolve));
  const result = await runInlineTest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('connect to the server via the baseURL', async ({baseURL, page}) => {
        await page.goto('/hello');
        await page.waitForURL('/hello');
        expect(page.url()).toBe('http://localhost:${port}/hello');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port}',
          port: ${port},
          reuseExistingServer: false,
        }
      };
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`http://localhost:${port} is already used, make sure that nothing is running on the port/url`);
  await new Promise(resolve => server.close(resolve));
});

for (const host of ['localhost', '127.0.0.1', '0.0.0.0']) {
  test(`should detect the server if a web-server is already running on ${host}`, async ({ runInlineTest }, { workerIndex }) => {
    const port = workerIndex * 2 + 10500;
    const server = createHttpServer((req: http.IncomingMessage, res: http.ServerResponse) => {
      res.end('<html><body>hello</body></html>');
    });
    await new Promise<void>(resolve => server.listen(port, host, resolve));
    try {
      const result = await runInlineTest({
        'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('connect to the server via the baseURL', async ({baseURL, page}) => {
        await page.goto('/hello');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
        'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node -e "process.exit(1)"',
          port: ${port},
          reuseExistingServer: false,
        }
      };
    `,
      });
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain(`http://localhost:${port} is already used, make sure that nothing is running on the port/url`);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });
}

test(`should support self signed certificate`, async ({ runInlineTest, httpsServer }) => {
  const result = await runInlineTest({
    'test.spec.js': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => { });
    `,
    'playwright.config.js': `
      module.exports = {
        webServer: {
          url: '${httpsServer.EMPTY_PAGE}',
          ignoreHTTPSErrors: true,
          reuseExistingServer: true,
        },
      };
    `,
  });
  expect(result.exitCode).toBe(0);
});

test('should send Accept header', async ({ runInlineTest, server }) => {
  let acceptHeader: string | undefined | null = null;
  server.setRoute('/hello', (req, res) => {
    if (acceptHeader === null)
      acceptHeader = req.headers.accept;
    res.end('<html><body>hello</body></html>');
  });
  const result = await runInlineTest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('connect to the server', async ({baseURL, page}) => {
        await page.goto('http://localhost:${server.PORT}/hello');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${server.PORT}',
          url: 'http://localhost:${server.PORT}/hello',
          reuseExistingServer: true,
        }
      };
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(acceptHeader).toBe('*/*');
});

test('should follow redirects', async ({ runInlineTest, server }) => {
  server.setRedirect('/redirect', '/redirected-to');
  server.setRoute('/redirected-to', (req, res) => {
    res.end('<html><body>hello</body></html>');
  });
  const result = await runInlineTest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('connect to the server', async ({baseURL, page}) => {
        await page.goto('http://localhost:${server.PORT}/redirect');
        expect(await page.textContent('body')).toBe('hello');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${server.PORT}',
          url: 'http://localhost:${server.PORT}/redirect',
          reuseExistingServer: true,
        }
      };
    `,
  });
  expect(result.exitCode).toBe(0);
});

test('should create multiple servers', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex * 2 + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
        import { test, expect } from '@playwright/test';

        test('connect to the server', async ({page}) => {
          await page.goto('http://localhost:${port}/port');
          await page.locator('text=${port}');

          await page.goto('http://localhost:${port + 1}/port');
          await page.locator('text=${port + 1}');
        });
      `,
    'playwright.config.ts': `
        module.exports = {
          webServer: [
            {
              command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port}',
              url: 'http://localhost:${port}/port',
            },
            {
              command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port + 1}',
              url: 'http://localhost:${port + 1}/port',
            }
          ],
          globalSetup: 'globalSetup.ts',
          globalTeardown: 'globalTeardown.ts',
        };
        `,
    'globalSetup.ts': `
        import { expect } from '@playwright/test';
        module.exports = async (config) => {
          expect(config.webServer, "The public API defines this type as singleton or null, so if using array style we fallback to null to avoid having the type lie to the user.").toBe(null);
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

test.describe('baseURL with plugins', () => {
  test('plugins do not set it', async ({ runInlineTest }, { workerIndex }) => {
    const port = workerIndex * 2 + 10500;
    const result = await runInlineTest({
      'test.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('connect to the server', async ({baseURL, page}) => {
          expect(baseURL).toBeUndefined();
        });
      `,
      'playwright.config.ts': `
        import { webServer } from 'playwright/lib/plugins';
        module.exports = {
          _plugins: [
            webServer({
              command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port}',
              url: 'http://localhost:${port}/port',
            })
          ]
        };
      `,
    }, undefined, { DEBUG: 'pw:webserver' });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
  });

  test('legacy config sets it alongside plugin', async ({ runInlineTest }, { workerIndex }) => {
    const port = workerIndex * 2 + 10500;
    const result = await runInlineTest({
      'test.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('connect to the server', async ({baseURL, page}) => {
          expect(baseURL).toBe('http://localhost:${port}');
        });
      `,
      'playwright.config.ts': `
        import { webServer } from 'playwright/lib/plugins';
        module.exports = {
          webServer: {
            command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port}',
            port: ${port},
          },
          _plugins: [
            webServer({
              command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port + 1}',
              url: 'http://localhost:${port + 1}/port'
            })
          ]
        };
      `,
    }, undefined, { DEBUG: 'pw:webserver' });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
  });
});

test('should treat 3XX as available server', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex * 2 + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => {});
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port}',
          url: 'http://localhost:${port}/redirect',
        }
      };
    `,
  }, {}, { DEBUG: 'pw:webserver' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('[WebServer] listening');
  expect(result.output).toContain('[WebServer] error from server');
});

test('should check ipv4 and ipv6 with happy eyeballs when URL is passed', async ({ runInlineTest }, { workerIndex }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/20784' });
  const port = workerIndex * 2 + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => {});
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node -e "require(\\'http\\').createServer((req, res) => res.end()).listen(${port}, \\'127.0.0.1\\')"',
          url: 'http://localhost:${port}/',
        }
      };
    `,
  }, {}, { DEBUG: 'pw:webserver' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('Process started');
  expect(result.output).toContain(`HTTP GET: http://localhost:${port}/`);
  expect(result.output).toContain('WebServer available');
});

test('should forward stdout when set to "pipe"', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex * 2 + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => {});
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port}',
          port: ${port},
          stdout: 'pipe',
        }
      };
    `,
  }, undefined);
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('[WebServer] listening');
  expect(result.output).toContain('[WebServer] error from server'); // stderr is piped by default
});

test('should be able to ignore "stderr"', async ({ runInlineTest }, { workerIndex }) => {
  const port = workerIndex * 2 + 10500;
  const result = await runInlineTest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => {});
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port}',
          port: ${port},
          stderr: 'ignore',
        }
      };
    `,
  }, undefined);
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).not.toContain('error from server');
});

test('should forward stdout when set to "pipe" before server is ready', async ({ interactWithTestRunner }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const testProcess = await interactWithTestRunner({
    'web-server.js': `
      console.log('output from server');
      console.log('\\n%%SEND-SIGINT%%');
      setTimeout(() => {}, 10000000);
    `,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => {});
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node web-server.js',
          port: 12345,
          stdout: 'pipe',
          timeout: 3000,
        },
      };
    `,
  }, { workers: 1 });
  await testProcess.waitForOutput('%%SEND-SIGINT%%');
  process.kill(-testProcess.process.pid!, 'SIGINT');
  await testProcess.exited;

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('[WebServer] output from server');
  expect(result.output).not.toContain('Timed out waiting 3000ms');
});

test.describe('gracefulShutdown option', () => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const files = (additionalOptions = {}) => {
    const port = test.info().workerIndex * 2 + 10510;
    return {
      'child.js': `
        process.on('SIGINT', () => { console.log('%%childprocess received SIGINT'); setTimeout(() => process.exit(), 10) })
        process.on('SIGTERM', () => { console.log('%%childprocess received SIGTERM'); setTimeout(() => process.exit(), 10) })
        setTimeout(() => {}, 100000) // prevent child from exiting
      `,
      'web-server.js': `
        require("node:child_process").fork('./child.js', { silent: false })
        
        process.on('SIGINT', () => {
          console.log('%%webserver received SIGINT but stubbornly refuses to wind down')
        })
        process.on('SIGTERM', () => {
          console.log('%%webserver received SIGTERM but stubbornly refuses to wind down')
        })

        const server = require("node:http").createServer((req, res) => { res.end("ok"); })
        server.listen(process.argv[2]);
      `,
      'test.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('pass', async ({}) => {});
      `,
      'playwright.config.ts': `
        module.exports = {
          webServer: {
            command: 'echo some-precondition && node web-server.js ${port}',
            port: ${port},
            stdout: 'pipe',
            timeout: 3000,
            ...${JSON.stringify(additionalOptions)}
          },
        };
      `,
    };
  };

  function parseOutputLines(result: RunResult): string[] {
    const prefix = '[WebServer] %%';
    return result.output.split('\n').filter(line => line.startsWith(prefix)).map(line => line.substring(prefix.length));
  }

  test('sends SIGKILL by default', async ({ runInlineTest }) => {
    const result = await runInlineTest(files(), { workers: 1 });
    expect(parseOutputLines(result)).toEqual([]);
  });

  test('can be configured to send SIGTERM', async ({ runInlineTest }) => {
    const result = await runInlineTest(files({ gracefulShutdown: { signal: 'SIGTERM', timeout: 500 } }), { workers: 1 });
    expect(parseOutputLines(result).sort()).toEqual(['childprocess received SIGTERM', 'webserver received SIGTERM but stubbornly refuses to wind down']);
  });

  test('can be configured to send SIGINT', async ({ runInlineTest }) => {
    const result = await runInlineTest(files({ gracefulShutdown: { signal: 'SIGINT', timeout: 500 } }), { workers: 1 });
    expect(parseOutputLines(result).sort()).toEqual(['childprocess received SIGINT', 'webserver received SIGINT but stubbornly refuses to wind down']);
  });
});

test.describe('name option', () => {
  test('should use custom prefix', async ({ runInlineTest }, { workerIndex }) => {
    const port = workerIndex * 2 + 10500;
    const name1 = 'CustomName1';
    const name2 = 'CustomName2';
    const defaultPrefix = 'WebServer';
    const result = await runInlineTest({
      'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => {});
    `,
      'playwright.config.ts': `
      module.exports = {
        webServer: [
          {
            command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port}',
            port: ${port},
            name: '${name1}',
          },
          {
            command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port + 1}',
            port: ${port + 1},
            name: '${name2}',
          }
        ],
      };
    `,
    }, undefined);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain(`[${name1}]`);
    expect(result.output).toContain(`[${name2}]`);
    expect(result.output).not.toContain(`[${defaultPrefix}]`);
  });

  test('should use default prefix when name option is not set', async ({ runInlineTest }, { workerIndex }) => {
    const port = workerIndex * 2 + 10500;
    const defaultPrefix = 'WebServer';
    const result = await runInlineTest({
      'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => {});
    `,
      'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(SIMPLE_SERVER_PATH)} ${port}',
          port: ${port},
        },
      };
    `,
    }, undefined);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain(`[${defaultPrefix}]`);
  });
});
