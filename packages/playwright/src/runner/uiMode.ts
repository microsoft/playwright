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

import { openTraceViewerApp, openTraceInBrowser, registry } from 'playwright-core/lib/server';
import { isUnderTest, ManualPromise } from 'playwright-core/lib/utils';
import type { FullResult } from '../../types/testReporter';
import { clearCompilationCache, collectAffectedTestFiles, dependenciesForTestFile } from '../transform/compilationCache';
import type { FullConfigInternal } from '../common/config';
import { InternalReporter } from '../reporters/internalReporter';
import { TeleReporterEmitter } from '../reporters/teleEmitter';
import { createReporters } from './reporters';
import { TestRun, createTaskRunnerForList, createTaskRunnerForWatch, createTaskRunnerForWatchSetup } from './tasks';
import { chokidar } from '../utilsBundle';
import type { FSWatcher } from 'chokidar';
import { open } from 'playwright-core/lib/utilsBundle';
import ListReporter from '../reporters/list';
import type { OpenTraceViewerOptions, Transport } from 'playwright-core/lib/server/trace/viewer/traceViewer';
import { Multiplexer } from '../reporters/multiplexer';
import { SigIntWatcher } from './sigIntWatcher';

class UIMode {
  private _config: FullConfigInternal;
  private _transport!: Transport;
  private _testRun: { run: Promise<FullResult['status']>, stop: ManualPromise<void> } | undefined;
  globalCleanup: (() => Promise<FullResult['status']>) | undefined;
  private _globalWatcher: Watcher;
  private _testWatcher: Watcher;
  private _originalStdoutWrite: NodeJS.WriteStream['write'];
  private _originalStderrWrite: NodeJS.WriteStream['write'];

  constructor(config: FullConfigInternal) {
    this._config = config;
    process.env.PW_LIVE_TRACE_STACKS = '1';
    config.cliListOnly = false;
    config.cliPassWithNoTests = true;

    for (const p of config.projects) {
      p.project.retries = 0;
      p.project.repeatEach = 1;
    }
    config.configCLIOverrides.use = config.configCLIOverrides.use || {};
    config.configCLIOverrides.use.trace = { mode: 'on', sources: false, _live: true };

    this._originalStdoutWrite = process.stdout.write;
    this._originalStderrWrite = process.stderr.write;
    this._globalWatcher = new Watcher('deep', () => this._dispatchEvent('listChanged', {}));
    this._testWatcher = new Watcher('flat', events => {
      const collector = new Set<string>();
      events.forEach(f => collectAffectedTestFiles(f.file, collector));
      this._dispatchEvent('testFilesChanged', { testFileNames: [...collector] });
    });
  }

  async runGlobalSetup(): Promise<FullResult['status']> {
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
    this.globalCleanup = globalCleanup;
    return status;
  }

  async showUI(options: { host?: string, port?: number }, cancelPromise: ManualPromise<void>) {
    let queue = Promise.resolve();

    this._transport = {
      dispatch: async (method, params) => {
        if (method === 'ping')
          return;

        if (method === 'watch') {
          this._watchFiles(params.fileNames);
          return;
        }
        if (method === 'open' && params.location) {
          open('vscode://file/' + params.location).catch(e => this._originalStderrWrite.call(process.stderr, String(e)));
          return;
        }
        if (method === 'resizeTerminal') {
          process.stdout.columns = params.cols;
          process.stdout.rows = params.rows;
          process.stderr.columns = params.cols;
          process.stderr.columns = params.rows;
          return;
        }
        if (method === 'stop') {
          void this._stopTests();
          return;
        }
        if (method === 'checkBrowsers')
          return { hasBrowsers: hasSomeBrowsers() };
        if (method === 'installBrowsers') {
          await installBrowsers();
          return;
        }

        queue = queue.then(() => this._queueListOrRun(method, params));
        await queue;
      },

      onclose: () => { },
    };
    const openOptions: OpenTraceViewerOptions = {
      app: 'uiMode.html',
      headless: isUnderTest() && process.env.PWTEST_HEADED_FOR_TEST !== '1',
      transport: this._transport,
      host: options.host,
      port: options.port,
      persistentContextOptions: {
        handleSIGINT: false,
      },
    };
    if (options.host !== undefined || options.port !== undefined) {
      await openTraceInBrowser([], openOptions);
    } else {
      const page = await openTraceViewerApp([], 'chromium', openOptions);
      page.on('close', () => cancelPromise.resolve());
    }

    if (!process.env.PWTEST_DEBUG) {
      process.stdout.write = (chunk: string | Buffer) => {
        this._dispatchEvent('stdio', chunkToPayload('stdout', chunk));
        return true;
      };
      process.stderr.write = (chunk: string | Buffer) => {
        this._dispatchEvent('stdio', chunkToPayload('stderr', chunk));
        return true;
      };
    }
    await cancelPromise;

    if (!process.env.PWTEST_DEBUG) {
      process.stdout.write = this._originalStdoutWrite;
      process.stderr.write = this._originalStderrWrite;
    }
  }

  private async _queueListOrRun(method: string, params: any) {
    if (method === 'list')
      await this._listTests();
    if (method === 'run')
      await this._runTests(params.testIds, params.projects);
  }

  private _dispatchEvent(method: string, params?: any) {
    this._transport.sendEvent?.(method, params);
  }

  private async _listTests() {
    const reporter = new InternalReporter(new TeleReporterEmitter(e => this._dispatchEvent(e.method, e.params), true));
    this._config.cliListOnly = true;
    this._config.testIdMatcher = undefined;
    const taskRunner = createTaskRunnerForList(this._config, reporter, 'out-of-process', { failOnLoadErrors: false });
    const testRun = new TestRun(this._config, reporter);
    clearCompilationCache();
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
    this._globalWatcher.update([...projectDirs], [...projectOutputs], false);
  }

  private async _runTests(testIds: string[], projects: string[]) {
    await this._stopTests();

    const testIdSet = testIds ? new Set<string>(testIds) : null;
    this._config.cliListOnly = false;
    this._config.cliProjectFilter = projects.length ? projects : undefined;
    this._config.testIdMatcher = id => !testIdSet || testIdSet.has(id);

    const reporters = await createReporters(this._config, 'ui');
    reporters.push(new TeleReporterEmitter(e => this._dispatchEvent(e.method, e.params), true));
    const reporter = new InternalReporter(new Multiplexer(reporters));
    const taskRunner = createTaskRunnerForWatch(this._config, reporter);
    const testRun = new TestRun(this._config, reporter);
    clearCompilationCache();
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

  private _watchFiles(fileNames: string[]) {
    const files = new Set<string>();
    for (const fileName of fileNames) {
      files.add(fileName);
      dependenciesForTestFile(fileName).forEach(file => files.add(file));
    }
    this._testWatcher.update([...files], [], true);
  }

  private async _stopTests() {
    this._testRun?.stop?.resolve();
    await this._testRun?.run;
  }
}

export async function runUIMode(config: FullConfigInternal, options: { host?: string, port?: number }): Promise<FullResult['status']> {
  const uiMode = new UIMode(config);
  const globalSetupStatus = await uiMode.runGlobalSetup();
  if (globalSetupStatus !== 'passed')
    return globalSetupStatus;
  const cancelPromise = new ManualPromise<void>();
  const sigintWatcher = new SigIntWatcher();
  void sigintWatcher.promise().then(() => cancelPromise.resolve());
  try {
    await uiMode.showUI(options, cancelPromise);
  } finally {
    sigintWatcher.disarm();
  }
  return await uiMode.globalCleanup?.() || (sigintWatcher.hadSignal() ? 'interrupted' : 'passed');
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

type FSEvent = { event: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir', file: string };

class Watcher {
  private _onChange: (events: FSEvent[]) => void;
  private _watchedFiles: string[] = [];
  private _ignoredFolders: string[] = [];
  private _collector: FSEvent[] = [];
  private _fsWatcher: FSWatcher | undefined;
  private _throttleTimer: NodeJS.Timeout | undefined;
  private _mode: 'flat' | 'deep';

  constructor(mode: 'flat' | 'deep', onChange: (events: FSEvent[]) => void) {
    this._mode = mode;
    this._onChange = onChange;
  }

  update(watchedFiles: string[], ignoredFolders: string[], reportPending: boolean) {
    if (JSON.stringify([this._watchedFiles, this._ignoredFolders]) === JSON.stringify(watchedFiles, ignoredFolders))
      return;

    if (reportPending)
      this._reportEventsIfAny();

    this._watchedFiles = watchedFiles;
    this._ignoredFolders = ignoredFolders;
    void this._fsWatcher?.close();
    this._fsWatcher = undefined;
    this._collector.length = 0;
    clearTimeout(this._throttleTimer);
    this._throttleTimer = undefined;

    if (!this._watchedFiles.length)
      return;

    this._fsWatcher = chokidar.watch(watchedFiles, { ignoreInitial: true, ignored: this._ignoredFolders }).on('all', async (event, file) => {
      if (this._throttleTimer)
        clearTimeout(this._throttleTimer);
      if (this._mode === 'flat' && event !== 'add' && event !== 'change')
        return;
      if (this._mode === 'deep' && event !== 'add' && event !== 'change' && event !== 'unlink' && event !== 'addDir' && event !== 'unlinkDir')
        return;
      this._collector.push({ event, file });
      this._throttleTimer = setTimeout(() => this._reportEventsIfAny(), 250);
    });
  }

  private _reportEventsIfAny() {
    if (this._collector.length)
      this._onChange(this._collector.slice());
    this._collector.length = 0;
  }
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
