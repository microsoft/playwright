/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';

import { registry } from 'playwright-core/lib/server';
import { ManualPromise, gracefullyProcessExitDoNotHang } from 'playwright-core/lib/utils';

import { loadConfig } from '../common/configLoader';
import { Watcher } from '../fsWatcher';
import { baseFullConfig } from '../isomorphic/teleReceiver';
import { addGitCommitInfoPlugin } from '../plugins/gitCommitInfoPlugin';
import { webServerPluginsForConfig } from '../plugins/webServerPlugin';
import { internalScreen } from '../reporters/base';
import { InternalReporter } from '../reporters/internalReporter';
import { affectedTestFiles, collectAffectedTestFiles, dependenciesForTestFile } from '../transform/compilationCache';
import { serializeError } from '../util';
import { createErrorCollectingReporter, createReporters } from './reporters';
import { TestRun, createApplyRebaselinesTask, createClearCacheTask, createGlobalSetupTasks, createListFilesTask, createLoadTask, createPluginSetupTasks, createReportBeginTask, createRunTestsTasks, createStartDevServerTask, runTasks, runTasksDeferCleanup } from './tasks';
import { LastRunReporter } from './lastRun';

import type * as reporterTypes from '../../types/testReporter';
import type { ConfigLocation, FullConfigInternal } from '../common/config';
import type { ConfigCLIOverrides } from '../common/ipc';
import type { TestRunnerPluginRegistration } from '../plugins';
import type { AnyReporter } from '../reporters/reporterV2';

export type RecoverFromStepErrorResult = {
  stepId: string;
  status: 'recovered' | 'failed';
  value?: string | number | boolean | undefined;
};

export const TestRunnerEvent = {
  TestFilesChanged: 'testFilesChanged',
  RecoverFromStepError: 'recoverFromStepError',
} as const;

export type TestRunnerEventMap = {
  [TestRunnerEvent.TestFilesChanged]: [testFiles: string[]];
  [TestRunnerEvent.RecoverFromStepError]: [stepId: string, message: string, location: reporterTypes.Location];
};

export type ListTestsParams = {
  projects?: string[];
  locations?: string[];
  grep?: string;
  grepInvert?: string;
};

export type RunTestsParams = {
  locations?: string[];
  grep?: string;
  grepInvert?: string;
  testIds?: string[];
  headed?: boolean;
  workers?: number | string;
  updateSnapshots?: 'all' | 'changed' | 'missing' | 'none';
  updateSourceMethod?: 'overwrite' | 'patch' | '3way';
  reporters?: string[],
  trace?: 'on' | 'off';
  video?: 'on' | 'off';
  projects?: string[];
  reuseContext?: boolean;
  connectWsEndpoint?: string;
};

type FullResultStatus = reporterTypes.FullResult['status'];

export class TestRunner extends EventEmitter<TestRunnerEventMap> {
  readonly configLocation: ConfigLocation;
  private _configCLIOverrides: ConfigCLIOverrides;

  private _watcher: Watcher;
  private _watchedProjectDirs = new Set<string>();
  private _ignoredProjectOutputs = new Set<string>();
  private _watchedTestDependencies = new Set<string>();

  private _testRun: { run: Promise<reporterTypes.FullResult['status']>, stop: ManualPromise<void> } | undefined;
  private _queue = Promise.resolve();
  private _globalSetup: { cleanup: () => Promise<any> } | undefined;
  private _devServer: { cleanup: () => Promise<any> } | undefined;
  private _plugins: TestRunnerPluginRegistration[] | undefined;
  private _watchTestDirs = false;
  private _populateDependenciesOnList = false;
  private _recoverFromStepErrors = false;
  private _resumeAfterStepErrors: Map<string, ManualPromise<RecoverFromStepErrorResult>> = new Map();

  constructor(configLocation: ConfigLocation, configCLIOverrides: ConfigCLIOverrides) {
    super();
    this.configLocation = configLocation;
    this._configCLIOverrides = configCLIOverrides;
    this._watcher = new Watcher(events => {
      const collector = new Set<string>();
      events.forEach(f => collectAffectedTestFiles(f.file, collector));
      this.emit(TestRunnerEvent.TestFilesChanged, [...collector]);
    });
  }

  async initialize(params: {
    watchTestDirs?: boolean;
    populateDependenciesOnList?: boolean;
    recoverFromStepErrors?: boolean;
  }) {
    this._watchTestDirs = !!params.watchTestDirs;
    this._populateDependenciesOnList = !!params.populateDependenciesOnList;
    this._recoverFromStepErrors = !!params.recoverFromStepErrors;
  }

  resizeTerminal(params: { cols: number, rows: number }) {
    /* eslint-disable no-restricted-properties */
    process.stdout.columns = params.cols;
    process.stdout.rows = params.rows;
    process.stderr.columns = params.cols;
    process.stderr.rows = params.rows;
    /* eslint-enable no-restricted-properties */
  }

  hasSomeBrowsers(): boolean {
    for (const browserName of ['chromium', 'webkit', 'firefox']) {
      try {
        registry.findExecutable(browserName)!.executablePathOrDie('javascript');
        return true;
      } catch {
      }
    }
    return false;
  }

  async installBrowsers() {
    const executables = registry.defaultExecutables();
    await registry.install(executables, false);
  }

  async runGlobalSetup(userReporters: AnyReporter[]): Promise<{ status: FullResultStatus }> {
    await this.runGlobalTeardown();

    const reporter = new InternalReporter(userReporters);
    const config = await this._loadConfigOrReportError(reporter, this._configCLIOverrides);
    if (!config)
      return { status: 'failed' };

    const { status, cleanup } = await runTasksDeferCleanup(new TestRun(config, reporter), [
      ...createGlobalSetupTasks(config),
    ]);
    if (status !== 'passed')
      await cleanup();
    else
      this._globalSetup = { cleanup };
    return { status };
  }

  async runGlobalTeardown() {
    const globalSetup = this._globalSetup;
    const status = await globalSetup?.cleanup();
    this._globalSetup = undefined;
    return { status };
  }

  async startDevServer(userReporter: AnyReporter, mode: 'in-process' | 'out-of-process'): Promise<{ status: FullResultStatus }> {
    await this.stopDevServer();

    const reporter = new InternalReporter([userReporter]);
    const config = await this._loadConfigOrReportError(reporter);
    if (!config)
      return { status: 'failed' };

    const { status, cleanup } = await runTasksDeferCleanup(new TestRun(config, reporter), [
      ...createPluginSetupTasks(config),
      createLoadTask(mode, { failOnLoadErrors: true, filterOnly: false }),
      createStartDevServerTask(),
    ]);
    if (status !== 'passed')
      await cleanup();
    else
      this._devServer = { cleanup };
    return { status };
  }

  async stopDevServer(): Promise<{ status: FullResultStatus }> {
    const devServer = this._devServer;
    const status = await devServer?.cleanup();
    this._devServer = undefined;
    return { status };
  }

  async clearCache(userReporter?: AnyReporter): Promise<{ status: FullResultStatus }> {
    const reporter = new InternalReporter(userReporter ? [userReporter] : []);
    const config = await this._loadConfigOrReportError(reporter);
    if (!config)
      return { status: 'failed' };
    const status = await runTasks(new TestRun(config, reporter), [
      ...createPluginSetupTasks(config),
      createClearCacheTask(config),
    ]);
    return { status };
  }

  async listFiles(userReporter: AnyReporter, projects?: string[]): Promise<{ status: FullResultStatus }> {
    const reporter = new InternalReporter([userReporter]);
    const config = await this._loadConfigOrReportError(reporter);
    if (!config)
      return { status: 'failed' };

    config.cliProjectFilter = projects?.length ? projects : undefined;
    const status = await runTasks(new TestRun(config, reporter), [
      createListFilesTask(),
      createReportBeginTask(),
    ]);
    return { status };
  }

  async listTests(userReporter: AnyReporter, params: ListTestsParams): Promise<{ status: FullResultStatus }> {
    let result: { status: FullResultStatus } | undefined;
    this._queue = this._queue.then(async () => {
      const { config, status } = await this._innerListTests(userReporter, params);
      if (config)
        await this._updateWatchedDirs(config);
      result = { status };
    }).catch(printInternalError);
    await this._queue;
    return result!;
  }

  private async _innerListTests(userReporter: AnyReporter, params: ListTestsParams): Promise<{
    status: reporterTypes.FullResult['status'],
    config?: FullConfigInternal,
  }> {
    const overrides: ConfigCLIOverrides = {
      ...this._configCLIOverrides,
      repeatEach: 1,
      retries: 0,
    };
    const reporter = new InternalReporter([userReporter]);
    const config = await this._loadConfigOrReportError(reporter, overrides);
    if (!config)
      return { status: 'failed' };

    config.cliArgs = params.locations || [];
    config.cliGrep = params.grep;
    config.cliGrepInvert = params.grepInvert;
    config.cliProjectFilter = params.projects?.length ? params.projects : undefined;
    config.cliListOnly = true;

    const status = await runTasks(new TestRun(config, reporter), [
      createLoadTask('out-of-process', { failOnLoadErrors: false, filterOnly: false, populateDependencies: this._populateDependenciesOnList }),
      createReportBeginTask(),
    ]);
    return { config, status };
  }

  private async _updateWatchedDirs(config: FullConfigInternal) {
    this._watchedProjectDirs = new Set();
    this._ignoredProjectOutputs = new Set();
    for (const p of config.projects) {
      this._watchedProjectDirs.add(p.project.testDir);
      this._ignoredProjectOutputs.add(p.project.outputDir);
    }

    const result = await resolveCtDirs(config);
    if (result) {
      this._watchedProjectDirs.add(result.templateDir);
      this._ignoredProjectOutputs.add(result.outDir);
    }

    if (this._watchTestDirs)
      await this._updateWatcher(false);
  }

  private async _updateWatcher(reportPending: boolean) {
    await this._watcher.update([...this._watchedProjectDirs, ...this._watchedTestDependencies], [...this._ignoredProjectOutputs], reportPending);
  }

  async runTests(userReporter: AnyReporter, params: RunTestsParams): Promise<{ status: FullResultStatus }> {
    let result: { status: FullResultStatus } = { status: 'passed' };
    this._queue = this._queue.then(async () => {
      result = await this._innerRunTests(userReporter, params).catch(e => { printInternalError(e); return { status: 'failed' }; });
    });
    await this._queue;
    return result;
  }

  private async _innerRunTests(userReporter: AnyReporter, params: RunTestsParams): Promise<{ status: FullResultStatus }> {
    await this.stopTests();
    const overrides: ConfigCLIOverrides = {
      ...this._configCLIOverrides,
      repeatEach: 1,
      retries: 0,
      preserveOutputDir: true,
      reporter: params.reporters ? params.reporters.map(r => [r]) : undefined,
      use: {
        ...this._configCLIOverrides.use,
        ...(params.trace === 'on' ? { trace: { mode: 'on', sources: false, _live: true } } : {}),
        ...(params.trace === 'off' ? { trace: 'off' } : {}),
        ...(params.video === 'on' || params.video === 'off' ? { video: params.video } : {}),
        ...(params.headed !== undefined ? { headless: !params.headed } : {}),
        _optionContextReuseMode: params.reuseContext ? 'when-possible' : undefined,
        _optionConnectOptions: params.connectWsEndpoint ? { wsEndpoint: params.connectWsEndpoint } : undefined,
      },
      ...(params.updateSnapshots ? { updateSnapshots: params.updateSnapshots } : {}),
      ...(params.updateSourceMethod ? { updateSourceMethod: params.updateSourceMethod } : {}),
      ...(params.workers ? { workers: params.workers } : {}),
    };
    if (params.trace === 'on')
      process.env.PW_LIVE_TRACE_STACKS = '1';
    else
      process.env.PW_LIVE_TRACE_STACKS = undefined;

    const config = await this._loadConfigOrReportError(new InternalReporter([userReporter]), overrides);
    if (!config)
      return { status: 'failed' };

    config.cliListOnly = false;
    config.cliPassWithNoTests = true;
    config.cliArgs = params.locations || [];
    config.cliGrep = params.grep;
    config.cliGrepInvert = params.grepInvert;
    config.cliProjectFilter = params.projects?.length ? params.projects : undefined;
    config.preOnlyTestFilters = [];
    if (params.testIds) {
      const testIdSet = new Set<string>(params.testIds);
      config.preOnlyTestFilters.push(test => testIdSet.has(test.id));
    }

    const configReporters = await createReporters(config, 'test', true);
    const reporter = new InternalReporter([...configReporters, userReporter]);
    const stop = new ManualPromise();
    const tasks = [
      createApplyRebaselinesTask(),
      createLoadTask('out-of-process', { filterOnly: true, failOnLoadErrors: false, doNotRunDepsOutsideProjectFilter: true }),
      ...createRunTestsTasks(config),
    ];
    const testRun = new TestRun(config, reporter);
    testRun.failureTracker.setRecoverFromStepErrorHandler(this._recoverFromStepError.bind(this));
    const run = runTasks(testRun, tasks, 0, stop).then(async status => {
      this._testRun = undefined;
      return status;
    });
    this._testRun = { run, stop };
    return { status: await run };
  }

  private async _recoverFromStepError(stepId: string, error: reporterTypes.TestError): Promise<RecoverFromStepErrorResult> {
    if (!this._recoverFromStepErrors)
      return { stepId, status: 'failed' };
    const recoveryPromise = new ManualPromise<RecoverFromStepErrorResult>();
    this._resumeAfterStepErrors.set(stepId, recoveryPromise);
    if (!error?.message || !error?.location)
      return { stepId, status: 'failed' };
    this.emit(TestRunnerEvent.RecoverFromStepError, stepId, error.message, error.location);
    const recoveredResult = await recoveryPromise;
    if (recoveredResult.stepId !== stepId)
      return { stepId, status: 'failed' };
    return recoveredResult;
  }

  async resumeAfterStepError(params: RecoverFromStepErrorResult): Promise<void> {
    const recoveryPromise = this._resumeAfterStepErrors.get(params.stepId);
    if (recoveryPromise)
      recoveryPromise.resolve(params);
  }

  async watch(fileNames: string[]) {
    this._watchedTestDependencies = new Set();
    for (const fileName of fileNames) {
      this._watchedTestDependencies.add(fileName);
      dependenciesForTestFile(fileName).forEach(file => this._watchedTestDependencies.add(file));
    }
    await this._updateWatcher(true);
  }

  async findRelatedTestFiles(files: string[], userReporter?: AnyReporter): Promise<{ testFiles: string[]; errors?: reporterTypes.TestError[]; }> {
    const errorReporter = createErrorCollectingReporter(internalScreen);
    const reporter = new InternalReporter(userReporter ? [userReporter, errorReporter] : [errorReporter]);
    const config = await this._loadConfigOrReportError(reporter);
    if (!config)
      return { errors: errorReporter.errors(), testFiles: [] };
    const status = await runTasks(new TestRun(config, reporter), [
      ...createPluginSetupTasks(config),
      createLoadTask('out-of-process', { failOnLoadErrors: true, filterOnly: false, populateDependencies: true }),
    ]);
    if (status !== 'passed')
      return { errors: errorReporter.errors(), testFiles: [] };
    return { testFiles: affectedTestFiles(files) };
  }

  async stopTests() {
    this._testRun?.stop?.resolve();
    await this._testRun?.run;
    this._resumeAfterStepErrors.clear();
  }

  async closeGracefully() {
    gracefullyProcessExitDoNotHang(0);
  }

  private async _loadConfig(overrides?: ConfigCLIOverrides): Promise<{ config: FullConfigInternal | null, error?: reporterTypes.TestError }> {
    try {
      const config = await loadConfig(this.configLocation, overrides);
      // Preserve plugin instances between setup and build.
      if (!this._plugins) {
        webServerPluginsForConfig(config).forEach(p => config.plugins.push({ factory: p }));
        addGitCommitInfoPlugin(config);
        this._plugins = config.plugins || [];
      } else {
        config.plugins.splice(0, config.plugins.length, ...this._plugins);
      }
      return { config };
    } catch (e) {
      return { config: null, error: serializeError(e) };
    }
  }

  private async _loadConfigOrReportError(reporter: InternalReporter, overrides?: ConfigCLIOverrides): Promise<FullConfigInternal | null> {
    const { config, error } = await this._loadConfig(overrides);
    if (config)
      return config;
    // Produce dummy config when it has an error.
    reporter.onConfigure(baseFullConfig);
    reporter.onError(error!);
    await reporter.onEnd({ status: 'failed' });
    await reporter.onExit();
    return null;
  }
}

function printInternalError(e: Error) {
  // eslint-disable-next-line no-console
  console.error('Internal error:', e);
}

// TODO: remove CT dependency.
async function resolveCtDirs(config: FullConfigInternal) {
  const use = config.config.projects[0].use as any;
  const relativeTemplateDir = use.ctTemplateDir || 'playwright';
  const templateDir = await fs.promises.realpath(path.normalize(path.join(config.configDir, relativeTemplateDir))).catch(() => undefined);
  if (!templateDir)
    return null;
  const outDir = use.ctCacheDir ? path.resolve(config.configDir, use.ctCacheDir) : path.resolve(templateDir, '.cache');
  return {
    outDir,
    templateDir
  };
}

export async function runAllTestsWithConfig(config: FullConfigInternal): Promise<FullResultStatus> {
  const listOnly = config.cliListOnly;

  addGitCommitInfoPlugin(config);

  // Legacy webServer support.
  webServerPluginsForConfig(config).forEach(p => config.plugins.push({ factory: p }));

  const reporters = await createReporters(config, listOnly ? 'list' : 'test', false);
  const lastRun = new LastRunReporter(config);
  if (config.cliLastFailed)
    await lastRun.filterLastFailed();

  const reporter = new InternalReporter([...reporters, lastRun]);
  const tasks = listOnly ? [
    createLoadTask('in-process', { failOnLoadErrors: true, filterOnly: false }),
    createReportBeginTask(),
  ] : [
    createApplyRebaselinesTask(),
    ...createGlobalSetupTasks(config),
    createLoadTask('in-process', { filterOnly: true, failOnLoadErrors: true }),
    ...createRunTestsTasks(config),
  ];
  const status = await runTasks(new TestRun(config, reporter), tasks, config.config.globalTimeout);

  // Calling process.exit() might truncate large stdout/stderr output.
  // See https://github.com/nodejs/node/issues/6456.
  // See https://github.com/nodejs/node/issues/12921
  // eslint-disable-next-line no-restricted-properties
  await new Promise<void>(resolve => process.stdout.write('', () => resolve()));
  // eslint-disable-next-line no-restricted-properties
  await new Promise<void>(resolve => process.stderr.write('', () => resolve()));
  return status;
}
