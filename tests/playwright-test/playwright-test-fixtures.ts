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

import type { JSONReport, JSONReportSpec, JSONReportSuite, JSONReportTest, JSONReportTestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { rimraf, PNG } from 'playwright-core/lib/utilsBundle';
import { promisify } from 'util';
import type { CommonFixtures, CommonWorkerFixtures, TestChildProcess } from '../config/commonFixtures';
import { commonFixtures } from '../config/commonFixtures';
import type { ServerFixtures, ServerWorkerOptions } from '../config/serverFixtures';
import { serverFixtures } from '../config/serverFixtures';
import type { TestInfo } from './stable-test-runner';
import { expect } from './stable-test-runner';
import { test as base } from './stable-test-runner';

const removeFolderAsync = promisify(rimraf);

export type CliRunResult = {
  exitCode: number,
  output: string,
};

export type RunResult = {
  exitCode: number,
  output: string,
  outputLines: string[],
  rawOutput: string,
  passed: number,
  failed: number,
  flaky: number,
  skipped: number,
  interrupted: number,
  report: JSONReport,
  results: any[],
};

type TSCResult = {
  output: string;
  exitCode: number;
};

type Files = { [key: string]: string | Buffer };
type Params = { [key: string]: string | number | boolean | string[] };

async function writeFiles(testInfo: TestInfo, files: Files, initial: boolean) {
  const baseDir = testInfo.outputPath();

  if (initial && !Object.keys(files).some(name => name.includes('package.json'))) {
    files = {
      ...files,
      'package.json': `{ "name": "test-project" }`,
    };
  }

  await Promise.all(Object.keys(files).map(async name => {
    const fullName = path.join(baseDir, name);
    await fs.promises.mkdir(path.dirname(fullName), { recursive: true });
    await fs.promises.writeFile(fullName, files[name]);
  }));

  return baseDir;
}

const cliEntrypoint = path.join(__dirname, '../../packages/playwright-core/cli.js');

async function runPlaywrightTest(childProcess: CommonFixtures['childProcess'], baseDir: string, params: any, env: NodeJS.ProcessEnv, options: RunOptions): Promise<RunResult> {
  const paramList: string[] = [];
  for (const key of Object.keys(params)) {
    for (const value of Array.isArray(params[key]) ? params[key] : [params[key]]) {
      const k = key.startsWith('-') ? key : '--' + key;
      paramList.push(params[key] === true ? `${k}` : `${k}=${value}`);
    }
  }
  const reportFile = path.join(baseDir, 'report.json');
  const args = ['test'];
  args.push(
      '--workers=2',
      ...paramList
  );
  if (options.additionalArgs)
    args.push(...options.additionalArgs);

  const cwd = options.cwd ? path.resolve(baseDir, options.cwd) : baseDir;
  // eslint-disable-next-line prefer-const
  let { exitCode, output } = await runPlaywrightCommand(childProcess, cwd, args, {
    PW_TEST_REPORTER: path.join(__dirname, '../../packages/playwright-test/lib/reporters/json.js'),
    PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile,
    ...env,
  }, options.sendSIGINTAfter);

  const summary = (re: RegExp) => {
    let result = 0;
    let match = re.exec(output);
    while (match) {
      result += (+match[1]);
      match = re.exec(output);
    }
    return result;
  };
  const passed = summary(/(\d+) passed/g);
  const failed = summary(/(\d+) failed/g);
  const flaky = summary(/(\d+) flaky/g);
  const skipped = summary(/(\d+) skipped/g);
  const interrupted = summary(/(\d+) interrupted/g);
  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportFile).toString());
  } catch (e) {
    output += '\n' + e.toString();
  }

  const results: JSONReportTestResult[] = [];
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

  const strippedOutput = stripAnsi(output);
  return {
    exitCode,
    output: strippedOutput,
    outputLines: strippedOutput.split('\n').filter(line => line.startsWith('%%')).map(line => line.substring(2).trim()),
    rawOutput: output,
    passed,
    failed,
    flaky,
    skipped,
    interrupted,
    report,
    results,
  };
}

function watchPlaywrightTest(childProcess: CommonFixtures['childProcess'], baseDir: string, env: NodeJS.ProcessEnv, options: RunOptions): TestChildProcess {
  const args = ['test', '--workers=2'];
  if (options.additionalArgs)
    args.push(...options.additionalArgs);
  const cwd = options.cwd ? path.resolve(baseDir, options.cwd) : baseDir;

  const command = ['node', cliEntrypoint];
  command.push(...args);
  const testProcess = childProcess({
    command,
    env: cleanEnv({ PWTEST_WATCH: '1', ...env }),
    cwd,
  });
  return testProcess;
}

async function runPlaywrightCommand(childProcess: CommonFixtures['childProcess'], cwd: string, commandWithArguments: string[], env: NodeJS.ProcessEnv, sendSIGINTAfter?: number): Promise<CliRunResult> {
  const command = ['node', cliEntrypoint];
  command.push(...commandWithArguments);
  const testProcess = childProcess({
    command,
    env: cleanEnv(env),
    cwd,
  });
  let didSendSigint = false;
  testProcess.onOutput = () => {
    if (sendSIGINTAfter && !didSendSigint && countTimes(testProcess.output, '%%SEND-SIGINT%%') >= sendSIGINTAfter) {
      didSendSigint = true;
      process.kill(testProcess.process.pid!, 'SIGINT');
    }
  };
  const { exitCode } = await testProcess.exited;
  return { exitCode, output: testProcess.output.toString() };
}

function cleanEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // BEGIN: Reserved CI
    CI: undefined,
    BUILD_URL: undefined,
    CI_COMMIT_SHA: undefined,
    CI_JOB_URL: undefined,
    CI_PROJECT_URL: undefined,
    GITHUB_REPOSITORY: undefined,
    GITHUB_RUN_ID: undefined,
    GITHUB_SERVER_URL: undefined,
    GITHUB_SHA: undefined,
    // END: Reserved CI
    PW_TEST_HTML_REPORT_OPEN: undefined,
    PW_TEST_REPORTER: undefined,
    PW_TEST_REPORTER_WS_ENDPOINT: undefined,
    PW_TEST_SOURCE_TRANSFORM: undefined,
    PW_TEST_SOURCE_TRANSFORM_SCOPE: undefined,
    TEST_WORKER_INDEX: undefined,
    TEST_PARLLEL_INDEX: undefined,
    NODE_OPTIONS: undefined,
    ...env,
  };
}

type RunOptions = {
  sendSIGINTAfter?: number;
  additionalArgs?: string[];
  cwd?: string,
};
type Fixtures = {
  writeFiles: (files: Files) => Promise<string>;
  runInlineTest: (files: Files, params?: Params, env?: NodeJS.ProcessEnv, options?: RunOptions) => Promise<RunResult>;
  runWatchTest: (files: Files, env?: NodeJS.ProcessEnv, options?: RunOptions) => Promise<TestChildProcess>;
  runTSC: (files: Files) => Promise<TSCResult>;
  nodeVersion: { major: number, minor: number, patch: number };
};

export const test = base
    .extend<CommonFixtures, CommonWorkerFixtures>(commonFixtures)
    .extend<ServerFixtures, ServerWorkerOptions>(serverFixtures)
    .extend<Fixtures>({
      writeFiles: async ({}, use, testInfo) => {
        await use(files => writeFiles(testInfo, files, false));
      },

      runInlineTest: async ({ childProcess }, use, testInfo: TestInfo) => {
        const cacheDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-test-cache-'));
        await use(async (files: Files, params: Params = {}, env: NodeJS.ProcessEnv = {}, options: RunOptions = {}) => {
          const baseDir = await writeFiles(testInfo, files, true);
          return await runPlaywrightTest(childProcess, baseDir, params, { ...env, PWTEST_CACHE_DIR: cacheDir }, options);
        });
        await removeFolderAsync(cacheDir);
      },

      runWatchTest: async ({ childProcess }, use, testInfo: TestInfo) => {
        const cacheDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-test-cache-'));
        let testProcess: TestChildProcess | undefined;
        await use(async (files: Files, env: NodeJS.ProcessEnv = {}, options: RunOptions = {}) => {
          const baseDir = await writeFiles(testInfo, files, true);
          testProcess = watchPlaywrightTest(childProcess, baseDir, { ...env, PWTEST_CACHE_DIR: cacheDir }, options);
          return testProcess;
        });
        await testProcess?.close();
        await removeFolderAsync(cacheDir);
      },

      runTSC: async ({ childProcess }, use, testInfo) => {
        await use(async files => {
          const baseDir = await writeFiles(testInfo, { 'tsconfig.json': JSON.stringify(TSCONFIG), ...files }, true);
          const tsc = childProcess({
            command: ['npx', 'tsc', '-p', baseDir],
            cwd: baseDir,
            shell: true,
          });
          const { exitCode } = await tsc.exited;
          return { exitCode, output: tsc.output };
        });
      },

      nodeVersion: async ({}, use) => {
        const [major, minor, patch] = process.versions.node.split('.');
        await use({ major: +major, minor: +minor, patch: +patch });
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
    'lib': ['esnext', 'dom', 'DOM.Iterable'],
    'noEmit': true,
  },
  'exclude': [
    'node_modules'
  ]
};

export { expect } from './stable-test-runner';

const asciiRegex = new RegExp('[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))', 'g');
export function stripAnsi(str: string): string {
  return str.replace(asciiRegex, '');
}

export function countTimes(s: string, sub: string): number {
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

export function createImage(width: number, height: number, r: number = 0, g: number = 0, b: number = 0, a: number = 255): Buffer {
  const image = new PNG({ width, height });
  // Make both images red.
  for (let i = 0; i < width * height; ++i) {
    image.data[i * 4 + 0] = r;
    image.data[i * 4 + 1] = g;
    image.data[i * 4 + 2] = b;
    image.data[i * 4 + 3] = a;
  }
  return PNG.sync.write(image);
}

export function createWhiteImage(width: number, height: number) {
  return createImage(width, height, 255, 255, 255);
}

export function paintBlackPixels(image: Buffer, blackPixelsCount: number): Buffer {
  const png = PNG.sync.read(image);
  for (let i = 0; i < blackPixelsCount; ++i) {
    for (let j = 0; j < 3; ++j)
      png.data[i * 4 + j] = 0;
  }
  return PNG.sync.write(png);
}

function filterTests(result: RunResult, filter: (spec: JSONReportSpec) => boolean) {
  const tests: JSONReportTest[] = [];
  const visit = (suite: JSONReportSuite) => {
    for (const spec of suite.specs)
      spec.tests.forEach(t => filter(spec) && tests.push(t));
    suite.suites?.forEach(s => visit(s));
  };
  visit(result.report.suites[0]);
  return tests;
}

export function expectTestHelper(result: RunResult) {
  return (title: string, expectedStatus: string, status: string, annotations: string[]) => {
    const tests = filterTests(result, s => s.title === title);
    for (const test of tests) {
      expect(test.expectedStatus, `title: ${title}`).toBe(expectedStatus);
      expect(test.status, `title: ${title}`).toBe(status);
      expect(test.annotations.map(a => a.type), `title: ${title}`).toEqual(annotations);
    }
  };
}
