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
            const log = (...args) => appendFileSync('${log}', args.join(' ') + '\\n');
            export default log;
        `,
    'test.spec.ts': `
          import log from './log';
          const { test } = pwt;
          test('it works', async ({baseURL}) => {
            log('baseURL', baseURL);
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
          const setup = () => log('globalSetup');
          export default setup;
        `,
    'globalTeardown.ts': `
          const teardown = () => log('globalTeardown');
          export default teardown;
        `,
    'plugin.ts': `
          import log from './log';
          export const myPlugin = (name: string) => ({
            configure: async (config) => { config.use = (config.use || {}); config.use.baseURL = (config.use.baseURL || '') + name + ' | '; },
            setup: async () => log(name, 'setup'),
            teardown: async () => log(name, 'teardown'),
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
    'baseURL a | b | ',
    'b teardown',
    'a teardown',
    '',
  ]);
});
