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
import { test, expect } from './playwright-test-fixtures';

test('event order', async ({ runInlineTest }, testInfo) => {
  const log = testInfo.outputPath('logs.txt');
  const result = await runInlineTest({
    'log.ts': `
      import { appendFileSync } from 'fs';
      const log = (...args) => appendFileSync('${log.replace(/\\/g, '\\\\')}', args.join(' ') + '\\n');
      export default log;
    `,
    'test.spec.ts': `
      import log from './log';
      const { test } = pwt;
      test('it works', async ({}) => {
      });
    `,
    'playwright.config.ts': `
      import { myPlugin } from './plugin.ts';
      module.exports = {
        plugins: [
            myPlugin('a'),
            myPlugin('b'),
        ],
        globalSetup: 'globalSetup.ts',
        globalTeardown: 'globalTeardown.ts',
      };
    `,
    'globalSetup.ts': `
      import log from './log';
      const setup = async () => {
        await new Promise(r => setTimeout(r, 100));
        log('globalSetup');
      }
      export default setup;
    `,
    'globalTeardown.ts': `
      import log from './log';
      const teardown = async () => {
        await new Promise(r => setTimeout(r, 100));
        log('globalTeardown');
      }
      export default teardown;
    `,
    'plugin.ts': `
      import log from './log';
      export const myPlugin = (name: string) => ({
        setup: async () => {
          await new Promise(r => setTimeout(r, 100));
          log(name, 'setup');
        },
        teardown: async () => {
          await new Promise(r => setTimeout(r, 100));
          log(name, 'teardown');
        },
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const logLines = await fs.promises.readFile(log, 'utf8');
  expect(logLines.split('\n')).toEqual([
    'a setup',
    'b setup',
    'globalSetup',
    'globalTeardown',
    'b teardown',
    'a teardown',
    '',
  ]);
});

test('plugins via require', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'test.spec.ts': `
      const { test } = pwt;
      test('it works', async ({}) => {
        expect(process.env.PW_CONFIG_DIR).toContain('plugins-via-require');
      });
    `,
    'playwright.config.ts': `
      export default { plugins: [ 'plugin.ts' ] };
    `,
    'plugin.ts': `
      export function setup(config, configDir, suite) {
        process.env.PW_CONFIG_DIR = configDir;
      };
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('fixtures', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'test.spec.ts': `
      const { test } = pwt;
      test('it works', async ({ foo }) => {
        expect(foo).toEqual(42);
      });

      test('it uses standard fixture', async ({ myBrowserName }) => {
        expect(myBrowserName).toEqual('chromium');
      });
    `,
    'playwright.config.ts': `
      import plugin from './plugin.ts';
      module.exports = {
        plugins: [ plugin ],
      };
    `,
    'plugin.ts': `
      export default {
        fixtures: {
          foo: 42,
          myBrowserName: async ({ browserName }, use) => { await use(browserName) }
        }
      };
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('fixtures via require', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'test.spec.ts': `
      const { test } = pwt;
      test('it works', async ({ foo }) => {
        expect(foo).toEqual(42);
      });
    `,
    'playwright.config.ts': `
      export default {
        plugins: [ { fixtures: require.resolve('./fixtures.ts') } ],
      };
    `,
    'fixtures.ts': `
      //@no-header
      export default {
        foo: 42
      };
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
