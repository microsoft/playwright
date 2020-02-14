/**
 * Copyright 2018 Google Inc. All rights reserved.
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

/**
 * @type {ChromiumTestSuite}
 */
module.exports.describe = function({testRunner, expect, FFOX, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('JSCoverage', function() {
    it('should work', async function({page, server}) {
      await page.coverage.startJSCoverage();
      await page.goto(server.PREFIX + '/jscoverage/simple.html', { waitUntil: 'load' });
      const coverage = await page.coverage.stopJSCoverage();
      expect(coverage.length).toBe(1);
      expect(coverage[0].url).toContain('/jscoverage/simple.html');
      expect(coverage[0].functions.find(f => f.functionName === 'foo').ranges[0].count).toEqual(1);
    });
    it('should report sourceURLs', async function({page, server}) {
      await page.coverage.startJSCoverage();
      await page.goto(server.PREFIX + '/jscoverage/sourceurl.html');
      const coverage = await page.coverage.stopJSCoverage();
      expect(coverage.length).toBe(1);
      expect(coverage[0].url).toBe('nicename.js');
    });
    it('should ignore eval() scripts by default', async function({page, server}) {
      await page.coverage.startJSCoverage();
      await page.goto(server.PREFIX + '/jscoverage/eval.html');
      const coverage = await page.coverage.stopJSCoverage();
      expect(coverage.length).toBe(1);
    });
    it('shouldn\'t ignore eval() scripts if reportAnonymousScripts is true', async function({page, server}) {
      await page.coverage.startJSCoverage({reportAnonymousScripts: true});
      await page.goto(server.PREFIX + '/jscoverage/eval.html');
      const coverage = await page.coverage.stopJSCoverage();
      expect(coverage.find(entry => entry.url.startsWith('debugger://'))).not.toBe(null);
      expect(coverage.length).toBe(2);
    });
    it('should ignore playwright internal scripts if reportAnonymousScripts is true', async function({page, server}) {
      await page.coverage.startJSCoverage({reportAnonymousScripts: true});
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate('console.log("foo")');
      await page.evaluate(() => console.log('bar'));
      const coverage = await page.coverage.stopJSCoverage();
      expect(coverage.length).toBe(0);
    });
    it('should report multiple scripts', async function({page, server}) {
      await page.coverage.startJSCoverage();
      await page.goto(server.PREFIX + '/jscoverage/multiple.html');
      const coverage = await page.coverage.stopJSCoverage();
      expect(coverage.length).toBe(2);
      coverage.sort((a, b) => a.url.localeCompare(b.url));
      expect(coverage[0].url).toContain('/jscoverage/script1.js');
      expect(coverage[1].url).toContain('/jscoverage/script2.js');
    });
    describe('resetOnNavigation', function() {
      it('should report scripts across navigations when disabled', async function({page, server}) {
        await page.coverage.startJSCoverage({resetOnNavigation: false});
        await page.goto(server.PREFIX + '/jscoverage/multiple.html');
        await page.goto(server.EMPTY_PAGE);
        const coverage = await page.coverage.stopJSCoverage();
        expect(coverage.length).toBe(2);
      });
      it('should NOT report scripts across navigations when enabled', async function({page, server}) {
        await page.coverage.startJSCoverage(); // Enabled by default.
        await page.goto(server.PREFIX + '/jscoverage/multiple.html');
        await page.goto(server.EMPTY_PAGE);
        const coverage = await page.coverage.stopJSCoverage();
        expect(coverage.length).toBe(0);
      });
    });
    it('should not hang when there is a debugger statement', async function({page, server}) {
      await page.coverage.startJSCoverage();
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => {
        debugger; // eslint-disable-line no-debugger
      });
      await page.coverage.stopJSCoverage();
    });
  });

  describe('CSSCoverage', function() {
    it('should work', async function({page, server}) {
      await page.coverage.startCSSCoverage();
      await page.goto(server.PREFIX + '/csscoverage/simple.html');
      const coverage = await page.coverage.stopCSSCoverage();
      expect(coverage.length).toBe(1);
      expect(coverage[0].url).toContain('/csscoverage/simple.html');
      expect(coverage[0].ranges).toEqual([
        {start: 1, end: 22}
      ]);
      const range = coverage[0].ranges[0];
      expect(coverage[0].text.substring(range.start, range.end)).toBe('div { color: green; }');
    });
    it('should report sourceURLs', async function({page, server}) {
      await page.coverage.startCSSCoverage();
      await page.goto(server.PREFIX + '/csscoverage/sourceurl.html');
      const coverage = await page.coverage.stopCSSCoverage();
      expect(coverage.length).toBe(1);
      expect(coverage[0].url).toBe('nicename.css');
    });
    it('should report multiple stylesheets', async function({page, server}) {
      await page.coverage.startCSSCoverage();
      await page.goto(server.PREFIX + '/csscoverage/multiple.html');
      const coverage = await page.coverage.stopCSSCoverage();
      expect(coverage.length).toBe(2);
      coverage.sort((a, b) => a.url.localeCompare(b.url));
      expect(coverage[0].url).toContain('/csscoverage/stylesheet1.css');
      expect(coverage[1].url).toContain('/csscoverage/stylesheet2.css');
    });
    it('should report stylesheets that have no coverage', async function({page, server}) {
      await page.coverage.startCSSCoverage();
      await page.goto(server.PREFIX + '/csscoverage/unused.html');
      const coverage = await page.coverage.stopCSSCoverage();
      expect(coverage.length).toBe(1);
      expect(coverage[0].url).toBe('unused.css');
      expect(coverage[0].ranges.length).toBe(0);
    });
    it('should work with media queries', async function({page, server}) {
      await page.coverage.startCSSCoverage();
      await page.goto(server.PREFIX + '/csscoverage/media.html');
      const coverage = await page.coverage.stopCSSCoverage();
      expect(coverage.length).toBe(1);
      expect(coverage[0].url).toContain('/csscoverage/media.html');
      expect(coverage[0].ranges).toEqual([
        {start: 17, end: 38}
      ]);
    });
    it('should work with complicated usecases', async function({page, server}) {
      await page.coverage.startCSSCoverage();
      await page.goto(server.PREFIX + '/csscoverage/involved.html');
      const coverage = await page.coverage.stopCSSCoverage();
      expect(JSON.stringify(coverage, null, 2).replace(/:\d{4}\//g, ':<PORT>/')).toBeGolden('csscoverage-involved.txt');
    });
    it('should ignore injected stylesheets', async function({page, server}) {
      await page.coverage.startCSSCoverage();
      await page.addStyleTag({content: 'body { margin: 10px;}'});
      // trigger style recalc
      const margin = await page.evaluate(() => window.getComputedStyle(document.body).margin);
      expect(margin).toBe('10px');
      const coverage = await page.coverage.stopCSSCoverage();
      expect(coverage.length).toBe(0);
    });
    describe('resetOnNavigation', function() {
      it('should report stylesheets across navigations', async function({page, server}) {
        await page.coverage.startCSSCoverage({resetOnNavigation: false});
        await page.goto(server.PREFIX + '/csscoverage/multiple.html');
        await page.goto(server.EMPTY_PAGE);
        const coverage = await page.coverage.stopCSSCoverage();
        expect(coverage.length).toBe(2);
      });
      it('should NOT report scripts across navigations', async function({page, server}) {
        await page.coverage.startCSSCoverage(); // Enabled by default.
        await page.goto(server.PREFIX + '/csscoverage/multiple.html');
        await page.goto(server.EMPTY_PAGE);
        const coverage = await page.coverage.stopCSSCoverage();
        expect(coverage.length).toBe(0);
      });
    });
    it('should work with a recently loaded stylesheet', async function({page, server}) {
      await page.coverage.startCSSCoverage();
      await page.evaluate(async url => {
        document.body.textContent = 'hello, world';

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        document.head.appendChild(link);
        await new Promise(x => link.onload = x);
        await new Promise(f => requestAnimationFrame(f));
      }, server.PREFIX + '/csscoverage/stylesheet1.css');
      const coverage = await page.coverage.stopCSSCoverage();
      expect(coverage.length).toBe(1);
    });
  });
};
