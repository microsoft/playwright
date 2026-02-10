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
import { test, expect, findDefaultSession, daemonFolder } from './cli-fixtures';

test('should not save user data by default (in-memory mode)', async ({ cli, server, mcpBrowser }, testInfo) => {
  await cli('open', server.HELLO_WORLD);
  const sessionOptions = await findDefaultSession();
  const dataDir = path.resolve(await daemonFolder(), 'ud-default-' + mcpBrowser);
  expect(fs.existsSync(dataDir)).toBe(false);
  expect(sessionOptions).toEqual({
    name: 'default',
    cli: {},
    socketPath: expect.any(String),
    userDataDirPrefix: expect.any(String),
    version: expect.any(String),
    workspaceDir: testInfo.outputPath(),
    resolvedConfig: expect.any(Object),
  });

  const { output: listOutput } = await cli('list');
  expect(listOutput).toContain(`### Browsers
- default:
  - status: open
  - browser-type: ${mcpBrowser}
  - user-data-dir: <in-memory>
  - headed: false`);
});

test('should save user data with --persistent flag', async ({ cli, server, mcpBrowser }, testInfo) => {
  await cli('open', server.HELLO_WORLD, '--persistent');
  const sessionOptions = await findDefaultSession();
  const dataDir = path.resolve(await daemonFolder(), 'ud-default-' + mcpBrowser);
  expect(fs.existsSync(dataDir)).toBe(true);
  expect(sessionOptions).toEqual({
    name: 'default',
    cli: {
      persistent: true,
    },
    socketPath: expect.any(String),
    userDataDirPrefix: expect.any(String),
    version: expect.any(String),
    workspaceDir: testInfo.outputPath(),
    resolvedConfig: expect.any(Object),
  });
});

test('should use custom user data dir with --profile=<dir>', async ({ cli, server }, testInfo) => {
  const customDir = testInfo.outputPath('custom-profile');
  await cli('open', server.HELLO_WORLD, `--profile=${customDir}`);
  expect(fs.existsSync(customDir)).toBe(true);
  const sessionOptions = await findDefaultSession();
  expect(sessionOptions).toEqual({
    name: 'default',
    cli: {
      persistent: true,
      profile: customDir,
    },
    socketPath: expect.any(String),
    userDataDirPrefix: expect.any(String),
    version: expect.any(String),
    workspaceDir: testInfo.outputPath(),
    resolvedConfig: expect.any(Object),
  });
});
