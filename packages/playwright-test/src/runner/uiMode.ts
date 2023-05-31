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

import { showTraceViewer } from 'playwright-core/lib/server';
import type { Page } from 'playwright-core/lib/server/page';
import { isUnderTest, ManualPromise } from 'playwright-core/lib/utils';
import type { FullResult } from '../../reporter';
import { clearCompilationCache, collectAffectedTestFiles, dependenciesForTestFile } from '../transform/compilationCache';
import type { FullConfigInternal } from '../common/config';
import { InternalReporter } from '../reporters/internalReporter';
import { TeleReporterEmitter } from '../reporters/teleEmitter';
import { createReporters } from './reporters';
import { TestRun, createTaskRunnerForList, createTaskRunnerForWatch, createTaskRunnerForWatchSetup } from './tasks';
import { chokidar } from '../utilsBundle';
import type { FSWatcher } from 'chokidar';
import { open } from '../utilsBundle';
import ListReporter from '../reporters/list';

class UIMode {
  private _config: FullConfigInternal;
  private _page!: Page;
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
    for (const project of config.projects) {
      project.deps = [];
      project.teardown = undefined;
    }

    for (const p of config.projects) {
      p.project.retries = 0;
      p.project.repeatEach = 1;
    }
    config.configCLIOverrides.use = config.configCLIOverrides.use || {};
    config.configCLIOverrides.use.trace = { mode: 'on', sources: false };

    this._originalStdoutWrite = process.stdout.write;
    this._originalStderrWrite = process.stderr.write;
    this._globalWatcher = new Watcher('deep', () => this._dispatchEvent({ method: 'listChanged' }));
    this._testWatcher = new Watcher('flat', events => {
      const collector = new Set<string>();
      events.forEach(f => collectAffectedTestFiles(f.file, collector));
      this._dispatchEvent({ method: 'testFilesChanged', params: { testFileNames: [...collector] } });
    });
  }

  async runGlobalSetup(): Promise<FullResult['status']> {
    const reporter = new InternalReporter([new ListReporter()]);
    const taskRunner = createTaskRunnerForWatchSetup(this._config, reporter);
    reporter.onConfigure(this._config);
    const testRun = new TestRun(this._config, reporter);
    const { status, cleanup: globalCleanup } = await taskRunner.runDeferCleanup(testRun, 0);
    await reporter.onExit({ status });
    if (status !== 'passed') {
      await globalCleanup();
      return status;
    }
    this.globalCleanup = globalCleanup;
    return status;
  }

  async showUI() {
    this._page = await showTraceViewer([], 'chromium', { app: 'uiMode.html', headless: isUnderTest() && process.env.PWTEST_HEADED_FOR_TEST !== '1' });
    if (!process.env.PWTEST_DEBUG) {
      process.stdout.write = (chunk: string | Buffer) => {
        this._dispatchEvent({ method: 'stdio', params: chunkToPayload('stdout', chunk) });
        return true;
      };
      process.stderr.write = (chunk: string | Buffer) => {
        this._dispatchEvent({ method: 'stdio', params: chunkToPayload('stderr', chunk) });
        return true;
      };
    }
    const exitPromise = new ManualPromise();
    this._page.on('close', () => exitPromise.resolve());
    let queue = Promise.resolve();
    this._page.exposeBinding('sendMessage', false, async (source, data) => {
      const { method, params }: { method: string, params: any } = data;
      if (method === 'exit') {
        exitPromise.resolve();
        return;
      }
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
        this._stopTests();
        return;
      }
      queue = queue.then(() => this._queueListOrRun(method, params));
      await queue;
    });
    await exitPromise;

    if (!process.env.PWTEST_DEBUG) {
      process.stdout.write = this._originalStdoutWrite;
      process.stderr.write = this._originalStderrWrite;
    }
  }

  private async _queueListOrRun(method: string, params: any) {
    if (method === 'list')
      await this._listTests();
    if (method === 'run')
      await this._runTests(params.testIds);
  }

  private _dispatchEvent(message: any) {
    // eslint-disable-next-line no-console
    this._page.mainFrame().evaluateExpression(dispatchFuncSource, { isFunction: true }, message).catch(e => this._originalStderrWrite.call(process.stderr, String(e)));
  }

  private async _listTests() {
    const listReporter = new TeleReporterEmitter(e => this._dispatchEvent(e));
    const reporter = new InternalReporter([listReporter]);
    this._config.cliListOnly = true;
    this._config.testIdMatcher = undefined;
    const taskRunner = createTaskRunnerForList(this._config, reporter, 'out-of-process', { failOnLoadErrors: false });
    const testRun = new TestRun(this._config, reporter);
    clearCompilationCache();
    reporter.onConfigure(this._config);
    const status = await taskRunner.run(testRun, 0);
    await reporter.onExit({ status });

    const projectDirs = new Set<string>();
    for (const p of this._config.projects)
      projectDirs.add(p.project.testDir);
    this._globalWatcher.update([...projectDirs], false);
  }

  private async _runTests(testIds: string[]) {
    await this._stopTests();

    const testIdSet = testIds ? new Set<string>(testIds) : null;
    this._config.cliListOnly = false;
    this._config.testIdMatcher = id => !testIdSet || testIdSet.has(id);

    const reporters = await createReporters(this._config, 'ui');
    reporters.push(new TeleReporterEmitter(e => this._dispatchEvent(e)));
    const reporter = new InternalReporter(reporters);
    const taskRunner = createTaskRunnerForWatch(this._config, reporter);
    const testRun = new TestRun(this._config, reporter);
    clearCompilationCache();
    reporter.onConfigure(this._config);
    const stop = new ManualPromise();
    const run = taskRunner.run(testRun, 0, stop).then(async status => {
      await reporter.onExit({ status });
      this._testRun = undefined;
      this._config.testIdMatcher = undefined;
      return status;
    });
    this._testRun = { run, stop };
    await run;
  }

  private async _watchFiles(fileNames: string[]) {
    const files = new Set<string>();
    for (const fileName of fileNames) {
      files.add(fileName);
      dependenciesForTestFile(fileName).forEach(file => files.add(file));
    }
    this._testWatcher.update([...files], true);
  }

  private async _stopTests() {
    this._testRun?.stop?.resolve();
    await this._testRun?.run;
  }
}

const dispatchFuncSource = String((message: any) => {
  (window as any).dispatch(message);
});

export async function runUIMode(config: FullConfigInternal): Promise<FullResult['status']> {
  const uiMode = new UIMode(config);
  const status = await uiMode.runGlobalSetup();
  if (status !== 'passed')
    return status;
  await uiMode.showUI();
  return await uiMode.globalCleanup?.() || 'passed';
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
  private _collector: FSEvent[] = [];
  private _fsWatcher: FSWatcher | undefined;
  private _throttleTimer: NodeJS.Timeout | undefined;
  private _mode: 'flat' | 'deep';

  constructor(mode: 'flat' | 'deep', onChange: (events: FSEvent[]) => void) {
    this._mode = mode;
    this._onChange = onChange;
  }

  update(watchedFiles: string[], reportPending: boolean) {
    if (JSON.stringify(this._watchedFiles) === JSON.stringify(watchedFiles))
      return;

    if (reportPending)
      this._reportEventsIfAny();

    this._watchedFiles = watchedFiles;
    this._fsWatcher?.close().then(() => {});
    this._fsWatcher = undefined;
    this._collector.length = 0;
    clearTimeout(this._throttleTimer);
    this._throttleTimer = undefined;

    if (!this._watchedFiles.length)
      return;

    this._fsWatcher = chokidar.watch(watchedFiles, { ignoreInitial: true }).on('all', async (event, file) => {
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
