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
import { spawn } from 'child_process';


test.use({ isolateBrowsers: true });

test('concurrent browser downloads should not clobber each other', async ({ exec, checkInstalledSoftwareOnDisk, _browsersPath, tmpWorkspace }) => {
  // Set up a workspace with playwright installed
  await exec('npm init -y');
  await exec('npm install playwright');
  // Start multiple concurrent install processes
  const processes = [];
  const numProcesses = 3;

  for (let i = 0; i < numProcesses; i++) {
    const child = spawn('npx', ['playwright', 'install', 'chromium'], {
      cwd: tmpWorkspace,
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: _browsersPath },
      stdio: 'pipe'
    });

    processes.push(child);
  }

  // Wait for all processes to complete
  const results = await Promise.all(processes.map((child, index) => {
    return new Promise<{ index: number; code: number | null; stdout: string; stderr: string }>(resolve => {
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', data => {
        stdout += data.toString();
      });

      child.stderr?.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', code => {
        resolve({ index, code, stdout, stderr });
      });
    });
  }));

  // Check that all processes completed successfully
  for (const result of results) {
    expect(result.code).toBe(0);
    if (result.code !== 0)
      throw new Error(`Process ${result.index} failed with code ${result.code}. stdout: ${result.stdout}, stderr: ${result.stderr}`);
  }

  // Verify that the browser was installed correctly
  // When installing chromium, it also installs chromium-headless-shell and ffmpeg as dependencies
  await checkInstalledSoftwareOnDisk(['chromium', 'chromium-headless-shell', 'ffmpeg']);
});
