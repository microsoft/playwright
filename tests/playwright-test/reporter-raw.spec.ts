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
import path from 'path';
import { test, expect } from './playwright-test-fixtures';

const kRawReporterPath = path.join(__dirname, '..', '..', 'packages', 'playwright-test', 'lib', 'reporters', 'raw.js');

test('should generate raw report', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('passes', async ({ page }, testInfo) => {});
    `,
  }, { reporter: 'dot,' + kRawReporterPath });
  const json = JSON.parse(fs.readFileSync(testInfo.outputPath('test-results', 'report', 'project.report'), 'utf-8'));
  expect(json.config).toBeTruthy();
  expect(json.project).toBeTruthy();
  expect(result.exitCode).toBe(0);
});

test('should use project name', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [{
          name: 'project-name',
          outputDir: 'output'
        }]
      }
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('passes', async ({ page }, testInfo) => {});
    `,
  }, { reporter: 'dot,' + kRawReporterPath });
  const json = JSON.parse(fs.readFileSync(testInfo.outputPath('output', 'report', 'project-name.report'), 'utf-8'));
  expect(json.project.name).toBe('project-name');
  expect(result.exitCode).toBe(0);
});

test('should save stdio', async ({ runInlineTest }, testInfo) => {
  await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('passes', async ({ page }, testInfo) => {
        console.log('STDOUT');
        process.stdout.write(Buffer.from([1, 2, 3]));
        console.error('STDERR');
        process.stderr.write(Buffer.from([4, 5, 6]));
      });
    `,
  }, { reporter: 'dot,' + kRawReporterPath });
  const json = JSON.parse(fs.readFileSync(testInfo.outputPath('test-results', 'report', 'project.report'), 'utf-8'));
  const result = json.suites[0].tests[0].results[0];
  expect(result.attachments).toEqual([
    { name: 'stdout', contentType: 'text/plain', body: 'STDOUT\n' },
    {
      name: 'stdout',
      contentType: 'application/octet-stream',
      body: { data: [1, 2, 3], type: 'Buffer' }
    },
    { name: 'stderr', contentType: 'text/plain', body: 'STDERR\n' },
    {
      name: 'stderr',
      contentType: 'application/octet-stream',
      body: { data: [4, 5, 6], type: 'Buffer' }
    }
  ]);
});

test('should save attachments', async ({ runInlineTest }, testInfo) => {
  await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('passes', async ({ page }, testInfo) => {
        testInfo.attachments.push({
          name: 'binary',
          contentType: 'application/octet-stream',
          body: Buffer.from([1,2,3])
        });
        testInfo.attachments.push({
          name: 'text',
          contentType: 'text/plain',
          path: 'dummy-path'
        });
      });
    `,
  }, { reporter: 'dot,' + kRawReporterPath });
  const json = JSON.parse(fs.readFileSync(testInfo.outputPath('test-results', 'report', 'project.report'), 'utf-8'));
  const result = json.suites[0].tests[0].results[0];
  expect(result.attachments[0].name).toBe('binary');
  expect(Buffer.from(result.attachments[0].body, 'base64')).toEqual(Buffer.from([1, 2, 3]));
  expect(result.attachments[1].name).toBe('text');
  const path2 = result.attachments[1].path;
  expect(path2).toBe('dummy-path');
});

test(`testInfo.attach should save attachments via path`, async ({ runInlineTest }, testInfo) => {
  await runInlineTest({
    'a.test.js': `
      const path = require('path');
      const fs = require('fs');
      import { test, expect } from '@playwright/test';
      test('infer contentType from path', async ({}, testInfo) => {
        const tmpPath = testInfo.outputPath('example.json');
        await fs.promises.writeFile(tmpPath, 'We <3 Playwright!');
        await testInfo.attach('foo', { path: tmpPath });
        // Forcibly remove the tmp file to ensure attach is actually automagically copying it
        await fs.promises.unlink(tmpPath);
      });

      test('explicit contentType (over extension)', async ({}, testInfo) => {
        const tmpPath = testInfo.outputPath('example.json');
        await fs.promises.writeFile(tmpPath, 'We <3 Playwright!');
        await testInfo.attach('foo', { path: tmpPath, contentType: 'image/png' });
        // Forcibly remove the tmp file to ensure attach is actually automagically copying it
        await fs.promises.unlink(tmpPath);
      });

      test('explicit contentType (over extension and name)', async ({}, testInfo) => {
        const tmpPath = testInfo.outputPath('example.json');
        await fs.promises.writeFile(tmpPath, 'We <3 Playwright!');
        await testInfo.attach('example.png', { path: tmpPath, contentType: 'x-playwright/custom' });
        // Forcibly remove the tmp file to ensure attach is actually automagically copying it
        await fs.promises.unlink(tmpPath);
      });

      test('fallback contentType', async ({}, testInfo) => {
        const tmpPath = testInfo.outputPath('example.this-extension-better-not-map-to-an-actual-mimetype');
        await fs.promises.writeFile(tmpPath, 'We <3 Playwright!');
        await testInfo.attach('foo', { path: tmpPath });
        // Forcibly remove the tmp file to ensure attach is actually automagically copying it
        await fs.promises.unlink(tmpPath);
      });
    `,
  }, { reporter: 'dot,' + kRawReporterPath, workers: 1 });
  const json = JSON.parse(fs.readFileSync(testInfo.outputPath('test-results', 'report', 'project.report'), 'utf-8'));
  {
    const result = json.suites[0].tests[0].results[0];
    expect(result.attachments[0].name).toBe('foo');
    expect(result.attachments[0].contentType).toBe('application/json');
    const p = result.attachments[0].path;
    expect(p).toMatch(/[/\\]attachments[/\\]foo-[0-9a-f]+\.json$/);
    const contents = fs.readFileSync(p);
    expect(contents.toString()).toBe('We <3 Playwright!');
  }
  {
    const result = json.suites[0].tests[1].results[0];
    expect(result.attachments[0].name).toBe('foo');
    expect(result.attachments[0].contentType).toBe('image/png');
    const p = result.attachments[0].path;
    expect(p).toMatch(/[/\\]attachments[/\\]foo-[0-9a-f]+\.json$/);
    const contents = fs.readFileSync(p);
    expect(contents.toString()).toBe('We <3 Playwright!');
  }
  {
    const result = json.suites[0].tests[2].results[0];
    expect(result.attachments[0].name).toBe('example.png');
    expect(result.attachments[0].contentType).toBe('x-playwright/custom');
    const p = result.attachments[0].path;
    expect(p).toMatch(/[/\\]attachments[/\\]example-png-[0-9a-f]+\.json$/);
    const contents = fs.readFileSync(p);
    expect(contents.toString()).toBe('We <3 Playwright!');
  }
  {
    const result = json.suites[0].tests[3].results[0];
    expect(result.attachments[0].name).toBe('foo');
    expect(result.attachments[0].contentType).toBe('application/octet-stream');
    const p = result.attachments[0].path;
    expect(p).toMatch(/[/\\]attachments[/\\]foo-[0-9a-f]+\.this-extension-better-not-map-to-an-actual-mimetype$/);
    const contents = fs.readFileSync(p);
    expect(contents.toString()).toBe('We <3 Playwright!');
  }
});

test(`testInfo.attach should save attachments via inline attachment`, async ({ runInlineTest }, testInfo) => {
  await runInlineTest({
    'a.test.js': `
      const path = require('path');
      const fs = require('fs');
      import { test, expect } from '@playwright/test';
      test('default contentType - string', async ({}, testInfo) => {
        await testInfo.attach('example.json', { body: 'We <3 Playwright!' });
      });

      test('default contentType - Buffer', async ({}, testInfo) => {
        await testInfo.attach('example.json', { body: Buffer.from('We <3 Playwright!') });
      });

      test('explicit contentType - string', async ({}, testInfo) => {
        await testInfo.attach('example.json', { body: 'We <3 Playwright!', contentType: 'x-playwright/custom' });
      });

      test('explicit contentType - Buffer', async ({}, testInfo) => {
        await testInfo.attach('example.json', { body: Buffer.from('We <3 Playwright!'), contentType: 'x-playwright/custom' });
      });
  `,
  }, { reporter: 'dot,' + kRawReporterPath, workers: 1 });
  const json = JSON.parse(fs.readFileSync(testInfo.outputPath('test-results', 'report', 'project.report'), 'utf-8'));
  {
    const result = json.suites[0].tests[0].results[0];
    expect(result.attachments[0].name).toBe('example.json');
    expect(result.attachments[0].contentType).toBe('text/plain');
    expect(Buffer.from(result.attachments[0].body, 'base64')).toEqual(Buffer.from('We <3 Playwright!'));
  }
  {
    const result = json.suites[0].tests[1].results[0];
    expect(result.attachments[0].name).toBe('example.json');
    expect(result.attachments[0].contentType).toBe('application/octet-stream');
    expect(Buffer.from(result.attachments[0].body, 'base64')).toEqual(Buffer.from('We <3 Playwright!'));
  }
  {
    const result = json.suites[0].tests[2].results[0];
    expect(result.attachments[0].name).toBe('example.json');
    expect(result.attachments[0].contentType).toBe('x-playwright/custom');
    expect(Buffer.from(result.attachments[0].body, 'base64')).toEqual(Buffer.from('We <3 Playwright!'));
  }
  {
    const result = json.suites[0].tests[3].results[0];
    expect(result.attachments[0].name).toBe('example.json');
    expect(result.attachments[0].contentType).toBe('x-playwright/custom');
    expect(Buffer.from(result.attachments[0].body, 'base64')).toEqual(Buffer.from('We <3 Playwright!'));
  }
});

test('dupe project names', async ({ runInlineTest }, testInfo) => {
  await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'project-name' },
          { name: 'project-name' },
          { name: 'project-name' },
        ]
      }
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('passes', async ({ page }, testInfo) => {});
    `,
  }, { reporter: 'dot,' + kRawReporterPath });
  const files = fs.readdirSync(testInfo.outputPath('test-results', 'report'));
  expect(new Set(files)).toEqual(new Set(['project-name.report', 'project-name-1.report', 'project-name-2.report']));
});
