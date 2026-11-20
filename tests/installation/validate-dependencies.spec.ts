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
import { test, expect } from './npmTest';
import fs from 'fs';
import path from 'path';

test.use({ isolateBrowsers: true });

test('should validate dependencies correctly if skipped during install', async ({ exec, writeFiles }) => {
  await exec('npm i playwright');

  await writeFiles({
    'test.js': `const { firefox } = require('playwright');
    (async () => {
      const browser = await firefox.launch();
      const page = await browser.newPage();
      await page.close();
      await browser.close();
    })();`,
  });

  const result = await exec('npx playwright install firefox', {
    env: {
      PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS: '1',
      DEBUG: 'pw:install',
    }
  });
  expect(result).toContain(`Skipping host requirements validation logic because`);

  await test.step('should skip dependency validation for a custom executablePath', async () => {
    const result2 = await exec('node validate-dependencies-skip-executable-path.js');
    expect(result2).not.toContain(`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`);
  });

  await test.step('should skip dependency validation on launch if env var is passed', async () => {
    const result = await exec('node test.js', {
      env: {
        PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS: '1',
      }
    });
    expect(result).toContain(`Skipping host requirements validation logic because`);
  });

  await test.step('should validate dependencies (skipped during install)', async () => {
    const result = await exec('node test.js', {
      env: {
        DEBUG: 'pw:install',
      },
    });
    expect(result).toContain(`validating host requirements for "firefox"`);
    expect(result).not.toContain(`validating host requirements for "chromium"`);
    expect(result).not.toContain(`validating host requirements for "webkit"`);
  });
});

test('should not validate dependencies on launch if validated during install', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44201' },
}, async ({ exec, writeFiles, _browsersPath }) => {
  await exec('npm i playwright');

  await writeFiles({
    'test.js': `const { chromium, firefox, webkit } = require('playwright');
    (async () => {
      for (const browserType of [chromium, firefox, webkit]) {
        const browser = await browserType.launch();
        const page = await browser.newPage();
        await page.close();
        await browser.close();
      }
    })();`,
  });

  const result = await exec('npx playwright install', {
    env: {
      DEBUG: 'pw:install',
    }
  });
  expect(result).not.toContain(`validating host requirements for "chromium"`);
  expect(result).not.toContain(`validating host requirements for "chromium-headless-shell"`);
  expect(result).toContain(`validating host requirements for "firefox"`);
  expect(result).toContain(`validating host requirements for "webkit"`);

  await test.step('should not validate dependencies on launch if already validated', async () => {
    const result = await exec('node test.js', {
      env: {
        DEBUG: 'pw:install',
      },
    });
    expect(result).not.toContain(`validating host requirements`);
  });

  for (const directory of await fs.promises.readdir(_browsersPath)) {
    if (directory.startsWith('chromium'))
      expect(fs.existsSync(path.join(_browsersPath, directory, 'DEPENDENCIES_VALIDATED'))).toBe(false);
  }
});
