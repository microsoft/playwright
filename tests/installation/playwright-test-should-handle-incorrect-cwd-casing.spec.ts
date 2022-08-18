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
import path from 'path';
import { test, expect } from './npmTest';

test('@playwright/test should handle incorrect cwd casing', async ({ exec, tmpWorkspace }) => {
  test.skip(process.platform !== 'win32');
  const cwd = path.join(tmpWorkspace, 'expectedcasing');
  fs.mkdirSync(cwd);
  fs.writeFileSync(path.join(cwd, 'sample.spec.ts'), `
    import { test, expect } from '@playwright/test';
    test('should pass', async () => {
      expect(1 + 1).toBe(2);
    })
  `);
  fs.writeFileSync(path.join(cwd, 'sample.spec.js'), `
    const { test, expect } = require('@playwright/test');
    test('should pass', async () => {
      expect(1 + 1).toBe(2);
    })
  `);
  await exec('npm init -y', { cwd });
  await exec('npm i --foreground-scripts @playwright/test', { cwd });

  const output = await exec('npx playwright test --reporter=list', { cwd: path.join(tmpWorkspace, 'eXpEcTeDcAsInG') });
  expect(output).toContain('2 passed');
});
