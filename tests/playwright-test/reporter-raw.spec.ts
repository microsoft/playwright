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
      const { test } = pwt;
      test('passes', async ({ page }, testInfo) => {});
    `,
  }, { reporter: 'dot,' + kRawReporterPath }, {}, { usesCustomOutputDir: true });
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
      const { test } = pwt;
      test('passes', async ({ page }, testInfo) => {});
    `,
  }, { reporter: 'dot,' + kRawReporterPath }, {}, { usesCustomOutputDir: true });
  const json = JSON.parse(fs.readFileSync(testInfo.outputPath('output', 'report', 'project-name.report'), 'utf-8'));
  expect(json.project.name).toBe('project-name');
  expect(result.exitCode).toBe(0);
});

test('should save stdio', async ({ runInlineTest }, testInfo) => {
  await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('passes', async ({ page }, testInfo) => {
        console.log('STDOUT');
        process.stdout.write(Buffer.from([1, 2, 3]));
        console.error('STDERR');
        process.stderr.write(Buffer.from([4, 5, 6]));
      });
    `,
  }, { reporter: 'dot,' + kRawReporterPath }, {}, { usesCustomOutputDir: true });
  const json = JSON.parse(fs.readFileSync(testInfo.outputPath('test-results', 'report', 'project.report'), 'utf-8'));
  const result = json.suites[0].tests[0].results[0];
  expect(result.attachments).toEqual([
    { name: 'stdout', contentType: 'text/plain', body: 'STDOUT\n' },
    {
      name: 'stdout',
      contentType: 'application/octet-stream',
      body: 'AQID'
    },
    { name: 'stderr', contentType: 'text/plain', body: 'STDERR\n' },
    {
      name: 'stderr',
      contentType: 'application/octet-stream',
      body: 'BAUG'
    }
  ]);
});

test('should save attachments', async ({ runInlineTest }, testInfo) => {
  await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
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
  }, { reporter: 'dot,' + kRawReporterPath }, {}, { usesCustomOutputDir: true });
  const json = JSON.parse(fs.readFileSync(testInfo.outputPath('test-results', 'report', 'project.report'), 'utf-8'));
  const result = json.suites[0].tests[0].results[0];
  expect(result.attachments[0].name).toBe('binary');
  expect(Buffer.from(result.attachments[0].body, 'base64')).toEqual(Buffer.from([1,2,3]));
  expect(result.attachments[1].name).toBe('text');
  const path2 = result.attachments[1].path;
  expect(path2).toBe('dummy-path');
});

for (const { description, apiCall, expected } of [
  {
    description: 'infer contentType from path',
    apiCall: `attach(tmpPath)`,
    expected: {
      contentType: 'application/json',
      name: 'example.json',
    },
  },
  {
    description: 'infer contentType from name (over extension)',
    apiCall: `attach(tmpPath, { name: 'example.png' })`,
    expected: {
      contentType: 'image/png',
      name: 'example.png',
    },
  },
  {
    description: 'explicit contentType (over extension)',
    apiCall: `attach(tmpPath, { contentType: 'image/png' })`,
    expected: {
      contentType: 'image/png',
      name: 'example.json',
    },
  },
  {
    description: 'explicit contentType (over extension and name)',
    apiCall: `attach(tmpPath, { name: 'example.png', contentType: 'x-playwright/custom' })`,
    expected: {
      contentType: 'x-playwright/custom',
      name: 'example.png',
    },
  },
  {
    description: 'fallback contentType',
    apiCall: `attach(tmpPath, { name: 'example.this-extension-better-not-map-to-an-actual-mimetype' })`,
    expected: {
      contentType: 'application/octet-stream',
      name: 'example.this-extension-better-not-map-to-an-actual-mimetype',
    },
  },
]) {
  test(`testInfo.attach should save attachments via path - ${description}`, async ({ runInlineTest }, testInfo) => {
    await runInlineTest({
      'a.test.js': `
      const path = require('path');
      const fs = require('fs');
      const { test } = pwt;
      test('passes', async ({}, testInfo) => {
        const tmpPath = testInfo.outputPath('example.json');
        await fs.promises.writeFile(tmpPath, 'We <3 Playwright!');
        await testInfo.${apiCall};
        // Forcibly remove the tmp file to ensure attach is actually automagically copying it
        await fs.promises.unlink(tmpPath);
      });
    `,
    }, { reporter: 'dot,' + kRawReporterPath }, {}, { usesCustomOutputDir: true });
    const json = JSON.parse(fs.readFileSync(testInfo.outputPath('test-results', 'report', 'project.report'), 'utf-8'));
    const result = json.suites[0].tests[0].results[0];
    expect(result.attachments[0].name).toBe(expected.name);
    expect(result.attachments[0].contentType).toBe(expected.contentType);
    const p = result.attachments[0].path;
    expect(p).toMatch(/[/\\]attachments[/\\]01a5667d100fac2200bf40cf43083fae0580c58e\.json$/);
    const contents = fs.readFileSync(p);
    expect(contents.toString()).toBe('We <3 Playwright!');
  });
}

for (const { description, apiCall, expected } of [
  {
    description: 'infer contentType - string',
    apiCall: `attach('We <3 Playwright!', 'example.json')`,
    expected: {
      contentType: 'application/json',
      name: 'example.json',
    },
  },
  {
    description: 'infer contentType - Buffer',
    apiCall: `attach(Buffer.from('We <3 Playwright!'), 'example.json')`,
    expected: {
      contentType: 'application/json',
      name: 'example.json',
    },
  },
  {
    description: 'fallback contentType - string',
    apiCall: `attach('We <3 Playwright!', 'example.this-extension-better-not-map-to-an-actual-mimetype')`,
    expected: {
      contentType: 'text/plain',
      name: 'example.this-extension-better-not-map-to-an-actual-mimetype',
    },
  },
  {
    description: 'fallback contentType - Buffer',
    apiCall: `attach(Buffer.from('We <3 Playwright!'), 'example.this-extension-better-not-map-to-an-actual-mimetype')`,
    expected: {
      contentType: 'application/octet-stream',
      name: 'example.this-extension-better-not-map-to-an-actual-mimetype',
    },
  },
  {
    description: 'fallback contentType - no extension',
    apiCall: `attach('We <3 Playwright!', 'example')`,
    expected: {
      contentType: 'text/plain',
      name: 'example',
    },
  },
  {
    description: 'explicit contentType - string',
    apiCall: `attach('We <3 Playwright!', 'example.json', 'x-playwright/custom')`,
    expected: {
      contentType: 'x-playwright/custom',
      name: 'example.json',
    },
  },
  {
    description: 'explicit contentType - Buffer',
    apiCall: `attach(Buffer.from('We <3 Playwright!'), 'example.json', 'x-playwright/custom')`,
    expected: {
      contentType: 'x-playwright/custom',
      name: 'example.json',
    },
  },
]) {
  test(`testInfo.attach should save attachments via inline attachment - ${description}`, async ({ runInlineTest }, testInfo) => {
    await runInlineTest({
      'a.test.js': `
      const path = require('path');
      const fs = require('fs');
      const { test } = pwt;
      test('passes', async ({}, testInfo) => {
        await testInfo.${apiCall};
      });
    `,
    }, { reporter: 'dot,' + kRawReporterPath }, {}, { usesCustomOutputDir: true });
    const json = JSON.parse(fs.readFileSync(testInfo.outputPath('test-results', 'report', 'project.report'), 'utf-8'));
    const result = json.suites[0].tests[0].results[0];
    expect(result.attachments[0].name).toBe(expected.name);
    expect(result.attachments[0].contentType).toBe(expected.contentType);
    expect(Buffer.from(result.attachments[0].body, 'base64')).toEqual(Buffer.from('We <3 Playwright!'));
  });
}

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
      const { test } = pwt;
      test('passes', async ({ page }, testInfo) => {});
    `,
  }, { reporter: 'dot,' + kRawReporterPath }, {}, { usesCustomOutputDir: true });
  const files = fs.readdirSync(testInfo.outputPath('test-results', 'report'));
  expect(new Set(files)).toEqual(new Set(['project-name.report', 'project-name-1.report', 'project-name-2.report']));
});
