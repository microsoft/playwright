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

import { it, expect } from './fixtures';
import type * as trace from '../src/server/trace/common/traceEvents';
import path from 'path';
import fs from 'fs';

it('should record trace', (test, { browserName, platform }) => {
  test.fixme();
}, async ({browser, testInfo, server}) => {
  const traceDir = testInfo.outputPath('trace');
  const context = await browser.newContext({ _traceDir: traceDir } as any);
  const page = await context.newPage();
  const url = server.PREFIX + '/snapshot/snapshot-with-css.html';
  await page.goto(url);
  await page.click('textarea');
  await context.close();
  const tracePath = path.join(traceDir, fs.readdirSync(traceDir).find(n => n.endsWith('.trace')));
  const traceFileContent = await fs.promises.readFile(tracePath, 'utf8');
  const traceEvents = traceFileContent.split('\n').filter(line => !!line).map(line => JSON.parse(line)) as trace.TraceEvent[];

  const contextEvent = traceEvents.find(event => event.type === 'context-created') as trace.ContextCreatedTraceEvent;
  expect(contextEvent).toBeTruthy();
  expect(contextEvent.debugName).toBeUndefined();
  const contextId = contextEvent.contextId;

  const pageEvent = traceEvents.find(event => event.type === 'page-created') as trace.PageCreatedTraceEvent;
  expect(pageEvent).toBeTruthy();
  expect(pageEvent.contextId).toBe(contextId);
  const pageId = pageEvent.pageId;

  const gotoEvent = traceEvents.find(event => event.type === 'action' && event.method === 'goto') as trace.ActionTraceEvent;
  expect(gotoEvent).toBeTruthy();
  expect(gotoEvent.contextId).toBe(contextId);
  expect(gotoEvent.pageId).toBe(pageId);
  expect(gotoEvent.params.url).toBe(url);

  const resourceEvent = traceEvents.find(event => event.type === 'resource' && event.url.endsWith('/frames/style.css')) as trace.NetworkResourceTraceEvent;
  expect(resourceEvent).toBeTruthy();
  expect(resourceEvent.contextId).toBe(contextId);
  expect(resourceEvent.pageId).toBe(pageId);
  expect(resourceEvent.method).toBe('GET');
  expect(resourceEvent.status).toBe(200);
  expect(resourceEvent.requestHeaders).toBeTruthy();
  expect(resourceEvent.requestHeaders.length).toBeGreaterThan(0);
  expect(resourceEvent.requestSha1).toBe('none');

  const clickEvent = traceEvents.find(event => event.type === 'action' && event.method === 'click') as trace.ActionTraceEvent;
  expect(clickEvent).toBeTruthy();
  expect(clickEvent.snapshots.length).toBe(2);
  const snapshotId = clickEvent.snapshots[0].snapshotId;
  const snapshotEvent = traceEvents.find(event => event.type === 'snapshot' && event.snapshot.snapshotId === snapshotId) as trace.FrameSnapshotTraceEvent;
  expect(snapshotEvent).toBeTruthy();
});

it('should record trace with POST', (test, { browserName, platform }) => {
  test.fixme();
}, async ({browser, testInfo, server}) => {
  const traceDir = testInfo.outputPath('trace');
  const context = await browser.newContext({ _traceDir: traceDir } as any);
  const page = await context.newPage();
  const url = server.PREFIX + '/trace-resources.html';
  await page.goto(url);
  await page.click('text=Download');
  await page.waitForSelector(`#response-status:text("404")`);
  await context.close();

  const tracePath = path.join(traceDir, fs.readdirSync(traceDir).find(n => n.endsWith('.trace')));
  const traceFileContent = await fs.promises.readFile(tracePath, 'utf8');
  const traceEvents = traceFileContent.split('\n').filter(line => !!line).map(line => JSON.parse(line)) as trace.TraceEvent[];

  const contextEvent = traceEvents.find(event => event.type === 'context-created') as trace.ContextCreatedTraceEvent;
  expect(contextEvent).toBeTruthy();
  expect(contextEvent.debugName).toBeUndefined();
  const contextId = contextEvent.contextId;

  const pageEvent = traceEvents.find(event => event.type === 'page-created') as trace.PageCreatedTraceEvent;
  expect(pageEvent).toBeTruthy();
  expect(pageEvent.contextId).toBe(contextId);
  const pageId = pageEvent.pageId;

  const gotoEvent = traceEvents.find(event => event.type === 'action' && event.method === 'goto') as trace.ActionTraceEvent;
  expect(gotoEvent).toBeTruthy();
  expect(gotoEvent.contextId).toBe(contextId);
  expect(gotoEvent.pageId).toBe(pageId);
  expect(gotoEvent.params.url).toBe(url);

  const resourceEvent = traceEvents.find(event => event.type === 'resource' && event.url.endsWith('/file.json')) as trace.NetworkResourceTraceEvent;
  expect(resourceEvent).toBeTruthy();
  expect(resourceEvent.contextId).toBe(contextId);
  expect(resourceEvent.pageId).toBe(pageId);
  expect(resourceEvent.method).toBe('POST');
  expect(resourceEvent.status).toBe(404);
  expect(resourceEvent.requestHeaders).toBeTruthy();
  expect(resourceEvent.requestHeaders.length).toBeGreaterThan(0);
  expect(resourceEvent.requestSha1).toBeTruthy();
  expect(resourceEvent.responseSha1).toBeTruthy();

  expect(fs.existsSync(path.join(traceDir, 'resources', resourceEvent.requestSha1))).toBe(true);
  expect(fs.existsSync(path.join(traceDir, 'resources', resourceEvent.responseSha1))).toBe(true);
});

it('should record trace with a debugName', (test, { browserName, platform }) => {
  test.fixme();
}, async ({browser, testInfo, server}) => {
  const traceDir = testInfo.outputPath('trace');
  const debugName = 'Custom testcase name';
  const context = await browser.newContext({ _traceDir: traceDir, _debugName: debugName } as any);
  await context.close();
  const tracePath = path.join(traceDir, fs.readdirSync(traceDir).find(n => n.endsWith('.trace')));
  const traceFileContent = await fs.promises.readFile(tracePath, 'utf8');
  const traceEvents = traceFileContent.split('\n').filter(line => !!line).map(line => JSON.parse(line)) as trace.TraceEvent[];

  const contextEvent = traceEvents.find(event => event.type === 'context-created') as trace.ContextCreatedTraceEvent;
  expect(contextEvent).toBeTruthy();
  expect(contextEvent.debugName).toBe(debugName);
});
