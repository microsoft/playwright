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

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import type { Config } from './types';
import { Runner, builtInReporters, BuiltInReporter, kDefaultConfigFiles } from './runner';
import { stopProfiling, startProfiling } from './profiler';
import { FilePatternFilter } from './util';
import { showHTMLReport } from './reporters/html';
import { GridServer } from 'playwright-core/lib/grid/gridServer';
import dockerFactory from 'playwright-core/lib/grid/dockerGridFactory';
import { createGuid } from 'playwright-core/lib/utils/utils';

const defaultTimeout = 30000;
const defaultReporter: BuiltInReporter = process.env.CI ? 'dot' : 'list';

export function addTestCommand(program: Command) {
  const command = program.command('test [test-filter...]');
  command.description('Run tests with Playwright Test');
  command.option('--browser <browser>', `Browser to use for tests, one of "all", "chromium", "firefox" or "webkit" (default: "chromium")`);
  command.option('--headed', `Run tests in headed browsers (default: headless)`);
  command.option('--debug', `Run tests with Playwright Inspector. Shortcut for "PWDEBUG=1" environment variable and "--timeout=0 --maxFailures=1 --headed --workers=1" options`);
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional ${kDefaultConfigFiles.map(file => `"${file}"`).join('/')}`);
  command.option('--forbid-only', `Fail if test.only is called (default: false)`);
  command.option('-g, --grep <grep>', `Only run tests matching this regular expression (default: ".*")`);
  command.option('-gv, --grep-invert <grep>', `Only run tests that do not match this regular expression`);
  command.option('--global-timeout <timeout>', `Maximum time this test suite can run in milliseconds (default: unlimited)`);
  command.option('-j, --workers <workers>', `Number of concurrent workers, use 1 to run in a single worker (default: number of CPU cores / 2)`);
  command.option('--list', `Collect all the tests and report them, but do not run`);
  command.option('--max-failures <N>', `Stop after the first N failures`);
  command.option('--output <dir>', `Folder for output artifacts (default: "test-results")`);
  command.option('--quiet', `Suppress stdio`);
  command.option('--repeat-each <N>', `Run each test N times (default: 1)`);
  command.option('--reporter <reporter>', `Reporter to use, comma-separated, can be ${builtInReporters.map(name => `"${name}"`).join(', ')} (default: "${defaultReporter}")`);
  command.option('--retries <retries>', `Maximum retry count for flaky tests, zero for no retries (default: no retries)`);
  command.option('--shard <shard>', `Shard tests and execute only the selected shard, specify in the form "current/all", 1-based, for example "3/5"`);
  command.option('--project <project-name...>', `Only run tests from the specified list of projects (default: run all projects)`);
  command.option('--timeout <timeout>', `Specify test timeout threshold in milliseconds, zero for unlimited (default: ${defaultTimeout})`);
  command.option('-u, --update-snapshots', `Update snapshots with actual results (default: only create missing snapshots)`);
  command.option('-x', `Stop after the first failure`);
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
  Pass arguments to filter test files. Each argument is treated as a regular expression.

Examples:
  $ npx playwright test my.spec.ts
  $ npx playwright test --headed
  $ npx playwright test --browser=webkit`);
}

export function addListTestsCommand(program: Command) {
  const command = program.command('list-tests [test-filter...]', { hidden: true });
  command.description('List tests with Playwright Test');
  command.option('-c, --config <file>', `Configuration file, or a test directory with optional ${kDefaultConfigFiles.map(file => `"${file}"`).join('/')}`);
  command.option('--project <project-name...>', `Only run tests from the specified list of projects (default: list all projects)`);
  command.action(async (args, opts) => {
    try {
      await listTests(opts);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
}

export function addShowReportCommand(program: Command) {
  const command = program.command('show-report [report]');
  command.description('show HTML report');
  command.action(report => showHTMLReport(report));
  command.addHelpText('afterAll', `
Arguments [report]:
  When specified, opens given report, otherwise opens last generated report.

Examples:
  $ npx playwright show-report
  $ npx playwright show-report playwright-report`);
}

async function runTests(args: string[], opts: { [key: string]: any }) {
  await startProfiling();

  const defaultConfig: Config = {
    preserveOutput: 'always',
    reporter: [ [defaultReporter] ],
    reportSlowTests: { max: 5, threshold: 15000 },
    timeout: defaultTimeout,
    updateSnapshots: 'missing',
    workers: Math.ceil(require('os').cpus().length / 2),
  };

  if (opts.browser) {
    const browserOpt = opts.browser.toLowerCase();
    if (!['all', 'chromium', 'firefox', 'webkit'].includes(browserOpt))
      throw new Error(`Unsupported browser "${opts.browser}", must be one of "all", "chromium", "firefox" or "webkit"`);
    const browserNames = browserOpt === 'all' ? ['chromium', 'firefox', 'webkit'] : [browserOpt];
    defaultConfig.projects = browserNames.map(browserName => {
      return {
        name: browserName,
        use: { browserName },
      };
    });
  }

  const overrides = overridesFromOptions(opts);
  if (opts.headed || opts.debug)
    overrides.use = { headless: false };
  if (opts.debug) {
    overrides.maxFailures = 1;
    overrides.timeout = 0;
    overrides.workers = 1;
    process.env.PWDEBUG = '1';
  }

  const runner = new Runner(overrides, { defaultConfig });

  // When no --config option is passed, let's look for the config file in the current directory.
  const configFile = opts.config ? path.resolve(process.cwd(), opts.config) : process.cwd();
  const config = await runner.loadConfigFromFile(configFile);
  if (('projects' in config) && opts.browser)
    throw new Error(`Cannot use --browser option when configuration file defines projects. Specify browserName in the projects instead.`);

  const filePatternFilter: FilePatternFilter[] = args.map(arg => {
    const match = /^(.*):(\d+)$/.exec(arg);
    return {
      re: forceRegExp(match ? match[1] : arg),
      line: match ? parseInt(match[2], 10) : null,
    };
  });

  if (process.env.PLAYWRIGHT_DOCKER)
    runner.addInternalGlobalSetup(launchDockerContainer);
  const result = await runner.runAllTests({
    listOnly: !!opts.list,
    filePatternFilter,
    projectFilter: opts.project || undefined,
  });
  await stopProfiling(undefined);

  if (result.status === 'interrupted')
    process.exit(130);
  process.exit(result.status === 'passed' ? 0 : 1);
}


async function listTests(opts: { [key: string]: any }) {
  const configFile = opts.config ? path.resolve(process.cwd(), opts.config) : process.cwd();
  const runner = new Runner({}, { defaultConfig: {} });
  await runner.loadConfigFromFile(configFile);
  const report = await runner.listAllTestFiles(opts.project);
  process.stdout.write(JSON.stringify(report));
  process.exit(0);
}

function forceRegExp(pattern: string): RegExp {
  const match = pattern.match(/^\/(.*)\/([gi]*)$/);
  if (match)
    return new RegExp(match[1], match[2]);
  return new RegExp(pattern, 'gi');
}

function overridesFromOptions(options: { [key: string]: any }): Config {
  const isDebuggerAttached = !!require('inspector').url();
  const shardPair = options.shard ? options.shard.split('/').map((t: string) => parseInt(t, 10)) : undefined;
  return {
    forbidOnly: options.forbidOnly ? true : undefined,
    globalTimeout: isDebuggerAttached ? 0 : (options.globalTimeout ? parseInt(options.globalTimeout, 10) : undefined),
    grep: options.grep ? forceRegExp(options.grep) : undefined,
    grepInvert: options.grepInvert ? forceRegExp(options.grepInvert) : undefined,
    maxFailures: options.x ? 1 : (options.maxFailures ? parseInt(options.maxFailures, 10) : undefined),
    outputDir: options.output ? path.resolve(process.cwd(), options.output) : undefined,
    quiet: options.quiet ? options.quiet : undefined,
    repeatEach: options.repeatEach ? parseInt(options.repeatEach, 10) : undefined,
    retries: options.retries ? parseInt(options.retries, 10) : undefined,
    reporter: (options.reporter && options.reporter.length) ? options.reporter.split(',').map((r: string) => [resolveReporter(r)]) : undefined,
    shard: shardPair ? { current: shardPair[0], total: shardPair[1] } : undefined,
    timeout: isDebuggerAttached ? 0 : (options.timeout ? parseInt(options.timeout, 10) : undefined),
    updateSnapshots: options.updateSnapshots ? 'all' as const : undefined,
    workers: options.workers ? parseInt(options.workers, 10) : undefined,
  };
}

function resolveReporter(id: string) {
  if (builtInReporters.includes(id as any))
    return id;
  const localPath = path.resolve(process.cwd(), id);
  if (fs.existsSync(localPath))
    return localPath;
  return require.resolve(id, { paths: [ process.cwd() ] });
}

async function launchDockerContainer(): Promise<() => Promise<void>> {
  const gridServer = new GridServer(dockerFactory, createGuid());
  await gridServer.start();
  // Start docker container in advance.
  const { error } = await gridServer.createAgent();
  if (error)
    throw error;
  process.env.PW_GRID = gridServer.urlPrefix().substring(0, gridServer.urlPrefix().length - 1);
  return async () => await gridServer.stop();
}
