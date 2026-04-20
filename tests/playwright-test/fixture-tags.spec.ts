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

const tagsReporter = String.raw`
  export default class Reporter {
    onBegin(config, suite) {
      const visit = suite => {
        for (const t of suite.tests || [])
          console.log('\n%%title=' + t.title + ', tags=' + t.tags.join(','));
        for (const child of suite.suites || [])
          visit(child);
      };
      visit(suite);
    }
    onError(error) { console.log(error); }
  }
`;

test('direct fixture usage inherits tag', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': tagsReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        myFixture: [async ({}, use) => { await use('value'); }, { tag: '@smoke' }],
      });
      test('uses fixture', async ({ myFixture }) => {});
      test('no fixture', async ({}) => {});
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'title=uses fixture, tags=@smoke',
    'title=no fixture, tags=',
  ]);
});

test('transitive fixture usage inherits tag', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': tagsReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        baseFixture: [async ({}, use) => { await use('base'); }, { tag: '@smoke' }],
        childFixture: async ({ baseFixture }, use) => { await use(baseFixture + '-child'); },
      });
      test('uses child', async ({ childFixture }) => {});
      test('uses base directly', async ({ baseFixture }) => {});
      test('uses neither', async ({}) => {});
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'title=uses child, tags=@smoke',
    'title=uses base directly, tags=@smoke',
    'title=uses neither, tags=',
  ]);
});

test('auto fixture propagates tag to all tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': tagsReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        autoFixture: [async ({}, use) => { await use(); }, { auto: true, tag: '@auto' }],
      });
      test('test one', async ({}) => {});
      test('test two', async ({}) => {});
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'title=test one, tags=@auto',
    'title=test two, tags=@auto',
  ]);
});

test('worker-scoped fixture propagates tag', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': tagsReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        workerFixture: [async ({}, use) => { await use('w'); }, { scope: 'worker', tag: '@perf' }],
      });
      test('uses worker fixture', async ({ workerFixture }) => {});
      test('no worker fixture', async ({}) => {});
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'title=uses worker fixture, tags=@perf',
    'title=no worker fixture, tags=',
  ]);
});

test('multiple tags on one fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': tagsReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        myFixture: [async ({}, use) => { await use('x'); }, { tag: ['@smoke', '@regression'] }],
      });
      test('test', async ({ myFixture }) => {});
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'title=test, tags=@smoke,@regression',
  ]);
});

test('tags from multiple fixtures are combined', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': tagsReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixtureA: [async ({}, use) => { await use('a'); }, { tag: '@featureA' }],
        fixtureB: [async ({}, use) => { await use('b'); }, { tag: '@featureB' }],
      });
      test('uses both', async ({ fixtureA, fixtureB }) => {});
      test('uses only A', async ({ fixtureA }) => {});
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'title=uses both, tags=@featureA,@featureB',
    'title=uses only A, tags=@featureA',
  ]);
});

test('fixture tag and test tag are both present', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': tagsReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        myFixture: [async ({}, use) => { await use('x'); }, { tag: '@smoke' }],
      });
      test('tagged test', { tag: '@critical' }, async ({ myFixture }) => {});
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'title=tagged test, tags=@critical,@smoke',
  ]);
});

test('fixture tag is deduplicated when test already has same tag', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': tagsReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        myFixture: [async ({}, use) => { await use('x'); }, { tag: '@smoke' }],
      });
      test('test', { tag: '@smoke' }, async ({ myFixture }) => {});
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'title=test, tags=@smoke',
  ]);
});

test('fixture tag is visible in testInfo.tags', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        myFixture: [async ({}, use) => { await use('x'); }, { tag: '@smoke' }],
      });
      test('test', async ({ myFixture }, testInfo) => {
        expect(testInfo.tags).toContain('@smoke');
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('--grep filters by fixture-inherited tag', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': String.raw`
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        smokeFixture: [async ({}, use) => { await use('x'); }, { tag: '@smoke' }],
      });
      test('smoke test', async ({ smokeFixture }) => { console.log('\n%% smoke'); });
      test('other test', async ({}) => { console.log('\n%% other'); });
    `,
  }, { grep: '@smoke' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.outputLines).toEqual(['smoke']);
});

test('fixture tags are resolved statically and available for filtering before fixture evaluation', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': String.raw`
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        apiFixture: [async ({}, use) => {
          console.log('\n%% apiFixture evaluated');
          await use('api');
        }, { tag: '@api' }],
      });
      test('api test', async ({ apiFixture }) => { console.log('\n%% api test ran'); });
      test('unit test', async ({}) => { console.log('\n%% unit test ran'); });
    `,
  }, { grep: '@api' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  // Fixture was evaluated (because the matching test used it), but only for the
  // matching test — proving the tag was known before execution for filtering.
  expect(result.outputLines).toEqual(['apiFixture evaluated', 'api test ran']);
});

test('grep-invert excludes tests by fixture tag without evaluating the fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': String.raw`
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        slowFixture: [async ({}, use) => {
          console.log('\n%% slowFixture evaluated');
          await use('slow');
        }, { tag: '@slow' }],
      });
      test('slow test', async ({ slowFixture }) => { console.log('\n%% slow test ran'); });
      test('fast test', async ({}) => { console.log('\n%% fast test ran'); });
    `,
  }, { 'grep-invert': '@slow' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  // The slow fixture was never evaluated because its test was filtered out
  // BEFORE execution — proving tags are resolved statically, not at runtime.
  expect(result.outputLines).toEqual(['fast test ran']);
});

test('fixture tag must start with @', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        myFixture: [async ({}, use) => { await use('x'); }, { tag: 'smoke' }],
      });
      test('test', async ({ myFixture }) => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Fixture "myFixture" tag "smoke" must start with "@".`);
});

test('function-only fixture override inherits tag from original', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': tagsReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const base2 = base.extend({
        myFixture: [async ({}, use) => { await use('original'); }, { tag: '@smoke' }],
      });
      const test = base2.extend({
        myFixture: async ({}, use) => { await use('overridden'); },
      });
      test('test', async ({ myFixture }) => {});
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'title=test, tags=@smoke',
  ]);
});

test('tuple fixture override without tag clears inherited tag', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': tagsReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const base2 = base.extend({
        myFixture: [async ({}, use) => { await use('original'); }, { tag: '@smoke' }],
      });
      const test = base2.extend({
        myFixture: [async ({}, use) => { await use('overridden'); }, {}],
      });
      test('test', async ({ myFixture }) => {});
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'title=test, tags=',
  ]);
});

test('tuple fixture override can set a new tag', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': tagsReporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const base2 = base.extend({
        myFixture: [async ({}, use) => { await use('original'); }, { tag: '@smoke' }],
      });
      const test = base2.extend({
        myFixture: [async ({}, use) => { await use('overridden'); }, { tag: '@regression' }],
      });
      test('test', async ({ myFixture }) => {});
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'title=test, tags=@regression',
  ]);
});
