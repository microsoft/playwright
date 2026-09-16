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

import fs from 'fs';
import { test, expect } from './playwright-test-fixtures';
import { parseTraceCoverage } from '../config/utils';

const coverageHelper = `
  const makeCoverage = (file, s0) => ({
    [file]: {
      path: file,
      statementMap: {
        '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        '1': { start: { line: 2, column: 0 }, end: { line: 2, column: 20 } },
      },
      fnMap: {
        '0': { name: 'foo', decl: { start: { line: 1, column: 0 }, end: { line: 1, column: 3 } }, loc: { start: { line: 1, column: 0 }, end: { line: 3, column: 1 } }, line: 1 },
      },
      branchMap: {
        '0': { loc: { start: { line: 2, column: 0 }, end: { line: 2, column: 20 } }, type: 'if', locations: [{ start: { line: 2, column: 0 }, end: { line: 2, column: 10 } }, { start: { line: 2, column: 10 }, end: { line: 2, column: 20 } }], line: 2 },
      },
      s: { '0': s0, '1': 0 },
      f: { '0': 1 },
      b: { '0': [1, 0] },
    },
  });
  const coverageScript = (file, s0) => '<script>window.__coverage__ = ' + JSON.stringify(makeCoverage(file, s0)) + '</script>';
`;

test('should collect istanbul coverage into the trace', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: { trace: { mode: 'on', coverage: true } },
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      ${coverageHelper}
      test('pass', async ({ page }) => {
        const http = require('http');
        const server = http.createServer((req, res) => {
          res.setHeader('Content-Type', 'text/html');
          if (req.url === '/frame')
            res.end(coverageScript('src/frame.js', 3));
          else if (req.url === '/page1')
            res.end(coverageScript('src/app.js', 5) + '<iframe src="/frame"></iframe>');
          else
            res.end(coverageScript('src/app.js', 2));
        });
        await new Promise(f => server.listen(0, '127.0.0.1', f));
        const origin = 'http://127.0.0.1:' + server.address().port;
        await page.goto(origin + '/page1');
        await expect(page.locator('iframe')).toBeVisible();
        // Navigating away parks the first document's counters for the next one.
        await page.goto(origin + '/page2');
        server.close();
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);

  const data = await parseTraceCoverage(test.info().outputPath('test-results', 'a-pass', 'trace.zip'));
  expect(data['src/app.js'].s['0']).toBe(7);
  expect(data['src/app.js'].s['1']).toBe(0);
  expect(data['src/app.js'].f['0']).toBe(2);
  expect(data['src/app.js'].b['0']).toEqual([2, 0]);
  expect(data['src/frame.js'].s['0']).toBe(3);
});

test('should aggregate coverage with the coverage reporter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: { trace: { mode: 'on', coverage: true } },
        reporter: [['dot'], ['coverage', { outputDir: 'coverage-report' }]],
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      ${coverageHelper}
      test('first', async ({ page }) => {
        await page.setContent(coverageScript('src/app.js', 5));
      });
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      ${coverageHelper}
      test('second', async ({ page, browser }) => {
        await page.setContent(coverageScript('src/app.js', 2));
        // Every context of a test keeps its own coverage entry in the trace.
        const second = await browser.newContext();
        await (await second.newPage()).setContent(coverageScript('src/second.js', 4));
        await second.close();
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);

  const final = JSON.parse(fs.readFileSync(test.info().outputPath('coverage-report', 'coverage-final.json'), 'utf8'));
  expect(final['src/app.js'].s['0']).toBe(7);
  expect(final['src/app.js'].s['1']).toBe(0);
  expect(final['src/app.js'].f['0']).toBe(2);
  expect(final['src/app.js'].b['0']).toEqual([2, 0]);
  expect(final['src/second.js'].s['0']).toBe(4);

  const lcov = fs.readFileSync(test.info().outputPath('coverage-report', 'lcov.info'), 'utf8');
  expect(lcov).toContain('SF:src/app.js');
  expect(lcov).toContain('DA:1,7');
  expect(lcov).toContain('FNDA:2,foo');
  expect(lcov).toContain('SF:src/second.js');

  expect(result.output).toContain('Code coverage (2 files)');
  expect(result.output).toContain('statements: 50.00% (2/4)');
});

test('should warn when no coverage was collected', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: { trace: { mode: 'on', coverage: true } },
        reporter: [['dot'], ['coverage', { outputDir: 'coverage-report' }]],
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('no instrumented code', async ({ page }) => {
        await page.setContent('<div>hello</div>');
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('No code coverage was collected');
  expect(fs.existsSync(test.info().outputPath('coverage-report', 'coverage-final.json'))).toBe(false);
});
