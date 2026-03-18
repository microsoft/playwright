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

import { test, expect } from './trace-cli-fixtures';

test.skip(({ mcpBrowser }) => mcpBrowser !== 'chrome', 'Chrome-only');

test('trace info shows metadata', async ({ traceFile, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['info', traceFile]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Browser:');
  expect(stdout).toContain('chromium');
  expect(stdout).toContain('Viewport:');
  expect(stdout).toContain('800x600');
  expect(stdout).toContain('Actions:');
  expect(stdout).toContain('Pages:');
  expect(stdout).toContain('Network:');
});

test('trace actions shows actions with ordinals', async ({ traceFile, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['actions', traceFile]);
  expect(exitCode).toBe(0);
  // Should have ordinal numbers
  expect(stdout).toMatch(/^\s+\d+\.\s/m);
  // Should have formatted action titles
  expect(stdout).toContain('Navigate');
  expect(stdout).toContain('Click');
  expect(stdout).toContain('Fill');
});

test('trace actions --grep filters actions', async ({ traceFile, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['actions', '--grep', 'Click', traceFile]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Click');
  expect(stdout).not.toContain('Navigate');
  expect(stdout).not.toContain('Fill');
});

test('trace action displays action details', async ({ traceFile, runTraceCli }) => {
  // First get an action ordinal from list
  const { stdout: listOutput } = await runTraceCli(['actions', '--grep', 'Navigate', traceFile]);
  const match = listOutput.match(/^\s+(\d+)\.\s/m);
  expect(match).toBeTruthy();

  const { stdout, exitCode } = await runTraceCli(['action', traceFile, match![1]]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Navigate');
  expect(stdout).toContain('Time');
  expect(stdout).toContain('start:');
  expect(stdout).toContain('duration:');
  expect(stdout).toContain('Parameters');
});

test('trace action reports available snapshots', async ({ traceFile, runTraceCli }) => {
  const { stdout: listOutput } = await runTraceCli(['actions', '--grep', 'Click', traceFile]);
  const match = listOutput.match(/^\s+(\d+)\.\s/m);
  expect(match).toBeTruthy();

  const { stdout, exitCode } = await runTraceCli(['action', traceFile, match![1]]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Snapshots');
  expect(stdout).toContain('available:');
});

test('trace action with invalid action ID', async ({ traceFile, runTraceCli }) => {
  const { stderr, exitCode } = await runTraceCli(['action', traceFile, '999999']);
  expect(exitCode).toBe(1);
  expect(stderr).toContain('not found');
});

test('trace requests shows requests with ordinals', async ({ traceFile, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['requests', traceFile]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Method');
  expect(stdout).toContain('Status');
  expect(stdout).toContain('GET');
  expect(stdout).toMatch(/\d+\./);
});

test('trace requests --method filters', async ({ traceFile, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['requests', '--method', 'GET', traceFile]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('GET');
  expect(stdout).not.toContain('POST');
});

test('trace request shows details', async ({ traceFile, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['request', traceFile, '1']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('General');
  expect(stdout).toContain('status:');
  expect(stdout).toContain('Request headers');
  expect(stdout).toContain('Response headers');
});

test('trace request with invalid ID', async ({ traceFile, runTraceCli }) => {
  const { stderr, exitCode } = await runTraceCli(['request', traceFile, '999999']);
  expect(exitCode).toBe(1);
  expect(stderr).toContain('not found');
});

test('trace console shows messages', async ({ traceFile, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['console', traceFile]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('info message');
  expect(stdout).toContain('warning message');
  expect(stdout).toContain('error message');
});

test('trace console --errors-only', async ({ traceFile, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['console', '--errors-only', traceFile]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('error message');
  expect(stdout).not.toContain('info message');
});

test('trace errors', async ({ traceFile, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['errors', traceFile]);
  expect(exitCode).toBe(0);
  // Our test trace may or may not have errors, just verify it doesn't crash
  expect(stdout).toBeTruthy();
});

test('trace snapshot saves HTML file', async ({ traceFile, runTraceCli }, testInfo) => {
  const { stdout: listOutput } = await runTraceCli(['actions', '--grep', 'Navigate', traceFile]);
  const match = listOutput.match(/^\s+(\d+)\.\s/m);
  expect(match).toBeTruthy();

  const outPath = testInfo.outputPath('test-snapshot.html');
  const { stdout, exitCode } = await runTraceCli(['snapshot', traceFile, match![1], '-o', outPath]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Snapshot saved to');
  expect(fs.existsSync(outPath)).toBe(true);
  const html = fs.readFileSync(outPath, 'utf-8');
  expect(html.toLowerCase()).toContain('<html');
});

test('trace snapshot --name before', async ({ traceFile, runTraceCli }, testInfo) => {
  const { stdout: listOutput } = await runTraceCli(['actions', '--grep', 'Click', traceFile]);
  const match = listOutput.match(/^\s+(\d+)\.\s/m);
  expect(match).toBeTruthy();

  const outPath = testInfo.outputPath('before-snapshot.html');
  const { stdout, exitCode } = await runTraceCli(['snapshot', '--name', 'before', traceFile, match![1], '-o', outPath]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Snapshot saved to');
});

test('trace screenshot saves image file', async ({ traceFile, runTraceCli }, testInfo) => {
  const { stdout: listOutput } = await runTraceCli(['actions', '--grep', 'Navigate', traceFile]);
  const match = listOutput.match(/^\s+(\d+)\.\s/m);
  expect(match).toBeTruthy();

  const outPath = testInfo.outputPath('test-screenshot.png');
  const { stdout, exitCode } = await runTraceCli(['screenshot', traceFile, match![1], '-o', outPath]);
  // Screenshot may or may not be available depending on timing
  if (exitCode === 0) {
    expect(stdout).toContain('Screenshot saved to');
    expect(fs.existsSync(outPath)).toBe(true);
  }
});

test('trace attachments lists attachments', async ({ traceFile, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['attachments', traceFile]);
  expect(exitCode).toBe(0);
  // Our test trace has no attachments, just verify it doesn't crash
  expect(stdout).toBeTruthy();
});
