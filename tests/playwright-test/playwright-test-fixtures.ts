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
import { PNG } from 'playwright-core/lib/utilsBundle';
import type { CommonFixtures, CommonWorkerFixtures, TestChildProcess } from '../config/commonFixtures';
import { commonFixtures } from '../config/commonFixtures';
import type { ServerFixtures, ServerWorkerOptions } from '../config/serverFixtures';
import { serverFixtures } from '../config/serverFixtures';
import type { TestInfo } from './stable-test-runner';
import { expect } from './stable-test-runner';
import { test as base } from './stable-test-runner';
export { countTimes } from '../config/commonFixtures';

type CliRunResult = {
  exitCode: number,
  output: string,
  outputLines: string[],
};

export type RunResult = {
  exitCode: number,
  output: string,
  stdout: string,
  stderr: string,
  outputLines: string[],
  rawOutput: string,
  passed: number,
  failed: number,
  flaky: number,
  skipped: number,
  interrupted: number,
  didNotRun: number,
  report: JSONReport,
  results: any[],
};

type TSCResult = {
  output: string;
  exitCode: number;
};

export type Files = { [key: string]: string | Buffer };
type Params = { [key: string]: string | number | boolean | string[] };

export async function writeFiles(testInfo: TestInfo, files: Files, initial: boolean) {
  const baseDir = testInfo.outputPath();

  if (initial && !Object.keys(files).some(name => name.includes('package.json'))) {
    files = {
      ...files,
      'package.json': `{ "name": "test-project" }`,
    };
  }

  if (initial && !Object.keys(files).some(name => name.includes('tsconfig.json') || name.includes('jsconfig.json'))) {
    files = {
      ...files,
      'tsconfig.json': `{}`,
    };
  }

  await Promise.all(Object.keys(files).map(async name => {
    const fullName = path.join(baseDir, name);
    if (files[name] === undefined)
      return;
    await fs.promises.mkdir(path.dirname(fullName), { recursive: true });
    await fs.promises.writeFile(fullName, files[name]);
  }));

  return baseDir;
}

export const cliEntrypoint = path.join(__dirname, '../../packages/playwright-test/cli.js');

const configFile = (baseDir: string, files: Files): string | undefined => {
  for (const [name, content] of Object.entries(files)) {
    if (name.includes('playwright.config')) {
      if (content.includes('reporter:') || content.includes('reportSlowTests:'))
        return path.resolve(baseDir, name);
    }
  }
  return undefined;
};

function findPackageJSONDir(files: Files, dir: string) {
  while (dir && !files[dir + '/package.json'])
    dir = path.dirname(dir);
  return dir;
}

function toParamList(params: any): string[] {
  const paramList: string[] = [];
  for (const key of Object.keys(params)) {
    for (const value of Array.isArray(params[key]) ? params[key] : [params[key]]) {
      const k = key.startsWith('-') ? key : '--' + key;
      paramList.push(params[key] === true ? `${k}` : `${k}=${value}`);
    }
  }
  return paramList;
}

function startPlaywrightTest(childProcess: CommonFixtures['childProcess'], baseDir: string, params: any, env: NodeJS.ProcessEnv, options: RunOptions): TestChildProcess {
  const paramList = toParamList(params);
  const args = ['test'];
  args.push(
      '--workers=2',
      ...paramList
  );
  if (options.additionalArgs)
    args.push(...options.additionalArgs);
  return startPlaywrightChildProcess(childProcess, baseDir, args, env, options);
}

function startPlaywrightChildProcess(childProcess: CommonFixtures['childProcess'], baseDir: string, args: string[], env: NodeJS.ProcessEnv, options: RunOptions): TestChildProcess {
  return childProcess({
    command: ['node', cliEntrypoint, ...args],
    env: cleanEnv(env),
    cwd: options.cwd ? path.resolve(baseDir, options.cwd) : baseDir,
  });
}

async function runPlaywrightTest(childProcess: CommonFixtures['childProcess'], baseDir: string, params: any, env: NodeJS.ProcessEnv, options: RunOptions, files: Files, mergeReports: (reportFolder: string, env?: NodeJS.ProcessEnv, options?: RunOptions) => Promise<CliRunResult>, useIntermediateMergeReport: boolean): Promise<RunResult> {
  let reporter;
  if (useIntermediateMergeReport) {
    reporter = params.reporter;
    params.reporter = 'blob';
  }
  const reportFile = path.join(baseDir, 'report.json');
  // When we have useIntermediateMergeReport, we want the JSON reporter only at the merge step.
  const envWithJsonReporter = {
    PW_TEST_REPORTER: path.join(__dirname, '../../packages/playwright/lib/reporters/json.js'),
    PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile,
    ...env,
  };
  const testProcess = startPlaywrightTest(childProcess, baseDir, params, useIntermediateMergeReport ? env : envWithJsonReporter, options);
  const { exitCode } = await testProcess.exited;
  let output = testProcess.output.toString();

  if (useIntermediateMergeReport) {
    const additionalArgs = [];
    if (reporter)
      additionalArgs.push('--reporter', reporter);
    const config = configFile(baseDir, files);
    if (config)
      additionalArgs.push('--config', config);
    const cwd = options.cwd ? path.resolve(baseDir, options.cwd) : baseDir;
    const packageRoot = path.resolve(baseDir, findPackageJSONDir(files, options.cwd ?? ''));
    const relativeBlobReportPath = path.relative(cwd, path.join(packageRoot, 'blob-report'));
    const mergeResult = await mergeReports(relativeBlobReportPath, envWithJsonReporter, { cwd, additionalArgs });
    expect(mergeResult.exitCode).toBe(0);
    output = mergeResult.output;
  }

  const parsed = parseTestRunnerOutput(output);

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

  return {
    ...parsed,
    exitCode,
    rawOutput: output,
    stdout: testProcess.stdout,
    stderr: testProcess.stderr,
    report,
    results,
  };
}

async function runPlaywrightCLI(childProcess: CommonFixtures['childProcess'], args: string[], baseDir: string, env: NodeJS.ProcessEnv): Promise<{ output: string, stdout: string, stderr: string, exitCode: number }> {
  const testProcess = childProcess({
    command: ['node', cliEntrypoint, ...args],
    env: cleanEnv(env),
    cwd: baseDir,
  });
  const { exitCode } = await testProcess.exited;
  return { exitCode, output: testProcess.output, stdout: testProcess.stdout, stderr: testProcess.stderr };
}

export function cleanEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
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
    PLAYWRIGHT_HTML_OPEN: undefined,
    PW_TEST_REPORTER: undefined,
    PW_TEST_REPORTER_WS_ENDPOINT: undefined,
    PW_TEST_SOURCE_TRANSFORM: undefined,
    PW_TEST_SOURCE_TRANSFORM_SCOPE: undefined,
    PWTEST_BOT_NAME: undefined,
    TEST_WORKER_INDEX: undefined,
    TEST_PARALLEL_INDEX: undefined,
    NODE_OPTIONS: undefined,
    ...env,
  };
}

export type RunOptions = {
  additionalArgs?: string[];
  cwd?: string,
};
type Fixtures = {
  writeFiles: (files: Files) => Promise<string>;
  deleteFile: (file: string) => Promise<void>;
  runInlineTest: (files: Files, params?: Params, env?: NodeJS.ProcessEnv, options?: RunOptions) => Promise<RunResult>;
  runCLICommand: (files: Files, command: string, args?: string[]) => Promise<{ stdout: string, stderr: string, exitCode: number }>;
  startCLICommand: (files: Files, command: string, args?: string[], options?: RunOptions) => Promise<TestChildProcess>;
  runWatchTest: (files: Files, params?: Params, env?: NodeJS.ProcessEnv, options?: RunOptions) => Promise<TestChildProcess>;
  interactWithTestRunner: (files: Files, params?: Params, env?: NodeJS.ProcessEnv, options?: RunOptions) => Promise<TestChildProcess>;
  runTSC: (files: Files) => Promise<TSCResult>;
  mergeReports: (reportFolder: string, env?: NodeJS.ProcessEnv, options?: RunOptions) => Promise<CliRunResult>
  useIntermediateMergeReport: boolean;
  nodeVersion: { major: number, minor: number, patch: number };
};

export const test = base
    .extend<CommonFixtures, CommonWorkerFixtures>(commonFixtures as any)
    .extend<ServerFixtures, ServerWorkerOptions>(serverFixtures as any)
    .extend<Fixtures>({
      writeFiles: async ({}, use, testInfo) => {
        await use(files => writeFiles(testInfo, files, false));
      },

      deleteFile: async ({}, use, testInfo) => {
        await use(async file => {
          const baseDir = testInfo.outputPath();
          await fs.promises.unlink(path.join(baseDir, file));
        });
      },

      runInlineTest: async ({ childProcess, mergeReports, useIntermediateMergeReport }, use, testInfo: TestInfo) => {
        const cacheDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-test-cache-'));
        await use(async (files: Files, params: Params = {}, env: NodeJS.ProcessEnv = {}, options: RunOptions = {}) => {
          const baseDir = await writeFiles(testInfo, files, true);
          return await runPlaywrightTest(childProcess, baseDir, params, { ...env, PWTEST_CACHE_DIR: cacheDir }, options, files, mergeReports, useIntermediateMergeReport);
        });
        await removeFolders([cacheDir]);
      },

      runCLICommand: async ({ childProcess }, use, testInfo: TestInfo) => {
        const cacheDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-test-cache-'));
        await use(async (files: Files, command: string, args?: string[]) => {
          const baseDir = await writeFiles(testInfo, files, true);
          return await runPlaywrightCLI(childProcess, [command, ...(args || [])], baseDir, { PWTEST_CACHE_DIR: cacheDir });
        });
        await removeFolders([cacheDir]);
      },

      startCLICommand: async ({ childProcess }, use, testInfo: TestInfo) => {
        const cacheDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-test-cache-'));
        await use(async (files: Files, command: string, args?: string[], options: RunOptions = {}) => {
          const baseDir = await writeFiles(testInfo, files, true);
          return startPlaywrightChildProcess(childProcess, baseDir, [command, ...(args || [])], { PWTEST_CACHE_DIR: cacheDir }, options);
        });
        await removeFolders([cacheDir]);
      },

      runWatchTest: async ({ interactWithTestRunner }, use, testInfo: TestInfo) => {
        await use((files, params, env, options) => interactWithTestRunner(files, params, { ...env, PWTEST_WATCH: '1' }, options));
      },

      interactWithTestRunner: async ({ childProcess }, use, testInfo: TestInfo) => {
        const cacheDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-test-cache-'));
        let testProcess: TestChildProcess | undefined;
        await use(async (files: Files, params: Params = {}, env: NodeJS.ProcessEnv = {}, options: RunOptions = {}) => {
          const baseDir = await writeFiles(testInfo, files, true);
          testProcess = startPlaywrightTest(childProcess, baseDir, params, { ...env, PWTEST_CACHE_DIR: cacheDir }, options);
          return testProcess;
        });
        await testProcess?.kill();
        await removeFolders([cacheDir]);
      },

      runTSC: async ({ childProcess }, use, testInfo) => {
        testInfo.slow();

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

      mergeReports: async ({ childProcess }, use) => {
        await use(async (reportFolder: string, env: NodeJS.ProcessEnv = {}, options: RunOptions = {}) => {
          const command = ['node', cliEntrypoint, 'merge-reports', reportFolder];
          if (options.additionalArgs)
            command.push(...options.additionalArgs);

          const cwd = options.cwd ? path.resolve(test.info().outputDir, options.cwd) : test.info().outputDir;
          const testProcess = childProcess({
            command,
            env: cleanEnv(env),
            cwd,
          });
          const { exitCode } = await testProcess.exited;
          const output = testProcess.output.toString();
          return {
            exitCode,
            output,
            outputLines: parseOutputLines(output),
          };
        });
      },

      nodeVersion: async ({}, use) => {
        const [major, minor, patch] = process.versions.node.split('.');
        await use({ major: +major, minor: +minor, patch: +patch });
      },

      useIntermediateMergeReport: async ({}, use) => {
        await use(process.env.PWTEST_INTERMEDIATE_BLOB_REPORT === '1');
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
    'skipLibCheck': true,
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

function parseOutputLines(output: string): string[] {
  return output.split('\n').filter(line => line.startsWith('%%')).map(line => line.substring(2).trim());
}

export function parseTestRunnerOutput(output: string) {
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
  const didNotRun = summary(/(\d+) did not run/g);

  const strippedOutput = stripAnsi(output);
  return {
    output: strippedOutput,
    outputLines: parseOutputLines(strippedOutput),
    rawOutput: output,
    passed,
    failed,
    flaky,
    skipped,
    interrupted,
    didNotRun,
  };
}

export const playwrightCtConfigText = `
import { defineConfig } from '@playwright/experimental-ct-react';
export default defineConfig({
  use: {
    ctPort: ${3200 + (+process.env.TEST_PARALLEL_INDEX)}
  },
  projects: [{name: 'default'}],
});
`;

export async function removeFolders(dirs: string[]): Promise<Error[]> {
  return await Promise.all(dirs.map((dir: string) =>
    fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 10 }).catch(e => e)
  ));
}
