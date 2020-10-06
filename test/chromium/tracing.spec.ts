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

import { fixtures as playwrightFixtures } from '../fixtures';
import fs from 'fs';
import path from 'path';
import type { ChromiumBrowser } from '../..';

type TestState = {
  outputTraceFile: string;
};
const fixtures = playwrightFixtures.defineTestFixtures<TestState>({
  outputTraceFile: async ({ testInfo }, test) => {
    await test(testInfo.outputPath(path.join(`trace.json`)));
  }
});

const { it, expect, describe } = fixtures;

describe('oopif', (suite, { browserName }) => {
  suite.skip(browserName !== 'chromium');
}, () => {
  it('should output a trace', async ({browser, page, server, outputTraceFile}) => {
    await (browser as ChromiumBrowser).startTracing(page, {screenshots: true, path: outputTraceFile});
    await page.goto(server.PREFIX + '/grid.html');
    await (browser as ChromiumBrowser).stopTracing();
    expect(fs.existsSync(outputTraceFile)).toBe(true);
  });

  it('should create directories as needed', async ({browser, page, server, testInfo}) => {
    const filePath = testInfo.outputPath(path.join('these', 'are', 'directories', 'trace.json'));
    await (browser as ChromiumBrowser).startTracing(page, {screenshots: true, path: filePath});
    await page.goto(server.PREFIX + '/grid.html');
    await (browser as ChromiumBrowser).stopTracing();
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should run with custom categories if provided', async ({browser, page, outputTraceFile}) => {
    await (browser as ChromiumBrowser).startTracing(page, {path: outputTraceFile, categories: ['disabled-by-default-v8.cpu_profiler.hires']});
    await (browser as ChromiumBrowser).stopTracing();

    const traceJson = JSON.parse(fs.readFileSync(outputTraceFile).toString());
    expect(traceJson.metadata['trace-config']).toContain('disabled-by-default-v8.cpu_profiler.hires');
  });

  it('should throw if tracing on two pages', async ({browser, page, outputTraceFile}) => {
    await (browser as ChromiumBrowser).startTracing(page, {path: outputTraceFile});
    const newPage = await browser.newPage();
    let error = null;
    await (browser as ChromiumBrowser).startTracing(newPage, {path: outputTraceFile}).catch(e => error = e);
    await newPage.close();
    expect(error).toBeTruthy();
    await (browser as ChromiumBrowser).stopTracing();
  });

  it('should return a buffer', async ({browser, page, server, outputTraceFile}) => {
    await (browser as ChromiumBrowser).startTracing(page, {screenshots: true, path: outputTraceFile});
    await page.goto(server.PREFIX + '/grid.html');
    const trace = await (browser as ChromiumBrowser).stopTracing();
    const buf = fs.readFileSync(outputTraceFile);
    expect(trace.toString()).toEqual(buf.toString());
  });

  it('should work without options', async ({browser, page, server}) => {
    await (browser as ChromiumBrowser).startTracing(page);
    await page.goto(server.PREFIX + '/grid.html');
    const trace = await (browser as ChromiumBrowser).stopTracing();
    expect(trace).toBeTruthy();
  });

  it('should support a buffer without a path', async ({browser, page, server}) => {
    await (browser as ChromiumBrowser).startTracing(page, {screenshots: true});
    await page.goto(server.PREFIX + '/grid.html');
    const trace = await (browser as ChromiumBrowser).stopTracing();
    expect(trace.toString()).toContain('screenshot');
  });
});
