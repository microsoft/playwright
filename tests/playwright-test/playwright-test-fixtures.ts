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

import type { JSONReport, JSONReportSuite } from '@playwright/test/src/reporters/json';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import rimraf from 'rimraf';
import { promisify } from 'util';
import { CommonFixtures, commonFixtures } from '../config/commonFixtures';
import { serverFixtures, serverOptions, ServerFixtures, ServerWorkerOptions } from '../config/serverFixtures';
import { test as base, TestInfo } from './stable-test-runner';

const removeFolderAsync = promisify(rimraf);

type RunResult = {
  exitCode: number,
  output: string,
  passed: number,
  failed: number,
  flaky: number,
  skipped: number,
  report: JSONReport,
  results: any[],
};

type TSCResult = {
  output: string;
  exitCode: number;
};

type Files = { [key: string]: string | Buffer };
type Params = { [key: string]: string | number | boolean | string[] };
type Env = { [key: string]: string | number | boolean | undefined };

async function writeFiles(testInfo: TestInfo, files: Files) {
  const baseDir = testInfo.outputPath();

  const headerJS = `
    const pwt = require('@playwright/test');
  `;
  const headerTS = `
    import * as pwt from '@playwright/test';
  `;
  const headerESM = `
    import * as pwt from '@playwright/test';
  `;

  const hasConfig = Object.keys(files).some(name => name.includes('.config.'));
  if (!hasConfig) {
    files = {
      ...files,
      'playwright.config.ts': `
        module.exports = { projects: [ {} ] };
      `,
    };
  }

  await Promise.all(Object.keys(files).map(async name => {
    const fullName = path.join(baseDir, name);
    await fs.promises.mkdir(path.dirname(fullName), { recursive: true });
    const isTypeScriptSourceFile = name.endsWith('.ts') && !name.endsWith('.d.ts');
    const isJSModule = name.endsWith('.mjs') || name.includes('esm');
    const header = isTypeScriptSourceFile ? headerTS : (isJSModule ? headerESM : headerJS);
    if (typeof files[name] === 'string' && files[name].includes('//@no-header')) {
      await fs.promises.writeFile(fullName, files[name]);
    } else if (/(spec|test)\.(js|ts|mjs)$/.test(name)) {
      const fileHeader = header + 'const { expect } = pwt;\n';
      await fs.promises.writeFile(fullName, fileHeader + files[name]);
    } else if (/\.(js|ts)$/.test(name) && !name.endsWith('d.ts')) {
      await fs.promises.writeFile(fullName, header + files[name]);
    } else {
      await fs.promises.writeFile(fullName, files[name]);
    }
  }));

  return baseDir;
}

const cliEntrypoint = path.join(__dirname, '../../packages/playwright-core/cli.js');

async function runPlaywrightTest(childProcess: CommonFixtures['childProcess'], baseDir: string, params: any, env: Env, options: RunOptions): Promise<RunResult> {
  const paramList = [];
  for (const key of Object.keys(params)) {
    for (const value of Array.isArray(params[key]) ? params[key] : [params[key]]) {
      const k = key.startsWith('-') ? key : '--' + key;
      paramList.push(params[key] === true ? `${k}` : `${k}=${value}`);
    }
  }
  const outputDir = path.join(baseDir, 'test-results');
  const reportFile = path.join(outputDir, 'report.json');
  const args = ['node', cliEntrypoint, 'test'];
  if (!options.usesCustomOutputDir)
    args.push('--output=' + outputDir);
  args.push(
      '--reporter=dot,json',
      '--workers=2',
      ...paramList
  );
  if (options.additionalArgs)
    args.push(...options.additionalArgs);
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-test-cache-'));
  const testProcess = childProcess({
    command: args,
    env: {
      ...process.env,
      PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile,
      PWTEST_CACHE_DIR: cacheDir,
      PWTEST_SKIP_TEST_OUTPUT: '1',
      ...env,
      PLAYWRIGHT_DOCKER: undefined,
      PW_GRID: undefined,
    },
    cwd: baseDir,
  });
  let didSendSigint = false;
  testProcess.onOutput = () => {
    if (options.sendSIGINTAfter && !didSendSigint && countTimes(testProcess.output, '%%SEND-SIGINT%%') >= options.sendSIGINTAfter) {
      didSendSigint = true;
      process.kill(testProcess.process.pid, 'SIGINT');
    }
  };
  const { exitCode } = await testProcess.exited;
  await removeFolderAsync(cacheDir);

  const outputString = testProcess.output.toString();
  const summary = (re: RegExp) => {
    let result = 0;
    let match = re.exec(outputString);
    while (match) {
      result += (+match[1]);
      match = re.exec(outputString);
    }
    return result;
  };
  const passed = summary(/(\d+) passed/g);
  const failed = summary(/(\d+) failed/g);
  const flaky = summary(/(\d+) flaky/g);
  const skipped = summary(/(\d+) skipped/g);
  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportFile).toString());
  } catch (e) {
    testProcess.output += '\n' + e.toString();
  }

  const results = [];
  function visitSuites(suites?: JSONReportSuite[]) {
    if (!suites)
      return;
    for (const suite of suites) {
      for (const spec of suite.specs) {
        for (const test of spec.tests)
          results.push(...test.results);
      }
      visitSuites(suite.suites);
    }
  }
  if (report)
    visitSuites(report.suites);

  return {
    exitCode,
    output: testProcess.output,
    passed,
    failed,
    flaky,
    skipped,
    report,
    results,
  };
}

type RunOptions = {
  sendSIGINTAfter?: number;
  usesCustomOutputDir?: boolean;
  additionalArgs?: string[];
};
type Fixtures = {
  writeFiles: (files: Files) => Promise<string>;
  runInlineTest: (files: Files, params?: Params, env?: Env, options?: RunOptions) => Promise<RunResult>;
  runTSC: (files: Files) => Promise<TSCResult>;
};

export const test = base
    .extend<CommonFixtures>(commonFixtures as any)
    // TODO: this is a hack until we roll the stable test runner.
    .extend<ServerFixtures, ServerWorkerOptions>({ ...serverOptions, ...serverFixtures } as any)
    .extend<Fixtures>({
      writeFiles: async ({}, use, testInfo) => {
        await use(files => writeFiles(testInfo, files));
      },

      runInlineTest: async ({ childProcess }, use, testInfo: TestInfo) => {
        await use(async (files: Files, params: Params = {}, env: Env = {}, options: RunOptions = {}) => {
          const baseDir = await writeFiles(testInfo, files);
          return await runPlaywrightTest(childProcess, baseDir, params, env, options);
        });
      },

      runTSC: async ({ childProcess }, use, testInfo) => {
        await use(async files => {
          const baseDir = await writeFiles(testInfo, { 'tsconfig.json': JSON.stringify(TSCONFIG), ...files });
          const tsc = childProcess({
            command: ['npx', 'tsc', '-p', baseDir],
            cwd: baseDir,
            shell: true,
          });
          const { exitCode } = await tsc.exited;
          return { exitCode, output: tsc.output };
        });
      },
    });

const TSCONFIG = {
  'compilerOptions': {
    'target': 'ESNext',
    'moduleResolution': 'node',
    'module': 'commonjs',
    'strict': true,
    'esModuleInterop': true,
    'allowSyntheticDefaultImports': true,
    'rootDir': '.',
    'lib': ['esnext', 'dom', 'DOM.Iterable']
  },
  'exclude': [
    'node_modules'
  ]
};

export { expect } from './stable-test-runner';

const asciiRegex = new RegExp('[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))', 'g');
export function stripAscii(str: string): string {
  return str.replace(asciiRegex, '');
}

function countTimes(s: string, sub: string): number {
  let result = 0;
  for (let index = 0; index !== -1;) {
    index = s.indexOf(sub, index);
    if (index !== -1) {
      result++;
      index += sub.length;
    }
  }
  return result;
}
