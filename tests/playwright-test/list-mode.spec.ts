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

import path from 'path';
import { test, expect } from './playwright-test-fixtures';

test('should have relative always-posix paths', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('math works!', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `
  }, { 'list': true });
  expect(result.exitCode).toBe(0);
  expect(result.report.config.rootDir.indexOf(path.win32.sep)).toBe(-1);
  expect(result.report.suites[0].specs[0].file).toBe('a.test.js');
  expect(result.report.suites[0].specs[0].line).toBe(6);
  expect(result.report.suites[0].specs[0].column).toBe(7);
});
