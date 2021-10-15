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
import { test as base, expect } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

import type { PromptOptions } from '../src/generator';

type TestFixtures = {
  packageManager: 'npm' | 'yarn';
  run: (parameters: string[], options: PromptOptions) => Promise<RunResult>,
};

type RunResult = {
  exitCode: number|null,
  dir: string,
  stderr: string,
  stdout: string,
};

const test = base.extend<TestFixtures>({
  packageManager: 'npm',
  run: async ({ packageManager }, use, testInfo) => {
    await use(async (parameters: string[], options: PromptOptions): Promise<RunResult> => {
      fs.mkdirSync(testInfo.outputDir, { recursive: true });
      const env = packageManager === 'yarn' ? {
        'npm_config_user_agent': 'yarn'
      } : undefined;
      const p = spawn('node', [path.join(__dirname, '..'), ...parameters], {
        shell: true,
        cwd: testInfo.outputDir,
        env: {
          ...process.env,
          ...env,
          'TEST_OPTIONS': JSON.stringify(options),
        }
      });
      let stdout = '';
      let stderr = '';
      p.stdout.on('data', data => stdout += data.toString());
      p.stderr.on('data', data => stderr += data.toString());
      let resolve = (result: RunResult) => { };
      const waitUntilExit = new Promise<RunResult>(r => resolve = r);
      p.on('exit', exitCode => {
        resolve({ exitCode, dir: testInfo.outputDir, stdout, stderr });
      });
      if (process.env.DEBUG) {
        p.stdout.on('data', chunk => process.stdout.write(chunk));
        p.stderr.on('data', chunk => process.stderr.write(chunk));
      }
      return await waitUntilExit;
    });
  },
});

for (const packageManager of ['npm', 'yarn'] as ('npm' | 'yarn')[]) {
  test.describe(`Package manager: ${packageManager}`, () => {
    test.use({ packageManager });

    test('should generate a project in the current directory', async ({ run }) => {
      const { exitCode, dir, stdout } = await run([], { installGitHubActions: true, testDir: 'e2e', language: 'TypeScript' });
      expect(exitCode).toBe(0);
      expect(fs.existsSync(path.join(dir, 'e2e/example.spec.ts'))).toBeTruthy();
      expect(fs.existsSync(path.join(dir, 'package.json'))).toBeTruthy();
      if (packageManager === 'npm')
        expect(fs.existsSync(path.join(dir, 'package-lock.json'))).toBeTruthy();
      else
        expect(fs.existsSync(path.join(dir, 'yarn.lock'))).toBeTruthy();
      expect(fs.existsSync(path.join(dir, 'playwright.config.ts'))).toBeTruthy();
      const playwrightConfigContent = fs.readFileSync(path.join(dir, 'playwright.config.ts'), 'utf8');
      expect(playwrightConfigContent).toContain('e2e');
      expect(fs.existsSync(path.join(dir, '.github/workflows/playwright.yml'))).toBeTruthy();
      expect(fs.existsSync(path.join(dir, '.gitignore'))).toBeTruthy();
      if (packageManager === 'npm') {
        expect(stdout).toContain('Initializing NPM project (npm init -y)…');
        expect(stdout).toContain('Installing Playwright Test (npm install --save-dev @playwright/test)…');
      } else {
        expect(stdout).toContain('Initializing Yarn project (yarn init -y)…');
        expect(stdout).toContain('Installing Playwright Test (yarn add --dev @playwright/test)…');
      }
      expect(stdout).toContain('npx playwright install --with-deps');
    });

    test('should generate a project in a given directory', async ({ run }) => {
      const { exitCode, dir } = await run(['foobar'], { installGitHubActions: true, testDir: 'e2e', language: 'TypeScript' });
      expect(exitCode).toBe(0);
      expect(fs.existsSync(path.join(dir, 'foobar/e2e/example.spec.ts'))).toBeTruthy();
      expect(fs.existsSync(path.join(dir, 'foobar/package.json'))).toBeTruthy();
      if (packageManager === 'npm')
        expect(fs.existsSync(path.join(dir, 'foobar/package-lock.json'))).toBeTruthy();
      else
        expect(fs.existsSync(path.join(dir, 'foobar/yarn.lock'))).toBeTruthy();
      expect(fs.existsSync(path.join(dir, 'foobar/playwright.config.ts'))).toBeTruthy();
      expect(fs.existsSync(path.join(dir, 'foobar/.github/workflows/playwright.yml'))).toBeTruthy();
    });

    test('should generate a project with JavaScript and without GHA', async ({ run }) => {
      const { exitCode, dir } = await run([], { installGitHubActions: false, testDir: 'tests', language: 'JavaScript' });
      expect(exitCode).toBe(0);
      expect(fs.existsSync(path.join(dir, 'tests/example.spec.js'))).toBeTruthy();
      expect(fs.existsSync(path.join(dir, 'package.json'))).toBeTruthy();
      if (packageManager === 'npm')
        expect(fs.existsSync(path.join(dir, 'package-lock.json'))).toBeTruthy();
      else
        expect(fs.existsSync(path.join(dir, 'yarn.lock'))).toBeTruthy();
      expect(fs.existsSync(path.join(dir, 'playwright.config.js'))).toBeTruthy();
      expect(fs.existsSync(path.join(dir, '.github/workflows/playwright.yml'))).toBeFalsy();
    });
  });
}
