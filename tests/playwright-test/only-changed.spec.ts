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

import { test, expect, magicFileCreationSymbol } from './playwright-test-fixtures';
import { execSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

test('should filter by file name', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('fails', () => { expect(1).toBe(2); });
      `,
    'b.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('fails', () => { expect(1).toBe(2); });
      `,
    async [magicFileCreationSymbol](baseDir) {
      execSync(`git init --initial-branch=main`, { cwd: baseDir });
      execSync(`git add .`, { cwd: baseDir });
      execSync(`git commit -m init`, { cwd: baseDir });

      await writeFile(join(baseDir, 'c.spec.ts'), `
        import { test, expect } from '@playwright/test';
        test('fails', () => { expect(1).toBe(2); });
      `);
    }
  }, { 'only-changed': true });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('c.spec.ts');
});
