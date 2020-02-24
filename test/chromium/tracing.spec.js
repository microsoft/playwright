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

/**
 * @type {ChromiumTestSuite}
 */
module.exports.describe = function({testRunner, expect, defaultBrowserOptions, playwright, ASSETS_DIR}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Chromium.startTracing', function() {
    beforeEach(async function(state) {
      state.outputFile = path.join(ASSETS_DIR, `trace-${state.parallelIndex}.json`);
      state.browser = await playwright.launch(defaultBrowserOptions);
      state.page = await state.browser.newPage();
    });
    afterEach(async function(state) {
      await state.browser.close();
      state.browser = null;
      state.page = null;
      if (fs.existsSync(state.outputFile)) {
        fs.unlinkSync(state.outputFile);
        state.outputFile = null;
      }
    });
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
    it('should return null in case of Buffer error', async({browser, page, server}) => {
      await browser.startTracing(page, {screenshots: true});
      await page.goto(server.PREFIX + '/grid.html');
      const oldBufferConcat = Buffer.concat;
      Buffer.concat = bufs => {
        throw new Error('Buffer.concat fake error, should be caught by playwright');
      };
      const trace = await browser.stopTracing();
      expect(trace).toEqual(null);
      Buffer.concat = oldBufferConcat;
    });
    it('should support a buffer without a path', async({browser, page, server}) => {
      await browser.startTracing(page, {screenshots: true});
      await page.goto(server.PREFIX + '/grid.html');
      const trace = await browser.stopTracing();
      expect(trace.toString()).toContain('screenshot', 'Does not contain screenshot');
    });
  });
};
