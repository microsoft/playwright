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
import type * as trace from '../types/trace';
import * as path from 'path';
import * as fs from 'fs';

it('should record trace', async ({browserType, defaultBrowserOptions, server, testOutputPath}) => {
  const artifactsPath = testOutputPath('trace');
  const browser = await browserType.launch({
    ...defaultBrowserOptions,
    artifactsPath,
  });
  const context = await browser.newContext({ recordTrace: true });
  const page = await context.newPage();
  const url = server.PREFIX + '/snapshot/snapshot-with-css.html';
  await page.goto(url);
  await context.close();
  await browser.close();

  const traceFile = path.join(artifactsPath, 'playwright.trace');
  const traceFileContent = await fs.promises.readFile(traceFile, 'utf8');
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

  expect(gotoEvent.snapshot).toBeTruthy();
  expect(fs.existsSync(path.join(artifactsPath, 'trace-resources', gotoEvent.snapshot!.sha1))).toBe(true);
});

it('should require artifactsPath', async ({browserType, defaultBrowserOptions}) => {
  const browser = await browserType.launch({
    ...defaultBrowserOptions,
    artifactsPath: undefined,
  });
  const error = await browser.newContext({ recordTrace: true }).catch(e => e);
  expect(error.message).toContain('"recordTrace" option requires "artifactsPath" to be specified');
  await browser.close();
});
