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
import { test, expect } from './cli-fixtures';

test('should not save user data by default (in-memory mode)', async ({ cli, server, mcpBrowser }, testInfo) => {
  // Default behavior is now in-memory (isolated), no flag needed
  await cli('open', server.HELLO_WORLD);
  const dataDir = testInfo.outputPath('daemon', 'ud-default-' + mcpBrowser);
  expect(fs.existsSync(dataDir)).toBe(false);
  const sessionFile = testInfo.outputPath('daemon', 'default.session');
  expect(fs.existsSync(sessionFile)).toBe(true);
  const sessionOptions = JSON.parse(await fs.promises.readFile(sessionFile, 'utf-8'));
  expect(sessionOptions).toEqual({
    cli: {},
    socketPath: expect.any(String),
    userDataDirPrefix: expect.any(String),
    version: expect.any(String),
  });

  const { output: listOutput } = await cli('session-list');
  expect(listOutput).toContain('Sessions:');
  expect(listOutput).toContain('  [running] default');
});

test('should save user data with --persistent flag', async ({ cli, server, mcpBrowser }, testInfo) => {
  await cli('open', server.HELLO_WORLD, '--persistent');
  const dataDir = testInfo.outputPath('daemon', 'ud-default-' + mcpBrowser);
  expect(fs.existsSync(dataDir)).toBe(true);
  const sessionFile = testInfo.outputPath('daemon', 'default.session');
  expect(fs.existsSync(sessionFile)).toBe(true);
  const sessionOptions = JSON.parse(await fs.promises.readFile(sessionFile, 'utf-8'));
  expect(sessionOptions).toEqual({
    cli: {
      persistent: true,
    },
    socketPath: expect.any(String),
    userDataDirPrefix: expect.any(String),
    version: expect.any(String),
  });
});

test('should use custom user data dir with --profile=<dir>', async ({ cli, server }, testInfo) => {
  const customDir = testInfo.outputPath('custom-profile');
  await cli('open', server.HELLO_WORLD, `--profile=${customDir}`);
  expect(fs.existsSync(customDir)).toBe(true);
  const sessionFile = testInfo.outputPath('daemon', 'default.session');
  expect(fs.existsSync(sessionFile)).toBe(true);
  const sessionOptions = JSON.parse(await fs.promises.readFile(sessionFile, 'utf-8'));
  expect(sessionOptions).toEqual({
    cli: {
      persistent: true,
      profile: customDir,
    },
    socketPath: expect.any(String),
    userDataDirPrefix: expect.any(String),
    version: expect.any(String),
  });
});
