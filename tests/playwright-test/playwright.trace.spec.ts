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

import { test, expect } from './playwright-test-fixtures';
import { parseTrace, parseTraceRaw } from '../config/utils';
import fs from 'fs';

test.describe.configure({ mode: 'parallel' });

test('should stop tracing with trace: on-first-retry, when not retrying', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on-first-retry' } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';

      test.describe('shared', () => {
        let page;
        test.beforeAll(async ({ browser }) => {
          page = await browser.newPage();
        });

        test.afterAll(async () => {
          await page.close();
        });

        test('flaky', async ({}, testInfo) => {
          expect(testInfo.retry).toBe(1);
        });

        test('no tracing', async ({}, testInfo) => {
          const e = await page.context().tracing.stop({ path: 'ignored' }).catch(e => e);
          expect(e.message).toContain('Must start tracing before stopping');
        });
      });
    `,
  }, { workers: 1, retries: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.flaky).toBe(1);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-shared-flaky-retry1', 'trace.zip'))).toBeTruthy();
});

test('should record api trace', async ({ runInlineTest, server }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on' } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';

      test('pass', async ({request, page}, testInfo) => {
        await page.goto('about:blank');
        await request.get('${server.EMPTY_PAGE}');
      });

      test('api pass', async ({playwright}, testInfo) => {
        const request = await playwright.request.newContext();
        await request.get('${server.EMPTY_PAGE}');
      });

      test('fail', async ({request, page}, testInfo) => {
        await page.goto('about:blank');
        await request.get('${server.EMPTY_PAGE}');
        expect(1).toBe(2);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(1);
  // One trace file for request context and one for each APIRequestContext
  const trace1 = await parseTrace(testInfo.outputPath('test-results', 'a-pass', 'trace.zip'));
  expect(trace1.actionTree).toEqual([
    'Before Hooks',
    '  Fixture "request"',
    '    Create request context',
    '  Fixture "browser"',
    '    Launch browser',
    '  Fixture "context"',
    '    Create context',
    '  Fixture "page"',
    '    Create page',
    'Navigate to "about:blank"',
    'GET "/empty.html"',
    'After Hooks',
    '  Fixture "page"',
    '  Fixture "context"',
    '  Fixture "request"',
  ]);
  const trace2 = await parseTrace(testInfo.outputPath('test-results', 'a-api-pass', 'trace.zip'));
  expect(trace2.actionTree).toEqual([
    'Before Hooks',
    'Create request context',
    'GET "/empty.html"',
    'After Hooks',
  ]);
  const trace3 = await parseTrace(testInfo.outputPath('test-results', 'a-fail', 'trace.zip'));
  expect(trace3.actionTree).toEqual([
    'Before Hooks',
    '  Fixture "request"',
    '    Create request context',
    '  Fixture "context"',
    '    Create context',
    '  Fixture "page"',
    '    Create page',
    'Navigate to "about:blank"',
    'GET "/empty.html"',
    'Expect "toBe"',
    'After Hooks',
    '  Fixture "page"',
    '  Fixture "context"',
    '  Fixture "request"',
    'Worker Cleanup',
    '  Fixture "browser"',
  ]);
});

test('should not throw with trace: on-first-retry and two retries in the same worker', async ({ runInlineTest }, testInfo) => {
  const files = {};
  for (let i = 0; i < 6; i++) {
    files[`a${i}.spec.ts`] = `
      import { test, expect } from './helper';
      test('flaky', async ({ myContext }, testInfo) => {
        await new Promise(f => setTimeout(f, 200 + Math.round(Math.random() * 1000)));
        expect(testInfo.retry).toBe(1);
      });
      test('passing', async ({ myContext }, testInfo) => {
        await new Promise(f => setTimeout(f, 200 + Math.round(Math.random() * 1000)));
      });
    `;
  }
  const result = await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on-first-retry' } };
    `,
    'helper.ts': `
      import { test as base } from '@playwright/test';
      export * from '@playwright/test';
      export const test = base.extend({
        myContext: [async ({ browser }, use) => {
          const c = await browser.newContext();
          await use(c);
          await c.close();
        }, { scope: 'worker' }]
      })
    `,
  }, { workers: 3, retries: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(6);
  expect(result.flaky).toBe(6);
});

test('should not mixup network files between contexts', async ({ runInlineTest, server }, testInfo) => {
  // NOTE: this test reproduces the issue 10% of the time. Running with --repeat-each=20 helps.
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22089' });

  const result = await runInlineTest({
    'playwright.config.ts': `
      export default { use: { trace: 'on' } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';

      let page1, page2;

      test.beforeAll(async ({ browser }) => {
        page1 = await browser.newPage();
        await page1.goto("${server.EMPTY_PAGE}");

        page2 = await browser.newPage();
        await page2.goto("${server.EMPTY_PAGE}");
      });

      test.afterAll(async () => {
        await page1.close();
        await page2.close();
      });

      test('example', async ({ page }) => {
        await page.goto("${server.EMPTY_PAGE}");
      });
    `,
  }, { workers: 1, timeout: 15000 });
  expect(result.exitCode).toEqual(0);
  expect(result.passed).toBe(1);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-example', 'trace.zip'))).toBe(true);
});

test('should save sources when requested', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
          trace: 'on',
        }
      };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {
        await page.evaluate(2 + 2);
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toEqual(0);
  const { resources } = await parseTrace(testInfo.outputPath('test-results', 'a-pass', 'trace.zip'));
  expect([...resources.keys()].filter(name => name.startsWith('resources/src@'))).toHaveLength(1);
});

test('should not save sources when not requested', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
          trace: {
            mode: 'on',
            sources: false,
          }
        }
      };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {
        await page.evaluate(2 + 2);
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toEqual(0);
  const { resources } = await parseTrace(testInfo.outputPath('test-results', 'a-pass', 'trace.zip'));
  expect([...resources.keys()].filter(name => name.startsWith('resources/src@'))).toHaveLength(0);
});

test('should work in serial mode', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'retain-on-failure' } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';

      test.describe.serial('serial', () => {
        let page;
        test.beforeAll(async ({ browser }) => {
          page = await browser.newPage();
        });

        test.afterAll(async () => {
          await page.close();
        });

        test('passes', async ({}, testInfo) => {
        });

        test('fails', async ({}, testInfo) => {
          throw new Error('oh my');
        });
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-serial-passes', 'trace.zip'))).toBeFalsy();
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-serial-fails', 'trace.zip'))).toBeTruthy();
});

test('should not override trace file in afterAll', async ({ runInlineTest, server }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'retain-on-failure' } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';

      test('test 1', async ({ page }) => {
        await page.goto('about:blank');
        throw 'oh no!';
      });

      // Another test in the same file to affect after hooks order.
      test('test 2', async ({ page }) => {
      });

      test.afterAll(async ({ request }) => {
        await request.get('${server.EMPTY_PAGE}');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  const trace1 = await parseTrace(testInfo.outputPath('test-results', 'a-test-1', 'trace.zip'));

  expect(trace1.actionTree).toEqual([
    'Before Hooks',
    '  Fixture "browser"',
    '    Launch browser',
    '  Fixture "context"',
    '    Create context',
    '  Fixture "page"',
    '    Create page',
    'Navigate to "about:blank"',
    'After Hooks',
    '  Fixture "page"',
    '  Fixture "context"',
    '  afterAll hook',
    '    Fixture "request"',
    '      Create request context',
    '    GET "/empty.html"',
    '    Fixture "request"',
    'Worker Cleanup',
    '  Fixture "browser"',
  ]);
  expect(trace1.errors).toEqual([`'oh no!'`]);

  const error = await parseTrace(testInfo.outputPath('test-results', 'a-test-2', 'trace.zip')).catch(e => e);
  expect(error).toBeTruthy();
});

test('should retain traces for interrupted tests', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'retain-on-failure' }, maxFailures: 1 };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test 1', async ({ page }) => {
        await page.waitForTimeout(2000);
        expect(1).toBe(2);
      });
    `,
    'b.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test 2', async ({ page }) => {
        await page.goto('about:blank');
        await page.waitForTimeout(5000);
      });
    `,
  }, { workers: 2 });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.interrupted).toBe(1);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-test-1', 'trace.zip'))).toBeTruthy();
  expect(fs.existsSync(testInfo.outputPath('test-results', 'b-test-2', 'trace.zip'))).toBeTruthy();
});

test('should respect --trace', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test 1', async ({ page }) => {
        await page.goto('about:blank');
      });
    `,
  }, { trace: 'on' });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-test-1', 'trace.zip'))).toBeTruthy();
});

for (const mode of ['off', 'retain-on-failure', 'on-first-retry', 'on-all-retries', 'retain-on-first-failure']) {
  test(`trace:${mode} should not create trace zip artifact if page test passed`, async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'a.spec.ts': `
        import { test as base, expect } from '@playwright/test';
        import fs from 'fs';
        let artifactsDir;
        const test = base.extend({
          workerAuto: [async ({}, use) => {
            await use();
            const entries =  fs.readdirSync(artifactsDir);
            expect(entries.filter(e => e.endsWith('.zip'))).toEqual([]);
          }, { scope: 'worker', auto: true }],
        });
        test('passing test', async ({ page }) => {
          artifactsDir = test.info()._tracing.artifactsDir();
          await page.goto('about:blank');
        });
      `,
    }, { trace: 'retain-on-failure' });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
  });

  test(`trace:${mode} should not create trace zip artifact if APIRequestContext test passed`, async ({ runInlineTest, server }) => {
    const result = await runInlineTest({
      'a.spec.ts': `
        import { test as base, expect } from '@playwright/test';
        import fs from 'fs';
        let artifactsDir;
        const test = base.extend({
          workerAuto: [async ({}, use) => {
            await use();
            const entries =  fs.readdirSync(artifactsDir);
            expect(entries.filter(e => e.endsWith('.zip'))).toEqual([]);
          }, { scope: 'worker', auto: true }],
        });
        test('passing test', async ({ request }) => {
          artifactsDir = test.info()._tracing.artifactsDir();
          expect(await request.get('${server.EMPTY_PAGE}')).toBeOK();
        });
      `,
    }, { trace: 'retain-on-failure' });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
  });
}

test(`trace:retain-on-failure should create trace if context is closed before failure in the test`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'retain-on-failure' } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('passing test', async ({ page, context }) => {
        await page.goto('about:blank');
        await context.close();
        expect(1).toBe(2);
      });
    `,
  }, { trace: 'retain-on-failure' });
  const tracePath = test.info().outputPath('test-results', 'a-passing-test', 'trace.zip');
  const trace = await parseTrace(tracePath);
  expect(trace.titles).toContain('Navigate to "about:blank"');
  expect(result.failed).toBe(1);
});

test(`trace:retain-on-failure should create trace if context is closed before failure in afterEach`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'retain-on-failure' } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('passing test', async ({ page, context }) => {
      });
      test.afterEach(async ({ page, context }) => {
        await page.goto('about:blank');
        await context.close();
        expect(1).toBe(2);
      });
    `,
  }, { trace: 'retain-on-failure' });
  const tracePath = test.info().outputPath('test-results', 'a-passing-test', 'trace.zip');
  const trace = await parseTrace(tracePath);
  expect(trace.titles).toContain('Navigate to "about:blank"');
  expect(result.failed).toBe(1);
});

test(`trace:retain-on-failure should create trace if request context is disposed before failure`, async ({ runInlineTest, server }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'retain-on-failure' } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('passing test', async ({ request }) => {
        expect(await request.get('${server.EMPTY_PAGE}')).toBeOK();
        await request.dispose();
        expect(1).toBe(2);
      });
    `,
  }, { trace: 'retain-on-failure' });
  const tracePath = test.info().outputPath('test-results', 'a-passing-test', 'trace.zip');
  const trace = await parseTrace(tracePath);
  expect(trace.titles).toContain('GET "/empty.html"');
  expect(result.failed).toBe(1);
});

test('should include attachments by default', async ({ runInlineTest, server }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on' } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';

      test('pass', async ({}, testInfo) => {
        testInfo.attach('foo', { body: 'bar' });
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const trace = await parseTrace(testInfo.outputPath('test-results', 'a-pass', 'trace.zip'));
  expect(trace.titles).toEqual([
    'Before Hooks',
    'Attach "foo"',
    'After Hooks',
  ]);
  expect(trace.actions[1].attachments).toEqual([{
    name: 'foo',
    contentType: 'text/plain',
    sha1: expect.any(String),
  }]);
  expect([...trace.resources.keys()]).toContain(`resources/${trace.actions[1].attachments[0].sha1}`);
});

test('should opt out of attachments', async ({ runInlineTest, server }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: { mode: 'on', attachments: false } } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';

      test('pass', async ({}, testInfo) => {
        testInfo.attach('foo', { body: 'bar' });
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const trace = await parseTrace(testInfo.outputPath('test-results', 'a-pass', 'trace.zip'));
  expect(trace.titles).toEqual([
    'Before Hooks',
    `Attach "foo"`,
    'After Hooks',
  ]);
  expect(trace.actions[1].attachments).toEqual(undefined);
  expect([...trace.resources.keys()].filter(f => f.startsWith('resources/') && !f.startsWith('resources/src@'))).toHaveLength(0);
});

test('should record with custom page fixture', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';

      const test = base.extend({
        myPage: async ({ browser }, use) => {
          await use(await browser.newPage());
        },
      });

      test.use({ trace: 'on' });

      test('fails', async ({ myPage }, testInfo) => {
        await myPage.setContent('hello');
        throw new Error('failure!');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('failure!');
  const trace = await parseTraceRaw(testInfo.outputPath('test-results', 'a-fails', 'trace.zip'));
  expect(trace.events).toContainEqual(expect.objectContaining({
    type: 'frame-snapshot',
  }));
});

test('should expand expect.toPass', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: { mode: 'on' } } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {
        let i = 0;
        await expect(async () => {
          await page.goto('data:text/html,Hello world');
          expect(i++).toBe(2);
        }).toPass();
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const trace = await parseTrace(testInfo.outputPath('test-results', 'a-pass', 'trace.zip'));
  expect(trace.actionTree).toEqual([
    'Before Hooks',
    '  Fixture "browser"',
    '    Launch browser',
    '  Fixture "context"',
    '    Create context',
    '  Fixture "page"',
    '    Create page',
    'Expect "toPass"',
    '  Navigate to "data:"',
    '  Expect "toBe"',
    '  Navigate to "data:"',
    '  Expect "toBe"',
    '  Navigate to "data:"',
    '  Expect "toBe"',
    'After Hooks',
    '  Fixture "page"',
    '  Fixture "context"',
  ]);
});

test('should show non-expect error in trace', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: { mode: 'on' } } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page }) => {
        expect(1).toBe(1);
        undefinedVariable1 = 'this throws an exception';
        expect(1).toBe(2);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  const trace = await parseTrace(testInfo.outputPath('test-results', 'a-fail', 'trace.zip'));
  expect(trace.actionTree).toEqual([
    'Before Hooks',
    '  Fixture "browser"',
    '    Launch browser',
    '  Fixture "context"',
    '    Create context',
    '  Fixture "page"',
    '    Create page',
    'Expect "toBe"',
    'After Hooks',
    '  Fixture "page"',
    '  Fixture "context"',
    'Worker Cleanup',
    '  Fixture "browser"',
  ]);
  expect(trace.errors).toEqual(['ReferenceError: undefinedVariable1 is not defined']);
});

test('should show error from beforeAll in trace', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: { mode: 'on' } } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeAll(async () => {
        throw new Error('Oh my!');
      })
      test('fail', async ({ page }) => {
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  const trace = await parseTrace(testInfo.outputPath('test-results', 'a-fail', 'trace.zip'));
  expect(trace.errors).toEqual(['Error: Oh my!']);
});

test('should throw when trace fixture is a function', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.use({
        trace: async ({}, use) => {
          await use('on');
        },
      });
      test('skipped', async ({ page }) => {
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Error: "trace" option cannot be a function');
});

test('should not throw when attachment is missing', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on' } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', async ({}) => {
        test.info().attachments.push({ name: 'screenshot', path: 'nothing-to-see-here', contentType: 'image/png' });
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const trace = await parseTrace(testInfo.outputPath('test-results', 'a-passes', 'trace.zip'));
  expect(trace.titles).toContain('Attach "screenshot"');
});

test('should not throw when screenshot on failure fails', async ({ runInlineTest, server }, testInfo) => {
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=file.txt');
    res.end(`Hello world`);
  });

  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on', screenshot: 'on' } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('has download page', async ({ page }) => {
        await page.goto("${server.EMPTY_PAGE}");
        await page.setContent('<a href="/download" target="blank">open me!</a>');
        const downloadPromise = page.waitForEvent('download');
        await page.click('a');
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('file.txt');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const trace = await parseTrace(testInfo.outputPath('test-results', 'a-has-download-page', 'trace.zip'));
  const attachedScreenshots = trace.actions.filter(a => a.attachments).flatMap(a => a.attachments);
  // One screenshot for the page, no screenshot for the download page since it should have failed.
  expect(attachedScreenshots.length).toBe(1);
});

test('should use custom expect message in trace', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: { mode: 'on' } } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page }) => {
        await expect(
            page.getByRole('button', { name: 'Find a hotel' }),
            'expect to have text: find a hotel'
        ).toHaveCount(0);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const trace = await parseTrace(testInfo.outputPath('test-results', 'a-fail', 'trace.zip'));
  expect(trace.actionTree).toEqual([
    'Before Hooks',
    '  Fixture "browser"',
    '    Launch browser',
    '  Fixture "context"',
    '    Create context',
    '  Fixture "page"',
    '    Create page',
    'Expect "expect to have text: find a hotel"',
    'After Hooks',
    '  Fixture "page"',
    '  Fixture "context"',
  ]);
});

test('should not throw when merging traces multiple times', async ({ runInlineTest }, testInfo) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27286' });

  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on' } };
    `,
    'a.spec.ts': `
      import { BrowserContext, expect, Page, test as baseTest } from '@playwright/test';

      let pg: Page;
      let ctx: BrowserContext;

      const test = baseTest.extend({
        page: async ({}, use) => {
          await use(pg);
        },
        context: async ({}, use) => {
          await use(ctx);
        },
      });

      test.beforeAll(async ({ browser }) => {
        ctx = await browser.newContext();
        pg = await ctx.newPage();
      });

      test.beforeAll(async ({ page }) => {
        await page.goto('https://playwright.dev');
      });

      test.afterAll(async ({ context }) => {
        await context.close();
      });

      test('foo', async ({ page }) => {
        await expect(page.locator('h1')).toContainText('Playwright');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-foo', 'trace.zip'))).toBe(true);
});

test('should record nested steps, even after timeout', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: { trace: { mode: 'on' } },
        timeout: 5000,
      };
    `,
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fooPage: async ({ page }, use) => {
          expect(1, 'fooPage setup').toBe(1);
          await new Promise(f => setTimeout(f, 1));  // To avoid same-wall-time sorting issues.
          await page.setContent('hello');
          await test.step('step in fooPage setup', async () => {
            await page.setContent('bar');
          });
          await use(page);
          expect(1, 'fooPage teardown').toBe(1);
          await new Promise(f => setTimeout(f, 1));  // To avoid same-wall-time sorting issues.
          await page.setContent('hi');
          await test.step('step in fooPage teardown', async () => {
            await page.setContent('bar');
          });
        },
        barPage: async ({ browser }, use) => {
          expect(1, 'barPage setup').toBe(1);
          await new Promise(f => setTimeout(f, 1));  // To avoid same-wall-time sorting issues.
          const page = await browser.newPage();
          await test.step('step in barPage setup', async () => {
            await page.setContent('bar');
          });
          await use(page);
          expect(1, 'barPage teardown').toBe(1);
          await new Promise(f => setTimeout(f, 1));  // To avoid same-wall-time sorting issues.
          await test.step('step in barPage teardown', async () => {
            await page.close();
          });
        },
      });

      test.beforeAll(async ({ barPage }) => {
        expect(1, 'beforeAll start').toBe(1);
        await new Promise(f => setTimeout(f, 1));  // To avoid same-wall-time sorting issues.
        await barPage.setContent('hello');
        await test.step('step in beforeAll', async () => {
          await barPage.setContent('bar');
        });
      });

      test.beforeEach(async ({ fooPage }) => {
        expect(1, 'beforeEach start').toBe(1);
        await new Promise(f => setTimeout(f, 1));  // To avoid same-wall-time sorting issues.
        await fooPage.setContent('hello');
        await test.step('step in beforeEach', async () => {
          await fooPage.setContent('hi');
          // Next line times out. We make sure that after hooks steps
          // form the expected step tree even when some previous steps have not finished.
          await new Promise(() => {});
        });
      });

      test('example', async ({ fooPage }) => {
      });

      test.afterEach(async ({ fooPage }) => {
        expect(1, 'afterEach start').toBe(1);
        await new Promise(f => setTimeout(f, 1));  // To avoid same-wall-time sorting issues.
        await fooPage.setContent('hello');
        await test.step('step in afterEach', async () => {
          await fooPage.setContent('bar');
        });
      });

      test.afterAll(async ({ barPage }) => {
        expect(1, 'afterAll start').toBe(1);
        await new Promise(f => setTimeout(f, 1));  // To avoid same-wall-time sorting issues.
        await barPage.setContent('hello');
        await test.step('step in afterAll', async () => {
          await barPage.setContent('bar');
        });
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  const trace = await parseTrace(testInfo.outputPath('test-results', 'a-example', 'trace.zip'));
  expect(trace.actionTree).toEqual([
    'Before Hooks',
    '  beforeAll hook',
    '    Fixture "browser"',
    '      Launch browser',
    '    Fixture "barPage"',
    '      Expect "barPage setup"',
    '      Create page',
    '      step in barPage setup',
    '        Set content',
    '    Expect "beforeAll start"',
    '    Set content',
    '    step in beforeAll',
    '      Set content',
    '    Fixture "barPage"',
    '      Expect "barPage teardown"',
    '      step in barPage teardown',
    '        Close context',
    '  beforeEach hook',
    '    Fixture "context"',
    '      Create context',
    '    Fixture "page"',
    '      Create page',
    '    Fixture "fooPage"',
    '      Expect "fooPage setup"',
    '      Set content',
    '      step in fooPage setup',
    '        Set content',
    '    Expect "beforeEach start"',
    '    Set content',
    '    step in beforeEach',
    '      Set content',
    'After Hooks',
    '  afterEach hook',
    '    Expect "afterEach start"',
    '    Set content',
    '    step in afterEach',
    '      Set content',
    '  Fixture "fooPage"',
    '    Expect "fooPage teardown"',
    '    Set content',
    '    step in fooPage teardown',
    '      Set content',
    '  Fixture "page"',
    '  Fixture "context"',
    '  afterAll hook',
    '    Fixture "barPage"',
    '      Expect "barPage setup"',
    '      Create page',
    '      step in barPage setup',
    '        Set content',
    '    Expect "afterAll start"',
    '    Set content',
    '    step in afterAll',
    '      Set content',
    '    Fixture "barPage"',
    '      Expect "barPage teardown"',
    '      step in barPage teardown',
    '        Close context',
    'Attach "error-context"',
    'Worker Cleanup',
    '  Fixture "browser"',
  ]);
});

test('should not produce an action entry for calling a binding', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on' } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', async ({ page }) => {
          let wasCalled = false;
          await page.exposeBinding('customBinding', () => {
            wasCalled = true;
            return 'foo';
          });

          const output = await page.evaluate(() => window['customBinding']());
          expect(wasCalled).toBe(true);
          expect(output).toBe('foo');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const trace = await parseTrace(testInfo.outputPath('test-results', 'a-passes', 'trace.zip'));
  expect(trace.actionTree).toEqual([
    'Before Hooks',
    '  Fixture "browser"',
    '    Launch browser',
    '  Fixture "context"',
    '    Create context',
    '  Fixture "page"',
    '    Create page',
    'Expose binding',
    'Evaluate',
    'Expect "toBe"',
    'Expect "toBe"',
    'After Hooks',
    '  Fixture "page"',
    '  Fixture "context"',
  ]);
});

test('should attribute worker fixture teardown to the right test', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: { trace: { mode: 'on' } },
      };
    `,
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: [async ({}, use) => {
          expect(1, 'step in foo setup').toBe(1);
          await use('foo');
          expect(1, 'step in foo teardown').toBe(1);
        }, { scope: 'worker' }],
      });

      test('one', async ({ foo }) => {
      });

      test('two', async ({ foo }) => {
        throw new Error('failure');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  const trace1 = await parseTrace(testInfo.outputPath('test-results', 'a-one', 'trace.zip'));
  expect(trace1.actionTree).toEqual([
    'Before Hooks',
    '  Fixture "foo"',
    '    Expect "step in foo setup"',
    'After Hooks',
  ]);
  const trace2 = await parseTrace(testInfo.outputPath('test-results', 'a-two', 'trace.zip'));
  expect(trace2.actionTree).toEqual([
    'Before Hooks',
    'After Hooks',
    'Worker Cleanup',
    '  Fixture "foo"',
    '    Expect "step in foo teardown"',
  ]);
});

test('trace:retain-on-first-failure should create trace but only on first failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page }) => {
        await page.goto('about:blank');
        expect(true).toBe(false);
      });
    `,
  }, { trace: 'retain-on-first-failure', retries: 1 });

  const retryTracePath = test.info().outputPath('test-results', 'a-fail-retry1', 'trace.zip');
  const retryTraceExists = fs.existsSync(retryTracePath);
  expect(retryTraceExists).toBe(false);

  const tracePath = test.info().outputPath('test-results', 'a-fail', 'trace.zip');
  const trace = await parseTrace(tracePath);
  expect(trace.titles).toContain('Navigate to "about:blank"');
  expect(result.failed).toBe(1);
});

test('trace:retain-on-first-failure should create trace if context is closed before failure in the test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page, context }) => {
        await page.goto('about:blank');
        await context.close();
        expect(1).toBe(2);
      });
    `,
  }, { trace: 'retain-on-first-failure' });
  const tracePath = test.info().outputPath('test-results', 'a-fail', 'trace.zip');
  const trace = await parseTrace(tracePath);
  expect(trace.titles).toContain('Navigate to "about:blank"');
  expect(result.failed).toBe(1);
});

test('trace:retain-on-first-failure should create trace if context is closed before failure in afterEach', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page, context }) => {
      });
      test.afterEach(async ({ page, context }) => {
        await page.goto('about:blank');
        await context.close();
        expect(1).toBe(2);
      });
    `,
  }, { trace: 'retain-on-first-failure' });
  const tracePath = test.info().outputPath('test-results', 'a-fail', 'trace.zip');
  const trace = await parseTrace(tracePath);
  expect(trace.titles).toContain('Navigate to "about:blank"');
  expect(result.failed).toBe(1);
});

test('trace:retain-on-first-failure should create trace if request context is disposed before failure', async ({ runInlineTest, server }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ request }) => {
        expect(await request.get('${server.EMPTY_PAGE}')).toBeOK();
        await request.dispose();
        expect(1).toBe(2);
      });
    `,
  }, { trace: 'retain-on-first-failure' });
  const tracePath = test.info().outputPath('test-results', 'a-fail', 'trace.zip');
  const trace = await parseTrace(tracePath);
  expect(trace.titles).toContain('GET "/empty.html"');
  expect(result.failed).toBe(1);
});

test('should not corrupt actions when no library trace is present', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: async ({}, use) => {
          expect(1).toBe(1);
          await use();
          expect(2).toBe(2);
        },
      });
      test('fail', async ({ foo }) => {
        expect(1).toBe(2);
      });
    `,
  }, { trace: 'on' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  const tracePath = test.info().outputPath('test-results', 'a-fail', 'trace.zip');
  const trace = await parseTrace(tracePath);
  expect(trace.actionTree).toEqual([
    'Before Hooks',
    '  Fixture "foo"',
    '    Expect "toBe"',
    'Expect "toBe"',
    'After Hooks',
    '  Fixture "foo"',
    '    Expect "toBe"',
    'Worker Cleanup',
  ]);
});

test('should record trace for manually created context in a failed test', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31541' });

  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ browser }) => {
        const page = await browser.newPage();
        await page.setContent('<script>console.log("from the page");</script>');
        expect(1).toBe(2);
      });
    `,
  }, { trace: 'on' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  const tracePath = test.info().outputPath('test-results', 'a-fail', 'trace.zip');
  const trace = await parseTrace(tracePath);
  expect(trace.actionTree).toEqual([
    'Before Hooks',
    '  Fixture "browser"',
    '    Launch browser',
    'Create page',
    'Set content',
    'Expect "toBe"',
    'After Hooks',
    'Worker Cleanup',
    '  Fixture "browser"',
  ]);
  // Check console events to make sure that library trace is recorded.
  expect(trace.events).toContainEqual(expect.objectContaining({ type: 'console', text: 'from the page' }));
});

test('should not nest top level expect into unfinished api calls ', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31959' }
}, async ({ runInlineTest, server }) => {
  server.setRoute('/index', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<script>fetch('/api')</script><div>Hello!</div>`);
  });
  server.setRoute('/hang', () => {});
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {
        await page.route('**/api', async route => {
          const response = await route.fetch({ url: '${server.PREFIX}/hang' });
          await route.fulfill({ response });
        });
        await page.goto('${server.PREFIX}/index');
        await expect(page.getByText('Hello!')).toBeVisible();
        await page.unrouteAll({ behavior: 'ignoreErrors' });
      });
    `,
  }, { trace: 'on' });
  expect(result.exitCode).toBe(0);
  expect(result.failed).toBe(0);

  const tracePath = test.info().outputPath('test-results', 'a-pass', 'trace.zip');
  const trace = await parseTrace(tracePath);
  expect(trace.actionTree).toEqual([
    'Before Hooks',
    '  Fixture "browser"',
    '    Launch browser',
    '  Fixture "context"',
    '    Create context',
    '  Fixture "page"',
    '    Create page',
    'Navigate to "/index"',
    'GET "/hang"',
    'Expect "toBeVisible"',
    'After Hooks',
    '  Fixture "page"',
    '  Fixture "context"',
  ]);
});

test('should record trace after fixture teardown timeout', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30718' },
}, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: async ({}, use) => {
          await use('foo');
          await new Promise(() => {});
        },
      });
      // Note: it is important that "fixture" is last, so that it runs the teardown first.
      test('fails', async ({ page, fixture }) => {
        await page.evaluate(() => console.log('from the page'));
      });
    `,
  }, { trace: 'on', timeout: '3000' }, { DEBUG: 'pw:test' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  const tracePath = test.info().outputPath('test-results', 'a-fails', 'trace.zip');
  const trace = await parseTrace(tracePath);
  expect(trace.actionTree).toEqual([
    'Before Hooks',
    '  Fixture "browser"',
    '    Launch browser',
    '  Fixture "context"',
    '    Create context',
    '  Fixture "page"',
    '    Create page',
    '  Fixture "fixture"',
    'Evaluate',
    'After Hooks',
    '  Fixture "fixture"',
    'Worker Cleanup',
    '  Fixture "browser"',
  ]);
  // Check console events to make sure that library trace is recorded.
  expect(trace.events).toContainEqual(expect.objectContaining({ type: 'console', text: 'from the page' }));
});

test('should record trace snapshot for more obscure commands', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test 1', async ({ browser }) => {
        const page = await browser.newPage();
        await page.setContent('<div>Content</div>');
        expect(await page.locator('div').count()).toBe(1);
        await page.locator('div').boundingBox();
      });
    `,
  }, { trace: 'on' });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);

  const tracePath = test.info().outputPath('test-results', 'a-test-1', 'trace.zip');
  const trace = await parseTrace(tracePath);
  expect(trace.actionTree).toEqual([
    'Before Hooks',
    '  Fixture "browser"',
    '    Launch browser',
    'Create page',
    'Set content',
    'Query count',
    'Expect "toBe"',
    'Bounding box',
    'After Hooks',
  ]);

  const snapshots = trace.traceModel.storage();
  const snapshotFrameOrPageId = snapshots.snapshotsForTest()[0];

  const countAction = trace.actions.find(a => a.method === 'queryCount');
  expect(countAction.beforeSnapshot).toBeTruthy();
  expect(countAction.afterSnapshot).toBeTruthy();
  expect(snapshots.snapshotByName(snapshotFrameOrPageId, countAction.beforeSnapshot)).toBeTruthy();
  expect(snapshots.snapshotByName(snapshotFrameOrPageId, countAction.afterSnapshot)).toBeTruthy();

  const boundingBoxAction = trace.actions.find(a => a.title === 'Bounding box');
  expect(boundingBoxAction.beforeSnapshot).toBeTruthy();
  expect(boundingBoxAction.afterSnapshot).toBeTruthy();
  expect(snapshots.snapshotByName(snapshotFrameOrPageId, boundingBoxAction.beforeSnapshot)).toBeTruthy();
  expect(snapshots.snapshotByName(snapshotFrameOrPageId, boundingBoxAction.afterSnapshot)).toBeTruthy();
});
