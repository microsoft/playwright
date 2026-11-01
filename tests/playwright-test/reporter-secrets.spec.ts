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
import * as yazl from 'yazl';
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
    if (step.params?.value) {
      this.log('fill ' + step.title + ' / ' + step.subtitle + ' / ' + step.params.value);
      this.log('fill-lengths ' + step.subtitle.length + ' ' + step.params.value.length);
    }
  }
  onTestEnd(test, result) {
    this.log('secrets option ' + JSON.stringify(this.secrets));
    this.log('identity ' + (result === globalThis.__lastResult));
    globalThis.__lastResult = result;
    for (const attachment of result.attachments) {
      if (attachment.contentType === 'application/zip')
        this.log('zip ' + attachment.name);
      else
        this.log('attachment ' + attachment.name + ' ' + (attachment.body || require('fs').readFileSync(attachment.path)).toString());
    }
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
import fs from 'fs';
test('fails ' + process.env.PASSWORD, async ({ page }, testInfo) => {
  const password = process.env.PASSWORD;
  console.log('stdout ' + password);
  await testInfo.attach('note ' + password, { body: 'body ' + password });
  const file = testInfo.outputPath('note.txt');
  fs.writeFileSync(file, 'file ' + password);
  await testInfo.attach('file', { path: file, contentType: 'text/plain' });
  if (process.env.SECRET_ZIP) {
    await testInfo.attach('binary', { body: Buffer.from('binary ' + password), contentType: 'application/octet-stream' });
    await testInfo.attach('safe binary', { body: Buffer.from('safe binary'), contentType: 'application/octet-stream' });
    const zip = testInfo.outputPath('archive.zip');
    fs.writeFileSync(zip, Buffer.from(process.env.SECRET_ZIP, 'base64'));
    await testInfo.attach('archive', { path: zip, contentType: 'application/zip' });
  }
  const longPassword = 'long-' + password.repeat(30);
  await page.setContent('<input aria-label="' + longPassword + '">');
  await page.getByLabel(longPassword).fill(longPassword);
  await test.step('step ' + password, async () => {
    expect(password).toBe('wrong ' + 'password123');
  });
});
`;

test('should redact secrets for reporters with the option only', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43795' } }, async ({ runInlineTest }) => {
  const zip = new yazl.ZipFile();
  zip.addBuffer(Buffer.from('compressed password123'), 'note.txt');
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const result = await runInlineTest({
    'reporter.ts': reporterJS,
    'playwright.config.ts': `
      module.exports = {
        use: { browserName: ${JSON.stringify(process.env.PWTEST_BROWSER_NAME || 'chromium')}, trace: 'on' },
        reporter: [
          ['./reporter.ts', { prefix: 'redacted', secrets: [{ name: 'PASSWORD', value: process.env.PASSWORD }, { name: 'LONG_PASSWORD', value: 'long-' + process.env.PASSWORD.repeat(30) }, { name: 'EMPTY', value: '' }] }],
          ['./reporter.ts', { prefix: 'raw' }],
        ],
      };
    `,
    'a.spec.ts': testJS,
  }, {}, { PASSWORD: 'password123', SECRET_ZIP: Buffer.concat(chunks).toString('base64') });

  expect(result.exitCode).toBe(1);
  expect(result.outputLines).toEqual(expect.arrayContaining([
    'redacted stdout stdout <secret>PASSWORD</secret>',
    'redacted step step <secret>PASSWORD</secret> error=Error: expect(received).toBe(expected) // Object.is equality',
    'redacted secrets option undefined',
    'redacted attachment note <secret>PASSWORD</secret> body <secret>PASSWORD</secret>',
    'redacted attachment file file <secret>PASSWORD</secret>',
    'redacted attachment binary Attachment omitted because it contains a secret.',
    'redacted attachment safe binary safe binary',
    'redacted attachment archive Attachment omitted because it contains a secret.',
    'redacted attachment trace Attachment omitted because it contains a secret.',
    `redacted fill Fill "<secret>LONG_PASSWORD</secret>" / getByLabel('<secret>LONG_PASSWORD</secret>') / <secret>LONG_PASSWORD</secret>`,
    'redacted title fails <secret>PASSWORD</secret>',
    'redacted error Error: expect(received).toBe(expected) // Object.is equality',
    'redacted snippet false',
    'raw stdout stdout password123',
    'raw step step password123 error=Error: expect(received).toBe(expected) // Object.is equality',
    'raw secrets option undefined',
    'raw attachment note password123 body password123',
    'raw attachment file file password123',
    'raw attachment binary binary password123',
    'raw attachment safe binary safe binary',
    'raw zip archive',
    'raw zip trace',
    'raw fill-lengths 201 201',
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

test('should redact secrets in built-in reporters', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43795' } }, async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
          browserName: ${JSON.stringify(process.env.PWTEST_BROWSER_NAME || 'chromium')},
          trace: { mode: 'on', secrets: [{ name: 'PASSWORD', value: process.env.PASSWORD }] },
        },
        reporter: [
          ['list', { secrets: [{ name: 'PASSWORD', value: process.env.PASSWORD }] }],
          ['json', { secrets: [{ name: 'PASSWORD', value: process.env.PASSWORD }], outputFile: 'secrets-report.json' }],
          ['html', { secrets: [{ name: 'PASSWORD', value: process.env.PASSWORD }], open: 'never' }],
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
  const trace = JSON.parse(json).suites[0].specs[0].tests[0].results[0].attachments.find(a => a.name === 'trace');
  expect(trace.contentType).toBe('application/zip');
  const tracePath = testInfo.outputPath('trace.zip');
  fs.writeFileSync(tracePath, trace.body ? Buffer.from(trace.body, 'base64') : fs.readFileSync(trace.path));
  const traceFile = new utils.ZipFile(tracePath);
  for (const entry of await traceFile.entries())
    expect((await traceFile.read(entry)).toString()).not.toContain('password123');
  traceFile.close();
  for (const file of fs.readdirSync(path.join(reportDir, 'data')))
    expect(fs.readFileSync(path.join(reportDir, 'data', file)).toString()).not.toContain('password123');
});

test('should redact secrets in the convenience reporter when all reporters have secrets', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43795' } }, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    '.env.secrets': 'PASSWORD=password123\n',
    'playwright.config.ts': `
      module.exports = {
        use: { browserName: ${JSON.stringify(process.env.PWTEST_BROWSER_NAME || 'chromium')} },
        reporter: [
          ['json', { secrets: '.env.secrets', outputFile: 'secrets-report.json' }],
          ['null', { secrets: [{ value: 'stdout' }] }],
        ],
      };
    `,
    'a.spec.ts': testJS,
  }, {}, { PASSWORD: 'password123', PW_TEST_REPORTER: '' });

  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).not.toContain('password123');
  expect(stripAnsi(result.output)).toContain('fails <secret>PASSWORD</secret>');
  expect(stripAnsi(result.output)).toContain('<secret/> <secret>PASSWORD</secret>');
});
