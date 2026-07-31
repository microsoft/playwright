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

// Given '%%begin:<name>' and '%%end:<name>' lines, returns pairs from the
// `conflicts` list that were running at the same time.
function conflictingOverlaps(lines: string[], conflicts: [string, string][]): [string, string][] {
  const running = new Set<string>();
  const overlaps: [string, string][] = [];
  for (const line of lines) {
    const [kind, name] = line.split(':');
    if (kind === 'begin') {
      for (const [x, y] of conflicts) {
        if ((name === x && running.has(y)) || (name === y && running.has(x)))
          overlaps.push([x, y]);
      }
      running.add(name);
    } else if (kind === 'end') {
      running.delete(name);
    }
  }
  return overlaps;
}

const lockedTest = (name: string, delay: number, lock?: string | string[]) => `
  test('${name}'${lock !== undefined ? `, { lock: ${JSON.stringify(lock)} }` : ''}, async () => {
    console.log('\\n%%begin:${name}');
    await new Promise(f => setTimeout(f, ${delay}));
    console.log('\\n%%end:${name}');
  });
`;

test('should not run tests with the same lock at the same time', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test1', 1000, 'shared')}
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test2', 1000, 'shared')}
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(conflictingOverlaps(result.outputLines, [['test1', 'test2']])).toEqual([]);
});

test('should run tests with different locks at the same time', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'helper.ts': `
      import fs from 'fs';
      import path from 'path';
      export async function signalAndWait(signal: string, waitFor: string) {
        fs.mkdirSync(process.env.SIGNAL_DIR, { recursive: true });
        fs.writeFileSync(path.join(process.env.SIGNAL_DIR, signal), '');
        while (!fs.existsSync(path.join(process.env.SIGNAL_DIR, waitFor)))
          await new Promise(f => setTimeout(f, 100));
      }
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      import { signalAndWait } from './helper';
      test('test1', { lock: 'lock-a' }, async () => {
        // Only finishes when both tests run at the same time.
        await signalAndWait('a.txt', 'b.txt');
      });
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      import { signalAndWait } from './helper';
      test('test2', { lock: 'lock-b' }, async () => {
        await signalAndWait('b.txt', 'a.txt');
      });
    `,
  }, { workers: 2 }, { SIGNAL_DIR: test.info().outputDir });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should not run tests with the same lock from different projects at the same time', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'project1' },
          { name: 'project2' },
        ],
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('test1', { lock: 'shared' }, async ({}, testInfo) => {
        console.log('\\n%%begin:' + testInfo.project.name);
        await new Promise(f => setTimeout(f, 1000));
        console.log('\\n%%end:' + testInfo.project.name);
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(conflictingOverlaps(result.outputLines, [['project1', 'project2']])).toEqual([]);
});

test('should support locks declared on a describe group', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test.describe('locked suite', { lock: 'shared' }, () => {
        ${lockedTest('test1', 1000)}
        ${lockedTest('test2', 1000)}
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(conflictingOverlaps(result.outputLines, [['test1', 'test2']])).toEqual([]);
});

test('should support multiple locks on a single test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test1', 1000, ['lock-a', 'lock-b'])}
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test2', 1000, 'lock-a')}
    `,
    'c.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test3', 1000, 'lock-b')}
    `,
  }, { workers: 3 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(conflictingOverlaps(result.outputLines, [['test1', 'test2'], ['test1', 'test3']])).toEqual([]);
});

test('should collect locks from the used fixture graph', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      import fs from 'fs';

      const test = base.extend<{ outer: void, inner: void, unused: void }>({
        outer: [undefined, { locks: ['shared'] }],
        inner: async ({ outer }, use) => {
          void outer;
          await use();
        },
        unused: [undefined, { locks: ['shared'] }],
      });

      test('fixture', async ({ inner }) => {
        void inner;
        console.log('\\n%%begin:fixture');
        fs.writeFileSync('fixture.ready', '');
        await expect.poll(() => fs.existsSync('unused.ready')).toBe(true);
        console.log('\\n%%end:fixture');
      });
      test('unused', async () => {
        console.log('\\n%%begin:unused');
        fs.writeFileSync('unused.ready', '');
        await expect.poll(() => fs.existsSync('fixture.ready')).toBe(true);
        console.log('\\n%%end:unused');
      });
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('direct', 500, 'shared')}
    `,
  }, { workers: 3 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(conflictingOverlaps(result.outputLines, [['fixture', 'direct']])).toEqual([]);
  expect(conflictingOverlaps(result.outputLines, [['fixture', 'unused']])).toEqual([['fixture', 'unused']]);
});

test('should not inherit locks when replacing a fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'helper.ts': `
      import fs from 'fs';
      import path from 'path';
      export async function signalAndWait(signal: string, waitFor: string) {
        fs.mkdirSync(process.env.SIGNAL_DIR, { recursive: true });
        fs.writeFileSync(path.join(process.env.SIGNAL_DIR, signal), '');
        while (!fs.existsSync(path.join(process.env.SIGNAL_DIR, waitFor)))
          await new Promise(f => setTimeout(f, 100));
      }
    `,
    'a.test.ts': `
      import { test as base } from '@playwright/test';
      import { signalAndWait } from './helper';

      const withLockedFixture = base.extend<{ resource: void }>({
        resource: [undefined, { locks: ['shared'] }],
      });
      const test = withLockedFixture.extend({
        resource: async ({}, use) => use(),
      });

      test('replacement', async ({ resource }) => {
        void resource;
        console.log('\\n%%begin:replacement');
        await signalAndWait('replacement', 'direct');
        console.log('\\n%%end:replacement');
      });
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      import { signalAndWait } from './helper';

      test('direct', { lock: 'shared' }, async () => {
        console.log('\\n%%begin:direct');
        await signalAndWait('direct', 'replacement');
        console.log('\\n%%end:direct');
      });
    `,
  }, { workers: 2 }, { SIGNAL_DIR: test.info().outputDir });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(conflictingOverlaps(result.outputLines, [['replacement', 'direct']])).toEqual([['replacement', 'direct']]);
});

test('should collect locks when an overriding fixture uses its base implementation', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'a.test.ts': `
      import { test as base } from '@playwright/test';

      const withLockedFixture = base.extend<{ resource: void }>({
        resource: [undefined, { locks: ['shared'] }],
      });
      const test = withLockedFixture.extend({
        resource: async ({ resource }, use) => {
          void resource;
          await use();
        },
      });

      test('fixture', async ({ resource }) => {
        void resource;
        console.log('\\n%%begin:fixture');
        await new Promise(f => setTimeout(f, 500));
        console.log('\\n%%end:fixture');
      });
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('direct', 500, 'shared')}
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(conflictingOverlaps(result.outputLines, [['fixture', 'direct']])).toEqual([]);
});

test('should collect locks from automatic fixtures, hooks and modifiers', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'a-auto.test.ts': `
      import { test as base } from '@playwright/test';

      const test = base.extend<{ automatic: void }>({
        automatic: [undefined, { auto: true, locks: ['shared'] }],
      });
      ${lockedTest('automatic', 500)}
    `,
    'b-hook.test.ts': `
      import { test as base } from '@playwright/test';

      const test = base.extend<{ hooked: void }>({
        hooked: [undefined, { locks: ['shared'] }],
      });
      test.beforeEach(async ({ hooked }) => void hooked);
      ${lockedTest('hook', 500)}
    `,
    'c-modifier.test.ts': `
      import { test as base } from '@playwright/test';

      const test = base.extend<{ modified: void }>({
        modified: [undefined, { locks: ['shared'] }],
      });
      test.skip(({ modified }) => {
        void modified;
        return false;
      });
      ${lockedTest('modifier', 500)}
    `,
  }, { workers: 3 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(conflictingOverlaps(result.outputLines, [
    ['automatic', 'hook'],
    ['automatic', 'modifier'],
    ['hook', 'modifier'],
  ])).toEqual([]);
});

test('should resolve fixture locks through project option overrides', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        fullyParallel: true,
        use: { account: 'override' },
      };
    `,
    'a.test.ts': `
      import { expect, test as base } from '@playwright/test';
      import fs from 'fs';

      const test = base.extend<{ database: void, account: string }>({
        database: [undefined, { locks: ['database'] }],
        account: [async ({ database }, use) => {
          await use('default');
        }, { option: true, locks: ['account'] }],
      });
      test('account one', async ({ account }) => {
        console.log('\\n%%begin:account-one:' + account);
        fs.writeFileSync(test.info().project.outputDir + '/account', '');
        await expect.poll(() => fs.existsSync(test.info().project.outputDir + '/database')).toBe(true);
        console.log('\\n%%end:account-one');
      });

      test('account two', async ({ account }) => {
        console.log('\\n%%begin:account-two:' + account);
        await new Promise(f => setTimeout(f, 500));
        console.log('\\n%%end:account-two');
      });

      test('database', async ({ database }) => {
        console.log('\\n%%begin:database');
        fs.writeFileSync(test.info().project.outputDir + '/database', '');
        await expect.poll(() => fs.existsSync(test.info().project.outputDir + '/account')).toBe(true);
        console.log('\\n%%end:database');
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.outputLines).toContain('begin:account-one:override');
  expect(conflictingOverlaps(result.outputLines, [['account-one', 'database']])).toHaveLength(1);
  expect(conflictingOverlaps(result.outputLines, [['account-one', 'account-two']])).toEqual([]);
});

test('should resolve fixture locks through suite option overrides', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'a.test.ts': `
      import { expect, test as base } from '@playwright/test';
      import fs from 'fs';

      const test = base.extend<{ database: void, account: string }>({
        database: [undefined, { locks: ['database'] }],
        account: [async ({ database }, use) => {
          await use('default');
        }, { option: true, locks: ['account'] }],
      });

      test.describe('overridden', () => {
        test.use({ account: 'override' });

        test('account one', async ({ account }) => {
          console.log('\\n%%begin:account-one:' + account);
          fs.writeFileSync(test.info().project.outputDir + '/account', '');
          await expect.poll(() => fs.existsSync(test.info().project.outputDir + '/database')).toBe(true);
          console.log('\\n%%end:account-one');
        });

        test('account two', async ({ account }) => {
          console.log('\\n%%begin:account-two:' + account);
          await new Promise(f => setTimeout(f, 500));
          console.log('\\n%%end:account-two');
        });
      });

      test('database', async ({ database }) => {
        console.log('\\n%%begin:database');
        fs.writeFileSync(test.info().project.outputDir + '/database', '');
        await expect.poll(() => fs.existsSync(test.info().project.outputDir + '/account')).toBe(true);
        console.log('\\n%%end:database');
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.outputLines).toContain('begin:account-one:override');
  expect(conflictingOverlaps(result.outputLines, [['account-one', 'database']])).toHaveLength(1);
  expect(conflictingOverlaps(result.outputLines, [['account-one', 'account-two']])).toHaveLength(1);
});

test('should not inherit locks when resetting an option with test.use(undefined)', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'a.test.ts': `
      import { test as base } from '@playwright/test';

      const test = base.extend<{ account: string }>({
        account: ['default', { option: true, locks: ['account'] }],
      });
      test.use({ account: undefined });

      test('option', async ({ account }) => {
        console.log('\\n%%begin:option:' + account);
        await new Promise(f => setTimeout(f, 500));
        console.log('\\n%%end:option');
      });
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('direct', 500, 'account')}
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.outputLines).toContain('begin:option:default');
  expect(conflictingOverlaps(result.outputLines, [['option', 'direct']])).toHaveLength(1);
});

test('should preserve fixture locks reachable outside an overridden option', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        fullyParallel: true,
        use: { account: 'override' },
      };
    `,
    'a.test.ts': `
      import { test as base } from '@playwright/test';

      const test = base.extend<{ database: void, account: string, audit: void }>({
        database: [undefined, { locks: ['database'] }],
        account: [async ({ database }, use) => {
          await use('default');
        }, { option: true }],
        audit: async ({ database }, use) => {
          await use();
        },
      });

      test('one', async ({ account, audit }) => {
        console.log('\\n%%begin:one:' + account);
        await new Promise(f => setTimeout(f, 500));
        console.log('\\n%%end:one');
      });

      test('two', async ({ database }) => {
        console.log('\\n%%begin:two');
        await new Promise(f => setTimeout(f, 500));
        console.log('\\n%%end:two');
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.outputLines).toContain('begin:one:override');
  expect(conflictingOverlaps(result.outputLines, [['one', 'two']])).toEqual([]);
});

test('should preserve dependency locks added after an option declaration', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        fullyParallel: true,
        use: { account: 'override' },
      };
    `,
    'a.test.ts': `
      import { test as base } from '@playwright/test';

      const baseWithOption = base.extend<{ database: void, account: string }>({
        database: [undefined, { locks: ['database'] }],
        account: [async ({}, use) => {
          await use('default');
        }, { option: true }],
      });
      const test = baseWithOption.extend({
        account: async ({ account, database }, use) => {
          await use(account);
        },
      });

      test('one', async ({ account }) => {
        console.log('\\n%%begin:one:' + account);
        await new Promise(f => setTimeout(f, 500));
        console.log('\\n%%end:one');
      });

      test('two', async ({ database }) => {
        console.log('\\n%%begin:two');
        await new Promise(f => setTimeout(f, 500));
        console.log('\\n%%end:two');
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.outputLines).toContain('begin:one:override');
  expect(conflictingOverlaps(result.outputLines, [['one', 'two']])).toEqual([]);
});

test('should hold the lock for the whole file group in default mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('a1', 500, 'shared')}
      ${lockedTest('a2', 500)}
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('b1', 1000, 'shared')}
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  // The lock declared on a1 covers the whole file, including a2.
  expect(conflictingOverlaps(result.outputLines, [['a1', 'b1'], ['a2', 'b1']])).toEqual([]);
});

test('should respect locks on tests from a parallel suite with beforeAll hooks', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test.beforeAll(() => {
        console.log('\\n%%beforeAll');
      });
      test('plain1', async () => {});
      test('plain2', async () => {});
      ${lockedTest('test1', 1000, 'shared')}
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test2', 1000, 'shared')}
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(4);
  expect(result.output).toContain('%%beforeAll');
  expect(conflictingOverlaps(result.outputLines, [['test1', 'test2']])).toEqual([]);
});

test('should not count waiting for a lock towards the test timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { timeout: 3000 };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test1', 2000, 'shared')}
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test2', 2000, 'shared')}
    `,
  }, { workers: 2 });
  // Together the tests exceed the 3000ms timeout; waiting for the lock is not test time.
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(conflictingOverlaps(result.outputLines, [['test1', 'test2']])).toEqual([]);
});

test('should validate lock in test details', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('test1', { lock: 42 }, async () => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('details.lock');
});

test('should validate fixture locks', async ({ runInlineTest }) => {
  const worker = await runInlineTest({
    'a.test.js': `
      const { test: base } = require('@playwright/test');
      const test = base.extend({
        fixture: [undefined, { scope: 'worker', locks: ['shared'] }],
      });
      test('test', async ({ fixture }) => {});
    `,
  });
  expect(worker.exitCode).toBe(1);
  expect(worker.output).toContain('cannot specify locks because it has worker scope');

  const emptyWorker = await runInlineTest({
    'a.test.js': `
      const { test: base } = require('@playwright/test');
      const test = base.extend({
        fixture: [undefined, { scope: 'worker', locks: [] }],
      });
      test('test', async ({ fixture }) => {});
    `,
  });
  expect(emptyWorker.exitCode).toBe(0);
  expect(emptyWorker.passed).toBe(1);

  const nonArray = await runInlineTest({
    'a.test.js': `
      const { test: base } = require('@playwright/test');
      const test = base.extend({
        fixture: [undefined, { locks: 'shared' }],
      });
      test('test', async ({ fixture }) => {});
    `,
  });
  expect(nonArray.exitCode).toBe(1);
  expect(nonArray.output).toContain('option "locks" must be an array');

  const nonString = await runInlineTest({
    'a.test.js': `
      const { test: base } = require('@playwright/test');
      const test = base.extend({
        fixture: [undefined, { locks: [42] }],
      });
      test('test', async ({ fixture }) => {});
    `,
  });
  expect(nonString.exitCode).toBe(1);
  expect(nonString.output).toContain('option "locks" must contain only strings');
});
