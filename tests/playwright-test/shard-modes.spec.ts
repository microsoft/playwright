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

const sixFiles = {
  'a.spec.ts': `
    import { test } from '@playwright/test';
    test('a1', async () => { console.log('%%a1'); });
  `,
  'b.spec.ts': `
    import { test } from '@playwright/test';
    test('b1', async () => { console.log('%%b1'); });
  `,
  'c.spec.ts': `
    import { test } from '@playwright/test';
    test('c1', async () => { console.log('%%c1'); });
  `,
  'd.spec.ts': `
    import { test } from '@playwright/test';
    test('d1', async () => { console.log('%%d1'); });
  `,
  'e.spec.ts': `
    import { test } from '@playwright/test';
    test('e1', async () => { console.log('%%e1'); });
  `,
  'f.spec.ts': `
    import { test } from '@playwright/test';
    test('f1', async () => { console.log('%%f1'); });
  `,
};

test('shardingMode=round-robin: shard 1/3 picks groups 0,3', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...sixFiles,
    'playwright.config.js': `module.exports = { shardingMode: 'round-robin' };`,
  }, { shard: '1/3', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.outputLines.sort()).toEqual(['a1', 'd1']);
});

test('shardingMode=round-robin: shard 2/3 picks groups 1,4', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...sixFiles,
    'playwright.config.js': `module.exports = { shardingMode: 'round-robin' };`,
  }, { shard: '2/3', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.outputLines.sort()).toEqual(['b1', 'e1']);
});

test('shardingMode=round-robin: shard 3/3 picks groups 2,5', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...sixFiles,
    'playwright.config.js': `module.exports = { shardingMode: 'round-robin' };`,
  }, { shard: '3/3', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.outputLines.sort()).toEqual(['c1', 'f1']);
});

test('shardingMode defaults to partition (regression)', async ({ runInlineTest }) => {
  const result = await runInlineTest(sixFiles, { shard: '1/3', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.outputLines.sort()).toEqual(['a1', 'b1']);
});

test('shardingMode=timings: balances by per-file duration', async ({ runInlineTest }, testInfo) => {
  const timingsPath = testInfo.outputPath('timings.json');
  require('fs').writeFileSync(timingsPath, JSON.stringify({
    'a.spec.ts': 1000,
    'b.spec.ts': 1,
    'c.spec.ts': 1,
    'd.spec.ts': 1,
    'e.spec.ts': 1,
    'f.spec.ts': 1,
  }));
  const result = await runInlineTest({
    ...sixFiles,
    'playwright.config.js': `module.exports = {
      shardingMode: 'timings',
      shardingTimingsFile: ${JSON.stringify(timingsPath)},
    };`,
  }, { shard: '1/2', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.outputLines).toEqual(['a1']);
});

test('shardingMode=timings: falls back to partition when file is missing', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...sixFiles,
    'playwright.config.js': `module.exports = {
      shardingMode: 'timings',
      shardingTimingsFile: 'nonexistent-timings.json',
    };`,
  }, { shard: '1/3', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines.sort()).toEqual(['a1', 'b1']);
  expect(result.output).toContain('timings file not found');
});

test('shardingMode={ sequencer }: custom function controls assignment', async ({ runInlineTest }, testInfo) => {
  const sequencerPath = testInfo.outputPath('seq.js');
  require('fs').writeFileSync(sequencerPath, `
    module.exports = function(groups, shard) {
      if (shard.current === 1)
        return new Set([groups[groups.length - 1]]);
      return new Set();
    };
  `);
  const result = await runInlineTest({
    ...sixFiles,
    'playwright.config.js': `module.exports = {
      shardingMode: { sequencer: ${JSON.stringify(sequencerPath)} },
    };`,
  }, { shard: '1/2', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.outputLines).toEqual(['f1']);
});

test('shardingMode validation: rejects unknown string', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...sixFiles,
    'playwright.config.js': `module.exports = { shardingMode: 'nonsense' };`,
  }, { shard: '1/2' });
  expect(result.exitCode).toBe(1);
  expect(result.output).toMatch(/shardingMode must be one of/);
});

test('--sharding-mode CLI flag overrides config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...sixFiles,
    'playwright.config.js': `module.exports = { shardingMode: 'partition' };`,
  }, { 'shard': '1/3', 'workers': 1, 'sharding-mode': 'round-robin' });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines.sort()).toEqual(['a1', 'd1']);
});
