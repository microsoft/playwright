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
import path from 'path';
import fs from 'fs';
import os from 'os';

test('cli should work', async ({ exec, tmpWorkspace }) => {
  await exec('npm i playwright');
  await exec('npx playwright install chromium');

  await test.step('codegen without arguments', async () => {
    const outputFile = test.info().outputPath('codegen.output');
    await exec(`npx playwright codegen --output=${outputFile}`, {
      env: {
        PWTEST_CLI_IS_UNDER_TEST: '1',
        PWTEST_CLI_EXIT_AFTER_TIMEOUT: '10000',
      }
    });
    const contents = fs.readFileSync(outputFile, 'utf-8');
    expect(contents).toContain(`@playwright/test`);
    expect(contents).toContain(`{ page }`);
  });

  await test.step('codegen with user data dir', async () => {
    const userDataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-test-custom-user-data-dir'));
    const outputFile = test.info().outputPath('codegen.output');

    try {
      await exec(`npx playwright codegen  --output=${outputFile} --user-data-dir ${userDataDir} about:blank`, {
        env: {
          PWTEST_CLI_IS_UNDER_TEST: '1',
          PWTEST_CLI_EXIT_AFTER_TIMEOUT: '10000',
        }
      });
      expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
      const contents = fs.readFileSync(outputFile, 'utf-8');
      expect(contents).toContain(`goto('about:blank')`);
      expect(contents).toContain(`{ page }`);
    } finally {
      fs.rmSync(userDataDir, { recursive: true });
    }
  });

  await test.step('codegen --target=javascript', async () => {
    const outputFile = test.info().outputPath('codegen.output');
    await exec(`npx playwright codegen --target=javascript --output=${outputFile}`, {
      env: {
        PWTEST_CLI_IS_UNDER_TEST: '1',
        PWTEST_CLI_EXIT_AFTER_TIMEOUT: '10000',
      }
    });
    const contents = fs.readFileSync(outputFile, 'utf-8');
    expect(contents).toContain(`context.close`);
    expect(contents).toContain(`playwright`);
  });

  await test.step('codegen --target=python', async () => {
    const outputFile = test.info().outputPath('codegen.output');
    await exec(`npx playwright codegen --target=python --output=${outputFile}`, {
      env: {
        PWTEST_CLI_IS_UNDER_TEST: '1',
        PWTEST_CLI_EXIT_AFTER_TIMEOUT: '10000',
      },
    });
    const contents = fs.readFileSync(outputFile, 'utf-8');
    expect(contents).toContain(`chromium.launch`);
    expect(contents).toContain(`browser.close`);
  });

  await test.step('screenshot', async () => {
    await exec(path.join('node_modules', '.bin', 'playwright'), 'screenshot about:blank one.png');
    await fs.promises.stat(path.join(tmpWorkspace, 'one.png'));

    await exec('npx playwright screenshot about:blank two.png');
    await fs.promises.stat(path.join(tmpWorkspace, 'two.png'));
  });

  await test.step('show-trace', async () => {
    const result = await exec('npx playwright show-trace i-do-not-exist.zip', { expectToExitWithError: true });
    expect(result).toContain(`Trace file i-do-not-exist.zip does not exist`);
  });

  await test.step('show-report', async () => {
    const result = await exec('npx playwright show-report', { expectToExitWithError: true });
    expect(result).toContain(`No report found at "${path.join(fs.realpathSync(tmpWorkspace), 'playwright-report')}"`);
  });
});
