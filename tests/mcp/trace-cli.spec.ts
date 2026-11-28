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

import { test, expect } from './trace-cli-fixtures';

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

test('trace requests shows start times and aborted request durations', async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['requests']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Start');
  // Every request row carries a start timestamp in the `trace actions` Time format.
  expect(stdout).toMatch(/\d+\.\s+\d+:\d{2}\.\d{3}\s/);
  // The aborted request has a recorded duration rather than '-'.
  const abortedRow = stdout.split('\n').find(line => line.includes('aborted'))!;
  expect(abortedRow).toContain('blocked');
  expect(abortedRow).toMatch(/\s\d+(\.\d+)?m?s\s/);
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
  expect(stdout).toMatch(/start:\s+\d+:\d{2}\.\d{3}/);
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

test('trace console --grep filters by message text', async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['console', '--grep', 'warning']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('warning message');
  expect(stdout).not.toContain('info message');
  expect(stdout).not.toContain('error message');
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

test('trace snapshot --phase before', async ({ runTraceCli }) => {
  const { stdout: listOutput } = await runTraceCli(['actions', '--grep', 'Click']);
  const match = listOutput.match(/^\s+(\d+)\.\s/m);
  expect(match).toBeTruthy();

  const { stdout, exitCode } = await runTraceCli(['snapshot', '--phase', 'before', match![1]]);
  expect(exitCode).toBe(0);
  expect(stdout).toBeTruthy();
});

test('trace snapshot resolves inner frames', async ({ runTraceCli }) => {
  const { stdout: listOutput } = await runTraceCli(['actions', '--grep', 'Click']);
  const ordinals = [...listOutput.matchAll(/^\s+(\d+)\.\s/gm)].map(m => m[1]);
  expect(ordinals.length).toBeGreaterThanOrEqual(2);
  const anchorClickOrdinal = ordinals[ordinals.length - 1];

  const { stdout } = await runTraceCli(['snapshot', '--phase', 'after', anchorClickOrdinal]);
  expect(stdout).toContain('Innermost');
});

test('trace snapshot replays sub-resource stylesheets from the archive', async ({ runTraceCli }) => {
  const { stdout: listOutput } = await runTraceCli(['actions', '--grep', 'Click']);
  const match = listOutput.match(/^\s+(\d+)\.\s/m);
  expect(match).toBeTruthy();
  const ordinal = match![1];

  const { stdout, exitCode } = await runTraceCli([
    'snapshot', '--phase', 'before', ordinal,
    '--', 'eval', 'el => getComputedStyle(el).color', '#styled',
  ]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('rgb(255, 0, 0)');
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

test('trace open with .trace file creates link', async ({ traceFile, traceCwd, runTraceCli }) => {
  // Extract the zip using the CLI to get raw trace files.
  const extractCwd = path.join(path.dirname(traceFile), 'extracted');
  fs.mkdirSync(extractCwd, { recursive: true });
  const cliPath = path.resolve(__dirname, '../../packages/playwright-core/cli.js');
  const { execFileSync } = require('child_process');
  execFileSync(process.execPath, [cliPath, 'trace', 'open', traceFile], { cwd: extractCwd });
  const extractDir = path.join(extractCwd, '.playwright-cli', 'trace');

  const traceEntries = fs.readdirSync(extractDir).filter((f: string) => f.endsWith('.trace'));
  expect(traceEntries.length).toBeGreaterThan(0);
  const dotTraceFile = path.join(extractDir, traceEntries[0]);
  const { exitCode } = await runTraceCli(['open', dotTraceFile]);
  expect(exitCode).toBe(0);

  const linkFile = path.join(traceCwd, '.playwright-cli', 'trace', '.link');
  expect(fs.existsSync(linkFile)).toBe(true);
  expect(fs.readFileSync(linkFile, 'utf-8')).toBe(dotTraceFile);

  const { stdout: actionsOutput, exitCode: actionsExitCode } = await runTraceCli(['actions']);
  expect(actionsExitCode).toBe(0);
  expect(actionsOutput).toContain('Navigate');
  expect(actionsOutput).toContain('Click');
});

test('trace attachments lists and extracts attachments', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44174' } }, async ({ traceFile, traceCwd, runTraceCli }, testInfo) => {
  const inlineTrace = testInfo.outputPath('inline.trace');
  await fs.promises.writeFile(inlineTrace, [
    { type: 'context-options', version: 8, origin: 'testRunner', browserName: '', options: {}, platform: process.platform, wallTime: 0, monotonicTime: 0 },
    { type: 'before', callId: 'call@1', startTime: 0, class: 'Test', method: 'step', params: {} },
    { type: 'after', callId: 'call@1', endTime: 1, attachments: [{ name: 'empty.txt', contentType: 'text/plain', base64: '' }] },
  ].map(event => JSON.stringify(event)).join('\n'));
  expect((await runTraceCli(['open', inlineTrace])).exitCode).toBe(0);

  const { stdout: listOutput, exitCode: listExitCode } = await runTraceCli(['attachments']);
  expect(listExitCode).toBe(0);
  expect(listOutput).toContain('empty.txt');

  const { stdout, exitCode } = await runTraceCli(['attachment', '1']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Attachment saved to');
  expect(await fs.promises.readFile(path.join(traceCwd, '.playwright-cli', 'empty.txt'))).toEqual(Buffer.alloc(0));

  expect((await runTraceCli(['open', traceFile])).exitCode).toBe(0);
});

test('trace actions --json outputs structured actions', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ traceFile, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['actions', '--json']);
  expect(exitCode).toBe(0);
  expect(stdout).not.toContain('\x1b[');

  const items = JSON.parse(stdout);
  expect(Array.isArray(items)).toBe(true);
  expect(items.length).toBeGreaterThan(0);
  for (const item of items) {
    expect(item).toEqual({
      ordinal: expect.any(Number),
      callId: expect.any(String),
      startTime: expect.any(Number),
      duration: expect.any(Number),
      title: expect.any(String),
      status: 'passed',
      error: null,
    });
  }
  expect(items.some((a: any) => a.title.includes('Navigate'))).toBe(true);
  expect(items.some((a: any) => a.title.includes('Click'))).toBe(true);
  expect(items.some((a: any) => a.title.includes('Fill'))).toBe(true);

  const { stdout: fileAfterFlagStdout, exitCode: fileAfterFlagExit } = await runTraceCli(['actions', traceFile, '--json']);
  expect(fileAfterFlagExit).toBe(0);
  expect(JSON.parse(fileAfterFlagStdout)).toEqual(items);

  const { stdout: globalFlagStdout, exitCode: globalFlagExit } = await runTraceCli(['--json', 'actions', traceFile]);
  expect(globalFlagExit).toBe(0);
  expect(JSON.parse(globalFlagStdout)).toEqual(items);

  const { stdout: filteredStdout, exitCode: filteredExitCode } = await runTraceCli(['actions', '--grep', 'Click', '--json']);
  expect(filteredExitCode).toBe(0);
  const filtered = JSON.parse(filteredStdout);
  expect(filtered.length).toBeGreaterThan(0);
  expect(filtered.every((a: any) => /click/i.test(a.title))).toBe(true);
});

test('trace requests --json outputs structured requests', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ traceFile, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['requests', '--json']);
  expect(exitCode).toBe(0);
  expect(stdout).not.toContain('\x1b[');

  const items = JSON.parse(stdout);
  expect(Array.isArray(items)).toBe(true);
  expect(items.length).toBeGreaterThan(0);

  const feedback = items.find((r: any) => r.url.endsWith('/feedback'));
  expect(feedback).toEqual({
    ordinal: expect.any(Number),
    method: 'POST',
    url: expect.stringContaining('/feedback'),
    status: 200,
    duration: expect.any(Number),
    failure: null,
  });

  const blocked = items.find((r: any) => r.url.endsWith('/blocked'));
  expect(blocked).toEqual({
    ordinal: expect.any(Number),
    method: 'GET',
    url: expect.stringContaining('/blocked'),
    status: -1,
    duration: expect.any(Number),
    failure: expect.any(String),
  });

  expect(JSON.parse((await runTraceCli(['requests', traceFile, '--json'])).stdout)).toEqual(items);
  expect(JSON.parse((await runTraceCli(['--json', 'requests', traceFile])).stdout)).toEqual(items);
});

test('trace console --json outputs structured console messages', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ traceFile, runTraceCli }, testInfo) => {
  const { stdout, exitCode } = await runTraceCli(['console', '--json']);
  expect(exitCode).toBe(0);
  expect(stdout).not.toContain('\x1b[');

  const items = JSON.parse(stdout);
  expect(items).toEqual([
    { ordinal: 1, type: 'log', text: 'info message', location: expect.any(String) },
    { ordinal: 2, type: 'warning', text: 'warning message', location: expect.any(String) },
    { ordinal: 3, type: 'error', text: 'error message', location: expect.any(String) },
    { ordinal: 4, type: 'error', text: expect.stringContaining('Failed to load resource'), location: expect.any(String) },
  ]);

  expect(JSON.parse((await runTraceCli(['console', traceFile, '--json'])).stdout)).toEqual(items);
  expect(JSON.parse((await runTraceCli(['--json', 'console', traceFile])).stdout)).toEqual(items);

  const stdioTrace = testInfo.outputPath('stdio.trace');
  await fs.promises.writeFile(stdioTrace, [
    { type: 'context-options', version: 8, origin: 'library', browserName: 'chromium', options: {}, platform: 'linux', wallTime: 1000, monotonicTime: 0 },
    { type: 'stdout', timestamp: 10, text: 'hello stdout\n' },
  ].map(event => JSON.stringify(event)).join('\n'));
  expect(JSON.parse((await runTraceCli(['console', stdioTrace, '--json'])).stdout)).toEqual([
    { ordinal: 1, type: 'stdout', text: 'hello stdout', location: null },
  ]);
});

test('trace errors --json outputs structured errors', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ traceFile, runTraceCli }, testInfo) => {
  const { stdout: fixtureStdout, exitCode: fixtureExitCode } = await runTraceCli(['errors', '--json']);
  expect(fixtureExitCode).toBe(0);
  const fixtureErrors = JSON.parse(fixtureStdout);
  expect(fixtureErrors).toEqual([
    { type: 'console', message: 'error message', location: expect.any(String) },
    { type: 'console', message: expect.stringContaining('Failed to load resource'), location: expect.any(String) },
  ]);

  expect(JSON.parse((await runTraceCli(['errors', traceFile, '--json'])).stdout)).toEqual(fixtureErrors);
  expect(JSON.parse((await runTraceCli(['--json', 'errors', traceFile])).stdout)).toEqual(fixtureErrors);

  const errorTrace = testInfo.outputPath('errors.trace');
  await fs.promises.writeFile(errorTrace, [
    { type: 'context-options', version: 8, origin: 'library', browserName: 'chromium', options: {}, platform: 'linux', wallTime: 1000, monotonicTime: 0 },
    { type: 'before', callId: 'call@1', startTime: 10, class: 'Frame', method: 'click', params: { selector: '#missing' }, stack: [{ file: '/app/tests/example.spec.ts', line: 14, column: 7 }] },
    { type: 'after', callId: 'call@1', endTime: 50, error: { name: 'TimeoutError', message: 'Timeout 30000ms exceeded.' } },
    { type: 'event', time: 20, class: 'BrowserContext', method: 'pageError', params: { error: { error: { name: 'Error', message: 'boom in page', stack: 'Error: boom in page\n    at http://localhost:3000/app.js:9:3' } } } },
    { type: 'console', time: 30, messageType: 'error', text: 'console failure', location: { url: 'http://localhost:3000/app.js', lineNumber: 12, columnNumber: 1 } },
    { type: 'stderr', timestamp: 40, text: 'stderr failure\n' },
  ].map(event => JSON.stringify(event)).join('\n'));

  const { stdout, exitCode } = await runTraceCli(['errors', errorTrace, '--json']);
  expect(exitCode).toBe(0);
  expect(JSON.parse(stdout)).toEqual([
    { type: 'assertion', message: 'Timeout 30000ms exceeded.', location: 'example.spec.ts:14:7' },
    { type: 'pageError', message: 'boom in page', location: 'app.js:9:3' },
    { type: 'console', message: 'console failure', location: 'app.js:12' },
    { type: 'stderr', message: 'stderr failure', location: null },
  ]);
});

test('empty trace with --json returns empty arrays', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ traceFile, runTraceCli }, testInfo) => {
  const emptyTrace = testInfo.outputPath('empty.trace');
  await fs.promises.writeFile(emptyTrace, JSON.stringify({
    type: 'context-options',
    version: 8,
    origin: 'library',
    browserName: 'chromium',
    options: {},
    platform: process.platform,
    wallTime: 1000,
    monotonicTime: 100,
  }));

  expect((await runTraceCli(['open', emptyTrace])).exitCode).toBe(0);

  for (const subcommand of ['actions', 'requests', 'console', 'errors']) {
    const { stdout, exitCode } = await runTraceCli([subcommand, '--json']);
    expect(exitCode).toBe(0);
    expect(stdout).toBe('[]');
    expect(JSON.parse(stdout)).toEqual([]);
  }

  expect((await runTraceCli(['open', traceFile])).exitCode).toBe(0);
});

test('trace summary on passing trace', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ traceFile, runTraceCli }) => {
  const { stdout: textStdout, exitCode: textExitCode } = await runTraceCli(['summary', traceFile]);
  expect(textExitCode).toBe(0);
  expect(textStdout).toContain('Browser:       chromium');
  expect(textStdout).toContain('Viewport:      800x600');
  expect(textStdout).toContain(`Platform:      ${process.platform}`);
  expect(textStdout).toContain('Duration:');
  expect(textStdout).toMatch(/Actions:\s+\d+ total, \d+ passed, 0 failed/);
  expect(textStdout).not.toContain('First failed:');
  expect(textStdout).toMatch(/Network:\s+\d+ requests \(\d+ ok, 1 errors\)/);
  expect(textStdout).toContain('Console:       2 errors');
  expect(textStdout).toContain('Page errors:   0');

  const { stdout: jsonStdout, exitCode: jsonExitCode } = await runTraceCli(['summary', traceFile, '--json']);
  expect(jsonExitCode).toBe(0);
  const summary = JSON.parse(jsonStdout);
  expect(summary).toEqual({
    browser: 'chromium',
    viewport: { width: 800, height: 600 },
    platform: process.platform,
    testTitle: null,
    duration: expect.any(Number),
    actions: {
      total: expect.any(Number),
      passed: expect.any(Number),
      failed: 0,
      firstFailed: null,
    },
    network: {
      total: expect.any(Number),
      ok: expect.any(Number),
      errors: 1,
    },
    errors: {
      console: 2,
      pageError: 0,
    },
  });
  expect(summary.actions.total).toBeGreaterThan(0);
  expect(summary.actions.passed).toBe(summary.actions.total);

  const { stdout: openSummaryStdout, exitCode: openSummaryExitCode } = await runTraceCli(['summary', '--json']);
  expect(openSummaryExitCode).toBe(0);
  expect(JSON.parse(openSummaryStdout)).toEqual(summary);

  const { stdout: globalJsonStdout, exitCode: globalJsonExitCode } = await runTraceCli(['--json', 'summary', traceFile]);
  expect(globalJsonExitCode).toBe(0);
  expect(JSON.parse(globalJsonStdout)).toEqual(summary);
});

test('trace summary on failing trace', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ runTraceCli }, testInfo) => {
  const failingDir = testInfo.outputPath('failing-trace');
  await fs.promises.mkdir(failingDir, { recursive: true });
  const failingTrace = path.join(failingDir, 'failing.trace');
  const failingNetwork = path.join(failingDir, 'failing.network');

  await fs.promises.writeFile(failingTrace, [
    {
      type: 'context-options',
      version: 8,
      origin: 'library',
      browserName: 'firefox',
      title: 'checkout should succeed',
      options: { viewport: { width: 1280, height: 720 } },
      platform: 'darwin',
      wallTime: 1000,
      monotonicTime: 100,
    },
    { type: 'before', callId: 'call@1', startTime: 110, class: 'Frame', method: 'goto', params: { url: 'http://localhost:3000/' } },
    { type: 'after', callId: 'call@1', endTime: 150 },
    { type: 'before', callId: 'call@2', startTime: 160, class: 'Frame', method: 'click', params: { selector: '#submit' } },
    { type: 'after', callId: 'call@2', endTime: 350, error: { name: 'TimeoutError', message: 'Waiting for #submit failed' } },
    { type: 'console', time: 200, messageType: 'error', text: 'API error 500', location: { url: 'http://localhost:3000/main.js', lineNumber: 4, columnNumber: 2 } },
    { type: 'event', time: 210, class: 'BrowserContext', method: 'pageError', params: { error: { error: { name: 'TypeError', message: 'Cannot read properties of null' } } } },
  ].map(event => JSON.stringify(event)).join('\n'));

  const makeHarResource = (url: string, status: number) => ({
    type: 'resource-snapshot',
    snapshot: {
      _monotonicTime: 120,
      startedDateTime: '2026-01-01T00:00:00.000Z',
      time: 25,
      request: { method: 'GET', url, httpVersion: 'HTTP/1.1', cookies: [], headers: [], queryString: [], headersSize: -1, bodySize: 0 },
      response: { status, statusText: status === 200 ? 'OK' : 'Internal Server Error', httpVersion: 'HTTP/1.1', cookies: [], headers: [], content: { size: 0, mimeType: 'text/plain' }, redirectURL: '', headersSize: -1, bodySize: 0 },
      cache: {},
      timings: { send: 0, wait: 25, receive: 0 },
    },
  });
  await fs.promises.writeFile(failingNetwork, [
    makeHarResource('http://localhost:3000/', 200),
    makeHarResource('http://localhost:3000/api/checkout', 500),
  ].map(event => JSON.stringify(event)).join('\n'));

  const { stdout: textStdout, exitCode: textExitCode } = await runTraceCli(['summary', failingTrace]);
  expect(textExitCode).toBe(0);
  expect(textStdout).toContain('Browser:       firefox');
  expect(textStdout).toContain('Platform:      darwin');
  expect(textStdout).toContain('Viewport:      1280x720');
  expect(textStdout).toContain('Title:         checkout should succeed');
  expect(textStdout).toContain('Duration:      250ms');
  expect(textStdout).toContain('Actions:       2 total, 1 passed, 1 failed');
  expect(textStdout).toContain('First failed:  #2 Click locator(\'#submit\')');
  expect(textStdout).toContain('Network:       2 requests (1 ok, 1 errors)');
  expect(textStdout).toContain('Console:       1 errors');
  expect(textStdout).toContain('Page errors:   1');

  const { stdout: jsonStdout, exitCode: jsonExitCode } = await runTraceCli(['summary', failingTrace, '--json']);
  expect(jsonExitCode).toBe(0);
  expect(JSON.parse(jsonStdout)).toEqual({
    browser: 'firefox',
    viewport: { width: 1280, height: 720 },
    platform: 'darwin',
    testTitle: 'checkout should succeed',
    duration: 250,
    actions: {
      total: 2,
      passed: 1,
      failed: 1,
      firstFailed: {
        ordinal: 2,
        title: 'Click locator(\'#submit\')',
      },
    },
    network: {
      total: 2,
      ok: 1,
      errors: 1,
    },
    errors: {
      console: 1,
      pageError: 1,
    },
  });
});
