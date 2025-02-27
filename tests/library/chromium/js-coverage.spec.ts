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

import { contextTest as it, expect } from '../../config/browserTest';

it.skip(({ trace }) => trace === 'on');

it('should work', async function({ page, server }) {
  await page.coverage.startJSCoverage();
  await page.goto(server.PREFIX + '/jscoverage/simple.html', { waitUntil: 'load' });
  const coverage = await page.coverage.stopJSCoverage();
  expect(coverage.length).toBe(1);
  expect(coverage[0].url).toContain('/jscoverage/simple.html');
  expect(coverage[0].functions.find(f => f.functionName === 'foo').ranges[0].count).toEqual(1);
});

it('should report sourceURLs', async function({ page, server }) {
  await page.coverage.startJSCoverage();
  await page.goto(server.PREFIX + '/jscoverage/sourceurl.html');
  const coverage = await page.coverage.stopJSCoverage();
  expect(coverage.length).toBe(1);
  expect(coverage[0].url).toBe('nicename.js');
});

it('should ignore eval() scripts by default', async function({ page, server }) {
  await page.coverage.startJSCoverage();
  await page.goto(server.PREFIX + '/jscoverage/eval.html');
  const coverage = await page.coverage.stopJSCoverage();
  expect(coverage.length).toBe(1);
});

it('shouldn\'t ignore eval() scripts if reportAnonymousScripts is true', async function({ page, server }) {
  it.skip(!!process.env.PW_CLOCK);
  await page.coverage.startJSCoverage({ reportAnonymousScripts: true });
  await page.goto(server.PREFIX + '/jscoverage/eval.html');
  const coverage = await page.coverage.stopJSCoverage();
  expect(coverage).toContainEqual(expect.objectContaining({
    url: '',
    source: 'console.log("foo")',
  }));
});

it('should report multiple scripts', async function({ page, server }) {
  await page.coverage.startJSCoverage();
  await page.goto(server.PREFIX + '/jscoverage/multiple.html');
  const coverage = await page.coverage.stopJSCoverage();
  expect(coverage.length).toBe(2);
  coverage.sort((a, b) => a.url.localeCompare(b.url));
  expect(coverage[0].url).toContain('/jscoverage/script1.js');
  expect(coverage[1].url).toContain('/jscoverage/script2.js');
});

it('should report scripts across navigations when disabled', async function({ page, server }) {
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await page.goto(server.PREFIX + '/jscoverage/multiple.html');
  await page.goto(server.EMPTY_PAGE);
  const coverage = await page.coverage.stopJSCoverage();
  expect(coverage.length).toBe(2);
});

it('should NOT report scripts across navigations when enabled', async function({ page, server }) {
  await page.coverage.startJSCoverage(); // Enabled by default.
  await page.goto(server.PREFIX + '/jscoverage/multiple.html');
  await page.goto(server.EMPTY_PAGE);
  const coverage = await page.coverage.stopJSCoverage();
  expect(coverage.length).toBe(0);
});

it('should not hang when there is a debugger statement', async function({ page, server }) {
  await page.coverage.startJSCoverage();
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => {
    debugger; // eslint-disable-line no-debugger
  });
  await page.coverage.stopJSCoverage();
});
