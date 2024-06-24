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

import { chromiumVersionLessThan } from '../../config/utils';
import { contextTest as it, expect } from '../../config/browserTest';

it('should work', async function({ page, server }) {
  await page.coverage.startCSSCoverage();
  await page.goto(server.PREFIX + '/csscoverage/simple.html');
  const coverage = await page.coverage.stopCSSCoverage();
  expect(coverage.length).toBe(1);
  expect(coverage[0].url).toContain('/csscoverage/simple.html');
  expect(coverage[0].ranges).toEqual([
    { start: 1, end: 22 }
  ]);
  const range = coverage[0].ranges[0];
  expect(coverage[0].text.substring(range.start, range.end)).toBe('div { color: green; }');
});

it('should report sourceURLs', async function({ page, server }) {
  await page.coverage.startCSSCoverage();
  await page.goto(server.PREFIX + '/csscoverage/sourceurl.html');
  const coverage = await page.coverage.stopCSSCoverage();
  expect(coverage.length).toBe(1);
  expect(coverage[0].url).toBe('nicename.css');
});

it('should report multiple stylesheets', async function({ page, server }) {
  await page.coverage.startCSSCoverage();
  await page.goto(server.PREFIX + '/csscoverage/multiple.html');
  const coverage = await page.coverage.stopCSSCoverage();
  expect(coverage.length).toBe(2);
  coverage.sort((a, b) => a.url.localeCompare(b.url));
  expect(coverage[0].url).toContain('/csscoverage/stylesheet1.css');
  expect(coverage[1].url).toContain('/csscoverage/stylesheet2.css');
});

it('should report stylesheets that have no coverage', async function({ page, server }) {
  await page.coverage.startCSSCoverage();
  await page.goto(server.PREFIX + '/csscoverage/unused.html');
  const coverage = await page.coverage.stopCSSCoverage();
  expect(coverage.length).toBe(1);
  expect(coverage[0].url).toBe('unused.css');
  expect(coverage[0].ranges.length).toBe(0);
});

it('should work with media queries', async function({ page, server, browserVersion }) {
  it.skip(chromiumVersionLessThan(browserVersion, '115.0.5762.0'), 'https://chromium-review.googlesource.com/c/chromium/src/+/4508957');
  await page.coverage.startCSSCoverage();
  await page.goto(server.PREFIX + '/csscoverage/media.html');
  const coverage = await page.coverage.stopCSSCoverage();
  expect(coverage.length).toBe(1);
  expect(coverage[0].url).toContain('/csscoverage/media.html');
  expect(coverage[0].ranges).toEqual([
    { start: 8, end: 15 },
    { start: 17, end: 38 },
  ]);
});

it('should work with complicated usecases', async function({ page, server, browserVersion }) {
  it.skip(chromiumVersionLessThan(browserVersion, '115.0.5762.0'), 'https://chromium-review.googlesource.com/c/chromium/src/+/4508957');
  await page.coverage.startCSSCoverage();
  await page.goto(server.PREFIX + '/csscoverage/involved.html');
  const coverage = await page.coverage.stopCSSCoverage();
  delete coverage[0].text;
  delete coverage[0].url;
  expect(coverage).toEqual(
      [
        {
          'ranges': [
            {
              'start': 149,
              'end': 297
            },
            {
              'start': 306,
              'end': 323
            },
            {
              'start': 327,
              'end': 433
            }
          ]
        }
      ]
  );
});

it('should ignore injected stylesheets', async function({ page, server }) {
  await page.coverage.startCSSCoverage();
  await page.addStyleTag({ content: 'body { margin: 10px;}' });
  // trigger style recalc
  const margin = await page.evaluate(() => window.getComputedStyle(document.body).margin);
  expect(margin).toBe('10px');
  const coverage = await page.coverage.stopCSSCoverage();
  expect(coverage.length).toBe(0);
});

it('should report stylesheets across navigations', async function({ page, server }) {
  await page.coverage.startCSSCoverage({ resetOnNavigation: false });
  await page.goto(server.PREFIX + '/csscoverage/multiple.html');
  await page.goto(server.EMPTY_PAGE);
  const coverage = await page.coverage.stopCSSCoverage();
  expect(coverage.length).toBe(2);
});

it('should NOT report scripts across navigations', async function({ page, server }) {
  await page.coverage.startCSSCoverage(); // Enabled by default.
  await page.goto(server.PREFIX + '/csscoverage/multiple.html');
  await page.goto(server.EMPTY_PAGE);
  const coverage = await page.coverage.stopCSSCoverage();
  expect(coverage.length).toBe(0);
});

it('should work with a recently loaded stylesheet', async function({ page, server }) {
  await page.coverage.startCSSCoverage();
  await page.evaluate(async url => {
    document.body.textContent = 'hello, world';

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
    await new Promise(x => link.onload = x);
    await new Promise(f => window.builtinRequestAnimationFrame(f));
  }, server.PREFIX + '/csscoverage/stylesheet1.css');
  const coverage = await page.coverage.stopCSSCoverage();
  expect(coverage.length).toBe(1);
});
