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

test('daemon shuts down on browser launch failure', async ({ cli, server }) => {
  const first = await cli('open', server.PREFIX, { env: { PLAYWRIGHT_MCP_EXECUTABLE_PATH: '/nonexistent/browser/path' } });
  expect(first.error).toContain(`executable doesn't exist`);

  const second = await cli('open', server.PREFIX);
  expect(second.exitCode).toBe(0);
  expect(second.output).toContain('Page URL');
});

test('install-browser', async ({ cli, server, mcpBrowser }) => {
  test.skip(mcpBrowser !== 'chromium', 'Test only chromium');
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('install-browser');
  expect(output).toContain(`Browser ${mcpBrowser} installed.`);
});

test('install workspace', async ({ cli }, testInfo) => {
  const { output } = await cli('install');
  expect(output).toContain(`Workspace initialized at`);
  const playwrightDir = testInfo.outputPath('.playwright');
  expect(fs.existsSync(playwrightDir)).toBe(true);
});

test('install workspace w/skills', async ({ cli }, testInfo) => {
  const { output } = await cli('install', '--skills');
  expect(output).toContain(`Skills installed to \`.claude${path.sep}skills${path.sep}playwright-cli\`.`);

  const skillFile = testInfo.outputPath('.claude', 'skills', 'playwright-cli', 'SKILL.md');
  expect(fs.existsSync(skillFile)).toBe(true);

  const referencesDir = testInfo.outputPath('.claude', 'skills', 'playwright-cli', 'references');
  const references = await fs.promises.readdir(referencesDir);
  expect(references.length).toBeGreaterThan(0);
});

test('install handles browser detection', async ({ cli }) => {
  const { output } = await cli('install');
  // Verify that one of the browser detection outcomes occurred
  const foundMatch = output.match(/Found ((?:chrome|msedge)[\w-]*), will use it as the default browser\./m);
  if (foundMatch?.[1] !== 'chrome')
    expect(output).toContain(`Created default config for ${foundMatch?.[1] ?? 'chromium'}.`);
});
