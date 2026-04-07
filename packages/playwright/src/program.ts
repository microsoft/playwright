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

/* eslint-disable no-console */

import 'playwright-core/lib/bootstrap';

import { libCli } from 'playwright-core/lib/coreBundle';
import { program } from 'playwright-core/lib/utilsBundle';

import { gracefullyProcessExitDoNotHang } from '@serverUtils/processLauncher';

import { builtInReporters, defaultReporter, defaultTimeout } from './common/config';

export { program };

import type { tools } from 'playwright-core/lib/coreBundle';
import type { TraceMode } from '../types/test';
import type { Command } from 'playwright-core/lib/utilsBundle';

const packageJSON = require('../package.json');

libCli.decorateProgram(program);

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
      const { runTests } = await import('./testActions');
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
    const { clearCache } = await import('./testActions');
    await clearCache(opts);
  });
}

function addDevServerCommand(program: Command) {
  const command = program.command('dev-server', { hidden: true });
  command.description('start dev server');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.action(async options => {
    const { startDevServer } = await import('./testActions');
    await startDevServer(options);
  });
}

function addTestServerCommand(program: Command) {
  const command = program.command('test-server', { hidden: true });
  command.description('start test server');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.option('--host <host>', 'Host to start the server on', 'localhost');
  command.option('--port <port>', 'Port to start the server on', '0');
  command.action(async opts => {
    const { runTestServerAction } = await import('./testActions');
    await runTestServerAction(opts);
  });
}

function addShowReportCommand(program: Command) {
  const command = program.command('show-report [report]');
  command.description('show HTML report');
  command.action(async (report, options) => {
    const { showReport } = await import('./reportActions');
    await showReport(report, options.host, +options.port);
  });
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
      const { mergeReports } = await import('./reportActions');
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

function addTestMCPServerCommand(program: Command) {
  const command = program.command('run-test-mcp-server', { hidden: true });
  command.description('Interact with the test runner over MCP');
  command.option('--headless', 'run browser in headless mode, headed by default');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"`);
  command.option('--host <host>', 'host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.');
  command.option('--port <port>', 'port to listen on for SSE transport.');
  command.action(async options => {
    const { tools } = await import('playwright-core/lib/coreBundle');
    const { TestServerBackend, testServerBackendTools } = await import('./mcp/test/testBackend');
    tools.setupExitWatchdog();
    const factory: tools.ServerBackendFactory = {
      name: 'Playwright Test Runner',
      nameInConfig: 'playwright-test-runner',
      version: packageJSON.version,
      toolSchemas: testServerBackendTools.map(tool => tool.schema),
      create: async () => new TestServerBackend(options.config, { muteConsole: options.port === undefined, headless: options.headless }),
      disposed: async () => { }
    };
    // TODO: add all options from mcp.startHttpServer.
    await tools.start(factory, { port: options.port === undefined ? undefined : +options.port, host: options.host });
  });
}

function addInitAgentsCommand(program: Command) {
  const command = program.command('init-agents');
  command.description('Initialize repository agents');
  const option = command.createOption('--loop <loop>', 'Agentic loop provider');
  option.choices(['claude', 'copilot', 'opencode', 'vscode', 'vscode-legacy']);
  command.addOption(option);
  command.option('-c, --config <file>', `Configuration file to find a project to use for seed test`);
  command.option('--project <project>', 'Project to use for seed test');
  command.option('--prompts', 'Whether to include prompts in the agent initialization');
  command.action(async opts => {
    const { loadConfigFromFile } = await import('./common/configLoader');
    const { ClaudeGenerator, OpencodeGenerator, VSCodeGenerator, CopilotGenerator } = await import('./agents/generateAgents');
    const config = await loadConfigFromFile(opts.config);
    if (opts.loop === 'opencode') {
      await OpencodeGenerator.init(config, opts.project, opts.prompts);
    } else if (opts.loop === 'vscode-legacy') {
      await VSCodeGenerator.init(config, opts.project);
    } else if (opts.loop === 'claude') {
      await ClaudeGenerator.init(config, opts.project, opts.prompts);
    } else {
      await CopilotGenerator.init(config, opts.project, opts.prompts);
      return;
    }
  });
}

const kTraceModes: TraceMode[] = ['on', 'off', 'on-first-retry', 'on-all-retries', 'retain-on-failure', 'retain-on-first-failure', 'retain-on-failure-and-retries'];

// Note: update docs/src/test-cli-js.md when you update this, program is the source of truth.

const testOptions: [string, { description: string, choices?: string[], preset?: string }][] = [
  /* deprecated */ ['--browser <browser>', { description: `Browser to use for tests, one of "all", "chromium", "firefox" or "webkit" (default: "chromium")` }],
  ['-c, --config <file>', { description: `Configuration file, or a test directory with optional "playwright.config.{m,c}?{js,ts}"` }],
  ['--debug [mode]', { description: `Run tests with Playwright Inspector. Shortcut for "PWDEBUG=1" environment variable and "--timeout=0 --max-failures=1 --headed --workers=1" options`, choices: ['inspector', 'cli'], preset: 'inspector' }],
  ['--fail-on-flaky-tests', { description: `Fail if any test is flagged as flaky (default: false)` }],
  ['--forbid-only', { description: `Fail if test.only is called (default: false)` }],
  ['--fully-parallel', { description: `Run all tests in parallel (default: false)` }],
  ['--global-timeout <timeout>', { description: `Maximum time this test suite can run in milliseconds (default: unlimited)` }],
  ['-g, --grep <grep>', { description: `Only run tests matching this regular expression (default: ".*")` }],
  ['--grep-invert <grep>', { description: `Only run tests that do not match this regular expression` }],
  ['--headed', { description: `Run tests in headed browsers (default: headless)` }],
  ['--ignore-snapshots', { description: `Ignore screenshot and snapshot expectations` }],
  ['--last-failed', { description: `Only re-run the failures` }],
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
  ['--run-agents <mode>', { description: `Run agents to generate the code for page.perform`, choices: ['missing', 'all', 'none'], preset: 'none' }],
  ['--shard <shard>', { description: `Shard tests and execute only the selected shard, specify in the form "current/all", 1-based, for example "3/5"` }],
  ['--test-list <file>', { description: `Path to a file containing a list of tests to run. See https://playwright.dev/docs/test-cli for more details.` }],
  ['--test-list-invert <file>', { description: `Path to a file containing a list of tests to skip. See https://playwright.dev/docs/test-cli for more details.` }],
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
addTestMCPServerCommand(program);
addDevServerCommand(program);
addTestServerCommand(program);
addInitAgentsCommand(program);
