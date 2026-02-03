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
import { test, expect } from './cli-fixtures';

test('state-save saves storage state to file', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);

  // Set some cookies and localStorage
  await cli('eval', '() => { document.cookie = "testCookie=testValue"; localStorage.setItem("testKey", "testValue"); }');

  // Save storage state
  const { output } = await cli('state-save');
  expect(output).toContain('storage-state-');
  expect(output).toContain('.json');

  // Verify the file was created and contains the cookie
  const outputDir = testInfo.outputPath('.playwright-cli');
  const files = await fs.promises.readdir(outputDir);
  const storageStateFile = files.find(f => f.startsWith('storage-state-'));
  expect(storageStateFile).toBeDefined();

  const content = JSON.parse(await fs.promises.readFile(path.join(outputDir, storageStateFile!), 'utf-8'));
  expect(content.cookies).toContainEqual(expect.objectContaining({
    name: 'testCookie',
    value: 'testValue',
  }));
});

test('state-save saves to custom filename', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);

  const { output } = await cli('state-save', 'my-state.json');
  expect(output).toContain('my-state.json');

  const stateFile = testInfo.outputPath('my-state.json');
  expect(await fs.promises.stat(stateFile).catch(() => null)).not.toBeNull();
});

test('state-load restores storage state from file', async ({ cli, server, mcpBrowser }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));

  // Create a storage state file
  const storageState = {
    cookies: [{
      name: 'restoredCookie',
      value: 'restoredValue',
      domain: 'localhost',
      path: '/',
    }],
    origins: [{
      origin: server.PREFIX,
      localStorage: [{
        name: 'restoredKey',
        value: 'restoredValue',
      }],
    }],
  };

  const stateFile = testInfo.outputPath('state.json');
  await fs.promises.writeFile(stateFile, JSON.stringify(storageState));

  await cli('open', server.EMPTY_PAGE);

  // Restore storage state
  const { output } = await cli('state-load', 'state.json');
  expect(output).toContain('Storage state restored');

  // Verify the cookie was restored
  const { output: cookieResult } = await cli('eval', '() => document.cookie');
  expect(cookieResult).toContain('restoredCookie=restoredValue');

  // Verify localStorage was restored
  const { output: localStorageResult } = await cli('eval', '() => localStorage.getItem("restoredKey")');
  expect(localStorageResult).toContain('restoredValue');
});

test('state-save and state-load roundtrip', async ({ cli, server, mcpBrowser }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);

  // Set data
  await cli('eval', '() => { document.cookie = "roundtripCookie=roundtripValue"; localStorage.setItem("roundtripKey", "roundtripValue"); }');

  // Save storage state
  await cli('state-save', 'roundtrip-state.json');

  // Clear storage
  await cli('eval', '() => { document.cookie = "roundtripCookie=; expires=Thu, 01 Jan 1970 00:00:00 GMT"; localStorage.clear(); }');

  // Verify storage is cleared
  const { output: clearedResult } = await cli('eval', '() => document.cookie + "|" + localStorage.getItem("roundtripKey")');
  expect(clearedResult).toContain('|null');

  // Restore storage state
  await cli('state-load', testInfo.outputPath('roundtrip-state.json'));

  // Reload to pick up cookies
  await cli('open', server.EMPTY_PAGE);

  // Verify storage was restored
  const { output: restoredResult } = await cli('eval', '() => document.cookie + "|" + localStorage.getItem("roundtripKey")');
  expect(restoredResult).toContain('roundtripCookie=roundtripValue');
});
