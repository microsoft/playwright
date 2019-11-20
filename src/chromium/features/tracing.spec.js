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

module.exports.addTests = function({testRunner, expect, defaultBrowserOptions, playwright, ASSETS_DIR}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Tracing', function() {
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
    it('should output a trace', async({page, server, outputFile}) => {
      await page.tracing.start({screenshots: true, path: outputFile});
      await page.goto(server.PREFIX + '/grid.html');
      await page.tracing.stop();
      expect(fs.existsSync(outputFile)).toBe(true);
    });
    it('should run with custom categories if provided', async({page, outputFile}) => {
      await page.tracing.start({path: outputFile, categories: ['disabled-by-default-v8.cpu_profiler.hires']});
      await page.tracing.stop();

      const traceJson = JSON.parse(fs.readFileSync(outputFile).toString());
      expect(traceJson.metadata['trace-config']).toContain('disabled-by-default-v8.cpu_profiler.hires');
    });
    it('should throw if tracing on two pages', async({page, server, browser, outputFile}) => {
      await page.tracing.start({path: outputFile});
      const newPage = await browser.newPage();
      let error = null;
      await newPage.tracing.start({path: outputFile}).catch(e => error = e);
      await newPage.close();
      expect(error).toBeTruthy();
      await page.tracing.stop();
    });
    it('should return a buffer', async({page, server, outputFile}) => {
      await page.tracing.start({screenshots: true, path: outputFile});
      await page.goto(server.PREFIX + '/grid.html');
      const trace = await page.tracing.stop();
      const buf = fs.readFileSync(outputFile);
      expect(trace.toString()).toEqual(buf.toString());
    });
    it('should work without options', async({page, server, outputFile}) => {
      await page.tracing.start();
      await page.goto(server.PREFIX + '/grid.html');
      const trace = await page.tracing.stop();
      expect(trace).toBeTruthy();
    });
    it('should return null in case of Buffer error', async({page, server}) => {
      await page.tracing.start({screenshots: true});
      await page.goto(server.PREFIX + '/grid.html');
      const oldBufferConcat = Buffer.concat;
      Buffer.concat = bufs => {
        throw 'error';
      };
      const trace = await page.tracing.stop();
      expect(trace).toEqual(null);
      Buffer.concat = oldBufferConcat;
    });
    it('should support a buffer without a path', async({page, server}) => {
      await page.tracing.start({screenshots: true});
      await page.goto(server.PREFIX + '/grid.html');
      const trace = await page.tracing.stop();
      expect(trace.toString()).toContain('screenshot');
    });
  });
};
