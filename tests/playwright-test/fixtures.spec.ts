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

test('should work', async ({ runInlineTest }) => {
  const { results } = await runInlineTest({
    'a.test.js': `
      const test = pwt.test.extend({
        asdf: async ({}, test) => await test(123),
      });

      test('should use asdf', async ({asdf}) => {
        expect(asdf).toBe(123);
      });
    `,
  });
  expect(results[0].status).toBe('passed');
});

test('should work with a sync test function', async ({ runInlineTest }) => {
  const { results } = await runInlineTest({
    'a.test.js': `
      const test = pwt.test.extend({
        asdf: async ({}, test) => await test(123),
      });

      test('should use asdf', ({asdf}) => {
        expect(asdf).toBe(123);
      });
    `,
  });
  expect(results[0].status).toBe('passed');
});

test('should work with a sync fixture function', async ({ runInlineTest }) => {
  const { results } = await runInlineTest({
    'a.test.js': `
      const test = pwt.test.extend({
        asdf: ({}, use) => {
          use(123);
        },
      });

      test('should use asdf', ({asdf}) => {
        expect(asdf).toBe(123);
      });
    `,
  });
  expect(results[0].status).toBe('passed');
});

test('should work with a non-arrow function', async ({ runInlineTest }) => {
  const { results } = await runInlineTest({
    'a.test.js': `
      const test = pwt.test.extend({
        asdf: async ({}, test) => await test(123),
      });

      test('should use asdf', function ({asdf}) {
        expect(asdf).toBe(123);
      });
    `,
  });
  expect(results[0].status).toBe('passed');
});

test('should work with a named function', async ({ runInlineTest }) => {
  const { results } = await runInlineTest({
    'a.test.js': `
      const test = pwt.test.extend({
        asdf: async ({}, test) => await test(123),
      });

      test('should use asdf', async function hello({asdf}) {
        expect(asdf).toBe(123);
      });
    `,
  });
  expect(results[0].status).toBe('passed');
});

test('should work with renamed parameters', async ({ runInlineTest }) => {
  const { results } = await runInlineTest({
    'a.test.js': `
      const test = pwt.test.extend({
        asdf: async ({}, test) => await test(123),
      });

      test('should use asdf', function ({asdf: renamed}) {
        expect(renamed).toBe(123);
      });
    `,
  });
  expect(results[0].status).toBe('passed');
});

test('should work with destructured object', async ({ runInlineTest }) => {
  const { results } = await runInlineTest({
    'a.test.js': `
      const test = pwt.test.extend({
        asdf: async ({}, test) => await test({ foo: 'foo', bar: { x: 'x', y: 'y' }, baz: 'baz' }),
      });

      test('should use asdf', async ({ asdf: { foo,
          bar: { x, y }, baz } }) => {
        expect(foo).toBe('foo');
        expect(x).toBe('x');
        expect(y).toBe('y');
        expect(baz).toBe('baz');
      });
    `,
  });
  expect(results[0].status).toBe('passed');
});

test('should work with destructured array', async ({ runInlineTest }) => {
  const { results } = await runInlineTest({
    'a.test.js': `
      const test = pwt.test.extend({
        asdf: async ({}, test) => await test(['foo', 'bar', { baz: 'baz' }]),
        more: async ({}, test) => await test(55),
      });

      test('should use asdf', async (

        {
          asdf: [foo, bar,        { baz}]


          ,more}) => {
        expect(foo).toBe('foo');
        expect(bar).toBe('bar');
        expect(baz).toBe('baz');
        expect(more).toBe(55);
      });
    `,
  });
  expect(results[0].status).toBe('passed');
});

test('should fail if parameters are not destructured', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const test = pwt.test.extend({
        asdf: async ({}, test) => await test(123),
      });
      test('should pass', function () {
        expect(1).toBe(1);
      });
      test('should use asdf', function (abc) {
        expect(abc.asdf).toBe(123);
      });
    `,
  });
  expect(result.output).toContain('First argument must use the object destructuring pattern: abc');
  expect(result.output).toContain('a.test.js:11:7');
  expect(result.results.length).toBe(0);
});

test('should fail with an unknown fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      pwt.test('should use asdf', async ({asdf}) => {
        expect(asdf).toBe(123);
      });
    `,
  });
  expect(result.output).toContain('Test has unknown parameter "asdf".');
  expect(result.output).toContain('a.test.js:5:11');
  expect(result.results.length).toBe(0);
});

test('should run the fixture every time', async ({ runInlineTest }) => {
  const { results } = await runInlineTest({
    'a.test.js': `
      let counter = 0;
      const test = pwt.test.extend({
        asdf: async ({}, test) => await test(counter++),
      });
      test('should use asdf', async ({asdf}) => {
        expect(asdf).toBe(0);
      });
      test('should use asdf', async ({asdf}) => {
        expect(asdf).toBe(1);
      });
      test('should use asdf', async ({asdf}) => {
        expect(asdf).toBe(2);
      });
    `,
  });
  expect(results.map(r => r.status)).toEqual(['passed', 'passed', 'passed']);
});

test('should only run worker fixtures once', async ({ runInlineTest }) => {
  const { results } = await runInlineTest({
    'a.test.js': `
      let counter = 0;
      const test = pwt.test.extend({
        asdf: [ async ({}, test) => await test(counter++), { scope: 'worker' } ],
      });
      test('should use asdf', async ({asdf}) => {
        expect(asdf).toBe(0);
      });
      test('should use asdf', async ({asdf}) => {
        expect(asdf).toBe(0);
      });
      test('should use asdf', async ({asdf}) => {
        expect(asdf).toBe(0);
      });
    `,
  });
  expect(results.map(r => r.status)).toEqual(['passed', 'passed', 'passed']);
});

test('each file should get their own fixtures', async ({ runInlineTest }) => {
  const { results } = await runInlineTest({
    'a.test.js': `
      const test = pwt.test.extend({
        worker: [ async ({}, test) => await test('worker-a'), { scope: 'worker' } ],
        test: async ({}, test) => await test('test-a'),
      });
      test('should use worker', async ({worker, test}) => {
        expect(worker).toBe('worker-a');
        expect(test).toBe('test-a');
      });
    `,
    'b.test.js': `
      const test = pwt.test.extend({
        worker: [ async ({}, test) => await test('worker-b'), { scope: 'worker' } ],
        test: async ({}, test) => await test('test-b'),
      });
      test('should use worker', async ({worker, test}) => {
        expect(worker).toBe('worker-b');
        expect(test).toBe('test-b');
      });
    `,
    'c.test.js': `
      const test = pwt.test.extend({
        worker: [ async ({}, test) => await test('worker-c'), { scope: 'worker' } ],
        test: async ({}, test) => await test('test-c'),
      });
      test('should use worker', async ({worker, test}) => {
        expect(worker).toBe('worker-c');
        expect(test).toBe('test-c');
      });
    `,
  });
  expect(results.map(r => r.status)).toEqual(['passed', 'passed', 'passed']);
});

test('tests should be able to share worker fixtures', async ({ runInlineTest }) => {
  const { results } = await runInlineTest({
    'worker.js': `
      global.counter = 0;
      const test = pwt.test.extend({
        worker: [ async ({}, test) => await test(global.counter++), { scope: 'worker' } ],
      });
      module.exports = test;
    `,
    'a.test.js': `
      const test = require('./worker.js');
      test('should use worker', async ({worker}) => {
        expect(worker).toBe(0);
      });
    `,
    'b.test.js': `
      const test = require('./worker.js');
      test('should use worker', async ({worker}) => {
        expect(worker).toBe(0);
      });
    `,
    'c.test.js': `
      const test = require('./worker.js');
      test('should use worker', async ({worker}) => {
        expect(worker).toBe(0);
      });
    `,
  });
  expect(results.map(r => r.status)).toEqual(['passed', 'passed', 'passed']);
});

test('automatic fixtures should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      let counterTest = 0;
      let counterWorker = 0;
      const test = pwt.test;
      test.use({
        automaticTestFixture: [ async ({}, runTest) => {
          ++counterTest;
          await runTest();
        }, { auto: true } ],

        automaticWorkerFixture: [ async ({}, runTest) => {
          ++counterWorker;
          await runTest();
        }, { scope: 'worker', auto: true } ],
      });
      test.beforeAll(async ({}) => {
        expect(counterWorker).toBe(1);
        expect(counterTest).toBe(0);
      });
      test.beforeEach(async ({}) => {
        expect(counterWorker).toBe(1);
        expect(counterTest === 1 || counterTest === 2).toBe(true);
      });
      test('test 1', async ({}) => {
        expect(counterWorker).toBe(1);
        expect(counterTest).toBe(1);
      });
      test('test 2', async ({}) => {
        expect(counterWorker).toBe(1);
        expect(counterTest).toBe(2);
      });
      test.afterEach(async ({}) => {
        expect(counterWorker).toBe(1);
        expect(counterTest === 1 || counterTest === 2).toBe(true);
      });
      test.afterAll(async ({}) => {
        expect(counterWorker).toBe(1);
        expect(counterTest).toBe(2);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.results.map(r => r.status)).toEqual(['passed', 'passed']);
});

test('tests does not run non-automatic worker fixtures', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      let counter = 0;
      const test = pwt.test.extend({
        nonAutomaticWorkerFixture: [ async ({}, runTest) => {
          ++counter;
          await runTest();
        }, { scope: 'worker' }],
      });
      test('test 1', async ({}) => {
        expect(counter).toBe(0);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.results.map(r => r.status)).toEqual(['passed']);
});

test('should teardown fixtures after timeout', async ({ runInlineTest }, testInfo) => {
  const file = testInfo.outputPath('log.txt');
  require('fs').writeFileSync(file, '', 'utf8');
  const result = await runInlineTest({
    'a.spec.ts': `
      const test = pwt.test.extend({
        file: [ ${JSON.stringify(file)}, { scope: 'worker' } ],
        w: [ async ({ file }, runTest) => {
          await runTest('w');
          require('fs').appendFileSync(file, 'worker fixture teardown\\n', 'utf8');
        }, { scope: 'worker' } ],
        t: async ({ file }, runTest) => {
          await runTest('t');
          require('fs').appendFileSync(file, 'test fixture teardown\\n', 'utf8');
        },
      });
      test('test', async ({t, w}) => {
        expect(t).toBe('t');
        expect(w).toBe('w');
        await new Promise(() => {});
      });
    `,
  }, { timeout: 1000 });
  expect(result.results[0].status).toBe('timedOut');
  const content = require('fs').readFileSync(file, 'utf8');
  expect(content).toContain('worker fixture teardown');
  expect(content).toContain('test fixture teardown');
});

test('should work with two different test objects', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const test1 = pwt.test.extend({
        foo: async ({}, test) => await test(123),
      });
      const test2 = pwt.test.extend({
        bar: async ({}, test) => await test(456),
      });
      test1('test 1', async ({foo}) => {
        expect(foo).toBe(123);
      });
      test2('test 2', async ({bar}) => {
        expect(bar).toBe(456);
      });
    `,
  });
  expect(result.results.map(r => r.workerIndex).sort()).toEqual([0, 0]);
  expect(result.results.map(r => r.status).sort()).toEqual(['passed', 'passed']);
});

test('should work with overrides calling base', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const test1 = pwt.test.extend({
        dep: async ({}, test) => await test('override'),
        foo: async ({}, test) => await test('base'),
        bar: async ({foo}, test) => await test(foo + '-bar'),
      });
      const test2 = test1.extend({
        foo: async ({ foo, dep }, test) => await test(foo + '-' + dep + '1'),
      });
      const test3 = test2.extend({
        foo: async ({ foo, dep }, test) => await test(foo + '-' + dep + '2'),
      });
      test3('test', async ({bar}) => {
        expect(bar).toBe('base-override1-override2-bar');
      });
    `,
  });
  expect(result.results[0].status).toBe('passed');
});

test('should understand worker fixture params in overrides calling base', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const test1 = pwt.test.extend({
        param: [ 'param', { scope: 'worker' }],
        foo: async ({}, test) => await test('foo'),
        bar: async ({foo}, test) => await test(foo + '-bar'),
      });
      const test2 = test1.extend({
        foo: async ({ foo, param }, test) => await test(foo + '-' + param),
      });
      const test3 = test2.extend({
        foo: async ({ foo }, test) => await test(foo + '-override'),
      });
      test3('test', async ({ bar }) => {
        console.log(bar);
      });
    `,
    'playwright.config.ts': `
      module.exports = { projects: [
        { use: { param: 'p1' } },
        { use: { param: 'p2' } },
        { use: { param: 'p3' } },
      ]};
    `,
  });
  const outputs = result.results.map(r => r.stdout[0].text.replace(/\s/g, ''));
  expect(outputs.sort()).toEqual(['foo-p1-override-bar', 'foo-p2-override-bar', 'foo-p3-override-bar']);
});

test('should work with two overrides calling base', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const test1 = pwt.test.extend({
        foo: async ({}, test) => await test('foo'),
        bar: async ({}, test) => await test('bar'),
        baz: async ({foo, bar}, test) => await test(foo + '-baz-' + bar),
      });
      const test2 = test1.extend({
        foo: async ({ foo, bar }, test) => await test(foo + '-' + bar),
        bar: async ({ bar }, test) => await test(bar + '-override'),
      });
      test2('test', async ({baz}) => {
        expect(baz).toBe('foo-bar-override-baz-bar-override');
      });
    `,
  });
  expect(result.results[0].status).toBe('passed');
});

test('should not create a new worker for test fixtures', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test('base test', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
      });

      const test2 = test.extend({
        foo: async ({}, run) => {
          console.log('foo-a');
          await run();
        }
      });
      test2('a test', async ({ foo }, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
      });
    `,
    'b.test.ts': `
      const { test } = pwt;
      const test2 = test.extend({
        foo: async ({}, run) => {
          console.log('foo-b');
          await run();
        }
      });
      const test3 = test2.extend({
        foo: async ({ foo }, run) => {
          console.log('foo-c');
          await run();
        }
      });
      test3('b test', async ({ foo }, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
      });
    `,
  }, { workers: 1 });
  expect(result.output).toContain('foo-a');
  expect(result.output).toContain('foo-b');
  expect(result.output).toContain('foo-c');
  expect(result.passed).toBe(3);
});

test('should create a new worker for worker fixtures', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test('base test', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
      });

      const test2 = test.extend({
        foo: [async ({}, run) => {
          console.log('foo-a');
          await run();
        }, { scope: 'worker' }],
      });
      test2('a test', async ({ foo }, testInfo) => {
        expect(testInfo.workerIndex).toBe(1);
      });
    `,
    'b.test.ts': `
      const { test } = pwt;
      const test2 = test.extend({
        bar: async ({}, run) => {
          console.log('bar-b');
          await run();
        },
      });
      test2('b test', async ({ bar }, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
      });
    `,
  }, { workers: 1 });
  expect(result.output).toContain('foo-a');
  expect(result.output).toContain('bar-b');
  expect(result.passed).toBe(3);
});

test('should run tests in order', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test('test1', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
        console.log('\\n%%test1');
      });

      const child = test.extend({
        foo: async ({}, run) => {
          console.log('\\n%%beforeEach');
          await run();
          console.log('\\n%%afterEach');
        },
      });
      child('test2', async ({ foo }, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
        console.log('\\n%%test2');
      });

      test('test3', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
        console.log('\\n%%test3');
      });
    `,
  }, { workers: 1 });
  expect(result.passed).toBe(3);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%test1',
    '%%beforeEach',
    '%%test2',
    '%%afterEach',
    '%%test3',
  ]);
});
