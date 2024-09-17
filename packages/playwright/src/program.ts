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
import { stopProfiling, startProfiling, gracefullyProcessExitDoNotHang } from 'playwright-core/lib/utils';
import { serializeError } from './util';
import { showHTMLReport } from './reporters/html';
import { createMergedReport } from './reporters/merge';
import { loadConfigFromFileRestartIfNeeded, loadEmptyConfigForMergeReports, resolveConfigLocation } from './common/configLoader';
import type { ConfigCLIOverrides } from './common/ipc';
import type { TestError } from '../types/testReporter';
import type { TraceMode } from '../types/test';
import { builtInReporters, defaultReporter, defaultTimeout } from './common/config';
import { program } from 'playwright-core/lib/cli/program';
export { program } from 'playwright-core/lib/cli/program';
import type { ReporterDescription } from '../types/test';
import { prepareErrorStack } from './reporters/base';
import * as testServer from './runner/testServer';
import { runWatchModeLoop } from './runner/watchMode';

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
      gracefullyProcessExitDoNotHang(1);
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
  command.option('--project <project-name...>', `Only run tests from the specified list of projects, supports '*' wildcard (default: list all projects)`);
  command.action(async (args, opts) => listTestFiles(opts));
}

function addClearCacheCommand(program: Command) {
  const command = program.command('clear-cache');
  command.description('clears build and test caches');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.action(async opts => {
    const config = await loadConfigFromFileRestartIfNeeded(opts.config);
    if (!config)
      return;
    const runner = new Runner(config);
    const { status } = await runner.clearCache();
    const exitCode = status === 'interrupted' ? 130 : (status === 'passed' ? 0 : 1);
    gracefullyProcessExitDoNotHang(exitCode);
  });
}

function addFindRelatedTestFilesCommand(program: Command) {
  const command = program.command('find-related-test-files [source-files...]', { hidden: true });
  command.description('Returns the list of related tests to the given files');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.action(async (files, options) => {
    const resolvedFiles = (files as string[]).map(file => path.resolve(process.cwd(), file));
    await withRunnerAndMutedWrite(options.config, runner => runner.findRelatedTestFiles(resolvedFiles));
  });
}

function addDevServerCommand(program: Command) {
  const command = program.command('dev-server', { hidden: true });
  command.description('start dev server');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.action(async options => {
    const config = await loadConfigFromFileRestartIfNeeded(options.config);
    if (!config)
      return;
    const runner = new Runner(config);
    const { status } = await runner.runDevServer();
    const exitCode = status === 'interrupted' ? 130 : (status === 'passed' ? 0 : 1);
    gracefullyProcessExitDoNotHang(exitCode);
  });
}

function addTestServerCommand(program: Command) {
  const command = program.command('test-server', { hidden: true });
  command.description('start test server');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.option('--host <host>', 'Host to start the server on', 'localhost');
  command.option('--port <port>', 'Port to start the server on', '0');
  command.action(opts => runTestServer(opts));
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
  const command = program.command('merge-reports [dir]');
  command.description('merge multiple blob reports (for sharded tests) into a single report');
  command.action(async (dir, options) => {
    try {
      await mergeReports(dir, options);
    } catch (e) {
      console.error(e);
      gracefullyProcessExitDoNotHang(1);
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
  const cliOverrides = overridesFromOptions(opts);

  if (opts.ui || opts.uiHost || opts.uiPort) {
    if (opts.onlyChanged)
      throw new Error(`--only-changed is not supported in UI mode. If you'd like that to change, see https://github.com/microsoft/playwright/issues/15075 for more details.`);

    const status = await testServer.runUIMode(opts.config, {
      host: opts.uiHost,
      port: opts.uiPort ? +opts.uiPort : undefined,
      args,
      grep: opts.grep as string | undefined,
      grepInvert: opts.grepInvert as string | undefined,
      project: opts.project || undefined,
      headed: opts.headed,
      reporter: Array.isArray(opts.reporter) ? opts.reporter : opts.reporter ? [opts.reporter] : undefined,
      workers: cliOverrides.workers,
      timeout: cliOverrides.timeout,
      outputDir: cliOverrides.outputDir,
      updateSnapshots: cliOverrides.updateSnapshots,
    });
    await stopProfiling('runner');
    if (status === 'restarted')
      return;
    const exitCode = status === 'interrupted' ? 130 : (status === 'passed' ? 0 : 1);
    gracefullyProcessExitDoNotHang(exitCode);
    return;
  }

  if (process.env.PWTEST_WATCH) {
    if (opts.onlyChanged)
      throw new Error(`--only-changed is not supported in watch mode. If you'd like that to change, file an issue and let us know about your usecase for it.`);

    const status = await runWatchModeLoop(
        resolveConfigLocation(opts.config),
        {
          projects: opts.project,
          files: args,
          grep: opts.grep
        }
    );
    await stopProfiling('runner');
    if (status === 'restarted')
      return;
    const exitCode = status === 'interrupted' ? 130 : (status === 'passed' ? 0 : 1);
    gracefullyProcessExitDoNotHang(exitCode);
    return;
  }

  const config = await loadConfigFromFileRestartIfNeeded(opts.config, cliOverrides, opts.deps === false);
  if (!config)
    return;

  config.cliArgs = args;
  config.cliGrep = opts.grep as string | undefined;
  config.cliOnlyChanged = opts.onlyChanged === true ? 'HEAD' : opts.onlyChanged;
  config.cliGrepInvert = opts.grepInvert as string | undefined;
  config.cliListOnly = !!opts.list;
  config.cliProjectFilter = opts.project || undefined;
  config.cliPassWithNoTests = !!opts.passWithNoTests;
  config.cliFailOnFlakyTests = !!opts.failOnFlakyTests;
  config.cliLastFailed = !!opts.lastFailed;

  const runner = new Runner(config);
  const status = await runner.runAllTests();
  await stopProfiling('runner');
  const exitCode = status === 'interrupted' ? 130 : (status === 'passed' ? 0 : 1);
  gracefullyProcessExitDoNotHang(exitCode);
}

async function runTestServer(opts: { [key: string]: any }) {
  const host = opts.host || 'localhost';
  const port = opts.port ? +opts.port : 0;
  const status = await testServer.runTestServer(opts.config, { host, port });
  if (status === 'restarted')
    return;
  const exitCode = status === 'interrupted' ? 130 : (status === 'passed' ? 0 : 1);
  gracefullyProcessExitDoNotHang(exitCode);
}

export async function withRunnerAndMutedWrite(configFile: string | undefined, callback: (runner: Runner) => Promise<any>) {
  // Redefine process.stdout.write in case config decides to pollute stdio.
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((a: any, b: any, c: any) => process.stderr.write(a, b, c)) as any;
  try {
    const config = await loadConfigFromFileRestartIfNeeded(configFile);
    if (!config)
      return;
    const runner = new Runner(config);
    const result = await callback(runner);
    stdoutWrite(JSON.stringify(result, undefined, 2), () => {
      gracefullyProcessExitDoNotHang(0);
    });
  } catch (e) {
    const error: TestError = serializeError(e);
    error.location = prepareErrorStack(e.stack).location;
    stdoutWrite(JSON.stringify({ error }, undefined, 2), () => {
      gracefullyProcessExitDoNotHang(0);
    });
  }
}

async function listTestFiles(opts: { [key: string]: any }) {
  await withRunnerAndMutedWrite(opts.config, async runner => {
    return await runner.listTestFiles();
  });
}

async function mergeReports(reportDir: string | undefined, opts: { [key: string]: any }) {
  const configFile = opts.config;
  const config = configFile ? await loadConfigFromFileRestartIfNeeded(configFile) : await loadEmptyConfigForMergeReports();
  if (!config)
    return;

  const dir = path.resolve(process.cwd(), reportDir || '');
  const dirStat = await fs.promises.stat(dir).catch(e => null);
  if (!dirStat)
    throw new Error('Directory does not exist: ' + dir);
  if (!dirStat.isDirectory())
    throw new Error(`"${dir}" is not a directory`);
  let reporterDescriptions: ReporterDescription[] | undefined = resolveReporterOption(opts.reporter);
  if (!reporterDescriptions && configFile)
    reporterDescriptions = config.config.reporter;
  if (!reporterDescriptions)
    reporterDescriptions = [[defaultReporter]];
  const rootDirOverride = configFile ? config.config.rootDir : undefined;
  await createMergedReport(config, dir, reporterDescriptions!, rootDirOverride);
  gracefullyProcessExitDoNotHang(0);
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
    tsconfig: options.tsconfig ? path.resolve(process.cwd(), options.tsconfig) : undefined,
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
    overrides.debug = true;
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

const kTraceModes: TraceMode[] = ['on', 'off', 'on-first-retry', 'on-all-retries', 'retain-on-failure', 'retain-on-first-failure'];

const testOptions: [string, string][] = [
  ['--browser <browser>', `Browser to use for tests, one of "all", "chromium", "firefox" or "webkit" (default: "chromium")`],
  ['-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`],
  ['--debug', `Run tests with Playwright Inspector. Shortcut for "PWDEBUG=1" environment variable and "--timeout=0 --max-failures=1 --headed --workers=1" options`],
  ['--fail-on-flaky-tests', `Fail if any test is flagged as flaky (default: false)`],
  ['--forbid-only', `Fail if test.only is called (default: false)`],
  ['--fully-parallel', `Run all tests in parallel (default: false)`],
  ['--global-timeout <timeout>', `Maximum time this test suite can run in milliseconds (default: unlimited)`],
  ['-g, --grep <grep>', `Only run tests matching this regular expression (default: ".*")`],
  ['-gv, --grep-invert <grep>', `Only run tests that do not match this regular expression`],
  ['--headed', `Run tests in headed browsers (default: headless)`],
  ['--ignore-snapshots', `Ignore screenshot and snapshot expectations`],
  ['--last-failed', `Only re-run the failures`],
  ['--list', `Collect all the tests and report them, but do not run`],
  ['--max-failures <N>', `Stop after the first N failures`],
  ['--no-deps', 'Do not run project dependencies'],
  ['--output <dir>', `Folder for output artifacts (default: "test-results")`],
  ['--only-changed [ref]', `Only run test files that have been changed between 'HEAD' and 'ref'. Defaults to running all uncommitted changes. Only supports Git.`],
  ['--pass-with-no-tests', `Makes test run succeed even if no tests were found`],
  ['--project <project-name...>', `Only run tests from the specified list of projects, supports '*' wildcard (default: run all projects)`],
  ['--quiet', `Suppress stdio`],
  ['--repeat-each <N>', `Run each test N times (default: 1)`],
  ['--reporter <reporter>', `Reporter to use, comma-separated, can be ${builtInReporters.map(name => `"${name}"`).join(', ')} (default: "${defaultReporter}")`],
  ['--retries <retries>', `Maximum retry count for flaky tests, zero for no retries (default: no retries)`],
  ['--shard <shard>', `Shard tests and execute only the selected shard, specify in the form "current/all", 1-based, for example "3/5"`],
  ['--timeout <timeout>', `Specify test timeout threshold in milliseconds, zero for unlimited (default: ${defaultTimeout})`],
  ['--trace <mode>', `Force tracing mode, can be ${kTraceModes.map(mode => `"${mode}"`).join(', ')}`],
  ['--tsconfig <path>', `Path to a single tsconfig applicable to all imported files (default: look up tsconfig for each imported file separately)`],
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
addClearCacheCommand(program);
addFindRelatedTestFilesCommand(program);
addDevServerCommand(program);
addTestServerCommand(program);
