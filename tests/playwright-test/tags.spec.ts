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
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('test 1', async ({}, testInfo) => {
        throw new Error('do not run this');
      });
      test('test 2 #smoke', async ({}, testInfo) => {
        console.log('needle');
      });
    `,
  }, {
    tag: 'smoke'
  });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('needle');
});

test('should combine multiple tags', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('test 1 #smoke', async ({}, testInfo) => {
        throw new Error('do not run this');
      });
      test('test 2 #water', async ({}, testInfo) => {
        throw new Error('do not run this 2');
      });
      test('test 3 #smoke #water', async ({}, testInfo) => {
        console.log('needle');
      });
    `,
  }, {
    args: ['--tag=smoke', '-twater']
  });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('needle');
});

test('tags should not appear in the title', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('I am #not great', async ({}, testInfo) => {
      });
    `,
  }, {reporter: 'list,json'});
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('I am great');
  expect(result.output).not.toContain('I am #not great');
});

test('tags should be able to come from extend', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      const tagged = test.extend({}, {tag: 'smoke'})
      test('Bad test', async ({}, testInfo) => {
        throw new Error('I am a bad test');
      });
      tagged('Good test', async ({}, testInfo) => {
        console.log('needle');
      });

    `,
  }, {tag: 'smoke'});
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('needle');
});
