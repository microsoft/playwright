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
import { createGuid, ManualPromise } from 'playwright-core/lib/utils';
import type { FullConfigInternal, FullProjectInternal } from '../common/types';
import { Multiplexer } from '../reporters/multiplexer';
import { createFileMatcher, createFileMatcherFromArguments } from '../util';
import type { Matcher } from '../util';
import { createTaskRunnerForWatch, createTaskRunnerForWatchSetup } from './tasks';
import type { TaskRunnerState } from './tasks';
import { buildProjectsClosure, filterProjects } from './projectUtils';
import { clearCompilationCache, collectAffectedTestFiles } from '../common/compilationCache';
import type { FullResult } from 'packages/playwright-test/reporter';
import { chokidar } from '../utilsBundle';
import type { FSWatcher as CFSWatcher } from 'chokidar';
import { createReporter } from './reporters';
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
    const commandLineFileMatcher = config._internal.cliArgs.length ? createFileMatcherFromArguments(config._internal.cliArgs) : () => true;
    const projects = filterProjects(config.projects, config._internal.cliProjectFilter);
    const projectClosure = buildProjectsClosure(projects);
    const projectFilters = new Map<FullProjectInternal, Matcher>();
    for (const project of projectClosure) {
      const testMatch = createFileMatcher(project.testMatch);
      const testIgnore = createFileMatcher(project.testIgnore);
      projectFilters.set(project, file => {
        if (!file.startsWith(project.testDir) || !testMatch(file) || testIgnore(file))
          return false;
        return project._internal.type === 'dependency' || commandLineFileMatcher(file);
      });
    }

    if (this._timer)
      clearTimeout(this._timer);
    if (this._watcher)
      await this._watcher.close();

    this._watcher = chokidar.watch(projectClosure.map(p => p.testDir), { ignoreInitial: true }).on('all', async (event, file) => {
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
  config._internal.passWithNoTests = true;
  for (const p of config.projects)
    p.retries = 0;

  // Perform global setup.
  const reporter = await createReporter(config, 'watch');
  const context: TaskRunnerState = {
    config,
    reporter,
    phases: [],
  };
  const taskRunner = createTaskRunnerForWatchSetup(config, reporter);
  reporter.onConfigure(config);
  const { status, cleanup: globalCleanup } = await taskRunner.runDeferCleanup(context, 0);
  if (status !== 'passed')
    return await globalCleanup();

  // Prepare projects that will be watched, set up watcher.
  const failedTestIdCollector = new Set<string>();
  const originalWorkers = config.workers;
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
        choices: config.projects.map(p => ({ name: p.name })),
      }).catch(() => ({ projectNames: null }));
      if (!projectNames)
        continue;
      config._internal.cliProjectFilter = projectNames.length ? projectNames : undefined;
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
        config._internal.cliArgs = filePattern.split(' ');
      else
        config._internal.cliArgs = [];
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
        config._internal.cliGrep = testPattern;
      else
        config._internal.cliGrep = undefined;
      await fsWatcher.update(config);
      await runTests(config, failedTestIdCollector);
      lastRun = { type: 'regular' };
      continue;
    }

    if (command === 'failed') {
      config._internal.testIdMatcher = id => failedTestIdCollector.has(id);
      const failedTestIds = new Set(failedTestIdCollector);
      await runTests(config, failedTestIdCollector, { title: 'running failed tests' });
      config._internal.testIdMatcher = undefined;
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
        config._internal.testIdMatcher = id => lastRun.failedTestIds!.has(id);
        await runTests(config, failedTestIdCollector, { title: 're-running tests' });
        config._internal.testIdMatcher = undefined;
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

  return result === 'passed' ? await globalCleanup() : result;
}

async function runChangedTests(config: FullConfigInternal, failedTestIdCollector: Set<string>, filesByProject: Map<FullProjectInternal, Set<string>>, title?: string) {
  const testFiles = new Set<string>();
  for (const files of filesByProject.values())
    files.forEach(f => testFiles.add(f));

  // Collect all the affected projects, follow project dependencies.
  // Prepare to exclude all the projects that do not depend on this file, as if they did not exist.
  const projects = filterProjects(config.projects, config._internal.cliProjectFilter);
  const projectClosure = buildProjectsClosure(projects);
  const affectedProjects = affectedProjectsClosure(projectClosure, [...filesByProject.keys()]);
  const affectsAnyDependency = [...affectedProjects].some(p => p._internal.type === 'dependency');
  const projectsToIgnore = new Set(projectClosure.filter(p => !affectedProjects.has(p)));

  // If there are affected dependency projects, do the full run, respect the original CLI.
  // if there are no affected dependency projects, intersect CLI with dirty files
  const additionalFileMatcher = affectsAnyDependency ? () => true : (file: string) => testFiles.has(file);
  await runTests(config, failedTestIdCollector, { projectsToIgnore, additionalFileMatcher, title: title || 'files changed' });
}

async function runTests(config: FullConfigInternal, failedTestIdCollector: Set<string>, options?: {
    projectsToIgnore?: Set<FullProjectInternal>,
    additionalFileMatcher?: Matcher,
    title?: string,
  }) {
  printConfiguration(config, options?.title);
  const reporter = new Multiplexer([new ListReporter()]);
  const taskRunner = createTaskRunnerForWatch(config, reporter, options?.projectsToIgnore, options?.additionalFileMatcher);
  const context: TaskRunnerState = {
    config,
    reporter,
    phases: [],
  };
  clearCompilationCache();
  reporter.onConfigure(config);
  const taskStatus = await taskRunner.run(context, 0);
  let status: FullResult['status'] = 'passed';

  let hasFailedTests = false;
  for (const test of context.rootSuite?.allTests() || []) {
    if (test.outcome() === 'unexpected') {
      failedTestIdCollector.add(test.id);
      hasFailedTests = true;
    } else {
      failedTestIdCollector.delete(test.id);
    }
  }

  if (context.phases.find(p => p.dispatcher.hasWorkerErrors()) || hasFailedTests)
    status = 'failed';
  if (status === 'passed' && taskStatus !== 'passed')
    status = taskStatus;
  await reporter.onExit({ status });
}

function affectedProjectsClosure(projectClosure: FullProjectInternal[], affected: FullProjectInternal[]): Set<FullProjectInternal> {
  const result = new Set<FullProjectInternal>(affected);
  for (let i = 0; i < projectClosure.length; ++i) {
    for (const p of projectClosure) {
      for (const dep of p._internal.deps) {
        if (result.has(dep))
          result.add(p);
      }
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
  result.finally(() => {
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
  const tokens: string[] = [];
  tokens.push('npx playwright test');
  tokens.push(...(config._internal.cliProjectFilter || [])?.map(p => colors.blue(`--project ${p}`)));
  if (config._internal.cliGrep)
    tokens.push(colors.red(`--grep ${config._internal.cliGrep}`));
  if (config._internal.cliArgs)
    tokens.push(...config._internal.cliArgs.map(a => colors.bold(a)));
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
    config.workers = 1;
    showBrowserServer = new PlaywrightServer({ path: '/' + createGuid(), maxConnections: 1 });
    const wsEndpoint = await showBrowserServer.listen();
    process.env.PW_TEST_REUSE_CONTEXT = '1';
    process.env.PW_TEST_CONNECT_WS_ENDPOINT = wsEndpoint;
    process.stdout.write(`${colors.dim('Show & reuse browser:')} ${colors.bold('on')}\n`);
  } else {
    config.workers = originalWorkers;
    await showBrowserServer?.close();
    showBrowserServer = undefined;
    delete process.env.PW_TEST_REUSE_CONTEXT;
    delete process.env.PW_TEST_CONNECT_WS_ENDPOINT;
    process.stdout.write(`${colors.dim('Show & reuse browser:')} ${colors.bold('off')}\n`);
  }
}

type Command = 'run' | 'failed' | 'repeat' | 'changed' | 'project' | 'file' | 'grep' | 'exit' | 'interrupted' | 'toggle-show-browser';
