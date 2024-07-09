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
import { installRootRedirect, openTraceInBrowser, openTraceViewerApp, registry, startTraceViewerServer } from 'playwright-core/lib/server';
import { ManualPromise, gracefullyProcessExitDoNotHang, isUnderTest } from 'playwright-core/lib/utils';
import type { Transport, HttpServer } from 'playwright-core/lib/utils';
import type * as reporterTypes from '../../types/testReporter';
import { collectAffectedTestFiles, dependenciesForTestFile } from '../transform/compilationCache';
import type { ConfigLocation, FullConfigInternal } from '../common/config';
import { InternalReporter } from '../reporters/internalReporter';
import { createReporterForTestServer, createReporters } from './reporters';
import { TestRun, createTaskRunnerForList, createTaskRunnerForTestServer, createTaskRunnerForWatchSetup, createTaskRunnerForListFiles } from './tasks';
import { open } from 'playwright-core/lib/utilsBundle';
import ListReporter from '../reporters/list';
import { Multiplexer } from '../reporters/multiplexer';
import { SigIntWatcher } from './sigIntWatcher';
import { Watcher } from '../fsWatcher';
import type { ReportEntry, TestServerInterface, TestServerInterfaceEventEmitters } from '../isomorphic/testServerInterface';
import { Runner } from './runner';
import type { ConfigCLIOverrides } from '../common/ipc';
import { loadConfig, resolveConfigLocation, restartWithExperimentalTsEsm } from '../common/configLoader';
import { webServerPluginsForConfig } from '../plugins/webServerPlugin';
import type { TraceViewerRedirectOptions, TraceViewerServerOptions } from 'playwright-core/lib/server/trace/viewer/traceViewer';
import type { TestRunnerPluginRegistration } from '../plugins';
import { serializeError } from '../util';
import { cacheDir } from '../transform/compilationCache';
import { baseFullConfig } from '../isomorphic/teleReceiver';

const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;

class TestServer {
  private _configLocation: ConfigLocation;
  private _dispatcher: TestServerDispatcher | undefined;

  constructor(configLocation: ConfigLocation) {
    this._configLocation = configLocation;
  }

  async start(options: { host?: string, port?: number }): Promise<HttpServer> {
    this._dispatcher = new TestServerDispatcher(this._configLocation);
    return await startTraceViewerServer({ ...options, transport: this._dispatcher.transport });
  }

  async stop() {
    await this._dispatcher?._setInterceptStdio(false);
    await this._dispatcher?.runGlobalTeardown();
  }
}

class TestServerDispatcher implements TestServerInterface {
  private _configLocation: ConfigLocation;
  private _globalWatcher: Watcher;
  private _testWatcher: Watcher;
  private _testRun: { run: Promise<reporterTypes.FullResult['status']>, stop: ManualPromise<void> } | undefined;
  readonly transport: Transport;
  private _queue = Promise.resolve();
  private _globalSetup: { cleanup: () => Promise<any>, report: ReportEntry[] } | undefined;
  readonly _dispatchEvent: TestServerInterfaceEventEmitters['dispatchEvent'];
  private _plugins: TestRunnerPluginRegistration[] | undefined;
  private _serializer = require.resolve('./uiModeReporter');
  private _watchTestDirs = false;
  private _closeOnDisconnect = false;
  private _devServerHandle: (() => Promise<void>) | undefined;

  constructor(configLocation: ConfigLocation) {
    this._configLocation = configLocation;
    this.transport = {
      dispatch: (method, params) => (this as any)[method](params),
      onclose: () => {
        if (this._closeOnDisconnect)
          gracefullyProcessExitDoNotHang(0);
      },
    };
    this._globalWatcher = new Watcher('deep', () => this._dispatchEvent('listChanged', {}));
    this._testWatcher = new Watcher('flat', events => {
      const collector = new Set<string>();
      events.forEach(f => collectAffectedTestFiles(f.file, collector));
      this._dispatchEvent('testFilesChanged', { testFiles: [...collector] });
    });
    this._dispatchEvent = (method, params) => this.transport.sendEvent?.(method, params);
  }

  private async _wireReporter(messageSink: (message: any) => void) {
    return await createReporterForTestServer(this._serializer, messageSink);
  }

  private async _collectingReporter() {
    const report: ReportEntry[] = [];
    const wireReporter = await createReporterForTestServer(this._serializer, e => report.push(e));
    const reporter = new InternalReporter(wireReporter);
    return { reporter, report };
  }

  async initialize(params: Parameters<TestServerInterface['initialize']>[0]): ReturnType<TestServerInterface['initialize']> {
    if (params.serializer)
      this._serializer = params.serializer;
    if (params.closeOnDisconnect)
      this._closeOnDisconnect = true;
    if (params.interceptStdio)
      await this._setInterceptStdio(true);
    if (params.watchTestDirs)
      this._watchTestDirs = true;
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
    process.stderr.columns = params.rows;
  }

  async checkBrowsers(): Promise<{ hasBrowsers: boolean; }> {
    return { hasBrowsers: hasSomeBrowsers() };
  }

  async installBrowsers() {
    await installBrowsers();
  }

  async runGlobalSetup(params: Parameters<TestServerInterface['runGlobalSetup']>[0]): ReturnType<TestServerInterface['runGlobalSetup']> {
    await this.runGlobalTeardown();

    const { reporter, report } = await this._collectingReporter();
    const { config, error } = await this._loadConfig();
    if (!config) {
      // Produce dummy config when it has an error.
      reporter.onConfigure(baseFullConfig);
      reporter.onError(error!);
      await reporter.onExit();
      return { status: 'failed', report };
    }

    webServerPluginsForConfig(config).forEach(p => config.plugins.push({ factory: p }));
    const listReporter = new InternalReporter(new ListReporter());
    const taskRunner = createTaskRunnerForWatchSetup(config, new Multiplexer([reporter, listReporter]));
    reporter.onConfigure(config.config);
    const testRun = new TestRun(config, reporter);
    const { status, cleanup: globalCleanup } = await taskRunner.runDeferCleanup(testRun, 0);
    await reporter.onEnd({ status });
    await reporter.onExit();
    if (status !== 'passed') {
      await globalCleanup();
      return { report, status };
    }
    this._globalSetup = { cleanup: globalCleanup, report };
    return { report, status };
  }

  async runGlobalTeardown() {
    const globalSetup = this._globalSetup;
    const status = await globalSetup?.cleanup();
    this._globalSetup = undefined;
    return { status, report: globalSetup?.report || [] };
  }

  async startDevServer(params: Parameters<TestServerInterface['startDevServer']>[0]): ReturnType<TestServerInterface['startDevServer']> {
    if (this._devServerHandle)
      return { status: 'failed', report: [] };
    const { reporter, report } = await this._collectingReporter();
    const { config, error } = await this._loadConfig();
    if (!config) {
      reporter.onError(error!);
      return { status: 'failed', report };
    }
    const devServerCommand = (config.config as any)['@playwright/test']?.['cli']?.['dev-server'];
    if (!devServerCommand) {
      reporter.onError({ message: 'No dev-server command found in the configuration' });
      return { status: 'failed', report };
    }
    try {
      this._devServerHandle = await devServerCommand(config);
      return { status: 'passed', report };
    } catch (e) {
      reporter.onError(serializeError(e));
      return { status: 'failed', report };
    }
  }

  async stopDevServer(params: Parameters<TestServerInterface['stopDevServer']>[0]): ReturnType<TestServerInterface['stopDevServer']> {
    if (!this._devServerHandle)
      return { status: 'failed', report: [] };
    try {
      await this._devServerHandle();
      this._devServerHandle = undefined;
      return { status: 'passed', report: [] };
    } catch (e) {
      const { reporter, report } = await this._collectingReporter();
      reporter.onError(serializeError(e));
      return { status: 'failed', report };
    }
  }

  async clearCache(params: Parameters<TestServerInterface['clearCache']>[0]): ReturnType<TestServerInterface['clearCache']> {
    const { config } = await this._loadConfig();
    if (config)
      await clearCacheAndLogToConsole(config);
  }

  async listFiles(params: Parameters<TestServerInterface['listFiles']>[0]): ReturnType<TestServerInterface['listFiles']> {
    const { reporter, report } = await this._collectingReporter();
    const { config, error } = await this._loadConfig();
    if (!config) {
      reporter.onError(error!);
      return { status: 'failed', report };
    }

    config.cliProjectFilter = params.projects?.length ? params.projects : undefined;
    const taskRunner = createTaskRunnerForListFiles(config, reporter);
    reporter.onConfigure(config.config);
    const testRun = new TestRun(config, reporter);
    const status = await taskRunner.run(testRun, 0);
    await reporter.onEnd({ status });
    await reporter.onExit();
    return { report, status };
  }

  async listTests(params: Parameters<TestServerInterface['listTests']>[0]): ReturnType<TestServerInterface['listTests']> {
    let result: Awaited<ReturnType<TestServerInterface['listTests']>>;
    this._queue = this._queue.then(async () => {
      result = await this._innerListTests(params);
    }).catch(printInternalError);
    await this._queue;
    return result!;
  }

  private async _innerListTests(params: Parameters<TestServerInterface['listTests']>[0]): ReturnType<TestServerInterface['listTests']> {
    const overrides: ConfigCLIOverrides = {
      repeatEach: 1,
      retries: 0,
    };
    const { reporter, report } = await this._collectingReporter();
    const { config, error } = await this._loadConfig(overrides);
    if (!config) {
      reporter.onError(error!);
      return { report: [], status: 'failed' };
    }

    config.cliArgs = params.locations || [];
    config.cliProjectFilter = params.projects?.length ? params.projects : undefined;
    config.cliListOnly = true;

    const taskRunner = createTaskRunnerForList(config, reporter, 'out-of-process', { failOnLoadErrors: false });
    const testRun = new TestRun(config, reporter);
    reporter.onConfigure(config.config);
    const status = await taskRunner.run(testRun, 0);
    await reporter.onEnd({ status });
    await reporter.onExit();

    const projectDirs = new Set<string>();
    const projectOutputs = new Set<string>();
    for (const p of config.projects) {
      projectDirs.add(p.project.testDir);
      projectOutputs.add(p.project.outputDir);
    }

    const result = await resolveCtDirs(config);
    if (result) {
      projectDirs.add(result.templateDir);
      projectOutputs.add(result.outDir);
    }

    if (this._watchTestDirs)
      this._globalWatcher.update([...projectDirs], [...projectOutputs], false);
    return { report, status };
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
      repeatEach: 1,
      retries: 0,
      preserveOutputDir: true,
      timeout: params.timeout,
      reporter: params.reporters ? params.reporters.map(r => [r]) : undefined,
      use: {
        trace: params.trace === 'on' ? { mode: 'on', sources: false, _live: true } : (params.trace === 'off' ? 'off' : undefined),
        video: params.video === 'on' ? 'on' : (params.video === 'off' ? 'off' : undefined),
        headless: params.headed ? false : undefined,
        _optionContextReuseMode: params.reuseContext ? 'when-possible' : undefined,
        _optionConnectOptions: params.connectWsEndpoint ? { wsEndpoint: params.connectWsEndpoint } : undefined,
      },
      outputDir: params.outputDir,
      updateSnapshots: params.updateSnapshots,
      workers: params.workers,
    };
    if (params.trace === 'on')
      process.env.PW_LIVE_TRACE_STACKS = '1';
    else
      process.env.PW_LIVE_TRACE_STACKS = undefined;

    const { config, error } = await this._loadConfig(overrides);
    if (!config) {
      const wireReporter = await this._wireReporter(e => this._dispatchEvent('report', e));
      wireReporter.onError(error!);
      return { status: 'failed' };
    }

    const testIdSet = params.testIds ? new Set<string>(params.testIds) : null;
    config.cliListOnly = false;
    config.cliPassWithNoTests = true;
    config.cliArgs = params.locations || [];
    config.cliGrep = params.grep;
    config.cliGrepInvert = params.grepInvert;
    config.cliProjectFilter = params.projects?.length ? params.projects : undefined;
    config.testIdMatcher = testIdSet ? id => testIdSet.has(id) : undefined;

    const reporters = await createReporters(config, 'test', true);
    const wireReporter = await this._wireReporter(e => this._dispatchEvent('report', e));
    reporters.push(wireReporter);
    const reporter = new InternalReporter(new Multiplexer(reporters));
    const taskRunner = createTaskRunnerForTestServer(config, reporter);
    const testRun = new TestRun(config, reporter);
    reporter.onConfigure(config.config);
    const stop = new ManualPromise();
    const run = taskRunner.run(testRun, 0, stop).then(async status => {
      await reporter.onEnd({ status });
      await reporter.onExit();
      this._testRun = undefined;
      return status;
    });
    this._testRun = { run, stop };
    return { status: await run };
  }

  async watch(params: { fileNames: string[]; }) {
    const files = new Set<string>();
    for (const fileName of params.fileNames) {
      files.add(fileName);
      dependenciesForTestFile(fileName).forEach(file => files.add(file));
    }
    this._testWatcher.update([...files], [], true);
  }

  async findRelatedTestFiles(params: Parameters<TestServerInterface['findRelatedTestFiles']>[0]): ReturnType<TestServerInterface['findRelatedTestFiles']> {
    const { config, error } = await this._loadConfig();
    if (error)
      return { testFiles: [], errors: [error] };
    const runner = new Runner(config!);
    return runner.findRelatedTestFiles('out-of-process', params.files);
  }

  async stopTests() {
    this._testRun?.stop?.resolve();
    await this._testRun?.run;
  }

  async _setInterceptStdio(intercept: boolean) {
    if (process.env.PWTEST_DEBUG)
      return;
    if (intercept) {
      process.stdout.write = (chunk: string | Buffer) => {
        this._dispatchEvent('stdio', chunkToPayload('stdout', chunk));
        return true;
      };
      process.stderr.write = (chunk: string | Buffer) => {
        this._dispatchEvent('stdio', chunkToPayload('stderr', chunk));
        return true;
      };
    } else {
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
      if (!this._plugins)
        this._plugins = config.plugins || [];
      else
        config.plugins.splice(0, config.plugins.length, ...this._plugins);
      return { config };
    } catch (e) {
      return { config: null, error: serializeError(e) };
    }
  }
}

export async function runUIMode(configFile: string | undefined, options: TraceViewerServerOptions & TraceViewerRedirectOptions): Promise<reporterTypes.FullResult['status'] | 'restarted'> {
  const configLocation = resolveConfigLocation(configFile);
  return await innerRunTestServer(configLocation, options, async (server: HttpServer, cancelPromise: ManualPromise<void>) => {
    await installRootRedirect(server, [], { ...options, webApp: 'uiMode.html' });
    if (options.host !== undefined || options.port !== undefined) {
      await openTraceInBrowser(server.urlPrefix('human-readable'));
    } else {
      const page = await openTraceViewerApp(server.urlPrefix('precise'), 'chromium', {
        headless: isUnderTest() && process.env.PWTEST_HEADED_FOR_TEST !== '1',
        persistentContextOptions: {
          handleSIGINT: false,
        },
      });
      page.on('close', () => cancelPromise.resolve());
    }
  });
}

export async function runTestServer(configFile: string | undefined, options: { host?: string, port?: number }): Promise<reporterTypes.FullResult['status'] | 'restarted'> {
  const configLocation = resolveConfigLocation(configFile);
  return await innerRunTestServer(configLocation, options, async server => {
    // eslint-disable-next-line no-console
    console.log('Listening on ' + server.urlPrefix('precise').replace('http:', 'ws:') + '/' + server.wsGuid());
  });
}

async function innerRunTestServer(configLocation: ConfigLocation, options: { host?: string, port?: number }, openUI: (server: HttpServer, cancelPromise: ManualPromise<void>, configLocation: ConfigLocation) => Promise<void>): Promise<reporterTypes.FullResult['status'] | 'restarted'> {
  if (restartWithExperimentalTsEsm(undefined, true))
    return 'restarted';
  const testServer = new TestServer(configLocation);
  const cancelPromise = new ManualPromise<void>();
  const sigintWatcher = new SigIntWatcher();
  process.stdin.on('close', () => gracefullyProcessExitDoNotHang(0));
  void sigintWatcher.promise().then(() => cancelPromise.resolve());
  try {
    const server = await testServer.start(options);
    await openUI(server, cancelPromise, configLocation);
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
  if (chunk instanceof Buffer)
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

export async function clearCacheAndLogToConsole(config: FullConfigInternal) {
  const override = (config.config as any)['@playwright/test']?.['cli']?.['clear-cache'];
  if (override) {
    await override(config);
    return;
  }
  await removeFolderAndLogToConsole(cacheDir);
}

export async function removeFolderAndLogToConsole(folder: string) {
  try {
    if (!fs.existsSync(folder))
      return;
    // eslint-disable-next-line no-console
    console.log(`Removing ${await fs.promises.realpath(folder)}`);
    await fs.promises.rm(folder, { recursive: true, force: true });
  } catch {
  }
}
