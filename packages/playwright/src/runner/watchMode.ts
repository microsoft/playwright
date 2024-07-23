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

import readline from 'readline';
import { createGuid, getPackageManagerExecCommand, ManualPromise } from 'playwright-core/lib/utils';
import type { FullConfigInternal, FullProjectInternal } from '../common/config';
import { createFileMatcher, createFileMatcherFromArguments } from '../util';
import type { Matcher } from '../util';
import { TestRun, createTaskRunnerForWatch, createTaskRunnerForWatchSetup } from './tasks';
import { buildProjectsClosure, filterProjects } from './projectUtils';
import { collectAffectedTestFiles } from '../transform/compilationCache';
import type { FullResult } from '../../types/testReporter';
import { chokidar } from '../utilsBundle';
import type { FSWatcher as CFSWatcher } from 'chokidar';
import { colors } from 'playwright-core/lib/utilsBundle';
import { enquirer } from '../utilsBundle';
import { separator } from '../reporters/base';
import { PlaywrightServer } from 'playwright-core/lib/remote/playwrightServer';
import ListReporter from '../reporters/list';

class FSWatcher {
  private _dirtyTestFiles = new Map<FullProjectInternal, Set<string>>();
  private _notifyDirtyFiles: (() => void) | undefined;
  private _watcher: CFSWatcher | undefined;
  private _timer: NodeJS.Timeout | undefined;

  async update(config: FullConfigInternal) {
    const commandLineFileMatcher = config.cliArgs.length ? createFileMatcherFromArguments(config.cliArgs) : () => true;
    const projects = filterProjects(config.projects, config.cliProjectFilter);
    const projectClosure = buildProjectsClosure(projects);
    const projectFilters = new Map<FullProjectInternal, Matcher>();
    for (const [project, type] of projectClosure) {
      const testMatch = createFileMatcher(project.project.testMatch);
      const testIgnore = createFileMatcher(project.project.testIgnore);
      projectFilters.set(project, file => {
        if (!file.startsWith(project.project.testDir) || !testMatch(file) || testIgnore(file))
          return false;
        return type === 'dependency' || commandLineFileMatcher(file);
      });
    }

    if (this._timer)
      clearTimeout(this._timer);
    if (this._watcher)
      await this._watcher.close();

    this._watcher = chokidar.watch([...projectClosure.keys()].map(p => p.project.testDir), { ignoreInitial: true }).on('all', async (event, file) => {
      if (event !== 'add' && event !== 'change')
        return;

      const testFiles = new Set<string>();
      collectAffectedTestFiles(file, testFiles);
      const testFileArray = [...testFiles];

      let hasMatches = false;
      for (const [project, filter] of projectFilters) {
        const filteredFiles = testFileArray.filter(filter);
        if (!filteredFiles.length)
          continue;
        let set = this._dirtyTestFiles.get(project);
        if (!set) {
          set = new Set();
          this._dirtyTestFiles.set(project, set);
        }
        filteredFiles.map(f => set!.add(f));
        hasMatches = true;
      }

      if (!hasMatches)
        return;

      if (this._timer)
        clearTimeout(this._timer);
      this._timer = setTimeout(() => {
        this._notifyDirtyFiles?.();
      }, 250);
    });

  }

  async onDirtyTestFiles(): Promise<void> {
    if (this._dirtyTestFiles.size)
      return;
    await new Promise<void>(f => this._notifyDirtyFiles = f);
  }

  takeDirtyTestFiles(): Map<FullProjectInternal, Set<string>> {
    const result = this._dirtyTestFiles;
    this._dirtyTestFiles = new Map();
    return result;
  }
}

export async function runWatchModeLoop(config: FullConfigInternal): Promise<FullResult['status']> {
  // Reset the settings that don't apply to watch.
  config.cliPassWithNoTests = true;
  for (const p of config.projects)
    p.project.retries = 0;

  // Perform global setup.
  const testRun = new TestRun(config);
  const taskRunner = createTaskRunnerForWatchSetup(config, [new ListReporter()]);
  taskRunner.reporter.onConfigure(config.config);
  const { status, cleanup: globalCleanup } = await taskRunner.runDeferCleanup(testRun, 0);
  if (status !== 'passed')
    await globalCleanup();
  await taskRunner.reporter.onEnd({ status });
  await taskRunner.reporter.onExit();
  if (status !== 'passed')
    return status;

  // Prepare projects that will be watched, set up watcher.
  const failedTestIdCollector = new Set<string>();
  const originalWorkers = config.config.workers;
  const fsWatcher = new FSWatcher();
  await fsWatcher.update(config);

  let lastRun: { type: 'changed' | 'regular' | 'failed', failedTestIds?: Set<string>, dirtyTestFiles?: Map<FullProjectInternal, Set<string>> } = { type: 'regular' };
  let result: FullResult['status'] = 'passed';

  // Enter the watch loop.
  await runTests(config, failedTestIdCollector);

  while (true) {
    printPrompt();
    const readCommandPromise = readCommand();
    await Promise.race([
      fsWatcher.onDirtyTestFiles(),
      readCommandPromise,
    ]);
    if (!readCommandPromise.isDone())
      readCommandPromise.resolve('changed');

    const command = await readCommandPromise;

    if (command === 'changed') {
      const dirtyTestFiles = fsWatcher.takeDirtyTestFiles();
      // Resolve files that depend on the changed files.
      await runChangedTests(config, failedTestIdCollector, dirtyTestFiles);
      lastRun = { type: 'changed', dirtyTestFiles };
      continue;
    }

    if (command === 'run') {
      // All means reset filters.
      await runTests(config, failedTestIdCollector);
      lastRun = { type: 'regular' };
      continue;
    }

    if (command === 'project') {
      const { projectNames } = await enquirer.prompt<{ projectNames: string[] }>({
        type: 'multiselect',
        name: 'projectNames',
        message: 'Select projects',
        choices: config.projects.map(p => ({ name: p.project.name })),
      }).catch(() => ({ projectNames: null }));
      if (!projectNames)
        continue;
      config.cliProjectFilter = projectNames.length ? projectNames : undefined;
      await fsWatcher.update(config);
      await runTests(config, failedTestIdCollector);
      lastRun = { type: 'regular' };
      continue;
    }

    if (command === 'file') {
      const { filePattern } = await enquirer.prompt<{ filePattern: string }>({
        type: 'text',
        name: 'filePattern',
        message: 'Input filename pattern (regex)',
      }).catch(() => ({ filePattern: null }));
      if (filePattern === null)
        continue;
      if (filePattern.trim())
        config.cliArgs = filePattern.split(' ');
      else
        config.cliArgs = [];
      await fsWatcher.update(config);
      await runTests(config, failedTestIdCollector);
      lastRun = { type: 'regular' };
      continue;
    }

    if (command === 'grep') {
      const { testPattern } = await enquirer.prompt<{ testPattern: string }>({
        type: 'text',
        name: 'testPattern',
        message: 'Input test name pattern (regex)',
      }).catch(() => ({ testPattern: null }));
      if (testPattern === null)
        continue;
      if (testPattern.trim())
        config.cliGrep = testPattern;
      else
        config.cliGrep = undefined;
      await fsWatcher.update(config);
      await runTests(config, failedTestIdCollector);
      lastRun = { type: 'regular' };
      continue;
    }

    if (command === 'failed') {
      config.testIdMatcher = id => failedTestIdCollector.has(id);
      const failedTestIds = new Set(failedTestIdCollector);
      await runTests(config, failedTestIdCollector, { title: 'running failed tests' });
      config.testIdMatcher = undefined;
      lastRun = { type: 'failed', failedTestIds };
      continue;
    }

    if (command === 'repeat') {
      if (lastRun.type === 'regular') {
        await runTests(config, failedTestIdCollector, { title: 're-running tests' });
        continue;
      } else if (lastRun.type === 'changed') {
        await runChangedTests(config, failedTestIdCollector, lastRun.dirtyTestFiles!, 're-running tests');
      } else if (lastRun.type === 'failed') {
        config.testIdMatcher = id => lastRun.failedTestIds!.has(id);
        await runTests(config, failedTestIdCollector, { title: 're-running tests' });
        config.testIdMatcher = undefined;
      }
      continue;
    }

    if (command === 'toggle-show-browser') {
      await toggleShowBrowser(config, originalWorkers);
      continue;
    }

    if (command === 'exit')
      break;

    if (command === 'interrupted') {
      result = 'interrupted';
      break;
    }
  }

  const cleanupStatus = await globalCleanup();
  return result === 'passed' ? cleanupStatus : result;
}

async function runChangedTests(config: FullConfigInternal, failedTestIdCollector: Set<string>, filesByProject: Map<FullProjectInternal, Set<string>>, title?: string) {
  const testFiles = new Set<string>();
  for (const files of filesByProject.values())
    files.forEach(f => testFiles.add(f));

  // Collect all the affected projects, follow project dependencies.
  // Prepare to exclude all the projects that do not depend on this file, as if they did not exist.
  const projects = filterProjects(config.projects, config.cliProjectFilter);
  const projectClosure = buildProjectsClosure(projects);
  const affectedProjects = affectedProjectsClosure([...projectClosure.keys()], [...filesByProject.keys()]);
  const affectsAnyDependency = [...affectedProjects].some(p => projectClosure.get(p) === 'dependency');

  // If there are affected dependency projects, do the full run, respect the original CLI.
  // if there are no affected dependency projects, intersect CLI with dirty files
  const additionalFileMatcher = affectsAnyDependency ? () => true : (file: string) => testFiles.has(file);
  await runTests(config, failedTestIdCollector, { additionalFileMatcher, title: title || 'files changed' });
}

async function runTests(config: FullConfigInternal, failedTestIdCollector: Set<string>, options?: {
    projectsToIgnore?: Set<FullProjectInternal>,
    additionalFileMatcher?: Matcher,
    title?: string,
  }) {
  printConfiguration(config, options?.title);
  const taskRunner = createTaskRunnerForWatch(config, [new ListReporter()], options?.additionalFileMatcher);
  const testRun = new TestRun(config);
  taskRunner.reporter.onConfigure(config.config);
  const taskStatus = await taskRunner.run(testRun, 0);
  let status: FullResult['status'] = 'passed';

  let hasFailedTests = false;
  for (const test of testRun.rootSuite?.allTests() || []) {
    if (test.outcome() === 'unexpected') {
      failedTestIdCollector.add(test.id);
      hasFailedTests = true;
    } else {
      failedTestIdCollector.delete(test.id);
    }
  }

  if (testRun.failureTracker.hasWorkerErrors() || hasFailedTests)
    status = 'failed';
  if (status === 'passed' && taskStatus !== 'passed')
    status = taskStatus;
  await taskRunner.reporter.onEnd({ status });
  await taskRunner.reporter.onExit();
}

function affectedProjectsClosure(projectClosure: FullProjectInternal[], affected: FullProjectInternal[]): Set<FullProjectInternal> {
  const result = new Set<FullProjectInternal>(affected);
  for (let i = 0; i < projectClosure.length; ++i) {
    for (const p of projectClosure) {
      for (const dep of p.deps) {
        if (result.has(dep))
          result.add(p);
      }
      if (p.teardown && result.has(p.teardown))
        result.add(p);
    }
  }
  return result;
}

function readCommand(): ManualPromise<Command> {
  const result = new ManualPromise<Command>();
  const rl = readline.createInterface({ input: process.stdin, escapeCodeTimeout: 50 });
  readline.emitKeypressEvents(process.stdin, rl);
  if (process.stdin.isTTY)
    process.stdin.setRawMode(true);

  const handler = (text: string, key: any) => {
    if (text === '\x03' || text === '\x1B' || (key && key.name === 'escape') || (key && key.ctrl && key.name === 'c')) {
      result.resolve('interrupted');
      return;
    }
    if (process.platform !== 'win32' && key && key.ctrl && key.name === 'z') {
      process.kill(process.ppid, 'SIGTSTP');
      process.kill(process.pid, 'SIGTSTP');
    }
    const name = key?.name;
    if (name === 'q') {
      result.resolve('exit');
      return;
    }
    if (name === 'h') {
      process.stdout.write(`${separator()}
Run tests
  ${colors.bold('enter')}    ${colors.dim('run tests')}
  ${colors.bold('f')}        ${colors.dim('run failed tests')}
  ${colors.bold('r')}        ${colors.dim('repeat last run')}
  ${colors.bold('q')}        ${colors.dim('quit')}

Change settings
  ${colors.bold('c')}        ${colors.dim('set project')}
  ${colors.bold('p')}        ${colors.dim('set file filter')}
  ${colors.bold('t')}        ${colors.dim('set title filter')}
  ${colors.bold('s')}        ${colors.dim('toggle show & reuse the browser')}
`);
      return;
    }

    switch (name) {
      case 'return': result.resolve('run'); break;
      case 'r': result.resolve('repeat'); break;
      case 'c': result.resolve('project'); break;
      case 'p': result.resolve('file'); break;
      case 't': result.resolve('grep'); break;
      case 'f': result.resolve('failed'); break;
      case 's': result.resolve('toggle-show-browser'); break;
    }
  };

  process.stdin.on('keypress', handler);
  void result.finally(() => {
    process.stdin.off('keypress', handler);
    rl.close();
    if (process.stdin.isTTY)
      process.stdin.setRawMode(false);
  });
  return result;
}

let showBrowserServer: PlaywrightServer | undefined;
let seq = 0;

function printConfiguration(config: FullConfigInternal, title?: string) {
  const packageManagerCommand = getPackageManagerExecCommand();
  const tokens: string[] = [];
  tokens.push(`${packageManagerCommand} playwright test`);
  tokens.push(...(config.cliProjectFilter || [])?.map(p => colors.blue(`--project ${p}`)));
  if (config.cliGrep)
    tokens.push(colors.red(`--grep ${config.cliGrep}`));
  if (config.cliArgs)
    tokens.push(...config.cliArgs.map(a => colors.bold(a)));
  if (title)
    tokens.push(colors.dim(`(${title})`));
  if (seq)
    tokens.push(colors.dim(`#${seq}`));
  ++seq;
  const lines: string[] = [];
  const sep = separator();
  lines.push('\x1Bc' + sep);
  lines.push(`${tokens.join(' ')}`);
  lines.push(`${colors.dim('Show & reuse browser:')} ${colors.bold(showBrowserServer ? 'on' : 'off')}`);
  process.stdout.write(lines.join('\n'));
}

function printPrompt() {
  const sep = separator();
  process.stdout.write(`
${sep}
${colors.dim('Waiting for file changes. Press')} ${colors.bold('enter')} ${colors.dim('to run tests')}, ${colors.bold('q')} ${colors.dim('to quit or')} ${colors.bold('h')} ${colors.dim('for more options.')}
`);
}

async function toggleShowBrowser(config: FullConfigInternal, originalWorkers: number) {
  if (!showBrowserServer) {
    config.config.workers = 1;
    showBrowserServer = new PlaywrightServer({ mode: 'extension', path: '/' + createGuid(), maxConnections: 1 });
    const wsEndpoint = await showBrowserServer.listen();
    config.configCLIOverrides.use = {
      ...config.configCLIOverrides.use,
      _optionContextReuseMode: 'when-possible',
      _optionConnectOptions: { wsEndpoint },
    };
    process.stdout.write(`${colors.dim('Show & reuse browser:')} ${colors.bold('on')}\n`);
  } else {
    config.config.workers = originalWorkers;
    if (config.configCLIOverrides.use) {
      delete config.configCLIOverrides.use._optionContextReuseMode;
      delete config.configCLIOverrides.use._optionConnectOptions;
    }
    await showBrowserServer?.close();
    showBrowserServer = undefined;
    process.stdout.write(`${colors.dim('Show & reuse browser:')} ${colors.bold('off')}\n`);
  }
}

type Command = 'run' | 'failed' | 'repeat' | 'changed' | 'project' | 'file' | 'grep' | 'exit' | 'interrupted' | 'toggle-show-browser';
