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

const count = 10;

function testFile(name: string) {
  return `
    import { test } from '@playwright/test';
    ${Array.from({ length: count }, (_, i) => `test('test${i}', () => console.log('\\n%%${name}-test${i}'));`).join('\n')}
  `;
}

const fileNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const files = Object.fromEntries(fileNames.map(name => [`${name}.spec.ts`, testFile(name)]));
const testsInFile = (name: string) => Array.from({ length: count }, (_, i) => `${name}-test${i}`);
const naturalOrder = fileNames.flatMap(testsInFile);

test('should shuffle files and keep tests within a file in order', async ({ runInlineTest }) => {
  const result = await runInlineTest(files, { workers: 1, shuffle: '42' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(naturalOrder.length);
  expect(result.output).toContain('shuffle seed 42');
  expect(result.outputLines).not.toEqual(naturalOrder);
  const fileOrder = [...new Set(result.outputLines.map(line => line.split('-')[0]))];
  expect(result.outputLines).toEqual(fileOrder.flatMap(testsInFile));

  const result2 = await runInlineTest(files, { workers: 1, shuffle: '42' });
  expect(result2.outputLines).toEqual(result.outputLines);

  const result3 = await runInlineTest(files, { workers: 1, shuffle: '43' });
  expect(result3.outputLines).not.toEqual(result.outputLines);
});

test('should shuffle individual tests in fully parallel mode', async ({ runInlineTest }) => {
  const result = await runInlineTest(files, { 'workers': 1, 'shuffle': '42', 'fully-parallel': true });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(naturalOrder.length);
  const aTests = result.outputLines.filter(line => line.startsWith('a-'));
  expect(aTests).not.toEqual(testsInFile('a'));
  expect([...aTests].sort()).toEqual([...testsInFile('a')].sort());
});

test('should pick and print a random seed', async ({ runInlineTest }) => {
  const result = await runInlineTest(files, { workers: 1, shuffle: true });
  expect(result.exitCode).toBe(0);
  const seed = result.output.match(/shuffle seed (\d+)/)![1];
  const result2 = await runInlineTest(files, { workers: 1, shuffle: seed });
  expect(result2.outputLines).toEqual(result.outputLines);
});

test('should keep serial suites together in parallel mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.configure({ mode: 'parallel' });
      ${Array.from({ length: count }, (_, i) => `test('test${i}', () => console.log('\\n%%test${i}'));`).join('\n')}
      test.describe.serial('serial', () => {
        let counter = 0;
        ${Array.from({ length: count }, (_, i) => `test('serial${i}', () => { expect(counter++).toBe(${i}); console.log('\\n%%serial${i}'); });`).join('\n')}
      });
    `,
  }, { workers: 1, shuffle: '7' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2 * count);
  const lines = result.outputLines;
  const serialStart = lines.indexOf('serial0');
  expect(lines.slice(serialStart, serialStart + count)).toEqual(Array.from({ length: count }, (_, i) => `serial${i}`));
  expect(lines.filter(line => line.startsWith('test'))).not.toEqual(Array.from({ length: count }, (_, i) => `test${i}`));
});
