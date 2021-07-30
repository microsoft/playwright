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

const smallReporterJS = `
class Reporter {
  onBegin(config, suite) {
    console.log('\\n%%begin');
  }
  onTestBegin(test) {}
  onStdOut() {}
  onStdErr() {}
  onTestEnd(test, result) {}
  onTimeout() {}
  onError() {}
  onEnd() {
    console.log('\\n%%end');
  }
}
module.exports = Reporter;
`;

test('should work with custom reporter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        constructor(options) {
          this.options = options;
        }
        onBegin(config, suite) {
          console.log('\\n%%reporter-begin-' + this.options.begin + '%%');
        }
        onTestBegin(test) {
          console.log('\\n%%reporter-testbegin-' + test.title + '-' + test.titlePath()[1] + '%%');
        }
        onStdOut() {
          console.log('\\n%%reporter-stdout%%');
        }
        onStdErr() {
          console.log('\\n%%reporter-stderr%%');
        }
        onTestEnd(test, result) {
          console.log('\\n%%reporter-testend-' + test.title + '-' + test.titlePath()[1] + '%%');
          if (!result.startTime)
            console.log('\\n%%error-no-start-time');
        }
        onTimeout() {
          console.log('\\n%%reporter-timeout%%');
        }
        onError() {
          console.log('\\n%%reporter-error%%');
        }
        async onEnd() {
          await new Promise(f => setTimeout(f, 500));
          console.log('\\n%%reporter-end-' + this.options.end + '%%');
        }
      }
      export default Reporter;
    `,
    'playwright.config.ts': `
      module.exports = {
        reporter: [
          [ './reporter.ts', { begin: 'begin', end: 'end' } ]
        ],
        projects: [
          { name: 'foo', repeatEach: 2 },
          { name: 'bar' },
        ],
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('not run', async ({}) => {
        console.log('log');
        console.error('error');
      });
      test.only('is run', async ({}) => {
        console.log('log');
        console.error('error');
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%reporter-begin-begin%%',
    '%%reporter-testbegin-is run-foo%%',
    '%%reporter-stdout%%',
    '%%reporter-stderr%%',
    '%%reporter-testend-is run-foo%%',
    '%%reporter-testbegin-is run-foo%%',
    '%%reporter-stdout%%',
    '%%reporter-stderr%%',
    '%%reporter-testend-is run-foo%%',
    '%%reporter-testbegin-is run-bar%%',
    '%%reporter-stdout%%',
    '%%reporter-stderr%%',
    '%%reporter-testend-is run-bar%%',
    '%%reporter-end-end%%',
  ]);
});


test('should work without a file extension', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': smallReporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({}) => {
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%begin',
    '%%end',
  ]);
});

test('should load reporter from node_modules', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'node_modules/my-reporter/index.js': smallReporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: 'my-reporter',
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({}) => {
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%begin',
    '%%end',
  ]);
});

test('should report expect progress', async ({ runInlineTest }) => {
  const expectReporterJS = `
    class Reporter {
      _onTestProgress(test, name, data) {
        if (data.frames)
          data.frames = [];
        console.log('%%%%', name, JSON.stringify(data));
      }
    }
    module.exports = Reporter;
  `;

  const result = await runInlineTest({
    'reporter.ts': expectReporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('fail', async ({}) => {
        expect(true).toBeTruthy();
        expect(false).toBeTruthy();
      });
      test('pass', async ({}) => {
        expect(false).not.toBeTruthy();
      });
      test('async', async ({ page }) => {
        await expect(page).not.toHaveTitle('False');
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    `%% expect {\"phase\":\"begin\",\"seq\":1,\"matcherName\":\"toBeTruthy\"}`,
    `%% expect {\"phase\":\"end\",\"seq\":1,\"pass\":true}`,
    `%% expect {\"phase\":\"begin\",\"seq\":2,\"matcherName\":\"toBeTruthy\"}`,
    `%% expect {\"phase\":\"end\",\"seq\":2,\"pass\":false,\"message\":\"\\u001b[2mexpect(\\u001b[22m\\u001b[31mreceived\\u001b[39m\\u001b[2m).\\u001b[22mtoBeTruthy\\u001b[2m()\\u001b[22m\\n\\nReceived: \\u001b[31mfalse\\u001b[39m\"}`,

    `%% expect {\"phase\":\"begin\",\"seq\":1,\"matcherName\":\"toBeTruthy\"}`,
    `%% expect {\"phase\":\"end\",\"seq\":1,\"pass\":false,\"isNot\":true}`,

    `%% pw:api {\"phase\":\"begin\",\"seq\":3,\"apiName\":\"browserContext.newPage\",\"frames\":[]}`,
    `%% pw:api {\"phase\":\"end\",\"seq\":3}`,
    `%% expect {\"phase\":\"begin\",\"seq\":2,\"matcherName\":\"toHaveTitle\"}`,
    `%% pw:api {\"phase\":\"begin\",\"seq\":4,\"apiName\":\"page.title\",\"frames\":[]}`,
    `%% pw:api {\"phase\":\"end\",\"seq\":4}`,
    `%% expect {\"phase\":\"end\",\"seq\":2,\"isNot\":true}`,
    `%% pw:api {\"phase\":\"begin\",\"seq\":5,\"apiName\":\"browserContext.close\",\"frames\":[]}`,
    `%% pw:api {\"phase\":\"end\",\"seq\":5}`,
  ]);
});

test('should report log progress', async ({ runInlineTest }) => {
  const expectReporterJS = `
    class Reporter {
      _onTestProgress(test, name, data) {
        if (data.frames)
          data.frames = [];
        console.log('%%%%', name, JSON.stringify(data));
      }
    }
    module.exports = Reporter;
  `;

  const result = await runInlineTest({
    'reporter.ts': expectReporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ page }) => {
        await page.setContent('<button></button>');
        await page.click('button');
      });
    `
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    `%% pw:api {\"phase\":\"begin\",\"seq\":3,\"apiName\":\"browserContext.newPage\",\"frames\":[]}`,
    `%% pw:api {\"phase\":\"end\",\"seq\":3}`,
    `%% pw:api {\"phase\":\"begin\",\"seq\":4,\"apiName\":\"page.setContent\",\"frames\":[]}`,
    `%% pw:api {\"phase\":\"end\",\"seq\":4}`,
    `%% pw:api {\"phase\":\"begin\",\"seq\":5,\"apiName\":\"page.click\",\"frames\":[]}`,
    `%% pw:api {\"phase\":\"end\",\"seq\":5}`,
    `%% pw:api {\"phase\":\"begin\",\"seq\":6,\"apiName\":\"browserContext.close\",\"frames\":[]}`,
    `%% pw:api {\"phase\":\"end\",\"seq\":6}`,
  ]);
});
