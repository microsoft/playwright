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
  const { output } = await cli('install-browser', '--list');
  expect(output).toMatch(/chromium-\d+/);
});

test('install workspace', async ({ cli }, testInfo) => {
  const { output } = await cli('install');
  expect(output).toContain(`Workspace initialized at`);
  const playwrightDir = testInfo.outputPath('.playwright');
  expect(fs.existsSync(playwrightDir)).toBe(true);
});

test('install adds .playwright-cli/ to .gitignore', async ({ cli }, testInfo) => {
  const outsideGitRepo = await cli('install');
  expect(outsideGitRepo.output).not.toContain('.gitignore');
  expect(fs.existsSync(testInfo.outputPath('.gitignore'))).toBe(false);

  await fs.promises.mkdir(testInfo.outputPath('.git'), { recursive: true });
  await fs.promises.writeFile(testInfo.outputPath('.gitignore'), 'node_modules/');
  const insideGitRepo = await cli('install');
  expect(insideGitRepo.output).toContain('Added `.playwright-cli/` to `.gitignore`.');
  const expectedContent = 'node_modules/\n# Playwright CLI output (may contain credentials)\n.playwright-cli/\n';
  expect(await fs.promises.readFile(testInfo.outputPath('.gitignore'), 'utf8')).toBe(expectedContent);

  const secondRun = await cli('install');
  expect(secondRun.output).not.toContain('.gitignore');
  expect(await fs.promises.readFile(testInfo.outputPath('.gitignore'), 'utf8')).toBe(expectedContent);
});

test('install workspace w/skills', async ({ cli }, testInfo) => {
  const { output } = await cli('install', '--skills');
  expect(output).toContain(`Skill installed to \`.claude${path.sep}skills${path.sep}playwright-cli\`.`);

  const skillFile = testInfo.outputPath('.claude', 'skills', 'playwright-cli', 'SKILL.md');
  expect(fs.existsSync(skillFile)).toBe(true);

  const referencesDir = testInfo.outputPath('.claude', 'skills', 'playwright-cli', 'references');
  const references = await fs.promises.readdir(referencesDir);
  expect(references.length).toBeGreaterThan(0);
});

test('install workspace w/--skills=agents', async ({ cli }, testInfo) => {
  const { output } = await cli('install', '--skills=agents');
  expect(output).toContain(`Skill installed to \`.agents${path.sep}skills${path.sep}playwright-cli\`.`);

  const skillFile = testInfo.outputPath('.agents', 'skills', 'playwright-cli', 'SKILL.md');
  expect(fs.existsSync(skillFile)).toBe(true);
});

test('install w/--skills -g installs into the home directory', async ({ cli }, testInfo) => {
  const fakeHome = testInfo.outputPath('fake-home');
  await fs.promises.mkdir(fakeHome, { recursive: true });
  const { output } = await cli('install', '--skills', '-g', { env: { HOME: fakeHome, USERPROFILE: fakeHome } });
  expect(output).toContain('Skill installed to');
  expect(output).not.toContain('Workspace initialized');

  const skillFile = path.join(fakeHome, '.claude', 'skills', 'playwright-cli', 'SKILL.md');
  expect(fs.existsSync(skillFile)).toBe(true);
});

test('install w/--skills=agents --global installs into the home directory', async ({ cli }, testInfo) => {
  const fakeHome = testInfo.outputPath('fake-home');
  await fs.promises.mkdir(fakeHome, { recursive: true });
  await cli('install', '--skills=agents', '--global', { env: { HOME: fakeHome, USERPROFILE: fakeHome } });

  const skillFile = path.join(fakeHome, '.agents', 'skills', 'playwright-cli', 'SKILL.md');
  expect(fs.existsSync(skillFile)).toBe(true);
});

test('install -g without --skills errors', async ({ cli }) => {
  const result = await cli('install', '-g');
  expect(result.exitCode).toBe(1);
  expect(result.error).toContain('--global requires --skills');
});

test('install handles browser detection', async ({ cli }) => {
  const { output } = await cli('install');
  // Verify that one of the browser detection outcomes occurred
  const foundMatch = output.match(/Found ((?:chrome|msedge)[\w-]*), will use it as the default browser\./m);
  if (foundMatch?.[1] !== 'chrome')
    expect(output).toContain(`Created default config for ${foundMatch?.[1] ?? 'chromium'}.`);
});

test('open with very long session name (issue 40878)', async ({ cli, server }) => {
  // Long session names push the unix socket path past sun_path's 104-byte limit on macOS.
  const longSessionName = 'awesome-coding-agent-orchestrators-with-an-overlong-suffix-for-testing';
  const result = await cli(`-s=${longSessionName}`, 'open', server.PREFIX);
  expect(result.error).toBe('');
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('Page URL');
});

test('open with long multi-byte session name (issue 42153)', async ({ cli, server }) => {
  const result = await cli('-s=セッション名がとても長い場合の動作を確認するためのテスト', 'open', server.PREFIX);
  expect(result.error).toBe('');
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('Page URL');
});
