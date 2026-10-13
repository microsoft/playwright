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
import { test, expect, stripAnsi } from './playwright-test-fixtures';
import { utils } from '../../packages/playwright-core/lib/coreBundle';

const reporterJS = `
class Reporter {
  constructor(options) {
    this.prefix = options.prefix;
    this.secrets = options.secrets;
  }
  log(message) {
    console.log('%%' + this.prefix + ' ' + message);
  }
  onBegin(config, suite) {
    this.suite = suite;
    this.log('config ' + JSON.stringify(config.reporter));
  }
  onStdOut(chunk) {
    this.log('stdout ' + chunk.toString().trim());
  }
  onStepEnd(test, result, step) {
    if (step.category === 'test.step')
      this.log('step ' + step.title + (step.error ? ' error=' + step.error.message.split('\\n')[0] : ''));
  }
  onTestEnd(test, result) {
    this.log('secrets option ' + JSON.stringify(this.secrets));
    this.log('identity ' + (result === globalThis.__lastResult));
    globalThis.__lastResult = result;
    for (const attachment of result.attachments.filter(a => a.body))
      this.log('attachment ' + attachment.name + ' ' + attachment.body.toString());
    this.log('title ' + test.title);
  }
  onEnd() {
    for (const test of this.suite.allTests()) {
      for (const result of test.results) {
        for (const error of result.errors)
          this.log('error ' + error.message.split('\\n')[0]);
        this.log('snippet ' + (error => error.snippet.includes('password123'))(result.errors[0]));
      }
    }
  }
}
module.exports = Reporter;
`;

const testJS = `
import { test, expect } from '@playwright/test';
test('fails ' + process.env.PASSWORD, async ({}, testInfo) => {
  const password = process.env.PASSWORD;
  console.log('stdout ' + password);
  await testInfo.attach('note ' + password, { body: 'body ' + password });
  await test.step('step ' + password, async () => {
    expect(password).toBe('wrong ' + 'password123');
  });
});
`;

test('should redact secrets for reporters with the option only', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': reporterJS,
    'playwright.config.ts': `
      module.exports = {
        reporter: [
          ['./reporter.ts', { prefix: 'redacted', secrets: { PASSWORD: process.env.PASSWORD, EMPTY: '' } }],
          ['./reporter.ts', { prefix: 'raw' }],
        ],
      };
    `,
    'a.spec.ts': testJS,
  }, {}, { PASSWORD: 'password123' });

  expect(result.exitCode).toBe(1);
  expect(result.outputLines).toEqual(expect.arrayContaining([
    'redacted stdout stdout <secret>PASSWORD</secret>',
    'redacted step step <secret>PASSWORD</secret> error=Error: expect(received).toBe(expected) // Object.is equality',
    'redacted secrets option undefined',
    'redacted attachment note <secret>PASSWORD</secret> body <secret>PASSWORD</secret>',
    'redacted title fails <secret>PASSWORD</secret>',
    'redacted error Error: expect(received).toBe(expected) // Object.is equality',
    'redacted snippet false',
    'raw stdout stdout password123',
    'raw step step password123 error=Error: expect(received).toBe(expected) // Object.is equality',
    'raw secrets option undefined',
    'raw attachment note password123 body password123',
    'raw title fails password123',
    'raw snippet true',
  ]));
  // Secrets are not exposed through the config.
  const configLines = result.outputLines.filter(line => line.includes(' config '));
  expect(configLines).toHaveLength(2);
  for (const line of configLines) {
    expect(line).not.toContain('"secrets"');
    expect(line).not.toContain('password123');
    expect(line).toContain('"prefix":"redacted"');
  }
  expect(result.outputLines.filter(line => line.startsWith('redacted ')).join('\n')).not.toContain('password123');
});

test('should redact secrets in built-in reporters', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        reporter: [
          ['list', { secrets: { PASSWORD: process.env.PASSWORD } }],
          ['json', { secrets: { PASSWORD: process.env.PASSWORD }, outputFile: 'secrets-report.json' }],
          ['html', { secrets: { PASSWORD: process.env.PASSWORD }, open: 'never' }],
        ],
      };
    `,
    'a.spec.ts': testJS,
  }, {}, { PASSWORD: 'password123', PLAYWRIGHT_HTML_OPEN: 'never' });

  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).not.toContain('password123');
  expect(stripAnsi(result.output)).toContain('fails <secret>PASSWORD</secret>');
  expect(stripAnsi(result.output)).toContain('Expected: "wrong <secret>PASSWORD</secret>"');

  const json = fs.readFileSync(testInfo.outputPath('secrets-report.json'), 'utf8');
  expect(json).not.toContain('password123');
  expect(json).toContain('fails <secret>PASSWORD</secret>');
  expect(JSON.parse(json).config.reporter).toEqual([
    ['list', {}],
    ['json', { outputFile: 'secrets-report.json' }],
    ['html', { open: 'never' }],
  ]);

  // The HTML report keeps its data in a zip embedded into index.html.
  const reportDir = testInfo.outputPath('playwright-report');
  const indexHtml = fs.readFileSync(path.join(reportDir, 'index.html'), 'utf8');
  const base64 = /<template id="playwrightReportBase64">data:application\/zip;base64,([^<]*)<\/template>/.exec(indexHtml)![1];
  const zipPath = testInfo.outputPath('report.zip');
  fs.writeFileSync(zipPath, Buffer.from(base64, 'base64'));
  const zipFile = new utils.ZipFile(zipPath);
  const entries = await zipFile.entries();
  expect(entries.length).toBeGreaterThan(0);
  let reportText = '';
  for (const entry of entries)
    reportText += (await zipFile.read(entry)).toString();
  zipFile.close();
  expect(reportText).not.toContain('password123');
  expect(reportText).toContain('fails <secret>PASSWORD</secret>');
});

test('should redact secrets in the convenience reporter when all reporters have secrets', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        reporter: [
          ['json', { secrets: { PASSWORD: process.env.PASSWORD }, outputFile: 'secrets-report.json' }],
          ['null', { secrets: { OTHER: 'stdout' } }],
        ],
      };
    `,
    'a.spec.ts': testJS,
  }, {}, { PASSWORD: 'password123', PW_TEST_REPORTER: '' });

  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).not.toContain('password123');
  expect(stripAnsi(result.output)).toContain('fails <secret>PASSWORD</secret>');
  expect(stripAnsi(result.output)).toContain('<secret>OTHER</secret> <secret>PASSWORD</secret>');
});
