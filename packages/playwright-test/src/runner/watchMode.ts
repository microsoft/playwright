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
import { ManualPromise } from 'playwright-core/lib/utils';
import type { FullConfigInternal, FullProjectInternal } from '../common/types';
import { Multiplexer } from '../reporters/multiplexer';
import { createFileFilterForArg, createFileMatcherFromFilters, createTitleMatcher, forceRegExp } from '../util';
import type { Matcher } from '../util';
import { createTaskRunnerForWatch } from './tasks';
import type { TaskRunnerState } from './tasks';
import { buildProjectsClosure, filterProjects } from './projectUtils';
import { clearCompilationCache } from '../common/compilationCache';
import type { FullResult, TestCase } from 'packages/playwright-test/reporter';
import chokidar from 'chokidar';
import { WatchModeReporter } from './reporters';
import { colors } from 'playwright-core/lib/utilsBundle';
import { enquirer } from '../utilsBundle';

class FSWatcher {
  private _dirtyFiles = new Set<string>();
  private _notifyDirtyFiles: (() => void) | undefined;

  constructor(dirs: string[]) {
    let timer: NodeJS.Timer;
    chokidar.watch(dirs, { ignoreInitial: true }).on('all', async (event, file) => {
      if (event !== 'add' && event !== 'change')
        return;
      this._dirtyFiles.add(file);
      if (timer)
        clearTimeout(timer);
      timer = setTimeout(() => {
        this._notifyDirtyFiles?.();
      }, 250);
    });
  }

  async onDirtyFiles(): Promise<void> {
    if (this._dirtyFiles.size)
      return;
    await new Promise<void>(f => this._notifyDirtyFiles = f);
  }

  takeDirtyFiles(): Set<string> {
    const result = this._dirtyFiles;
    this._dirtyFiles = new Set();
    return result;
  }
}

export async function runWatchModeLoop(config: FullConfigInternal, failedTests: TestCase[]) {
  const projects = filterProjects(config.projects, config._internal.cliProjectFilter);
  const projectClosure = buildProjectsClosure(projects);
  config._internal.passWithNoTests = true;
  const failedTestIdCollector = new Set(failedTests.map(t => t.id));

  const originalTitleMatcher = config._internal.cliTitleMatcher;
  const originalFileFilters = config._internal.cliFileFilters;

  const fsWatcher = new FSWatcher(projectClosure.map(p => p.testDir));
  let lastFilePattern: string | undefined;
  let lastTestPattern: string | undefined;
  while (true) {
    process.stdout.write(`
Waiting for file changes...
${colors.dim('press')} ${colors.bold('h')} ${colors.dim('to show help, press')} ${colors.bold('q')} ${colors.dim('to quit')}
`);
    const readCommandPromise = readCommand();
    await Promise.race([
      fsWatcher.onDirtyFiles(),
      readCommandPromise,
    ]);
    if (!readCommandPromise.isDone())
      readCommandPromise.resolve('changed');

    const command = await readCommandPromise;
    if (command === 'changed') {
      process.stdout.write('\x1Bc');
      await runChangedTests(config, failedTestIdCollector, projectClosure, fsWatcher.takeDirtyFiles());
      continue;
    }
    if (command === 'all') {
      process.stdout.write('\x1Bc');
      // All means reset filters.
      config._internal.cliTitleMatcher = originalTitleMatcher;
      config._internal.cliFileFilters = originalFileFilters;
      lastFilePattern = undefined;
      lastTestPattern = undefined;
      await runTests(config, failedTestIdCollector);
      continue;
    }
    if (command === 'file') {
      const { filePattern } = await enquirer.prompt<{ filePattern: string }>({
        type: 'text',
        name: 'filePattern',
        message: 'Input filename pattern (regex)',
        initial: lastFilePattern,
      });
      if (filePattern.trim()) {
        lastFilePattern = filePattern;
        config._internal.cliFileFilters = [createFileFilterForArg(filePattern)];
      } else {
        lastFilePattern = undefined;
        config._internal.cliFileFilters = originalFileFilters;
      }
      await runTests(config, failedTestIdCollector);
      continue;
    }
    if (command === 'grep') {
      const { testPattern } = await enquirer.prompt<{ testPattern: string }>({
        type: 'text',
        name: 'testPattern',
        message: 'Input test name pattern (regex)',
        initial: lastTestPattern,
      });
      if (testPattern.trim()) {
        lastTestPattern = testPattern;
        config._internal.cliTitleMatcher = createTitleMatcher(forceRegExp(testPattern));
      } else {
        lastTestPattern = undefined;
        config._internal.cliTitleMatcher = originalTitleMatcher;
      }
      await runTests(config, failedTestIdCollector);
      continue;
    }
    if (command === 'failed') {
      process.stdout.write('\x1Bc');
      config._internal.testIdMatcher = id => failedTestIdCollector.has(id);
      try {
        await runTests(config, failedTestIdCollector);
      } finally {
        config._internal.testIdMatcher = undefined;
      }
      continue;
    }
  }
}

async function runChangedTests(config: FullConfigInternal, failedTestIds: Set<string>, projectClosure: FullProjectInternal[], files: Set<string>) {
  const commandLineFileMatcher = config._internal.cliFileFilters.length ? createFileMatcherFromFilters(config._internal.cliFileFilters) : () => true;

  // Collect projects with changes.
  const filesByProject = new Map<FullProjectInternal, string[]>();
  for (const project of projectClosure) {
    const projectFiles: string[] = [];
    for (const file of files) {
      if (!file.startsWith(project.testDir))
        continue;
      if (project._internal.type === 'dependency' || commandLineFileMatcher(file))
        projectFiles.push(file);
    }
    if (projectFiles.length)
      filesByProject.set(project, projectFiles);
  }

  // Collect all the affected projects, follow project dependencies.
  // Prepare to exclude all the projects that do not depend on this file, as if they did not exist.
  const affectedProjects = affectedProjectsClosure(projectClosure, [...filesByProject.keys()]);
  const affectsAnyDependency = [...affectedProjects].some(p => p._internal.type === 'dependency');
  const projectsToIgnore = new Set(projectClosure.filter(p => !affectedProjects.has(p)));

  // If there are affected dependency projects, do the full run, respect the original CLI.
  // if there are no affected dependency projects, intersect CLI with dirty files
  const additionalFileMatcher = affectsAnyDependency ? () => true : (file: string) => files.has(file);
  return await runTests(config, failedTestIds, projectsToIgnore, additionalFileMatcher);
}

async function runTests(config: FullConfigInternal, failedTestIds: Set<string>, projectsToIgnore?: Set<FullProjectInternal>, additionalFileMatcher?: Matcher) {
  const reporter = new Multiplexer([new WatchModeReporter()]);
  const taskRunner = createTaskRunnerForWatch(config, reporter, projectsToIgnore, additionalFileMatcher);
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
    if (test.outcome() === 'expected') {
      failedTestIds.delete(test.id);
    } else {
      failedTestIds.add(test.id);
      hasFailedTests = true;
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
    if (text === '\x03' || text === '\x1B' || (key && key.name === 'escape') || (key && key.ctrl && key.name === 'c'))
      return process.exit(130);
    if (process.platform !== 'win32' && key && key.ctrl && key.name === 'z') {
      process.kill(process.ppid, 'SIGTSTP');
      process.kill(process.pid, 'SIGTSTP');
    }
    const name = key?.name;
    if (name === 'q')
      process.exit(0);
    if (name === 'h') {
      process.stdout.write(`
Watch Usage
${commands.map(i => colors.dim('  press ') + colors.reset(colors.bold(i[0])) + colors.dim(` to ${i[1]}`)).join('\n')}
`);
      return;
    }

    switch (name) {
      case 'a': result.resolve('all'); break;
      case 'p': result.resolve('file'); break;
      case 't': result.resolve('grep'); break;
      case 'f': result.resolve('failed'); break;
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

type Command = 'all' | 'failed' | 'changed' | 'file' | 'grep';

const commands = [
  ['a', 'rerun all tests'],
  ['f', 'rerun only failed tests'],
  ['p', 'filter by a filename'],
  ['t', 'filter by a test name regex pattern'],
  ['q', 'quit'],
];
