/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

/* eslint-disable no-console */

import type { Command } from 'playwright-core/lib/utilsBundle';
import fs from 'fs';
import path from 'path';
import { Runner } from './runner/runner';
import { stopProfiling, startProfiling } from 'playwright-core/lib/utils';
import { experimentalLoaderOption, fileIsModule, serializeError } from './util';
import { showHTMLReport } from './reporters/html';
import { createMergedReport } from './reporters/merge';
import { ConfigLoader, resolveConfigFile } from './common/configLoader';
import type { ConfigCLIOverrides } from './common/ipc';
import type { FullResult, TestError } from '../reporter';
import type { TraceMode } from '../types/test';
import { builtInReporters, defaultReporter, defaultTimeout } from './common/config';
import type { FullConfigInternal } from './common/config';
import program from 'playwright-core/lib/cli/program';
import type { ReporterDescription } from '..';
import { prepareErrorStack } from './reporters/base';

function addTestCommand(program: Command) {
  const command = program.command('test [test-filter...]');
  command.description('run tests with Playwright Test');
  const options = testOptions.sort((a, b) => a[0].replace(/-/g, '').localeCompare(b[0].replace(/-/g, '')));
  options.forEach(([name, description]) => command.option(name, description));
  command.action(async (args, opts) => {
    try {
      await runTests(args, opts);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
  command.addHelpText('afterAll', `
Arguments [test-filter...]:
  Pass arguments to filter test files. Each argument is treated as a regular expression. Matching is performed against the absolute file paths.

Examples:
  $ npx playwright test my.spec.ts
  $ npx playwright test some.spec.ts:42
  $ npx playwright test --headed
  $ npx playwright test --project=webkit`);
}

function addListFilesCommand(program: Command) {
  const command = program.command('list-files [file-filter...]', { hidden: true });
  command.description('List files with Playwright Test tests');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.option('--project <project-name...>', `Only run tests from the specified list of projects (default: list all projects)`);
  command.action(async (args, opts) => {
    try {
      await listTestFiles(opts);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
}

function addShowReportCommand(program: Command) {
  const command = program.command('show-report [report]');
  command.description('show HTML report');
  command.action((report, options) => showHTMLReport(report, options.host, +options.port));
  command.option('--host <host>', 'Host to serve report on', 'localhost');
  command.option('--port <port>', 'Port to serve report on', '9323');
  command.addHelpText('afterAll', `
Arguments [report]:
  When specified, opens given report, otherwise opens last generated report.

Examples:
  $ npx playwright show-report
  $ npx playwright show-report playwright-report`);
}

function addMergeReportsCommand(program: Command) {
  const command = program.command('merge-reports [dir]', { hidden: true });
  command.description('merge multiple blob reports (for sharded tests) into a single report');
  command.action(async (dir, options) => {
    try {
      await mergeReports(dir, options);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
  command.option('-c, --config <file>', `Configuration file. Can be used to specify additional configuration for the output report.`);
  command.option('--reporter <reporter>', `Reporter to use, comma-separated, can be ${builtInReporters.map(name => `"${name}"`).join(', ')} (default: "${defaultReporter}")`);
  command.addHelpText('afterAll', `
Arguments [dir]:
  Directory containing blob reports.

Examples:
  $ npx playwright merge-reports playwright-report`);
}


async function runTests(args: string[], opts: { [key: string]: any }) {
  await startProfiling();

  // When no --config option is passed, let's look for the config file in the current directory.
  const configFileOrDirectory = opts.config ? path.resolve(process.cwd(), opts.config) : process.cwd();
  const resolvedConfigFile = resolveConfigFile(configFileOrDirectory);
  if (restartWithExperimentalTsEsm(resolvedConfigFile))
    return;

  const overrides = overridesFromOptions(opts);
  const configLoader = new ConfigLoader(overrides);
  let config: FullConfigInternal;
  if (resolvedConfigFile)
    config = await configLoader.loadConfigFile(resolvedConfigFile, opts.deps === false);
  else
    config = await configLoader.loadEmptyConfig(configFileOrDirectory);

  config.cliArgs = args;
  config.cliGrep = opts.grep as string | undefined;
  config.cliGrepInvert = opts.grepInvert as string | undefined;
  config.cliListOnly = !!opts.list;
  config.cliProjectFilter = opts.project || undefined;
  config.cliPassWithNoTests = !!opts.passWithNoTests;

  const runner = new Runner(config);
  let status: FullResult['status'];
  if (opts.ui || opts.uiHost || opts.uiPort)
    status = await runner.uiAllTests({ host: opts.uiHost, port: opts.uiPort ? +opts.uiPort : undefined });
  else if (process.env.PWTEST_WATCH)
    status = await runner.watchAllTests();
  else
    status = await runner.runAllTests();
  await stopProfiling('runner');
  if (status === 'interrupted')
    process.exit(130);
  process.exit(status === 'passed' ? 0 : 1);
}

async function listTestFiles(opts: { [key: string]: any }) {
  // Redefine process.stdout.write in case config decides to pollute stdio.
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (() => {}) as any;
  process.stderr.write = (() => {}) as any;
  const configFileOrDirectory = opts.config ? path.resolve(process.cwd(), opts.config) : process.cwd();
  const resolvedConfigFile = resolveConfigFile(configFileOrDirectory)!;
  if (restartWithExperimentalTsEsm(resolvedConfigFile))
    return;

  try {
    const configLoader = new ConfigLoader();
    const config = await configLoader.loadConfigFile(resolvedConfigFile);
    const runner = new Runner(config);
    const report = await runner.listTestFiles(opts.project);
    stdoutWrite(JSON.stringify(report), () => {
      process.exit(0);
    });
  } catch (e) {
    const error: TestError = serializeError(e);
    error.location = prepareErrorStack(e.stack).location;
    stdoutWrite(JSON.stringify({ error }), () => {
      process.exit(0);
    });
  }
}

async function mergeReports(reportDir: string | undefined, opts: { [key: string]: any }) {
  let configFile = opts.config;
  if (configFile) {
    configFile = path.resolve(process.cwd(), configFile);
    if (!fs.existsSync(configFile))
      throw new Error(`${configFile} does not exist`);
    if (!fs.statSync(configFile).isFile())
      throw new Error(`${configFile} is not a file`);
  }
  if (restartWithExperimentalTsEsm(configFile))
    return;

  const configLoader = new ConfigLoader();
  const config = await (configFile ? configLoader.loadConfigFile(configFile) : configLoader.loadEmptyConfig(process.cwd()));
  const dir = path.resolve(process.cwd(), reportDir || '');
  if (!(await fs.promises.stat(dir)).isDirectory())
    throw new Error('Directory does not exist: ' + dir);
  let reporterDescriptions: ReporterDescription[] | undefined = resolveReporterOption(opts.reporter);
  if (!reporterDescriptions && configFile)
    reporterDescriptions = config.config.reporter;
  if (!reporterDescriptions)
    reporterDescriptions = [[defaultReporter]];
  await createMergedReport(config, dir, reporterDescriptions!);
}

function overridesFromOptions(options: { [key: string]: any }): ConfigCLIOverrides {
  const shardPair = options.shard ? options.shard.split('/').map((t: string) => parseInt(t, 10)) : undefined;
  const overrides: ConfigCLIOverrides = {
    forbidOnly: options.forbidOnly ? true : undefined,
    fullyParallel: options.fullyParallel ? true : undefined,
    globalTimeout: options.globalTimeout ? parseInt(options.globalTimeout, 10) : undefined,
    maxFailures: options.x ? 1 : (options.maxFailures ? parseInt(options.maxFailures, 10) : undefined),
    outputDir: options.output ? path.resolve(process.cwd(), options.output) : undefined,
    quiet: options.quiet ? options.quiet : undefined,
    repeatEach: options.repeatEach ? parseInt(options.repeatEach, 10) : undefined,
    retries: options.retries ? parseInt(options.retries, 10) : undefined,
    reporter: resolveReporterOption(options.reporter),
    shard: shardPair ? { current: shardPair[0], total: shardPair[1] } : undefined,
    timeout: options.timeout ? parseInt(options.timeout, 10) : undefined,
    ignoreSnapshots: options.ignoreSnapshots ? !!options.ignoreSnapshots : undefined,
    updateSnapshots: options.updateSnapshots ? 'all' as const : undefined,
    workers: options.workers,
  };

  if (options.browser) {
    const browserOpt = options.browser.toLowerCase();
    if (!['all', 'chromium', 'firefox', 'webkit'].includes(browserOpt))
      throw new Error(`Unsupported browser "${options.browser}", must be one of "all", "chromium", "firefox" or "webkit"`);
    const browserNames = browserOpt === 'all' ? ['chromium', 'firefox', 'webkit'] : [browserOpt];
    overrides.projects = browserNames.map(browserName => {
      return {
        name: browserName,
        use: { browserName },
      };
    });
  }

  if (options.headed || options.debug)
    overrides.use = { headless: false };
  if (!options.ui && options.debug) {
    overrides.maxFailures = 1;
    overrides.timeout = 0;
    overrides.workers = 1;
    process.env.PWDEBUG = '1';
  }
  if (!options.ui && options.trace) {
    if (!kTraceModes.includes(options.trace))
      throw new Error(`Unsupported trace mode "${options.trace}", must be one of ${kTraceModes.map(mode => `"${mode}"`).join(', ')}`);
    overrides.use = overrides.use || {};
    overrides.use.trace = options.trace;
  }
  return overrides;
}

function resolveReporterOption(reporter?: string): ReporterDescription[] | undefined {
  if (!reporter || !reporter.length)
    return undefined;
  return reporter.split(',').map((r: string) => [resolveReporter(r)]);
}

function resolveReporter(id: string) {
  if (builtInReporters.includes(id as any))
    return id;
  const localPath = path.resolve(process.cwd(), id);
  if (fs.existsSync(localPath))
    return localPath;
  return require.resolve(id, { paths: [process.cwd()] });
}

function restartWithExperimentalTsEsm(configFile: string | null): boolean {
  const nodeVersion = +process.versions.node.split('.')[0];
  // New experimental loader is only supported on Node 16+.
  if (nodeVersion < 16)
    return false;
  if (!configFile)
    return false;
  if (process.env.PW_DISABLE_TS_ESM)
    return false;
  if (process.env.PW_TS_ESM_ON)
    return false;
  if (!fileIsModule(configFile))
    return false;
  const NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + experimentalLoaderOption();
  const innerProcess = require('child_process').fork(require.resolve('./cli'), process.argv.slice(2), {
    env: {
      ...process.env,
      NODE_OPTIONS,
      PW_TS_ESM_ON: '1',
    }
  });

  innerProcess.on('close', (code: number | null) => {
    if (code !== 0 && code !== null)
      process.exit(code);
  });
  return true;
}

const kTraceModes: TraceMode[] = ['on', 'off', 'on-first-retry', 'on-all-retries', 'retain-on-failure'];

const testOptions: [string, string][] = [
  ['--browser <browser>', `Browser to use for tests, one of "all", "chromium", "firefox" or "webkit" (default: "chromium")`],
  ['-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`],
  ['--debug', `Run tests with Playwright Inspector. Shortcut for "PWDEBUG=1" environment variable and "--timeout=0 --max-failures=1 --headed --workers=1" options`],
  ['--forbid-only', `Fail if test.only is called (default: false)`],
  ['--fully-parallel', `Run all tests in parallel (default: false)`],
  ['--global-timeout <timeout>', `Maximum time this test suite can run in milliseconds (default: unlimited)`],
  ['-g, --grep <grep>', `Only run tests matching this regular expression (default: ".*")`],
  ['-gv, --grep-invert <grep>', `Only run tests that do not match this regular expression`],
  ['--headed', `Run tests in headed browsers (default: headless)`],
  ['--ignore-snapshots', `Ignore screenshot and snapshot expectations`],
  ['--list', `Collect all the tests and report them, but do not run`],
  ['--max-failures <N>', `Stop after the first N failures`],
  ['--no-deps', 'Do not run project dependencies'],
  ['--output <dir>', `Folder for output artifacts (default: "test-results")`],
  ['--pass-with-no-tests', `Makes test run succeed even if no tests were found`],
  ['--project <project-name...>', `Only run tests from the specified list of projects (default: run all projects)`],
  ['--quiet', `Suppress stdio`],
  ['--repeat-each <N>', `Run each test N times (default: 1)`],
  ['--reporter <reporter>', `Reporter to use, comma-separated, can be ${builtInReporters.map(name => `"${name}"`).join(', ')} (default: "${defaultReporter}")`],
  ['--retries <retries>', `Maximum retry count for flaky tests, zero for no retries (default: no retries)`],
  ['--shard <shard>', `Shard tests and execute only the selected shard, specify in the form "current/all", 1-based, for example "3/5"`],
  ['--timeout <timeout>', `Specify test timeout threshold in milliseconds, zero for unlimited (default: ${defaultTimeout})`],
  ['--trace <mode>', `Force tracing mode, can be ${kTraceModes.map(mode => `"${mode}"`).join(', ')}`],
  ['--ui', `Run tests in interactive UI mode`],
  ['--ui-host <host>', 'Host to serve UI on; specifying this option opens UI in a browser tab'],
  ['--ui-port <port>', 'Port to serve UI on, 0 for any free port; specifying this option opens UI in a browser tab'],
  ['-u, --update-snapshots', `Update snapshots with actual results (default: only create missing snapshots)`],
  ['-j, --workers <workers>', `Number of concurrent workers or percentage of logical CPU cores, use 1 to run in a single worker (default: 50%)`],
  ['-x', `Stop after the first failure`],
];

addTestCommand(program);
addShowReportCommand(program);
addListFilesCommand(program);
addMergeReportsCommand(program);

program.parse(process.argv);
