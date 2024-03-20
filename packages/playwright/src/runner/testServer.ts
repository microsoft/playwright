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
import { registry, startTraceViewerServer } from 'playwright-core/lib/server';
import { ManualPromise, gracefullyProcessExitDoNotHang, isUnderTest } from 'playwright-core/lib/utils';
import type { Transport, HttpServer } from 'playwright-core/lib/utils';
import type { FullResult, Location, TestError } from '../../types/testReporter';
import { collectAffectedTestFiles, dependenciesForTestFile } from '../transform/compilationCache';
import type { FullConfigInternal } from '../common/config';
import { InternalReporter } from '../reporters/internalReporter';
import { createReporterForTestServer, createReporters } from './reporters';
import { TestRun, createTaskRunnerForList, createTaskRunnerForWatch, createTaskRunnerForWatchSetup } from './tasks';
import { open } from 'playwright-core/lib/utilsBundle';
import ListReporter from '../reporters/list';
import { Multiplexer } from '../reporters/multiplexer';
import { SigIntWatcher } from './sigIntWatcher';
import { Watcher } from '../fsWatcher';
import type { TestServerInterface, TestServerInterfaceEventEmitters } from '../isomorphic/testServerInterface';
import { Runner } from './runner';
import { serializeError } from '../util';
import { prepareErrorStack } from '../reporters/base';

class TestServer {
  private _config: FullConfigInternal;
  private _dispatcher: TestServerDispatcher | undefined;
  private _originalStdoutWrite: NodeJS.WriteStream['write'];
  private _originalStderrWrite: NodeJS.WriteStream['write'];

  constructor(config: FullConfigInternal) {
    this._config = config;
    process.env.PW_LIVE_TRACE_STACKS = '1';
    config.cliListOnly = false;
    config.cliPassWithNoTests = true;
    config.config.preserveOutput = 'always';

    for (const p of config.projects) {
      p.project.retries = 0;
      p.project.repeatEach = 1;
    }
    config.configCLIOverrides.use = config.configCLIOverrides.use || {};
    config.configCLIOverrides.use.trace = { mode: 'on', sources: false, _live: true };

    this._originalStdoutWrite = process.stdout.write;
    this._originalStderrWrite = process.stderr.write;
  }

  async start(options: { host?: string, port?: number }): Promise<HttpServer> {
    this._dispatcher = new TestServerDispatcher(this._config);
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
  private _config: FullConfigInternal;
  private _globalWatcher: Watcher;
  private _testWatcher: Watcher;
  private _testRun: { run: Promise<FullResult['status']>, stop: ManualPromise<void> } | undefined;
  readonly transport: Transport;
  private _queue = Promise.resolve();
  private _globalCleanup: (() => Promise<FullResult['status']>) | undefined;
  readonly _dispatchEvent: TestServerInterfaceEventEmitters['dispatchEvent'];

  constructor(config: FullConfigInternal) {
    this._config = config;
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

  async ping() {}

  async open(params: { location: Location }) {
    if (isUnderTest())
      return;
    // eslint-disable-next-line no-console
    open('vscode://file/' + params.location.file + ':' + params.location.line).catch(e => console.error(e));
  }

  async resizeTerminal(params: { cols: number; rows: number; }) {
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

  async runGlobalSetup(): Promise<FullResult['status']> {
    await this.runGlobalTeardown();

    const reporter = new InternalReporter(new ListReporter());
    const taskRunner = createTaskRunnerForWatchSetup(this._config, reporter);
    reporter.onConfigure(this._config.config);
    const testRun = new TestRun(this._config, reporter);
    const { status, cleanup: globalCleanup } = await taskRunner.runDeferCleanup(testRun, 0);
    await reporter.onEnd({ status });
    await reporter.onExit();
    if (status !== 'passed') {
      await globalCleanup();
      return status;
    }
    this._globalCleanup = globalCleanup;
    return status;
  }

  async runGlobalTeardown() {
    const result = (await this._globalCleanup?.()) || 'passed';
    this._globalCleanup = undefined;
    return result;
  }

  async listFiles() {
    try {
      const runner = new Runner(this._config);
      return runner.listTestFiles();
    } catch (e) {
      const error: TestError = serializeError(e);
      error.location = prepareErrorStack(e.stack).location;
      return { projects: [], error };
    }
  }

  async listTests(params: { reporter?: string; fileNames: string[]; }) {
    let report: any[] = [];
    this._queue = this._queue.then(async () => {
      report = await this._innerListTests(params);
    }).catch(printInternalError);
    await this._queue;
    return { report };
  }

  private async _innerListTests(params: { reporter?: string; fileNames?: string[]; }) {
    const report: any[] = [];
    const wireReporter = await createReporterForTestServer(this._config, params.reporter || require.resolve('./uiModeReporter'), 'list', e => report.push(e));
    const reporter = new InternalReporter(wireReporter);
    this._config.cliArgs = params.fileNames || [];
    this._config.cliListOnly = true;
    this._config.testIdMatcher = undefined;
    const taskRunner = createTaskRunnerForList(this._config, reporter, 'out-of-process', { failOnLoadErrors: false });
    const testRun = new TestRun(this._config, reporter);
    reporter.onConfigure(this._config.config);
    const status = await taskRunner.run(testRun, 0);
    await reporter.onEnd({ status });
    await reporter.onExit();

    const projectDirs = new Set<string>();
    const projectOutputs = new Set<string>();
    for (const p of this._config.projects) {
      projectDirs.add(p.project.testDir);
      projectOutputs.add(p.project.outputDir);
    }

    const result = await resolveCtDirs(this._config);
    if (result) {
      projectDirs.add(result.templateDir);
      projectOutputs.add(result.outDir);
    }

    this._globalWatcher.update([...projectDirs], [...projectOutputs], false);
    return report;
  }

  async runTests(params: { reporter?: string; locations?: string[] | undefined; grep?: string | undefined; testIds?: string[] | undefined; headed?: boolean | undefined; oneWorker?: boolean | undefined; trace?: 'off' | 'on' | undefined; projects?: string[] | undefined; reuseContext?: boolean | undefined; connectWsEndpoint?: string | undefined; }) {
    this._queue = this._queue.then(() => this._innerRunTests(params)).catch(printInternalError);
    await this._queue;
  }

  private async _innerRunTests(params: { reporter?: string; locations?: string[] | undefined; grep?: string | undefined; testIds?: string[] | undefined; headed?: boolean | undefined; oneWorker?: boolean | undefined; trace?: 'off' | 'on' | undefined; projects?: string[] | undefined; reuseContext?: boolean | undefined; connectWsEndpoint?: string | undefined; }) {
    await this.stopTests();
    const { testIds, projects, locations, grep } = params;

    const testIdSet = testIds ? new Set<string>(testIds) : null;
    this._config.cliArgs = locations ? locations : [];
    this._config.cliGrep = grep;
    this._config.cliListOnly = false;
    this._config.cliProjectFilter = projects?.length ? projects : undefined;
    this._config.testIdMatcher = id => !testIdSet || testIdSet.has(id);

    const reporters = await createReporters(this._config, 'ui');
    reporters.push(await createReporterForTestServer(this._config, params.reporter || require.resolve('./uiModeReporter'), 'list', e => this._dispatchEvent('report', e)));
    const reporter = new InternalReporter(new Multiplexer(reporters));
    const taskRunner = createTaskRunnerForWatch(this._config, reporter);
    const testRun = new TestRun(this._config, reporter);
    reporter.onConfigure(this._config.config);
    const stop = new ManualPromise();
    const run = taskRunner.run(testRun, 0, stop).then(async status => {
      await reporter.onEnd({ status });
      await reporter.onExit();
      this._testRun = undefined;
      this._config.testIdMatcher = undefined;
      return status;
    });
    this._testRun = { run, stop };
    await run;
  }

  async watch(params: { fileNames: string[]; }) {
    const files = new Set<string>();
    for (const fileName of params.fileNames) {
      files.add(fileName);
      dependenciesForTestFile(fileName).forEach(file => files.add(file));
    }
    this._testWatcher.update([...files], [], true);
  }

  findRelatedTestFiles(params: { files: string[]; }): Promise<{ testFiles: string[]; errors?: TestError[] | undefined; }> {
    const runner = new Runner(this._config);
    return runner.findRelatedTestFiles('out-of-process', params.files);
  }

  async stopTests() {
    this._testRun?.stop?.resolve();
    await this._testRun?.run;
  }

  async closeGracefully() {
    gracefullyProcessExitDoNotHang(0);
  }
}

export async function runTestServer(config: FullConfigInternal, options: { host?: string, port?: number }, openUI: (server: HttpServer, cancelPromise: ManualPromise<void>) => Promise<void>): Promise<FullResult['status']> {
  const testServer = new TestServer(config);
  const cancelPromise = new ManualPromise<void>();
  const sigintWatcher = new SigIntWatcher();
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
