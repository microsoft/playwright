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

import { serverUtils } from 'playwright-core/lib/coreBundle';
import { builtInReporters } from './common/config';

const { gracefullyProcessExitDoNotHang } = serverUtils;
import { loadConfigFromFile, resolveConfigLocation } from './common/configLoader';
import { terminalScreen } from './reporters/base';
import { filterProjects } from './runner/projectUtils';
import * as testServer from './runner/testServer';
import { runWatchModeLoop } from './runner/watchMode';
import { runAllTestsWithConfig, TestRunner } from './runner/testRunner';
import { createErrorCollectingReporter } from './runner/reporters';

import type { ConfigCLIOverrides } from './common/ipc';
import type { ReporterDescription } from '../types/test';

export async function runTests(args: string[], opts: { [key: string]: any }) {
  await serverUtils.startProfiling();
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
  config.cliTestList = opts.testList ? path.resolve(process.cwd(), opts.testList) : undefined;
  config.cliTestListInvert = opts.testListInvert ? path.resolve(process.cwd(), opts.testListInvert) : undefined;

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
    await serverUtils.stopProfiling('runner');
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
    await serverUtils.stopProfiling('runner');
    const exitCode = status === 'interrupted' ? 130 : (status === 'passed' ? 0 : 1);
    gracefullyProcessExitDoNotHang(exitCode);
    return;
  }

  const status = await runAllTestsWithConfig(config);
  await serverUtils.stopProfiling('runner');
  const exitCode = status === 'interrupted' ? 130 : (status === 'passed' ? 0 : 1);
  gracefullyProcessExitDoNotHang(exitCode);
}

export async function runTestServerAction(opts: { [key: string]: any }) {
  const host = opts.host;
  const port = opts.port ? +opts.port : undefined;
  const status = await testServer.runTestServer(opts.config, { }, { host, port });
  const exitCode = status === 'interrupted' ? 130 : (status === 'passed' ? 0 : 1);
  gracefullyProcessExitDoNotHang(exitCode);
}

export async function clearCache(opts: { [key: string]: any }) {
  const runner = new TestRunner(resolveConfigLocation(opts.config), {});
  const { status } = await runner.clearCache(createErrorCollectingReporter(terminalScreen));
  const exitCode = status === 'interrupted' ? 130 : (status === 'passed' ? 0 : 1);
  gracefullyProcessExitDoNotHang(exitCode);
}

export async function startDevServer(options: { [key: string]: any }) {
  const runner = new TestRunner(resolveConfigLocation(options.config), {});
  await runner.startDevServer(createErrorCollectingReporter(terminalScreen), 'in-process');
}

function overridesFromOptions(options: { [key: string]: any }): ConfigCLIOverrides {
  if (options.ui) {
    options.debug = undefined;
    options.trace = undefined;
  }

  const overrides: ConfigCLIOverrides = {
    debug: options.debug,
    failOnFlakyTests: options.failOnFlakyTests ? true : undefined,
    forbidOnly: options.forbidOnly ? true : undefined,
    fullyParallel: options.fullyParallel ? true : undefined,
    globalTimeout: options.globalTimeout ? parseInt(options.globalTimeout, 10) : undefined,
    maxFailures: options.x ? 1 : (options.maxFailures ? parseInt(options.maxFailures, 10) : undefined),
    outputDir: options.output ? path.resolve(process.cwd(), options.output) : undefined,
    pause: !!process.env.PWPAUSE,
    quiet: options.quiet ? options.quiet : undefined,
    repeatEach: options.repeatEach ? parseInt(options.repeatEach, 10) : undefined,
    retries: options.retries ? parseInt(options.retries, 10) : undefined,
    reporter: resolveReporterOption(options.reporter),
    shard: resolveShardOption(options.shard),
    shardWeights: resolveShardWeightsOption(),
    timeout: options.timeout ? parseInt(options.timeout, 10) : undefined,
    tsconfig: options.tsconfig ? path.resolve(process.cwd(), options.tsconfig) : undefined,
    ignoreSnapshots: options.ignoreSnapshots ? !!options.ignoreSnapshots : undefined,
    updateSnapshots: options.updateSnapshots,
    updateSourceMethod: options.updateSourceMethod,
    use: {
      trace: options.trace,
    },
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

  if (options.headed)
    overrides.use.headless = false;
  if (options.debug === 'inspector') {
    overrides.use.headless = false;
    process.env.PWDEBUG = '1';
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

function resolveShardWeightsOption(): ConfigCLIOverrides['shardWeights'] {
  const shardWeights = process.env.PWTEST_SHARD_WEIGHTS;
  if (!shardWeights)
    return undefined;

  return shardWeights.split(':').map(w => {
    const weight = parseInt(w, 10);
    if (isNaN(weight) || weight < 0)
      throw new Error(`PWTEST_SHARD_WEIGHTS="${shardWeights}" weights must be non-negative numbers`);
    return weight;
  });
}

function resolveReporter(id: string) {
  if (builtInReporters.includes(id as any))
    return id;
  const localPath = path.resolve(process.cwd(), id);
  if (fs.existsSync(localPath))
    return localPath;
  return require.resolve(id, { paths: [process.cwd()] });
}
