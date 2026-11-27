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

test('trace actions --json outputs structured actions array', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['actions', '--json']);
  expect(exitCode).toBe(0);
  const actions = JSON.parse(stdout);
  expect(Array.isArray(actions)).toBe(true);
  expect(actions.length).toBeGreaterThan(0);
  expect(actions[0]).toHaveProperty('ordinal');
  expect(actions[0]).toHaveProperty('callId');
  expect(actions[0]).toHaveProperty('title');
  expect(actions[0]).toHaveProperty('status');
  expect(actions[0]).toHaveProperty('durationFormatted');
  // Ordinals should be monotonically increasing
  for (let i = 1; i < actions.length; i++)
    expect(actions[i].ordinal).toBeGreaterThanOrEqual(actions[i - 1].ordinal);
});

test('trace action <id> --json outputs action details in JSON', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['action', '1', '--json']);
  expect(exitCode).toBe(0);
  const action = JSON.parse(stdout);
  expect(action.ordinal).toBe(1);
  expect(action).toHaveProperty('title');
  expect(action).toHaveProperty('params');
  expect(action).toHaveProperty('snapshots');
  expect(action.status).toBe('passed');
});

test('trace action with invalid ID and --json', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ runTraceCli }) => {
  const { stderr, exitCode } = await runTraceCli(['action', '99999', '--json']);
  expect(exitCode).toBe(1);
  expect(stderr).toContain("Action '99999' not found");
});

test('trace requests --json outputs structured requests array', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['requests', '--json']);
  expect(exitCode).toBe(0);
  const requests = JSON.parse(stdout);
  expect(Array.isArray(requests)).toBe(true);
  expect(requests.length).toBeGreaterThan(0);
  expect(requests[0]).toHaveProperty('ordinal');
  expect(requests[0]).toHaveProperty('method');
  expect(requests[0]).toHaveProperty('url');
  expect(requests[0]).toHaveProperty('status');
  expect(requests[0]).toHaveProperty('durationFormatted');
});

test('trace request <id> --json outputs request details in JSON', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['request', '1', '--json']);
  expect(exitCode).toBe(0);
  const request = JSON.parse(stdout);
  expect(request.ordinal).toBe(1);
  expect(request).toHaveProperty('method');
  expect(request).toHaveProperty('url');
  expect(request).toHaveProperty('status');
  expect(request).toHaveProperty('requestHeaders');
  expect(request).toHaveProperty('responseHeaders');
});

test('trace request with invalid ID and --json', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ runTraceCli }) => {
  const { stderr, exitCode } = await runTraceCli(['request', '99999', '--json']);
  expect(exitCode).toBe(1);
  expect(stderr).toContain("Request '99999' not found");
});

test('trace console --json outputs structured console events array', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['console', '--json']);
  expect(exitCode).toBe(0);
  const entries = JSON.parse(stdout);
  expect(Array.isArray(entries)).toBe(true);
  expect(entries.length).toBeGreaterThan(0);
  expect(entries[0]).toHaveProperty('ordinal');
  expect(entries[0]).toHaveProperty('type');
  expect(entries[0]).toHaveProperty('level');
  expect(entries[0]).toHaveProperty('text');
});

test('trace errors --json outputs structured errors array', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['errors', '--json']);
  expect(exitCode).toBe(0);
  const errors = JSON.parse(stdout);
  expect(Array.isArray(errors)).toBe(true);
});

test('trace summary shows execution overview', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['summary']);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Trace Summary');
  expect(stdout).toContain('Status:       PASSED');
  expect(stdout).toContain('Browser:');
  expect(stdout).toContain('Actions:');
  expect(stdout).toContain('Network:');
  expect(stdout).toContain('Errors:');
});

test('trace summary --json outputs structured summary object', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['summary', '--json']);
  expect(exitCode).toBe(0);
  const summary = JSON.parse(stdout);
  expect(summary.status).toBe('passed');
  expect(summary).toHaveProperty('metadata');
  expect(summary.metadata.browser).toBe('chromium');
  expect(summary).toHaveProperty('actions');
  expect(summary.actions.total).toBeGreaterThan(0);
  expect(summary.actions.failed).toBe(0);
  expect(summary).toHaveProperty('network');
  expect(summary).toHaveProperty('errors');
  expect(summary.errors.testErrors).toBe(0);
});

test('trace summary <traceFile> directly summarizes archive', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ traceFile, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['summary', traceFile]);
  expect(exitCode).toBe(0);
  expect(stdout).toContain('Trace Summary');
  expect(stdout).toContain('Status:       PASSED');
  expect(stdout).toContain('Actions:');
});

test('trace summary <traceFile> --json directly outputs summary JSON', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ traceFile, runTraceCli }) => {
  const { stdout, exitCode } = await runTraceCli(['summary', traceFile, '--json']);
  expect(exitCode).toBe(0);
  const summary = JSON.parse(stdout);
  expect(summary.status).toBe('passed');
  expect(summary.metadata.browser).toBe('chromium');
  expect(summary.actions.total).toBeGreaterThan(0);
});

test('trace commands with failed actions and network errors', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ traceCwd, traceFile, runTraceCli }) => {
  const failedTrace = path.join(traceCwd, 'failed.trace');
  await fs.promises.writeFile(failedTrace, [
    { type: 'context-options', version: 10, browserName: 'chromium', wallTime: Date.now(), startTime: 0, endTime: 2000, options: { viewport: { width: 1280, height: 720 } } },
    { type: 'before', callId: 'call@1', startTime: 10, class: 'Test', method: 'step', params: { title: 'step 1' } },
    { type: 'after', callId: 'call@1', endTime: 50 },
    {
      type: 'before',
      callId: 'call@2',
      startTime: 60,
      class: 'Test',
      method: 'step',
      params: { title: 'step 2' },
      stack: [{ file: 'test.spec.ts', line: 42, column: 10 }],
    },
    {
      type: 'after',
      callId: 'call@2',
      endTime: 1000,
      error: {
        message: 'Timeout 5000ms exceeded waiting for locator("button#missing")',
        stack: 'Error: Timeout 5000ms exceeded\n    at test.spec.ts:42:10',
      },
    },
    {
      type: 'resource-snapshot',
      snapshot: {
        _monotonicTime: 100,
        time: 50,
        request: { method: 'POST', url: 'https://example.com/api/data', headers: [] },
        response: { status: 500, statusText: 'Internal Server Error', headers: [], content: { mimeType: 'application/json' }, bodySize: 0 },
      },
    },
    {
      type: 'console',
      messageType: 'error',
      text: 'Unhandled promise rejection in application',
      location: { url: 'https://example.com/app.js', lineNumber: 99 },
      time: 200,
    },
  ].map(event => JSON.stringify(event)).join('\n'));

  expect((await runTraceCli(['open', failedTrace])).exitCode).toBe(0);

  // trace actions --errors-only --json
  const { stdout: actionsOut, exitCode: actionsExit } = await runTraceCli(['actions', '--errors-only', '--json']);
  expect(actionsExit).toBe(0);
  const failedActions = JSON.parse(actionsOut);
  expect(failedActions.length).toBe(1);
  expect(failedActions[0].ordinal).toBe(2);
  expect(failedActions[0].status).toBe('failed');
  expect(failedActions[0].error).toContain('Timeout 5000ms exceeded');

  // trace requests --failed --json
  const { stdout: requestsOut, exitCode: requestsExit } = await runTraceCli(['requests', '--failed', '--json']);
  expect(requestsExit).toBe(0);
  const failedRequests = JSON.parse(requestsOut);
  expect(failedRequests.length).toBe(1);
  expect(failedRequests[0].status).toBe(500);
  expect(failedRequests[0].method).toBe('POST');

  // trace console --errors-only --json
  const { stdout: consoleOut, exitCode: consoleExit } = await runTraceCli(['console', '--errors-only', '--json']);
  expect(consoleExit).toBe(0);
  const consoleErrors = JSON.parse(consoleOut);
  expect(consoleErrors.length).toBe(1);
  expect(consoleErrors[0].level).toBe('error');
  expect(consoleErrors[0].text).toContain('Unhandled promise rejection');

  // trace errors --json
  const { stdout: errorsOut, exitCode: errorsExit } = await runTraceCli(['errors', '--json']);
  expect(errorsExit).toBe(0);
  const errors = JSON.parse(errorsOut);
  expect(errors.length).toBe(1);
  expect(errors[0].actionOrdinal).toBe(2);
  expect(errors[0].message).toContain('Timeout 5000ms exceeded');
  expect(errors[0].stack.length).toBeGreaterThan(0);
  expect(errors[0].stack[0].file).toBe('test.spec.ts');

  // trace summary --json
  const { stdout: summaryJsonOut, exitCode: summaryJsonExit } = await runTraceCli(['summary', '--json']);
  expect(summaryJsonExit).toBe(0);
  const summary = JSON.parse(summaryJsonOut);
  expect(summary.status).toBe('failed');
  expect(summary.actions.total).toBe(2);
  expect(summary.actions.failed).toBe(1);
  expect(summary.actions.firstFailure.ordinal).toBe(2);
  expect(summary.network.failed).toBe(1);
  expect(summary.network.failures[0].status).toBe(500);
  expect(summary.errors.testErrors).toBe(1);
  expect(summary.errors.consoleErrors).toBe(1);

  // trace summary text
  const { stdout: summaryTextOut, exitCode: summaryTextExit } = await runTraceCli(['summary']);
  expect(summaryTextExit).toBe(0);
  expect(summaryTextOut).toContain('Status:       FAILED');
  expect(summaryTextOut).toContain('First Fail:   #2');

  // Reopen original trace to keep environment clean
  expect((await runTraceCli(['open', traceFile])).exitCode).toBe(0);
});

test('trace summary on empty trace handles edge cases safely', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44396' } }, async ({ traceCwd, traceFile, runTraceCli }) => {
  const emptyTrace = path.join(traceCwd, 'empty.trace');
  await fs.promises.writeFile(emptyTrace, '');

  expect((await runTraceCli(['open', emptyTrace])).exitCode).toBe(0);

  const { stdout, exitCode } = await runTraceCli(['summary', '--json']);
  expect(exitCode).toBe(0);
  const summary = JSON.parse(stdout);
  expect(summary.status).toBe('passed');
  expect(summary.metadata.startTime).toBe('unknown');
  expect(summary.metadata.durationMs).toBe(0);
  expect(summary.actions.total).toBe(0);
  expect(summary.network.total).toBe(0);
  expect(summary.errors.total).toBe(0);

  // Reopen original trace
  expect((await runTraceCli(['open', traceFile])).exitCode).toBe(0);
});
