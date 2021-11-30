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

import { test, expect } from './playwright-test-fixtures';

test('global fixtures should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.js': `
      const { test } = pwt;

      const base = test.extend({
        globalBase: [ async ({}, use) => {
          console.log('\\n%%globalBase setup');
          await use('globalBase');
          console.log('\\n%%globalBase teardown');
        }, { scope: 'global' }],
      });

      const test1 = base.extend({
        global1: [ async ({ globalBase }, use) => {
          console.log('\\n%%global1 setup');
          await use(globalBase + '-global1');
          console.log('\\n%%global1 teardown');
        }, { scope: 'global' }],

        global2: [ async ({ global1 }, use) => {
          console.log('\\n%%global2 setup');
          await use(global1 + '-global2');
          console.log('\\n%%global2 teardown');
        }, { scope: 'global' }],
      }).extend({
        global1: async ({ global1 }, use) => {
          console.log('\\n%%global1 override setup');
          await use(global1 + '-override1');
          console.log('\\n%%global1 override teardown');
        },
      });

      const test2 = base.extend({
        global1: [ async ({ globalBase }, use) => {
          console.log('\\n%%anotherglobal1 setup');
          await use(globalBase + '-another1');
          console.log('\\n%%anotherglobal1 teardown');
        }, { scope: 'global' }],

        global2: [ async ({ global1 }, use) => {
          console.log('\\n%%anotherglobal2 setup');
          await use(global1 + '-another2');
          console.log('\\n%%anotherglobal2 teardown');
        }, { scope: 'global' }],
      }).extend({
        global1: async ({ global1 }, use) => {
          console.log('\\n%%anotherglobal1 override setup');
          await use(global1 + '-anotheroverride1');
          console.log('\\n%%anotherglobal1 override teardown');
        },
      });

      module.exports = { test1, test2 };
    `,
    'a.test.ts': `
      import { test1, test2 } from './helper';

      test1('test1a', async ({ global1, global2 }) => {
        console.log('\\n%%test1a;' + global1 + ';' + global2);
      });
      test1('test2a', async ({ global2, global1 }) => {
        console.log('\\n%%test2a;' + global1 + ';' + global2);
      });
      test2('test3a', async ({ global1, global2 }) => {
        console.log('\\n%%test3a;' + global1 + ';' + global2);
      });
    `,
    'b.test.ts': `
      import { test1, test2 } from './helper';

      test1('test1b', async ({ global1, global2 }) => {
        console.log('\\n%%test1b;' + global1 + ';' + global2);
      });
      test1('test2b', async ({ global2, global1 }) => {
        console.log('\\n%%test2b;' + global1 + ';' + global2);
      });
      test2('test3b', async ({ global1, global2 }) => {
        console.log('\\n%%test3b;' + global1 + ';' + global2);
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%globalBase setup',
    '%%global1 setup',
    '%%global1 override setup',
    '%%global2 setup',
    '%%test1a;globalBase-global1-override1;globalBase-global1-override1-global2',
    '%%test2a;globalBase-global1-override1;globalBase-global1-override1-global2',
    '%%test1b;globalBase-global1-override1;globalBase-global1-override1-global2',
    '%%test2b;globalBase-global1-override1;globalBase-global1-override1-global2',
    '%%anotherglobal1 setup',
    '%%anotherglobal1 override setup',
    '%%anotherglobal2 setup',
    '%%test3a;globalBase-another1-anotheroverride1;globalBase-another1-anotheroverride1-another2',
    '%%test3b;globalBase-another1-anotheroverride1;globalBase-another1-anotheroverride1-another2',
    '%%anotherglobal2 teardown',
    '%%anotherglobal1 override teardown',
    '%%anotherglobal1 teardown',
    '%%global2 teardown',
    '%%global1 override teardown',
    '%%global1 teardown',
    '%%globalBase teardown',
  ]);
});

test('global fixture teardown error should fail test run', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const test = pwt.test.extend({
        globalBase: [ async ({}, use) => {
          console.log('\\n%%globalBase setup');
          await use('globalBase');
          console.log('\\n%%globalBase teardown');
          throw new Error('oh my');
        }, { scope: 'global' }],
      });

      test('test', async ({ globalBase }) => {
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Error: oh my');
});

test('global fixture should be shared between projects and provide dummy workerInfo', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        projects: [
          { name: 'foo' },
          { name: 'bar' },
        ],
      };
    `,
    'a.spec.js': `
      const test = pwt.test.extend({
        globalBase: [ async ({}, use, workerInfo) => {
          console.log('\\n%%globalBase setup in project=' + workerInfo.project.name + ' wi=' + workerInfo.workerIndex + ' pi=' + workerInfo.parallelIndex);
          await use('globalBase');
        }, { scope: 'global' }],
      });

      test('test', async ({ globalBase }, testInfo) => {
        console.log('\\n%%test: ' + globalBase + ' in project=' + testInfo.project.name);
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%globalBase setup in project= wi=-1 pi=-1',
    '%%test: globalBase in project=foo',
    '%%test: globalBase in project=bar',
  ]);
});

test('global option is not allowed', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const test = pwt.test.extend({
        opt: [ 'opt', { scope: 'global', option: true }],
      });

      test('test', async ({ opt }, testInfo) => {
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toMatch(/Error: Global options are not supported.\n\s+"opt" defined at a.spec.js:5:29/);
});

test('global fixture cannot depend on worker fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const test = pwt.test.extend({
        worker: [ 'worker', { scope: 'worker' }],
        global: [ async ({ worker }, use) => {
          await use(worker);
        }, { scope: 'global' }],
      });

      test('test', async ({ global }) => {
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Error: global fixture "global" cannot depend on a worker fixture "worker".');
});

test('global fixture cannot depend on test fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const test = pwt.test.extend({
        test: [ 'test', { scope: 'test' }],
        global: [ async ({ test }, use) => {
          await use(test);
        }, { scope: 'global' }],
      });

      test('test', async ({ global }) => {
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Error: global fixture "global" cannot depend on a test fixture "test".');
});

test('test and worker fixtures can depend on global fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const test = pwt.test.extend({
        global: [ 'global', { scope: 'global' }],
        test: [ ({ global }, use) => use(global + '-test'), { scope: 'test' }],
        worker: [ ({ global }, use) => use(global + '-worker'), { scope: 'worker' }],
      });

      test('my test', async ({ global, test, worker }) => {
        expect(global).toBe('global');
        expect(test).toBe('global-test');
        expect(worker).toBe('global-worker');
      });
    `,
  });
  expect(result.exitCode).toBe(0);
});

test('can use global fixture in skips', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const test = pwt.test.extend({
        global: [ true, { scope: 'global' }],
      });

      test.skip(({ global }) => !!global);

      test('skipped', async ({ global }) => {
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.skipped).toBe(1);
});

test('cannot test.use a global fixture inside describe', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const test = pwt.test.extend({
        global: [ 'global', { scope: 'global' } ],
      });

      test.describe('suite', () => {
        test.use({ global: 'foo' });

        test('my test', async ({ global }) => {
        });
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Error: Cannot use({ global }) in a describe group, because it forces a new worker.');
});

test('global fixture throw gets into the worker', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.js': `
      module.exports = pwt.test.extend({
        global: [ () => {
          console.log('global fixture setup');
          throw new Error('Oh my!');
        }, { scope: 'global' } ],
      });
    `,
    'a.spec.js': `
      const test = require('./helper');
      test('test1', async ({ global }) => {
        console.log('running test1');
      });
    `,
    'b.spec.js': `
      const test = require('./helper');
      test('passed', async () => {
        await new Promise(f => setTimeout(f, 1000));
        console.log('finished passed');
      });
      test('test2', async ({ global }) => {
        console.log('running test2');
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(2);
  expect(result.output).toContain('global fixture setup');
  expect(result.output).toContain('finished passed');
  expect(result.output).toContain('Error: Oh my!');
});

test('should throw for non-stringifiable values', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const test = pwt.test.extend({
        global: [ ({}, use) => use(process), { scope: 'global' } ],
      });

      test('my test', async ({ global }) => {
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toMatch(/The value of the global fixture "global" cannot be serialized:\n\s+TypeError: Converting circular structure to JSON/);
});

test('should throw for function values', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const test = pwt.test.extend({
        global: [ ({}, use) => use(process.addListener), { scope: 'global' } ],
      });

      test('my test', async ({ global }) => {
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('The value of the global fixture "global" cannot be serialized.');
});

test('can use global fixture in hook but not test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const test = pwt.test.extend({
        global: [ 'foo', { scope: 'global' }],
      });

      test.beforeAll(({ global }) => {
        console.log('beforeAll ' + global);
      });

      test('my test', async () => {
        console.log('my test');
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('beforeAll foo');
  expect(result.output).toContain('my test');
});

test('auto global fixtures run for filtered tests only', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      pwt.test.extend({
        global: [ ({}, use) => {
          console.log('global1 setup');
          use('global1');
        }, { scope: 'global' }],
        auto: [ ({}, use) => {
          console.log('auto1 setup');
          use('auto1');
        }, { scope: 'global', auto: true }],
      })('test1', ({ global }) => {
        console.log('test1-' + global);
      });

      pwt.test.extend({
        global: [ ({}, use) => {
          console.log('global2 setup');
          use('global2');
        }, { scope: 'global' }],
        auto: [ ({}, use) => {
          console.log('auto2 setup');
          use('auto2');
        }, { scope: 'global', auto: true }],
      }).only('test2', ({ global }) => {
        console.log('test2-' + global);
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('auto2 setup');
  expect(result.output).toContain('global2 setup');
  expect(result.output).toContain('test2-global2');
});

test('global fixtures should work concurrently', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.js': `
      module.exports = pwt.test.extend({
        global: [ async ({}, use) => {
          console.log('\\n%%global fixture setup');
          await new Promise(f => setTimeout(f, 3000));
          console.log('\\n%%global fixture setup done');
          use('value');
        }, { scope: 'global' } ],
      });
    `,
    'a.spec.js': `
      const test = require('./helper');
      test('test1', async ({ global }) => {
        console.log('running test1');
      });
    `,
    'b.spec.js': `
      const test = require('./helper');
      test('test2', async ({ global }) => {
        console.log('running test2');
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.output).toContain('global fixture setup');
  expect(result.output).toContain('global fixture setup done');
  expect(result.output).toContain('running test1');
  expect(result.output).toContain('running test2');
});
