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

const fs = require('fs');
const path = require('path');
const {output, CHANNEL} = require('../utils');
const {FIREFOX, CHROMIUM, WEBKIT} = require('playwright-runner');
const expect = require('expect');
const {browserEnv} = require('../environments/browser');
const {serverEnv} = require('../environments/server');
if (!CHROMIUM)
  return;
let traceNum = 0;
const {it} = serverEnv.mixin(browserEnv).extend({
  async beforeEach({browser}) {
    const page = await browser.newPage();
    const outputFile = output(`trace-${traceNum++}.json`);
    return {page, outputFile};
  },
  async afterEach({outputFile}) {
    if (fs.existsSync(outputFile))
      fs.unlinkSync(outputFile);
  }
})
describe('Chromium.startTracing', function() {
  it('should output a trace', async({browser, page, server, outputFile}) => {
    await browser.startTracing(page, {screenshots: true, path: outputFile});
    await page.goto(server.PREFIX + '/grid.html');
    await browser.stopTracing();
    expect(fs.existsSync(outputFile)).toBe(true);
  });
  it('should run with custom categories if provided', async({browser, page, outputFile}) => {
    await browser.startTracing(page, {path: outputFile, categories: ['disabled-by-default-v8.cpu_profiler.hires']});
    await browser.stopTracing();

    const traceJson = JSON.parse(fs.readFileSync(outputFile).toString());
    expect(traceJson.metadata['trace-config']).toContain('disabled-by-default-v8.cpu_profiler.hires', 'Does not contain expected category');
  });
  it('should throw if tracing on two pages', async({browser, page, server, outputFile}) => {
    await browser.startTracing(page, {path: outputFile});
    const newPage = await browser.newPage();
    let error = null;
    await browser.startTracing(newPage, {path: outputFile}).catch(e => error = e);
    await newPage.close();
    expect(error).toBeTruthy();
    await browser.stopTracing();
  });
  it('should return a buffer', async({browser, page, server, outputFile}) => {
    await browser.startTracing(page, {screenshots: true, path: outputFile});
    await page.goto(server.PREFIX + '/grid.html');
    const trace = await browser.stopTracing();
    const buf = fs.readFileSync(outputFile);
    expect(trace.toString()).toEqual(buf.toString(), 'Tracing buffer mismatch');
  });
  it('should work without options', async({browser, page, server, outputFile}) => {
    await browser.startTracing(page);
    await page.goto(server.PREFIX + '/grid.html');
    const trace = await browser.stopTracing();
    expect(trace).toBeTruthy();
  });
  it('should support a buffer without a path', async({browser, page, server}) => {
    await browser.startTracing(page, {screenshots: true});
    await page.goto(server.PREFIX + '/grid.html');
    const trace = await browser.stopTracing();
    expect(trace.toString()).toContain('screenshot', 'Does not contain screenshot');
  });
});
