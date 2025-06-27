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

import fs from 'fs';
import path from 'path';
import util from 'util';

import { installRootRedirect, openTraceInBrowser, openTraceViewerApp, registry, startTraceViewerServer } from 'playwright-core/lib/server';
import { ManualPromise, isUnderTest, gracefullyProcessExitDoNotHang } from 'playwright-core/lib/utils';
import { open, debug } from 'playwright-core/lib/utilsBundle';

import { createErrorCollectingReporter, createReporterForTestServer, createReporters } from './reporters';
import { SigIntWatcher } from './sigIntWatcher';
import { TestRun, createApplyRebaselinesTask, createClearCacheTask, createGlobalSetupTasks, createListFilesTask, createLoadTask, createReportBeginTask, createRunTestsTasks, createStartDevServerTask, runTasks, runTasksDeferCleanup } from './tasks';
import { loadConfig, resolveConfigLocation } from '../common/configLoader';
import { Watcher } from '../fsWatcher';
import { baseFullConfig } from '../isomorphic/teleReceiver';
import { addGitCommitInfoPlugin } from '../plugins/gitCommitInfoPlugin';
import { webServerPluginsForConfig } from '../plugins/webServerPlugin';
import { internalScreen } from '../reporters/base';
import { InternalReporter } from '../reporters/internalReporter';
import ListReporter from '../reporters/list';
import { affectedTestFiles, collectAffectedTestFiles, dependenciesForTestFile } from '../transform/compilationCache';
import { serializeError } from '../util';

import type * as reporterTypes from '../../types/testReporter';
import type { ConfigLocation, FullConfigInternal } from '../common/config';
import type { ConfigCLIOverrides } from '../common/ipc';
import type { ReportEntry, TestServerInterface, TestServerInterfaceEventEmitters } from '../isomorphic/testServerInterface';
import type { TestRunnerPluginRegistration } from '../plugins';
import type { ReporterV2 } from '../reporters/reporterV2';
import type { TraceViewerRedirectOptions, TraceViewerServerOptions } from 'playwright-core/lib/server/trace/viewer/traceViewer';
import type { HttpServer, Transport } from 'playwright-core/lib/utils';

const originalDebugLog = debug.log;
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;

class TestServer {
  private _configLocation: ConfigLocation;
  private _configCLIOverrides: ConfigCLIOverrides;
  private _dispatcher: TestServerDispatcher | undefined;

  constructor(configLocation: ConfigLocation, configCLIOverrides: ConfigCLIOverrides) {
    this._configLocation = configLocation;
    this._configCLIOverrides = configCLIOverrides;
  }

  async start(options: { host?: string, port?: number }): Promise<HttpServer> {
    this._dispatcher = new TestServerDispatcher(this._configLocation, this._configCLIOverrides);
    return await startTraceViewerServer({ ...options, transport: this._dispatcher.transport });
  }

  async stop() {
    await this._dispatcher?._setInterceptStdio(false);
    await this._dispatcher?.runGlobalTeardown();
  }
}

export class TestServerDispatcher implements TestServerInterface {
  private _configLocation: ConfigLocation;
  private _configCLIOverrides: ConfigCLIOverrides;

  private _watcher: Watcher;
  private _watchedProjectDirs = new Set<string>();
  private _ignoredProjectOutputs = new Set<string>();
  private _watchedTestDependencies = new Set<string>();

  private _testRun: { run: Promise<reporterTypes.FullResult['status']>, stop: ManualPromise<void> } | undefined;
  readonly transport: Transport;
  private _queue = Promise.resolve();
  private _globalSetup: { cleanup: () => Promise<any>, report: ReportEntry[] } | undefined;
  private _devServer: { cleanup: () => Promise<any>, report: ReportEntry[] } | undefined;
  readonly _dispatchEvent: TestServerInterfaceEventEmitters['dispatchEvent'];
  private _plugins: TestRunnerPluginRegistration[] | undefined;
  private _serializer = require.resolve('./uiModeReporter');
  private _watchTestDirs = false;
  private _closeOnDisconnect = false;
  private _populateDependenciesOnList = false;

  constructor(configLocation: ConfigLocation, configCLIOverrides: ConfigCLIOverrides) {
    this._configLocation = configLocation;
    this._configCLIOverrides = configCLIOverrides;
    this.transport = {
      onconnect: () => {},
      dispatch: (method, params) => (this as any)[method](params),
      onclose: () => {
        if (this._closeOnDisconnect)
          gracefullyProcessExitDoNotHang(0);
      },
    };
    this._watcher = new Watcher(events => {
      const collector = new Set<string>();
      events.forEach(f => collectAffectedTestFiles(f.file, collector));
      this._dispatchEvent('testFilesChanged', { testFiles: [...collector] });
    });
    this._dispatchEvent = (method, params) => this.transport.sendEvent?.(method, params);
  }

  private async _wireReporter(messageSink: (message: any) => void) {
    return await createReporterForTestServer(this._serializer, messageSink);
  }

  private async _collectingInternalReporter(...extraReporters: ReporterV2[]) {
    const report: ReportEntry[] = [];
    const collectingReporter = await createReporterForTestServer(this._serializer, e => report.push(e));
    return { reporter: new InternalReporter([collectingReporter, ...extraReporters]), report };
  }

  async initialize(params: Parameters<TestServerInterface['initialize']>[0]): ReturnType<TestServerInterface['initialize']> {
    // Note: this method can be called multiple times, for example from a new connection after UI mode reload.
    this._serializer = params.serializer || require.resolve('./uiModeReporter');
    this._closeOnDisconnect = !!params.closeOnDisconnect;
    await this._setInterceptStdio(!!params.interceptStdio);
    this._watchTestDirs = !!params.watchTestDirs;
    this._populateDependenciesOnList = !!params.populateDependenciesOnList;
  }

  async ping() {}

  async open(params: Parameters<TestServerInterface['open']>[0]): ReturnType<TestServerInterface['open']> {
    if (isUnderTest())
      return;
    // eslint-disable-next-line no-console
    open('vscode://file/' + params.location.file + ':' + params.location.line).catch(e => console.error(e));
  }

  async resizeTerminal(params: Parameters<TestServerInterface['resizeTerminal']>[0]): ReturnType<TestServerInterface['resizeTerminal']> {
    process.stdout.columns = params.cols;
    process.stdout.rows = params.rows;
    process.stderr.columns = params.cols;
    process.stderr.rows = params.rows;
  }

  async checkBrowsers(): Promise<{ hasBrowsers: boolean; }> {
    return { hasBrowsers: hasSomeBrowsers() };
  }

  async installBrowsers() {
    await installBrowsers();
  }

  async runGlobalSetup(params: Parameters<TestServerInterface['runGlobalSetup']>[0]): ReturnType<TestServerInterface['runGlobalSetup']> {
    await this.runGlobalTeardown();

    const { reporter, report } = await this._collectingInternalReporter(new ListReporter());
    const config = await this._loadConfigOrReportError(reporter, this._configCLIOverrides);
    if (!config)
      return { status: 'failed', report };

    const { status, cleanup } = await runTasksDeferCleanup(new TestRun(config, reporter), [
      ...createGlobalSetupTasks(config),
    ]);
    if (status !== 'passed')
      await cleanup();
    else
      this._globalSetup = { cleanup, report };
    return { report, status };
  }

  async runGlobalTeardown() {
    const globalSetup = this._globalSetup;
    const status = await globalSetup?.cleanup();
    this._globalSetup = undefined;
    return { status, report: globalSetup?.report || [] };
  }

  async startDevServer(params: Parameters<TestServerInterface['startDevServer']>[0]): ReturnType<TestServerInterface['startDevServer']> {
    await this.stopDevServer({});

    const { reporter, report } = await this._collectingInternalReporter();
    const config = await this._loadConfigOrReportError(reporter);
    if (!config)
      return { report, status: 'failed' };

    const { status, cleanup } = await runTasksDeferCleanup(new TestRun(config, reporter), [
      createLoadTask('out-of-process', { failOnLoadErrors: true, filterOnly: false }),
      createStartDevServerTask(),
    ]);
    if (status !== 'passed')
      await cleanup();
    else
      this._devServer = { cleanup, report };
    return { report, status };
  }

  async stopDevServer(params: Parameters<TestServerInterface['stopDevServer']>[0]): ReturnType<TestServerInterface['stopDevServer']> {
    const devServer = this._devServer;
    const status = await devServer?.cleanup();
    this._devServer = undefined;
    return { status, report: devServer?.report || [] };
  }

  async clearCache(params: Parameters<TestServerInterface['clearCache']>[0]): ReturnType<TestServerInterface['clearCache']> {
    const reporter = new InternalReporter([]);
    const config = await this._loadConfigOrReportError(reporter);
    if (!config)
      return;
    await runTasks(new TestRun(config, reporter), [
      createClearCacheTask(config),
    ]);
  }

  async listFiles(params: Parameters<TestServerInterface['listFiles']>[0]): ReturnType<TestServerInterface['listFiles']> {
    const { reporter, report } = await this._collectingInternalReporter();
    const config = await this._loadConfigOrReportError(reporter);
    if (!config)
      return { status: 'failed', report };

    config.cliProjectFilter = params.projects?.length ? params.projects : undefined;
    const status = await runTasks(new TestRun(config, reporter), [
      createListFilesTask(),
      createReportBeginTask(),
    ]);
    return { report, status };
  }

  async listTests(params: Parameters<TestServerInterface['listTests']>[0]): ReturnType<TestServerInterface['listTests']> {
    let result: Awaited<ReturnType<TestServerInterface['listTests']>>;
    this._queue = this._queue.then(async () => {
      const { config, report, status } = await this._innerListTests(params);
      if (config)
        await this._updateWatchedDirs(config);
      result = { report, status };
    }).catch(printInternalError);
    await this._queue;
    return result!;
  }

  private async _innerListTests(params: Parameters<TestServerInterface['listTests']>[0]): Promise<{
    report: ReportEntry[],
    reporter: InternalReporter,
    status: reporterTypes.FullResult['status'],
    config?: FullConfigInternal,
  }> {
    const overrides: ConfigCLIOverrides = {
      ...this._configCLIOverrides,
      repeatEach: 1,
      retries: 0,
    };
    const { reporter, report } = await this._collectingInternalReporter();
    const config = await this._loadConfigOrReportError(reporter, overrides);
    if (!config)
      return { report, reporter, status: 'failed' };

    config.cliArgs = params.locations || [];
    config.cliGrep = params.grep;
    config.cliGrepInvert = params.grepInvert;
    config.cliProjectFilter = params.projects?.length ? params.projects : undefined;
    config.cliListOnly = true;

    const status = await runTasks(new TestRun(config, reporter), [
      createLoadTask('out-of-process', { failOnLoadErrors: false, filterOnly: false, populateDependencies: this._populateDependenciesOnList }),
      createReportBeginTask(),
    ]);
    return { config, report, reporter, status };
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

  async runTests(params: Parameters<TestServerInterface['runTests']>[0]): ReturnType<TestServerInterface['runTests']> {
    let result: Awaited<ReturnType<TestServerInterface['runTests']>> = { status: 'passed' };
    this._queue = this._queue.then(async () => {
      result = await this._innerRunTests(params).catch(e => { printInternalError(e); return { status: 'failed' }; });
    });
    await this._queue;
    return result;
  }

  private async _innerRunTests(params: Parameters<TestServerInterface['runTests']>[0]): ReturnType<TestServerInterface['runTests']> {
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

    const wireReporter = await this._wireReporter(e => this._dispatchEvent('report', e));
    const config = await this._loadConfigOrReportError(new InternalReporter([wireReporter]), overrides);
    if (!config)
      return { status: 'failed' };

    const testIdSet = params.testIds ? new Set<string>(params.testIds) : null;
    config.cliListOnly = false;
    config.cliPassWithNoTests = true;
    config.cliArgs = params.locations || [];
    config.cliGrep = params.grep;
    config.cliGrepInvert = params.grepInvert;
    config.cliProjectFilter = params.projects?.length ? params.projects : undefined;
    config.testIdMatcher = testIdSet ? id => testIdSet.has(id) : undefined;

    const configReporters = await createReporters(config, 'test', true);
    const reporter = new InternalReporter([...configReporters, wireReporter]);
    const stop = new ManualPromise();
    const tasks = [
      createApplyRebaselinesTask(),
      createLoadTask('out-of-process', { filterOnly: true, failOnLoadErrors: false, doNotRunDepsOutsideProjectFilter: true }),
      ...createRunTestsTasks(config),
    ];
    const run = runTasks(new TestRun(config, reporter), tasks, 0, stop).then(async status => {
      this._testRun = undefined;
      return status;
    });
    this._testRun = { run, stop };
    return { status: await run };
  }

  async watch(params: { fileNames: string[]; }) {
    this._watchedTestDependencies = new Set();
    for (const fileName of params.fileNames) {
      this._watchedTestDependencies.add(fileName);
      dependenciesForTestFile(fileName).forEach(file => this._watchedTestDependencies.add(file));
    }
    await this._updateWatcher(true);
  }

  async findRelatedTestFiles(params: Parameters<TestServerInterface['findRelatedTestFiles']>[0]): ReturnType<TestServerInterface['findRelatedTestFiles']> {
    const errorReporter = createErrorCollectingReporter(internalScreen);
    const reporter = new InternalReporter([errorReporter]);
    const config = await this._loadConfigOrReportError(reporter);
    if (!config)
      return { errors: errorReporter.errors(), testFiles: [] };
    const status = await runTasks(new TestRun(config, reporter), [
      createLoadTask('out-of-process', { failOnLoadErrors: true, filterOnly: false, populateDependencies: true }),
    ]);
    if (status !== 'passed')
      return { errors: errorReporter.errors(), testFiles: [] };
    return { testFiles: affectedTestFiles(params.files) };
  }

  async stopTests() {
    this._testRun?.stop?.resolve();
    await this._testRun?.run;
  }

  async _setInterceptStdio(intercept: boolean) {
    if (process.env.PWTEST_DEBUG)
      return;
    if (intercept) {
      if (debug.log === originalDebugLog) {
        // Only if debug.log hasn't already been tampered with, don't intercept any DEBUG=* logging
        debug.log = (...args) => {
          const string = util.format(...args) + '\n';
          return (originalStderrWrite as any).apply(process.stderr, [string]);
        };
      }
      process.stdout.write = (chunk: string | Buffer) => {
        this._dispatchEvent('stdio', chunkToPayload('stdout', chunk));
        return true;
      };
      process.stderr.write = (chunk: string | Buffer) => {
        this._dispatchEvent('stdio', chunkToPayload('stderr', chunk));
        return true;
      };
    } else {
      debug.log = originalDebugLog;
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    }
  }

  async closeGracefully() {
    gracefullyProcessExitDoNotHang(0);
  }

  private async _loadConfig(overrides?: ConfigCLIOverrides): Promise<{ config: FullConfigInternal | null, error?: reporterTypes.TestError }> {
    try {
      const config = await loadConfig(this._configLocation, overrides);
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

export async function runUIMode(configFile: string | undefined, configCLIOverrides: ConfigCLIOverrides, options: TraceViewerServerOptions & TraceViewerRedirectOptions): Promise<reporterTypes.FullResult['status']> {
  const configLocation = resolveConfigLocation(configFile);
  return await innerRunTestServer(configLocation, configCLIOverrides, options, async (server: HttpServer, cancelPromise: ManualPromise<void>) => {
    await installRootRedirect(server, [], { ...options, webApp: 'uiMode.html' });
    if (options.host !== undefined || options.port !== undefined) {
      await openTraceInBrowser(server.urlPrefix('human-readable'));
    } else {
      const channel = await installedChromiumChannelForUI(configLocation, configCLIOverrides);
      const page = await openTraceViewerApp(server.urlPrefix('precise'), 'chromium', {
        headless: isUnderTest() && process.env.PWTEST_HEADED_FOR_TEST !== '1',
        persistentContextOptions: {
          handleSIGINT: false,
          channel,
        },
      });
      page.on('close', () => cancelPromise.resolve());
    }
  });
}

// Pick first channel that is used by one of the projects, to ensure it is installed on the machine.
async function installedChromiumChannelForUI(configLocation: ConfigLocation, configCLIOverrides: ConfigCLIOverrides) {
  const config = await loadConfig(configLocation, configCLIOverrides).catch(e => null);
  if (!config)
    return undefined;
  if (config.projects.some(p => (!p.project.use.browserName || p.project.use.browserName === 'chromium') && !p.project.use.channel))
    return undefined;
  for (const channel of ['chromium', 'chrome', 'msedge']) {
    if (config.projects.some(p => p.project.use.channel === channel))
      return channel;
  }
  return undefined;
}

export async function runTestServer(configFile: string | undefined, configCLIOverrides: ConfigCLIOverrides, options: { host?: string, port?: number }): Promise<reporterTypes.FullResult['status']> {
  const configLocation = resolveConfigLocation(configFile);
  return await innerRunTestServer(configLocation, configCLIOverrides, options, async server => {
    // eslint-disable-next-line no-console
    console.log('Listening on ' + server.urlPrefix('precise').replace('http:', 'ws:') + '/' + server.wsGuid());
  });
}

async function innerRunTestServer(configLocation: ConfigLocation, configCLIOverrides: ConfigCLIOverrides, options: { host?: string, port?: number }, openUI: (server: HttpServer, cancelPromise: ManualPromise<void>) => Promise<void>): Promise<reporterTypes.FullResult['status']> {
  const testServer = new TestServer(configLocation, configCLIOverrides);
  const cancelPromise = new ManualPromise<void>();
  const sigintWatcher = new SigIntWatcher();
  process.stdin.on('close', () => gracefullyProcessExitDoNotHang(0));
  void sigintWatcher.promise().then(() => cancelPromise.resolve());
  try {
    const server = await testServer.start(options);
    await openUI(server, cancelPromise);
    await cancelPromise;
  } finally {
    await testServer.stop();
    sigintWatcher.disarm();
  }
  return sigintWatcher.hadSignal() ? 'interrupted' : 'passed';
}

type StdioPayload = {
  type: 'stdout' | 'stderr';
  text?: string;
  buffer?: string;
};

function chunkToPayload(type: 'stdout' | 'stderr', chunk: Buffer | string): StdioPayload {
  if (chunk instanceof Uint8Array)
    return { type, buffer: chunk.toString('base64') };
  return { type, text: chunk };
}

function hasSomeBrowsers(): boolean {
  for (const browserName of ['chromium', 'webkit', 'firefox']) {
    try {
      registry.findExecutable(browserName)!.executablePathOrDie('javascript');
      return true;
    } catch {
    }
  }
  return false;
}

async function installBrowsers() {
  const executables = registry.defaultExecutables();
  await registry.install(executables, false);
}

function printInternalError(e: Error) {
  // eslint-disable-next-line no-console
  console.error('Internal error:', e);
}

// TODO: remove CT dependency.
export async function resolveCtDirs(config: FullConfigInternal) {
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
