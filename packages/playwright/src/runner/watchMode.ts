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
import path from 'path';
import { createGuid, getPackageManagerExecCommand, ManualPromise } from 'playwright-core/lib/utils';
import type { ConfigLocation } from '../common/config';
import type { FullResult } from '../../types/testReporter';
import { colors } from 'playwright-core/lib/utilsBundle';
import { enquirer } from '../utilsBundle';
import { separator } from '../reporters/base';
import { PlaywrightServer } from 'playwright-core/lib/remote/playwrightServer';
import { TestServerDispatcher } from './testServer';
import { EventEmitter } from 'stream';
import { type TestServerTransport, TestServerConnection } from '../isomorphic/testServerConnection';
import { TeleSuiteUpdater } from '../isomorphic/teleSuiteUpdater';
import { restartWithExperimentalTsEsm } from '../common/configLoader';

class InMemoryTransport extends EventEmitter implements TestServerTransport {
  public readonly _send: (data: string) => void;

  constructor(send: (data: any) => void) {
    super();
    this._send = send;
  }

  close() {
    this.emit('close');
  }

  onclose(listener: () => void): void {
    this.on('close', listener);
  }

  onerror(listener: () => void): void {
    // no-op to fulfil the interface, the user of InMemoryTransport doesn't emit any errors.
  }

  onmessage(listener: (message: string) => void): void {
    this.on('message', listener);
  }

  onopen(listener: () => void): void {
    this.on('open', listener);
  }

  send(data: string): void {
    this._send(data);
  }
}

interface WatchModeOptions {
  files?: string[];
  projects?: string[];
  grep?: string;
}

export async function runWatchModeLoop(configLocation: ConfigLocation, initialOptions: WatchModeOptions): Promise<FullResult['status'] | 'restarted'> {
  if (restartWithExperimentalTsEsm(undefined, true))
    return 'restarted';

  const options: WatchModeOptions = { ...initialOptions };
  let bufferMode = false;

  const testServerDispatcher = new TestServerDispatcher(configLocation);
  const transport = new InMemoryTransport(
      async data => {
        const { id, method, params } = JSON.parse(data);
        try {
          const result = await testServerDispatcher.transport.dispatch(method, params);
          transport.emit('message', JSON.stringify({ id, result }));
        } catch (e) {
          transport.emit('message', JSON.stringify({ id, error: String(e) }));
        }
      }
  );
  testServerDispatcher.transport.sendEvent = (method, params) => {
    transport.emit('message', JSON.stringify({ method, params }));
  };
  const testServerConnection = new TestServerConnection(transport);
  transport.emit('open');

  const teleSuiteUpdater = new TeleSuiteUpdater({ pathSeparator: path.sep, onUpdate() { } });

  const dirtyTestFiles = new Set<string>();
  const dirtyTestIds = new Set<string>();
  let onDirtyTests = new ManualPromise<'changed'>();

  let queue = Promise.resolve();
  const changedFiles = new Set<string>();
  testServerConnection.onTestFilesChanged(({ testFiles }) => {
    testFiles.forEach(file => changedFiles.add(file));

    queue = queue.then(async () => {
      if (changedFiles.size === 0)
        return;

      const { report } = await testServerConnection.listTests({ locations: options.files, projects: options.projects, grep: options.grep });
      teleSuiteUpdater.processListReport(report);

      for (const test of teleSuiteUpdater.rootSuite!.allTests()) {
        if (changedFiles.has(test.location.file)) {
          dirtyTestFiles.add(test.location.file);
          dirtyTestIds.add(test.id);
        }
      }
      changedFiles.clear();

      if (dirtyTestIds.size > 0) {
        onDirtyTests.resolve('changed');
        onDirtyTests = new ManualPromise();
      }
    });
  });
  testServerConnection.onReport(report => teleSuiteUpdater.processTestReportEvent(report));

  await testServerConnection.initialize({ interceptStdio: false, watchTestDirs: true, populateDependenciesOnList: true });
  await testServerConnection.runGlobalSetup({});

  const { report } = await testServerConnection.listTests({});
  teleSuiteUpdater.processListReport(report);

  const projectNames = teleSuiteUpdater.rootSuite!.suites.map(s => s.title);

  let lastRun: { type: 'changed' | 'regular' | 'failed', failedTestIds?: string[], dirtyTestIds?: string[] } = { type: 'regular' };
  let result: FullResult['status'] = 'passed';

  while (true) {
    if (bufferMode)
      printBufferPrompt(dirtyTestFiles, teleSuiteUpdater.config!.rootDir);
    else
      printPrompt();

    const waitForCommand = readCommand();
    const command = await Promise.race([
      onDirtyTests,
      waitForCommand.result,
    ]);
    if (command === 'changed')
      waitForCommand.cancel();
    if (bufferMode && command === 'changed')
      continue;

    const shouldRunChangedFiles = bufferMode ? command === 'run' : command === 'changed';
    if (shouldRunChangedFiles) {
      if (dirtyTestIds.size === 0)
        continue;

      const testIds = [...dirtyTestIds];
      dirtyTestIds.clear();
      dirtyTestFiles.clear();
      await runTests(options, testServerConnection, { testIds, title: 'files changed' });
      lastRun = { type: 'changed', dirtyTestIds: testIds };
      continue;
    }

    if (command === 'run') {
      // All means reset filters.
      await runTests(options, testServerConnection);
      lastRun = { type: 'regular' };
      continue;
    }

    if (command === 'project') {
      const { selectedProjects } = await enquirer.prompt<{ selectedProjects: string[] }>({
        type: 'multiselect',
        name: 'selectedProjects',
        message: 'Select projects',
        choices: projectNames,
      }).catch(() => ({ selectedProjects: null }));
      if (!selectedProjects)
        continue;
      options.projects = selectedProjects.length ? selectedProjects : undefined;
      await runTests(options, testServerConnection);
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
        options.files = filePattern.split(' ');
      else
        options.files = undefined;
      await runTests(options, testServerConnection);
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
        options.grep = testPattern;
      else
        options.grep = undefined;
      await runTests(options, testServerConnection);
      lastRun = { type: 'regular' };
      continue;
    }

    if (command === 'failed') {
      const failedTestIds = teleSuiteUpdater.rootSuite!.allTests().filter(t => !t.ok()).map(t => t.id);
      await runTests({}, testServerConnection, { title: 'running failed tests', testIds: failedTestIds });
      lastRun = { type: 'failed', failedTestIds };
      continue;
    }

    if (command === 'repeat') {
      if (lastRun.type === 'regular') {
        await runTests(options, testServerConnection, { title: 're-running tests' });
        continue;
      } else if (lastRun.type === 'changed') {
        await runTests(options, testServerConnection, { title: 're-running tests', testIds: lastRun.dirtyTestIds });
      } else if (lastRun.type === 'failed') {
        await runTests({}, testServerConnection, { title: 're-running tests', testIds: lastRun.failedTestIds });
      }
      continue;
    }

    if (command === 'toggle-show-browser') {
      await toggleShowBrowser();
      continue;
    }

    if (command === 'toggle-buffer-mode') {
      bufferMode = !bufferMode;
      continue;
    }

    if (command === 'exit')
      break;

    if (command === 'interrupted') {
      result = 'interrupted';
      break;
    }
  }

  const teardown = await testServerConnection.runGlobalTeardown({});

  return result === 'passed' ? teardown.status : result;
}

async function runTests(watchOptions: WatchModeOptions, testServerConnection: TestServerConnection, options?: {
    title?: string,
    testIds?: string[],
  }) {
  printConfiguration(watchOptions, options?.title);

  await testServerConnection.runTests({
    grep: watchOptions.grep,
    testIds: options?.testIds,
    locations: watchOptions?.files,
    projects: watchOptions.projects,
    connectWsEndpoint,
    reuseContext: connectWsEndpoint ? true : undefined,
    workers: connectWsEndpoint ? 1 : undefined,
    headed: connectWsEndpoint ? true : undefined,
  });
}

function readCommand(): { result: Promise<Command>, cancel: () => void } {
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
  ${colors.bold('b')}        ${colors.dim('toggle buffer mode')}
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
      case 'b': result.resolve('toggle-buffer-mode'); break;
    }
  };

  process.stdin.on('keypress', handler);
  const cancel = () => {
    process.stdin.off('keypress', handler);
    rl.close();
    if (process.stdin.isTTY)
      process.stdin.setRawMode(false);
  };
  void result.finally(cancel);
  return { result, cancel };
}

let showBrowserServer: PlaywrightServer | undefined;
let connectWsEndpoint: string | undefined = undefined;
let seq = 1;

function printConfiguration(options: WatchModeOptions, title?: string) {
  const packageManagerCommand = getPackageManagerExecCommand();
  const tokens: string[] = [];
  tokens.push(`${packageManagerCommand} playwright test`);
  if (options.projects)
    tokens.push(...options.projects.map(p => colors.blue(`--project ${p}`)));
  if (options.grep)
    tokens.push(colors.red(`--grep ${options.grep}`));
  if (options.files)
    tokens.push(...options.files.map(a => colors.bold(a)));
  if (title)
    tokens.push(colors.dim(`(${title})`));
  tokens.push(colors.dim(`#${seq++}`));
  const lines: string[] = [];
  const sep = separator();
  lines.push('\x1Bc' + sep);
  lines.push(`${tokens.join(' ')}`);
  lines.push(`${colors.dim('Show & reuse browser:')} ${colors.bold(showBrowserServer ? 'on' : 'off')}`);
  process.stdout.write(lines.join('\n'));
}

function printBufferPrompt(dirtyTestFiles: Set<string>, rootDir: string) {
  const sep = separator();
  process.stdout.write('\x1Bc');
  process.stdout.write(`${sep}\n`);

  if (dirtyTestFiles.size === 0) {
    process.stdout.write(`${colors.dim('Waiting for file changes. Press')} ${colors.bold('q')} ${colors.dim('to quit or')} ${colors.bold('h')} ${colors.dim('for more options.')}\n\n`);
    return;
  }

  process.stdout.write(`${colors.dim(`${dirtyTestFiles.size} test ${dirtyTestFiles.size === 1 ? 'file' : 'files'} changed:`)}\n\n`);
  for (const file of dirtyTestFiles)
    process.stdout.write(` · ${path.relative(rootDir, file)}\n`);
  process.stdout.write(`\n${colors.dim(`Press`)} ${colors.bold('enter')} ${colors.dim('to run')}, ${colors.bold('q')} ${colors.dim('to quit or')} ${colors.bold('h')} ${colors.dim('for more options.')}\n\n`);
}

function printPrompt() {
  const sep = separator();
  process.stdout.write(`
${sep}
${colors.dim('Waiting for file changes. Press')} ${colors.bold('enter')} ${colors.dim('to run tests')}, ${colors.bold('q')} ${colors.dim('to quit or')} ${colors.bold('h')} ${colors.dim('for more options.')}
`);
}

async function toggleShowBrowser() {
  if (!showBrowserServer) {
    showBrowserServer = new PlaywrightServer({ mode: 'extension', path: '/' + createGuid(), maxConnections: 1 });
    connectWsEndpoint = await showBrowserServer.listen();
    process.stdout.write(`${colors.dim('Show & reuse browser:')} ${colors.bold('on')}\n`);
  } else {
    await showBrowserServer?.close();
    showBrowserServer = undefined;
    connectWsEndpoint = undefined;
    process.stdout.write(`${colors.dim('Show & reuse browser:')} ${colors.bold('off')}\n`);
  }
}

type Command = 'run' | 'failed' | 'repeat' | 'changed' | 'project' | 'file' | 'grep' | 'exit' | 'interrupted' | 'toggle-show-browser' | 'toggle-buffer-mode';
