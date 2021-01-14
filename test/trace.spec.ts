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
import type * as trace from '../src/trace/traceTypes';
import * as path from 'path';
import * as fs from 'fs';

it('should record trace', async ({browser, testInfo, server}) => {
  const artifactsPath = testInfo.outputPath('');
  const tracePath = path.join(artifactsPath, 'playwright.trace');
  const context = await browser.newContext({ _tracePath: tracePath } as any);
  const page = await context.newPage();
  const url = server.PREFIX + '/snapshot/snapshot-with-css.html';
  await page.goto(url);
  await context.close();

  const traceFileContent = await fs.promises.readFile(tracePath, 'utf8');
  const traceEvents = traceFileContent.split('\n').filter(line => !!line).map(line => JSON.parse(line)) as trace.TraceEvent[];

  const contextEvent = traceEvents.find(event => event.type === 'context-created') as trace.ContextCreatedTraceEvent;
  expect(contextEvent).toBeTruthy();
  const contextId = contextEvent.contextId;

  const pageEvent = traceEvents.find(event => event.type === 'page-created') as trace.PageCreatedTraceEvent;
  expect(pageEvent).toBeTruthy();
  expect(pageEvent.contextId).toBe(contextId);
  const pageId = pageEvent.pageId;

  const gotoEvent = traceEvents.find(event => event.type === 'action' && event.action === 'goto') as trace.ActionTraceEvent;
  expect(gotoEvent).toBeTruthy();
  expect(gotoEvent.contextId).toBe(contextId);
  expect(gotoEvent.pageId).toBe(pageId);
  expect(gotoEvent.value).toBe(url);

  const resourceEvent = traceEvents.find(event => event.type === 'resource' && event.url.endsWith('/frames/style.css')) as trace.NetworkResourceTraceEvent;
  expect(resourceEvent).toBeTruthy();
  expect(resourceEvent.contextId).toBe(contextId);
  expect(resourceEvent.pageId).toBe(pageId);
  expect(resourceEvent.method).toBe('GET');
  expect(resourceEvent.status).toBe(200);
  expect(resourceEvent.requestHeaders).toBeTruthy();
  expect(resourceEvent.requestHeaders.length).toBeGreaterThan(0);
  expect(resourceEvent.requestSha1).toBe('none');

  expect(gotoEvent.snapshot).toBeTruthy();
  expect(fs.existsSync(path.join(artifactsPath, 'trace-resources', gotoEvent.snapshot!.sha1))).toBe(true);
});

it('should record trace with POST', async ({browser, testInfo, server}) => {
  const artifactsPath = testInfo.outputPath('');
  const tracePath = path.join(artifactsPath, 'playwright.trace');
  const context = await browser.newContext({ _tracePath: tracePath } as any);
  const page = await context.newPage();
  const url = server.PREFIX + '/trace-resources.html';
  await page.goto(url);
  await page.click('text=Download');
  await context.close();

  const traceFileContent = await fs.promises.readFile(tracePath, 'utf8');
  const traceEvents = traceFileContent.split('\n').filter(line => !!line).map(line => JSON.parse(line)) as trace.TraceEvent[];

  const contextEvent = traceEvents.find(event => event.type === 'context-created') as trace.ContextCreatedTraceEvent;
  expect(contextEvent).toBeTruthy();
  const contextId = contextEvent.contextId;

  const pageEvent = traceEvents.find(event => event.type === 'page-created') as trace.PageCreatedTraceEvent;
  expect(pageEvent).toBeTruthy();
  expect(pageEvent.contextId).toBe(contextId);
  const pageId = pageEvent.pageId;

  const gotoEvent = traceEvents.find(event => event.type === 'action' && event.action === 'goto') as trace.ActionTraceEvent;
  expect(gotoEvent).toBeTruthy();
  expect(gotoEvent.contextId).toBe(contextId);
  expect(gotoEvent.pageId).toBe(pageId);
  expect(gotoEvent.value).toBe(url);

  const resourceEvent = traceEvents.find(event => event.type === 'resource' && event.url.endsWith('/file.json')) as trace.NetworkResourceTraceEvent;
  expect(resourceEvent).toBeTruthy();
  expect(resourceEvent.contextId).toBe(contextId);
  expect(resourceEvent.pageId).toBe(pageId);
  expect(resourceEvent.method).toBe('POST');
  expect(resourceEvent.status).toBe(404);
  expect(resourceEvent.requestHeaders).toBeTruthy();
  expect(resourceEvent.requestHeaders.length).toBeGreaterThan(0);
  expect(resourceEvent.requestSha1).toBeTruthy();
  expect(resourceEvent.sha1).toBeTruthy();

  expect(fs.existsSync(path.join(artifactsPath, 'trace-resources', resourceEvent.requestSha1))).toBe(true);
  expect(fs.existsSync(path.join(artifactsPath, 'trace-resources', resourceEvent.sha1))).toBe(true);
});
