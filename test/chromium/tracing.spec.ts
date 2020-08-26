/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { options } from '../playwright.fixtures';
import { registerFixture } from '../../test-runner';

import fs from 'fs';
import path from 'path';
import type { ChromiumBrowser } from '../..';

declare global {
  interface TestState {
    outputFile: string;
  }
}

registerFixture('outputFile', async ({tmpDir}, test) => {
  const outputFile = path.join(tmpDir, `trace.json`);
  await test(outputFile);
  if (fs.existsSync(outputFile))
    fs.unlinkSync(outputFile);
});

it.skip(!options.CHROMIUM)('should output a trace', async({browser, page, server, outputFile}) => {
  await (browser as ChromiumBrowser).startTracing(page, {screenshots: true, path: outputFile});
  await page.goto(server.PREFIX + '/grid.html');
  await (browser as ChromiumBrowser).stopTracing();
  expect(fs.existsSync(outputFile)).toBe(true);
});

it.skip(!options.CHROMIUM)('should create directories as needed', async({browser, page, server, tmpDir}) => {
  const filePath = path.join(tmpDir, 'these', 'are', 'directories');
  await (browser as ChromiumBrowser).startTracing(page, {screenshots: true, path: filePath});
  await page.goto(server.PREFIX + '/grid.html');
  await (browser as ChromiumBrowser).stopTracing();
  expect(fs.existsSync(filePath)).toBe(true);
});

it.skip(!options.CHROMIUM)('should run with custom categories if provided', async({browser, page, outputFile}) => {
  await (browser as ChromiumBrowser).startTracing(page, {path: outputFile, categories: ['disabled-by-default-v8.cpu_profiler.hires']});
  await (browser as ChromiumBrowser).stopTracing();

  const traceJson = JSON.parse(fs.readFileSync(outputFile).toString());
  expect(traceJson.metadata['trace-config']).toContain('disabled-by-default-v8.cpu_profiler.hires');
});

it.skip(!options.CHROMIUM)('should throw if tracing on two pages', async({browser, page, outputFile}) => {
  await (browser as ChromiumBrowser).startTracing(page, {path: outputFile});
  const newPage = await browser.newPage();
  let error = null;
  await (browser as ChromiumBrowser).startTracing(newPage, {path: outputFile}).catch(e => error = e);
  await newPage.close();
  expect(error).toBeTruthy();
  await (browser as ChromiumBrowser).stopTracing();
});

it.skip(!options.CHROMIUM)('should return a buffer', async({browser, page, server, outputFile}) => {
  await (browser as ChromiumBrowser).startTracing(page, {screenshots: true, path: outputFile});
  await page.goto(server.PREFIX + '/grid.html');
  const trace = await (browser as ChromiumBrowser).stopTracing();
  const buf = fs.readFileSync(outputFile);
  expect(trace.toString()).toEqual(buf.toString());
});

it.skip(!options.CHROMIUM)('should work without options', async({browser, page, server}) => {
  await (browser as ChromiumBrowser).startTracing(page);
  await page.goto(server.PREFIX + '/grid.html');
  const trace = await (browser as ChromiumBrowser).stopTracing();
  expect(trace).toBeTruthy();
});

it.skip(!options.CHROMIUM)('should support a buffer without a path', async({browser, page, server}) => {
  await (browser as ChromiumBrowser).startTracing(page, {screenshots: true});
  await page.goto(server.PREFIX + '/grid.html');
  const trace = await (browser as ChromiumBrowser).stopTracing();
  expect(trace.toString()).toContain('screenshot');
});
