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
import type { FullConfigInternal } from '../common/config';
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
import { loadConfig, resolveConfigFile, restartWithExperimentalTsEsm } from '../common/configLoader';
import { webServerPluginsForConfig } from '../plugins/webServerPlugin';
import type { TraceViewerRedirectOptions, TraceViewerServerOptions } from 'playwright-core/lib/server/trace/viewer/traceViewer';
import type { TestRunnerPluginRegistration } from '../plugins';
import { serializeError } from '../util';

class TestServer {
  private _configFile: string | undefined;
  private _dispatcher: TestServerDispatcher | undefined;
  private _originalStdoutWrite: NodeJS.WriteStream['write'];
  private _originalStderrWrite: NodeJS.WriteStream['write'];

  constructor(configFile: string | undefined) {
    this._configFile = configFile;
    this._originalStdoutWrite = process.stdout.write;
    this._originalStderrWrite = process.stderr.write;
  }

  async start(options: { host?: string, port?: number }): Promise<HttpServer> {
    this._dispatcher = new TestServerDispatcher(this._configFile);
    return await startTraceViewerServer({ ...options, transport: this._dispatcher.transport });
  }

  async stop() {
    await this._dispatcher?.runGlobalTeardown();
  }

  wireStdIO() {
    if (!process.env.PWTEST_DEBUG) {
      process.stdout.write = (chunk: string | Buffer) => {
        this._dispatcher?._dispatchEvent('stdio', chunkToPayload('stdout', chunk));
        return true;
      };
      process.stderr.write = (chunk: string | Buffer) => {
        this._dispatcher?._dispatchEvent('stdio', chunkToPayload('stderr', chunk));
        return true;
      };
    }
  }

  unwireStdIO() {
    if (!process.env.PWTEST_DEBUG) {
      process.stdout.write = this._originalStdoutWrite;
      process.stderr.write = this._originalStderrWrite;
    }
  }
}

class TestServerDispatcher implements TestServerInterface {
  private _configFile: string | undefined;
  private _globalWatcher: Watcher;
  private _testWatcher: Watcher;
  private _testRun: { run: Promise<reporterTypes.FullResult['status']>, stop: ManualPromise<void> } | undefined;
  readonly transport: Transport;
  private _queue = Promise.resolve();
  private _globalSetup: { cleanup: () => Promise<any>, report: ReportEntry[] } | undefined;
  readonly _dispatchEvent: TestServerInterfaceEventEmitters['dispatchEvent'];
  private _plugins: TestRunnerPluginRegistration[] | undefined;
  private _serializer = require.resolve('./uiModeReporter');
  private _watchTestDir = false;

  constructor(configFile: string | undefined) {
    this._configFile = configFile;
    this.transport = {
      dispatch: (method, params) => (this as any)[method](params),
      onclose: () => {},
    };
    this._globalWatcher = new Watcher('deep', () => this._dispatchEvent('listChanged', {}));
    this._testWatcher = new Watcher('flat', events => {
      const collector = new Set<string>();
      events.forEach(f => collectAffectedTestFiles(f.file, collector));
      this._dispatchEvent('testFilesChanged', { testFiles: [...collector] });
    });
    this._dispatchEvent = (method, params) => this.transport.sendEvent?.(method, params);
  }

  async setSerializer(params: { serializer: string; }): Promise<void> {
    this._serializer = params.serializer;
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

  async ready() {}

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
    const { config, error } = await this._loadConfig(this._configFile);
    if (!config) {
      reporter.onError(error!);
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

  async listFiles(params: Parameters<TestServerInterface['listFiles']>[0]): ReturnType<TestServerInterface['listFiles']> {
    const { reporter, report } = await this._collectingReporter();
    const { config, error } = await this._loadConfig(this._configFile);
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
    const { config, error } = await this._loadConfig(this._configFile, overrides);
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

    if (this._watchTestDir)
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
        headless: params.headed ? false : undefined,
        _optionContextReuseMode: params.reuseContext ? 'when-possible' : undefined,
        _optionConnectOptions: params.connectWsEndpoint ? { wsEndpoint: params.connectWsEndpoint } : undefined,
      },
      workers: params.workers,
    };
    if (params.trace === 'on')
      process.env.PW_LIVE_TRACE_STACKS = '1';
    else
      process.env.PW_LIVE_TRACE_STACKS = undefined;

    const { config, error } = await this._loadConfig(this._configFile, overrides);
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

  async watchTestDir() {
    this._watchTestDir = true;
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
    const { config, error } = await this._loadConfig(this._configFile);
    if (error)
      return { testFiles: [], errors: [error] };
    const runner = new Runner(config!);
    return runner.findRelatedTestFiles('out-of-process', params.files);
  }

  async stopTests() {
    this._testRun?.stop?.resolve();
    await this._testRun?.run;
  }

  async closeGracefully() {
    gracefullyProcessExitDoNotHang(0);
  }

  private async _loadConfig(configFile: string | undefined, overrides?: ConfigCLIOverrides): Promise<{ config: FullConfigInternal | null, error?: reporterTypes.TestError }> {
    const configFileOrDirectory = configFile ? path.resolve(process.cwd(), configFile) : process.cwd();
    const resolvedConfigFile = resolveConfigFile(configFileOrDirectory);
    try {
      const config = await loadConfig({ resolvedConfigFile, configDir: resolvedConfigFile === configFileOrDirectory ? path.dirname(resolvedConfigFile) : configFileOrDirectory  }, overrides);
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

export async function runUIMode(configFile: string | undefined, options: TraceViewerServerOptions & TraceViewerRedirectOptions): Promise<reporterTypes.FullResult['status']> {
  return await innerRunTestServer(configFile, options, async (server: HttpServer, cancelPromise: ManualPromise<void>) => {
    await installRootRedirect(server, [], { ...options, webApp: 'uiMode.html' });
    if (options.host !== undefined || options.port !== undefined) {
      await openTraceInBrowser(server.urlPrefix());
    } else {
      const page = await openTraceViewerApp(server.urlPrefix(), 'chromium', {
        headless: isUnderTest() && process.env.PWTEST_HEADED_FOR_TEST !== '1',
        persistentContextOptions: {
          handleSIGINT: false,
        },
      });
      page.on('close', () => cancelPromise.resolve());
    }
  });
}

export async function runTestServer(configFile: string | undefined, options: { host?: string, port?: number }): Promise<reporterTypes.FullResult['status']> {
  return await innerRunTestServer(configFile, options, async server => {
    // eslint-disable-next-line no-console
    console.log('Listening on ' + server.urlPrefix().replace('http:', 'ws:') + '/' + server.wsGuid());
  });
}

async function innerRunTestServer(configFile: string | undefined, options: { host?: string, port?: number }, openUI: (server: HttpServer, cancelPromise: ManualPromise<void>) => Promise<void>): Promise<reporterTypes.FullResult['status']> {
  if (restartWithExperimentalTsEsm(undefined, true))
    return 'passed';
  const testServer = new TestServer(configFile);
  const cancelPromise = new ManualPromise<void>();
  const sigintWatcher = new SigIntWatcher();
  process.stdin.on('close', () => gracefullyProcessExitDoNotHang(0));
  void sigintWatcher.promise().then(() => cancelPromise.resolve());
  try {
    const server = await testServer.start(options);
    await openUI(server, cancelPromise);
    testServer.wireStdIO();
    await cancelPromise;
  } finally {
    testServer.unwireStdIO();
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
