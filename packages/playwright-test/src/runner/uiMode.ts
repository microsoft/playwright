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
import { ManualPromise } from 'playwright-core/lib/utils';
import type { FullResult } from '../../reporter';
import { clearCompilationCache, dependenciesForTestFile } from '../common/compilationCache';
import type { FullConfigInternal } from '../common/types';
import { Multiplexer } from '../reporters/multiplexer';
import { TeleReporterEmitter } from '../reporters/teleEmitter';
import { createReporter } from './reporters';
import type { TaskRunnerState } from './tasks';
import { createTaskRunnerForList, createTaskRunnerForWatch, createTaskRunnerForWatchSetup } from './tasks';
import { chokidar } from '../utilsBundle';
import type { FSWatcher } from 'chokidar';
import { open } from '../utilsBundle';

class UIMode {
  private _config: FullConfigInternal;
  private _page!: Page;
  private _testRun: { run: Promise<FullResult['status']>, stop: ManualPromise<void> } | undefined;
  globalCleanup: (() => Promise<FullResult['status']>) | undefined;
  private _testWatcher: FSWatcher | undefined;
  private _watchTestFile: string | undefined;
  private _originalStderr: (buffer: string | Uint8Array) => void;

  constructor(config: FullConfigInternal) {
    this._config = config;
    config._internal.configCLIOverrides.forbidOnly = false;
    config._internal.configCLIOverrides.globalTimeout = 0;
    config._internal.configCLIOverrides.repeatEach = 0;
    config._internal.configCLIOverrides.shard = undefined;
    config._internal.configCLIOverrides.updateSnapshots = undefined;
    config._internal.listOnly = false;
    config._internal.passWithNoTests = true;

    for (const p of config.projects)
      p.retries = 0;
    config._internal.configCLIOverrides.use = config._internal.configCLIOverrides.use || {};
    config._internal.configCLIOverrides.use.trace = { mode: 'on', sources: false };

    this._originalStderr = process.stderr.write.bind(process.stderr);
    process.stdout.write = (chunk: string | Buffer) => {
      this._dispatchEvent({ method: 'stdio', params: chunkToPayload('stdout', chunk) });
      return true;
    };
    process.stderr.write = (chunk: string | Buffer) => {
      this._dispatchEvent({ method: 'stdio', params: chunkToPayload('stderr', chunk) });
      return true;
    };

    this._installGlobalWatcher();
  }

  private _installGlobalWatcher(): FSWatcher {
    const projectDirs = new Set<string>();
    for (const p of this._config.projects)
      projectDirs.add(p.testDir);
    let coalescingTimer: NodeJS.Timeout | undefined;
    const watcher = chokidar.watch([...projectDirs], { ignoreInitial: true, persistent: true }).on('all', async event => {
      if (event !== 'add' && event !== 'change')
        return;
      if (coalescingTimer)
        clearTimeout(coalescingTimer);
      coalescingTimer = setTimeout(() => {
        this._dispatchEvent({ method: 'listChanged' });
      }, 200);
    });
    return watcher;
  }

  async runGlobalSetup(): Promise<FullResult['status']> {
    const reporter = await createReporter(this._config, 'watch');
    const taskRunner = createTaskRunnerForWatchSetup(this._config, reporter);
    reporter.onConfigure(this._config);
    const context: TaskRunnerState = {
      config: this._config,
      reporter,
      phases: [],
    };
    const { status, cleanup: globalCleanup } = await taskRunner.runDeferCleanup(context, 0);
    if (status !== 'passed') {
      await globalCleanup();
      return status;
    }
    this.globalCleanup = globalCleanup;
    return status;
  }

  async showUI() {
    this._page = await showTraceViewer([], 'chromium', { app: 'watch.html' });
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
        this._watchFile(params.fileName);
        return;
      }
      if (method === 'open' && params.location) {
        open('vscode://file/' + params.location).catch(e => this._originalStderr(String(e)));
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
  }

  private async _queueListOrRun(method: string, params: any) {
    if (method === 'list')
      await this._listTests();
    if (method === 'run')
      await this._runTests(params.testIds);
  }

  private _dispatchEvent(message: any) {
    // eslint-disable-next-line no-console
    this._page.mainFrame().evaluateExpression(dispatchFuncSource, true, message).catch(e => this._originalStderr(String(e)));
  }

  private async _listTests() {
    const listReporter = new TeleReporterEmitter(e => this._dispatchEvent(e));
    const reporter = new Multiplexer([listReporter]);
    this._config._internal.listOnly = true;
    this._config._internal.testIdMatcher = undefined;
    const taskRunner = createTaskRunnerForList(this._config, reporter, 'out-of-process');
    const context: TaskRunnerState = { config: this._config, reporter, phases: [] };
    clearCompilationCache();
    reporter.onConfigure(this._config);
    await taskRunner.run(context, 0);
  }

  private async _runTests(testIds: string[]) {
    await this._stopTests();

    const testIdSet = testIds ? new Set<string>(testIds) : null;
    this._config._internal.listOnly = false;
    this._config._internal.testIdMatcher = id => !testIdSet || testIdSet.has(id);

    const runReporter = new TeleReporterEmitter(e => this._dispatchEvent(e));
    const reporter = await createReporter(this._config, 'ui', [runReporter]);
    const taskRunner = createTaskRunnerForWatch(this._config, reporter);
    const context: TaskRunnerState = { config: this._config, reporter, phases: [] };
    clearCompilationCache();
    reporter.onConfigure(this._config);
    const stop = new ManualPromise();
    const run = taskRunner.run(context, 0, stop).then(async status => {
      await reporter.onExit({ status });
      this._testRun = undefined;
      this._config._internal.testIdMatcher = undefined;
      return status;
    });
    this._testRun = { run, stop };
    await run;
  }

  private async _watchFile(fileName: string) {
    if (this._watchTestFile === fileName)
      return;
    if (this._testWatcher)
      await this._testWatcher.close();
    this._watchTestFile = fileName;
    if (!fileName)
      return;

    const files = [fileName, ...dependenciesForTestFile(fileName)];
    this._testWatcher = chokidar.watch(files, { ignoreInitial: true }).on('all', async (event, file) => {
      if (event !== 'add' && event !== 'change')
        return;
      this._dispatchEvent({ method: 'fileChanged', params: { fileName: file } });
    });
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
