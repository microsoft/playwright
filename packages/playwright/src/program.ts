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

import fs from 'fs';
import path from 'path';

import { program } from 'playwright-core/lib/cli/program';
import { gracefullyProcessExitDoNotHang, startProfiling, stopProfiling } from 'playwright-core/lib/utils';

import { builtInReporters, defaultReporter, defaultTimeout } from './common/config';
import { loadConfigFromFile, loadEmptyConfigForMergeReports, resolveConfigLocation } from './common/configLoader';
export { program } from 'playwright-core/lib/cli/program';
import { terminalScreen } from './reporters/base';
import { showHTMLReport } from './reporters/html';
import { createMergedReport } from './reporters/merge';
import { filterProjects } from './runner/projectUtils';
import * as testServer from './runner/testServer';
import { runWatchModeLoop } from './runner/watchMode';
import { runAllTestsWithConfig, TestRunner } from './runner/testRunner';
import { createErrorCollectingReporter } from './runner/reporters';
import { ServerBackendFactory, runMainBackend } from './mcp/sdk/exports';
import { TestServerBackend } from './mcp/test/testBackend';
import { decorateCommand } from './mcp/program';
import { setupExitWatchdog } from './mcp/browser/watchdog';
import { initClaudeCodeRepo, initOpencodeRepo, initVSCodeRepo } from './agents/generateAgents';

import type { ConfigCLIOverrides } from './common/ipc';
import type { TraceMode } from '../types/test';
import type { ReporterDescription } from '../types/test';
import type { Command } from 'playwright-core/lib/utilsBundle';

const packageJSON = require('../package.json');

function addTestCommand(program: Command) {
  const command = program.command('test [test-filter...]');
  command.description('run tests with Playwright Test');
  const options = testOptions.sort((a, b) => a[0].replace(/-/g, '').localeCompare(b[0].replace(/-/g, '')));
  options.forEach(([name, { description, choices, preset }]) => {
    const option = command.createOption(name, description);
    if (choices)
      option.choices(choices);
    if (preset)
      option.preset(preset);
    // We don't set the default value here, because we want not specified options to
    // fall back to the user config, which we haven't parsed yet.
    command.addOption(option);
    return command;
  });
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

function addClearCacheCommand(program: Command) {
  const command = program.command('clear-cache');
  command.description('clears build and test caches');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.action(async opts => {
    const runner = new TestRunner(resolveConfigLocation(opts.config), {});
    const { status } = await runner.clearCache(createErrorCollectingReporter(terminalScreen));
    const exitCode = status === 'interrupted' ? 130 : (status === 'passed' ? 0 : 1);
    gracefullyProcessExitDoNotHang(exitCode);
  });
}

function addDevServerCommand(program: Command) {
  const command = program.command('dev-server', { hidden: true });
  command.description('start dev server');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.action(async options => {
    const runner = new TestRunner(resolveConfigLocation(options.config), {});
    await runner.startDevServer(createErrorCollectingReporter(terminalScreen), 'in-process');
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

function addBrowserMCPServerCommand(program: Command) {
  const command = program.command('run-mcp-server', { hidden: true });
  command.description('Interact with the browser over MCP');
  decorateCommand(command, packageJSON.version);
}

function addTestMCPServerCommand(program: Command) {
  const command = program.command('run-test-mcp-server', { hidden: true });
  command.description('Interact with the test runner over MCP');
  command.option('--headless', 'run browser in headless mode, headed by default');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.option('--host <host>', 'host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.');
  command.option('--port <port>', 'port to listen on for SSE transport.');
  command.action(async options => {
    setupExitWatchdog();
    const backendFactory: ServerBackendFactory = {
      name: 'Playwright Test Runner',
      nameInConfig: 'playwright-test-runner',
      version: packageJSON.version,
      create: () => new TestServerBackend(options.config, { muteConsole: options.port === undefined, headless: options.headless }),
    };
    const mdbUrl = await runMainBackend(backendFactory, { port: options.port === undefined ? undefined : +options.port });
    if (mdbUrl)
      console.error('MCP Listening on: ', mdbUrl);
  });
}

function addInitAgentsCommand(program: Command) {
  const command = program.command('init-agents', { hidden: true });
  command.description('Initialize repository agents for the Claude Code');
  const option = command.createOption('--loop <loop>', 'Agentic loop provider');
  option.choices(['claude', 'opencode', 'vscode']);
  command.addOption(option);
  command.action(async opts => {
    if (opts.loop === 'opencode')
      await initOpencodeRepo();
    else if (opts.loop === 'vscode')
      await initVSCodeRepo();
    else if (opts.loop === 'claude')
      await initClaudeCodeRepo();
  });
}

async function runTests(args: string[], opts: { [key: string]: any }) {
  await startProfiling();
  const cliOverrides = overridesFromOptions(opts);

  const config = await loadConfigFromFile(opts.config, cliOverrides, opts.deps === false);
  config.cliArgs = args;
  config.cliGrep = opts.grep as string | undefined;
  config.cliOnlyChanged = opts.onlyChanged === true ? 'HEAD' : opts.onlyChanged;
  config.cliGrepInvert = opts.grepInvert as string | undefined;
  config.cliListOnly = !!opts.list;
  config.cliProjectFilter = opts.project || undefined;
  config.cliPassWithNoTests = !!opts.passWithNoTests;
  config.cliLastFailed = !!opts.lastFailed;
  config.cliLastRunFile = opts.lastRunFile ? path.resolve(process.cwd(), opts.lastRunFile) : undefined;

  // Evaluate project filters against config before starting execution. This enables a consistent error message across run modes
  filterProjects(config.projects, config.cliProjectFilter);

  if (opts.ui || opts.uiHost || opts.uiPort) {
    if (opts.onlyChanged)
      throw new Error(`--only-changed is not supported in UI mode. If you'd like that to change, see https://github.com/microsoft/playwright/issues/15075 for more details.`);

    const status = await testServer.runUIMode(opts.config, cliOverrides, {
      host: opts.uiHost,
      port: opts.uiPort ? +opts.uiPort : undefined,
      args,
      grep: opts.grep as string | undefined,
      grepInvert: opts.grepInvert as string | undefined,
      project: opts.project || undefined,
      reporter: Array.isArray(opts.reporter) ? opts.reporter : opts.reporter ? [opts.reporter] : undefined,
    });
    await stopProfiling('runner');
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
    const exitCode = status === 'interrupted' ? 130 : (status === 'passed' ? 0 : 1);
    gracefullyProcessExitDoNotHang(exitCode);
    return;
  }

  const status = await runAllTestsWithConfig(config);
  await stopProfiling('runner');
  const exitCode = status === 'interrupted' ? 130 : (status === 'passed' ? 0 : 1);
  gracefullyProcessExitDoNotHang(exitCode);
}

async function runTestServer(opts: { [key: string]: any }) {
  const host = opts.host || 'localhost';
  const port = opts.port ? +opts.port : 0;
  const status = await testServer.runTestServer(opts.config, { }, { host, port });
  const exitCode = status === 'interrupted' ? 130 : (status === 'passed' ? 0 : 1);
  gracefullyProcessExitDoNotHang(exitCode);
}

async function mergeReports(reportDir: string | undefined, opts: { [key: string]: any }) {
  const configFile = opts.config;
  const config = configFile ? await loadConfigFromFile(configFile) : await loadEmptyConfigForMergeReports();

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
  const overrides: ConfigCLIOverrides = {
    failOnFlakyTests: options.failOnFlakyTests ? true : undefined,
    forbidOnly: options.forbidOnly ? true : undefined,
    fullyParallel: options.fullyParallel ? true : undefined,
    globalTimeout: options.globalTimeout ? parseInt(options.globalTimeout, 10) : undefined,
    maxFailures: options.x ? 1 : (options.maxFailures ? parseInt(options.maxFailures, 10) : undefined),
    outputDir: options.output ? path.resolve(process.cwd(), options.output) : undefined,
    quiet: options.quiet ? options.quiet : undefined,
    repeatEach: options.repeatEach ? parseInt(options.repeatEach, 10) : undefined,
    retries: options.retries ? parseInt(options.retries, 10) : undefined,
    reporter: resolveReporterOption(options.reporter),
    shard: resolveShardOption(options.shard),
    timeout: options.timeout ? parseInt(options.timeout, 10) : undefined,
    tsconfig: options.tsconfig ? path.resolve(process.cwd(), options.tsconfig) : undefined,
    ignoreSnapshots: options.ignoreSnapshots ? !!options.ignoreSnapshots : undefined,
    updateSnapshots: options.updateSnapshots,
    updateSourceMethod: options.updateSourceMethod,
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
    overrides.use = overrides.use || {};
    overrides.use.trace = options.trace;
  }
  if (overrides.tsconfig && !fs.existsSync(overrides.tsconfig))
    throw new Error(`--tsconfig "${options.tsconfig}" does not exist`);

  return overrides;
}

function resolveReporterOption(reporter?: string): ReporterDescription[] | undefined {
  if (!reporter || !reporter.length)
    return undefined;
  return reporter.split(',').map((r: string) => [resolveReporter(r)]);
}

function resolveShardOption(shard?: string): ConfigCLIOverrides['shard'] {
  if (!shard)
    return undefined;

  const shardPair = shard.split('/');

  if (shardPair.length !== 2) {
    throw new Error(
        `--shard "${shard}", expected format is "current/all", 1-based, for example "3/5".`,
    );
  }

  const current = parseInt(shardPair[0], 10);
  const total = parseInt(shardPair[1], 10);

  if (isNaN(total) || total < 1)
    throw new Error(`--shard "${shard}" total must be a positive number`);


  if (isNaN(current) || current < 1 || current > total) {
    throw new Error(
        `--shard "${shard}" current must be a positive number, not greater than shard total`,
    );
  }

  return { current, total };
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

// Note: update docs/src/test-cli-js.md when you update this, program is the source of truth.

const testOptions: [string, { description: string, choices?: string[], preset?: string }][] = [
  /* deprecated */ ['--browser <browser>', { description: `Browser to use for tests, one of "all", "chromium", "firefox" or "webkit" (default: "chromium")` }],
  ['-c, --config <file>', { description: `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"` }],
  ['--debug', { description: `Run tests with Playwright Inspector. Shortcut for "PWDEBUG=1" environment variable and "--timeout=0 --max-failures=1 --headed --workers=1" options` }],
  ['--fail-on-flaky-tests', { description: `Fail if any test is flagged as flaky (default: false)` }],
  ['--forbid-only', { description: `Fail if test.only is called (default: false)` }],
  ['--fully-parallel', { description: `Run all tests in parallel (default: false)` }],
  ['--global-timeout <timeout>', { description: `Maximum time this test suite can run in milliseconds (default: unlimited)` }],
  ['-g, --grep <grep>', { description: `Only run tests matching this regular expression (default: ".*")` }],
  ['--grep-invert <grep>', { description: `Only run tests that do not match this regular expression` }],
  ['--headed', { description: `Run tests in headed browsers (default: headless)` }],
  ['--ignore-snapshots', { description: `Ignore screenshot and snapshot expectations` }],
  ['--last-failed', { description: `Only re-run the failures` }],
  ['--last-run-file <file>', { description: `Path to the last-run file (default: "test-results/.last-run.json")` }],
  ['--list', { description: `Collect all the tests and report them, but do not run` }],
  ['--max-failures <N>', { description: `Stop after the first N failures` }],
  ['--no-deps', { description: `Do not run project dependencies` }],
  ['--output <dir>', { description: `Folder for output artifacts (default: "test-results")` }],
  ['--only-changed [ref]', { description: `Only run test files that have been changed between 'HEAD' and 'ref'. Defaults to running all uncommitted changes. Only supports Git.` }],
  ['--pass-with-no-tests', { description: `Makes test run succeed even if no tests were found` }],
  ['--project <project-name...>', { description: `Only run tests from the specified list of projects, supports '*' wildcard (default: run all projects)` }],
  ['--quiet', { description: `Suppress stdio` }],
  ['--repeat-each <N>', { description: `Run each test N times (default: 1)` }],
  ['--reporter <reporter>', { description: `Reporter to use, comma-separated, can be ${builtInReporters.map(name => `"${name}"`).join(', ')} (default: "${defaultReporter}")` }],
  ['--retries <retries>', { description: `Maximum retry count for flaky tests, zero for no retries (default: no retries)` }],
  ['--shard <shard>', { description: `Shard tests and execute only the selected shard, specify in the form "current/all", 1-based, for example "3/5"` }],
  ['--timeout <timeout>', { description: `Specify test timeout threshold in milliseconds, zero for unlimited (default: ${defaultTimeout})` }],
  ['--trace <mode>', { description: `Force tracing mode`, choices: kTraceModes as string[] }],
  ['--tsconfig <path>', { description: `Path to a single tsconfig applicable to all imported files (default: look up tsconfig for each imported file separately)` }],
  ['--ui', { description: `Run tests in interactive UI mode` }],
  ['--ui-host <host>', { description: `Host to serve UI on; specifying this option opens UI in a browser tab` }],
  ['--ui-port <port>', { description: `Port to serve UI on, 0 for any free port; specifying this option opens UI in a browser tab` }],
  ['-u, --update-snapshots [mode]', { description: `Update snapshots with actual results. Running tests without the flag defaults to "missing"`, choices: ['all', 'changed', 'missing', 'none'], preset: 'changed' }],
  ['--update-source-method <method>', { description: `Chooses the way source is updated (default: "patch")`, choices: ['overwrite', '3way', 'patch'] }],
  ['-j, --workers <workers>', { description: `Number of concurrent workers or percentage of logical CPU cores, use 1 to run in a single worker (default: 50%)` }],
  ['-x', { description: `Stop after the first failure` }],
];

addTestCommand(program);
addShowReportCommand(program);
addMergeReportsCommand(program);
addClearCacheCommand(program);
addBrowserMCPServerCommand(program);
addTestMCPServerCommand(program);
addDevServerCommand(program);
addTestServerCommand(program);
addInitAgentsCommand(program);
