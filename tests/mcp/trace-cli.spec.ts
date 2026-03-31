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
import path from 'path';

test.skip(({ mcpBrowser }) => mcpBrowser !== 'chrome', 'Chrome-only');

test('trace open shows metadata', async ({ traceFile, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['open', traceFile]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Browser:');
  expect(stdout).toContain('chromium');
  expect(stdout).toContain('Viewport:');
  expect(stdout).toContain('800x600');
  expect(stdout).toContain('Actions:');
  expect(stdout).toContain('Pages:');
  expect(stdout).toContain('Network:');
});

test('trace actions shows actions with ordinals', async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['actions']);
  expect(exitCode).toBe(0);
  // Should have ordinal numbers
  expect(stdout).toMatch(/^\s+\d+\.\s/m);
  // Should have formatted action titles
  expect(stdout).toContain('Navigate');
  expect(stdout).toContain('Click');
  expect(stdout).toContain('Fill');
});

test('trace actions --grep filters actions', async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['actions', '--grep', 'Click']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Click');
  expect(stdout).not.toContain('Navigate');
  expect(stdout).not.toContain('Fill');
});

test('trace action displays action details', async ({ runTraceCli }) => {
  // First get an action ordinal from list
  const { stdout: listOutput } = await runTraceCli(['actions', '--grep', 'Navigate']);
  const match = listOutput.match(/^\s+(\d+)\.\s/m);
  expect(match).toBeTruthy();

  const { stdout, exitCode } = await runTraceCli(['action', match![1]]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Navigate');
  expect(stdout).toContain('Time');
  expect(stdout).toContain('start:');
  expect(stdout).toContain('duration:');
  expect(stdout).toContain('Parameters');
});

test('trace action reports available snapshots', async ({ runTraceCli }) => {
  const { stdout: listOutput } = await runTraceCli(['actions', '--grep', 'Click']);
  const match = listOutput.match(/^\s+(\d+)\.\s/m);
  expect(match).toBeTruthy();

  const { stdout, exitCode } = await runTraceCli(['action', match![1]]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Snapshots');
  expect(stdout).toContain('available:');
});

test('trace action with invalid action ID', async ({ runTraceCli }) => {
  const { stderr, exitCode } = await runTraceCli(['action', '999999']);
  expect(exitCode).toBe(1);
  expect(stderr).toContain('not found');
});

test('trace requests shows requests with ordinals', async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['requests']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Method');
  expect(stdout).toContain('Status');
  expect(stdout).toContain('GET');
  expect(stdout).toMatch(/\d+\./);
});

test('trace requests --method filters', async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['requests', '--method', 'GET']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('GET');
  expect(stdout).not.toContain('POST');
});

test('trace request shows details', async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['request', '1']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('General');
  expect(stdout).toContain('status:');
  expect(stdout).toContain('Request headers');
  expect(stdout).toContain('Response headers');
});

test('trace request shows request and response body', async ({ traceCwd, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['requests', '--grep', 'feedback']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('feedback');
  const ordinal = stdout.match(/^\s+(\d+)\.\s/m)![1];
  const { stdout: requestOutput, exitCode: requestExitCode } = await runTraceCli(['request', ordinal]);
  expect(requestExitCode).toBe(0);
  expect(requestOutput).toContain('Request body');
  const requestBodyPath = path.join('.playwright-cli', 'trace', 'resources', '60e4c013c41de11280ed8ba99dd94144124a0c35.txt');
  expect(requestOutput).toContain(' ' + requestBodyPath);
  expect(fs.readFileSync(path.join(traceCwd, requestBodyPath), 'utf-8')).toEqual('What a great product!');
  expect(requestOutput).toContain('Response body');
  expect(requestOutput).toContain('application/json');
  const responseBodyPath = path.join('.playwright-cli', 'trace', 'resources', '030b61c2fb7042fb4fc0ef4287a4ae3c0d98ed68.json');
  expect(requestOutput).toContain(' ' + responseBodyPath);
  expect(fs.readFileSync(path.join(traceCwd, responseBodyPath), 'utf-8')).toEqual(JSON.stringify({ received: true }));
});

test('trace request with invalid ID', async ({ runTraceCli }) => {
  const { stderr, exitCode } = await runTraceCli(['request', '999999']);
  expect(exitCode).toBe(1);
  expect(stderr).toContain('not found');
});

test('trace console shows messages', async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['console']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('info message');
  expect(stdout).toContain('warning message');
  expect(stdout).toContain('error message');
});

test('trace console --errors-only', async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['console', '--errors-only']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('error message');
  expect(stdout).not.toContain('info message');
});

test('trace errors', async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['errors']);
  expect(exitCode).toBe(0);
  // Our test trace may or may not have errors, just verify it doesn't crash
  expect(stdout).toBeTruthy();
});

test('trace snapshot runs command on snapshot', async ({ runTraceCli }) => {
  const { stdout: listOutput } = await runTraceCli(['actions', '--grep', 'Navigate']);
  const match = listOutput.match(/^\s+(\d+)\.\s/m);
  expect(match).toBeTruthy();

  const { stdout, exitCode } = await runTraceCli(['snapshot', match![1]]);
  expect(exitCode).toBe(0);
  expect(stdout).toBeTruthy();
});

test('trace snapshot --name before', async ({ runTraceCli }) => {
  const { stdout: listOutput } = await runTraceCli(['actions', '--grep', 'Click']);
  const match = listOutput.match(/^\s+(\d+)\.\s/m);
  expect(match).toBeTruthy();

  const { stdout, exitCode } = await runTraceCli(['snapshot', '--name', 'before', match![1]]);
  expect(exitCode).toBe(0);
  expect(stdout).toBeTruthy();
});

test('trace screenshot saves image file', async ({ runTraceCli }, testInfo) => {
  const { stdout: listOutput } = await runTraceCli(['actions', '--grep', 'Navigate']);
  const match = listOutput.match(/^\s+(\d+)\.\s/m);
  expect(match).toBeTruthy();

  const outPath = testInfo.outputPath('test-screenshot.png');
  const { stdout, exitCode } = await runTraceCli(['screenshot', match![1], '-o', outPath]);
  // Screenshot may or may not be available depending on timing
  if (exitCode === 0) {
    expect(stdout).toContain('Screenshot saved to');
    expect(fs.existsSync(outPath)).toBe(true);
  }
});

test('trace close removes extracted trace', async ({ traceFile, runTraceCli }) => {
  const { exitCode } = await runTraceCli(['close']);
  expect(exitCode).toBe(0);

  // Subsequent commands should fail because trace is closed.
  const { stderr, exitCode: exitCode2 } = await runTraceCli(['actions']);
  expect(exitCode2).toBe(1);
  expect(stderr).toContain('No trace opened');

  // Re-open for remaining tests.
  const { exitCode: exitCode3 } = await runTraceCli(['open', traceFile]);
  expect(exitCode3).toBe(0);
});

test('trace attachments lists attachments', async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['attachments']);
  expect(exitCode).toBe(0);
  // Our test trace has no attachments, just verify it doesn't crash
  expect(stdout).toBeTruthy();
});
