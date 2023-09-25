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

import { browserTest as it, expect } from '../../config/browserTest';
import fs from 'fs';
import path from 'path';

it('should output a trace', async ({ browser, server }, testInfo) => {
  let warning = null;
  const warningHandler = w => warning = w;
  process.on('warning', warningHandler);

  const page = await browser.newPage();
  const outputTraceFile = testInfo.outputPath(path.join(`trace.json`));
  await browser.startTracing(page, { screenshots: true, path: outputTraceFile });
  for (let i = 0; i < 20; i++)
    await page.goto(server.PREFIX + '/grid.html');
  await browser.stopTracing();
  expect(fs.existsSync(outputTraceFile)).toBe(true);
  await page.close();

  process.off('warning', warningHandler);
  expect(warning).toBe(null);
});

it('should create directories as needed', async ({ browser, server }, testInfo) => {
  const page = await browser.newPage();
  const filePath = testInfo.outputPath(path.join('these', 'are', 'directories', 'trace.json'));
  await browser.startTracing(page, { screenshots: true, path: filePath });
  await page.goto(server.PREFIX + '/grid.html');
  await browser.stopTracing();
  expect(fs.existsSync(filePath)).toBe(true);
  await page.close();
});

it('should run with custom categories if provided', async ({ browser }, testInfo) => {
  const page = await browser.newPage();
  const outputTraceFile = testInfo.outputPath(path.join(`trace.json`));
  await browser.startTracing(page, { path: outputTraceFile, categories: ['disabled-by-default-v8.cpu_profiler.hires'] });
  await browser.stopTracing();

  const traceJson = JSON.parse(fs.readFileSync(outputTraceFile).toString());
  expect(traceJson.metadata['trace-config']).toContain('disabled-by-default-v8.cpu_profiler.hires');
  await page.close();
});

it('should throw if tracing on two pages', async ({ browser }, testInfo) => {
  const page = await browser.newPage();
  const outputTraceFile = testInfo.outputPath(path.join(`trace.json`));
  await browser.startTracing(page, { path: outputTraceFile });
  const newPage = await browser.newPage();
  let error = null;
  await browser.startTracing(newPage, { path: outputTraceFile }).catch(e => error = e);
  await newPage.close();
  expect(error).toBeTruthy();
  await browser.stopTracing();
  await page.close();
});

it('should return a buffer', async ({ browser, server }, testInfo) => {
  const page = await browser.newPage();
  const outputTraceFile = testInfo.outputPath(path.join(`trace.json`));
  await browser.startTracing(page, { screenshots: true, path: outputTraceFile });
  await page.goto(server.PREFIX + '/grid.html');
  const trace = await browser.stopTracing();
  const buf = fs.readFileSync(outputTraceFile);
  expect(trace.toString()).toEqual(buf.toString());
  await page.close();
});

it('should work without options', async ({ browser, server }) => {
  const page = await browser.newPage();
  await browser.startTracing(page);
  await page.goto(server.PREFIX + '/grid.html');
  const trace = await browser.stopTracing();
  expect(trace).toBeTruthy();
  await page.close();
});

it('should support a buffer without a path', async ({ browser, server }) => {
  const page = await browser.newPage();
  await browser.startTracing(page, { screenshots: true });
  await page.goto(server.PREFIX + '/grid.html');
  const trace = await browser.stopTracing();
  expect(trace.toString()).toContain('screenshot');
  await page.close();
});
