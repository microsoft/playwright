/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import os from 'os';
import readline from 'readline';
import { EventEmitter } from 'events';
import debug from 'debug';

import { launchProcess } from '@utils/processLauncher';
import { wrapInASCIIBox } from '@utils/ascii';
import { debugMode } from '@utils/debug';
import { ManualPromise } from '@isomorphic/manualPromise';
import { monotonicTime } from '@isomorphic/time';

import { libPath } from '../package';

import type { BrowserWindow } from 'electron';
import type { Browser, BrowserContext, JSHandle, Page, Worker } from '../../types/types';
import type * as api from '../../types/types';
import type { Playwright } from '../client/playwright';
import type childProcess from 'child_process';

const debugLogger = debug('pw:electron');

export const Events = {
  ElectronApplication: {
    Close: 'close',
    Console: 'console',
    Window: 'window',
  },
};

type ElectronLaunchOptions = NonNullable<Parameters<api.Electron['launch']>[0]>;

type ElectronAppType = typeof import('electron');

class Progress {
  private _deadline: number;
  private _timeoutError: Error;

  constructor(timeout: number, timeoutMessage: string) {
    this._deadline = timeout ? monotonicTime() + timeout : 0;
    this._timeoutError = new Error(timeoutMessage);
  }

  async race<T>(promise: Promise<T>): Promise<T> {
    const timeoutPromise = new ManualPromise<T>();
    const timeout = this.timeUntilDeadline();
    const timer = timeout ? setTimeout(() => timeoutPromise.reject(this._timeoutError), timeout) : undefined;
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  }

  timeUntilDeadline() {
    return this._deadline ? this._deadline - monotonicTime() : 0;
  }
}

export class Electron implements api.Electron {
  _playwright: Playwright;

  constructor(playwright: Playwright) {
    this._playwright = playwright;
  }

  async launch(options: ElectronLaunchOptions = {}): Promise<ElectronApplication> {
    const timeout = options.timeout ?? (debugMode() === 'inspector' ? 0 : 3 * 60 * 1000);
    const progress = new Progress(timeout, `electron.launch: Timeout ${timeout}ms exceeded`);
    let app: ElectronApplication | undefined;

    // --remote-debugging-port=0 must be the last playwright argument; loader.ts relies on it.
    let electronArguments = ['--inspect=0', '--remote-debugging-port=0', ...(options.args || [])];

    if (os.platform() === 'linux') {
      if (!options.chromiumSandbox && !electronArguments.includes('--no-sandbox'))
        electronArguments.unshift('--no-sandbox');
    }

    let command: string;
    if (options.executablePath) {
      command = options.executablePath;
    } else {
      try {
        // 'electron/index.js' resolves to the Electron App executable shim.
        command = require('electron/index.js');
      } catch (error: any) {
        if ((error as NodeJS.ErrnoException)?.code === 'MODULE_NOT_FOUND') {
          throw new Error('\n' + wrapInASCIIBox([
            'Electron executablePath not found!',
            'Please install it using `npm install -D electron` or set the executablePath to your Electron executable.',
          ].join('\n'), 1));
        }
        throw error;
      }
      // Only inject our loader for non-packaged apps; packaged apps may have
      // their own command-line handling. loader.js is emitted under
      // lib/electron/ as a per-file build (see utils/build/build.js).
      electronArguments.unshift('-r', libPath('electron', 'loader.js'));
    }

    let shell = false;
    if (process.platform === 'win32') {
      // shell: true is required to launch .cmd files. We pass the entire
      // command as a single string to dodge DEP0190 and Windows quoting bugs.
      // https://github.com/nodejs/node/issues/52554
      // https://github.com/microsoft/playwright/issues/38278
      shell = true;
      command = [command, ...electronArguments].map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ');
      electronArguments = [];
    }

    // When debugging Playwright tests that drive Electron, NODE_OPTIONS
    // would make the user's debugger latch onto Electron's Node first.
    // Strip it so Playwright can attach.
    const env = { ...(options.env ?? process.env) };
    delete env.NODE_OPTIONS;

    const logCollector: string[] = [];
    const { launchedProcess, kill } = await launchProcess({
      command,
      args: electronArguments,
      env,
      log: (message: string) => {
        debugLogger(message);
        logCollector.push(message);
      },
      shell,
      stdio: 'pipe',
      cwd: options.cwd,
      tempDirectories: [],
      attemptToGracefullyClose: async () => { await app?.close(); },
      handleSIGINT: true,
      handleSIGTERM: true,
      handleSIGHUP: true,
      onExit: () => app?._onClose(),
    });

    // Start every line listener immediately — the lines may arrive before we
    // are ready to await them.
    const waitForXserverError = waitForLine(progress, launchedProcess, /Unable to open X display/).then(() => {
      throw new Error([
        'Unable to open X display!',
        '================================',
        'Most likely this is because there is no X server available.',
        "Use 'xvfb-run' on Linux to launch your tests with an emulated display server.",
        "For example: 'xvfb-run npm run test:e2e'",
        '================================',
        ...logCollector,
      ].join('\n'));
    });
    const nodeMatchPromise = waitForLine(progress, launchedProcess, /^Debugger listening on (ws:\/\/.*)$/);
    const chromeMatchPromise = waitForLine(progress, launchedProcess, /^DevTools listening on (ws:\/\/.*)$/);
    const debuggerDisconnectPromise = waitForLine(progress, launchedProcess, /Waiting for the debugger to disconnect\.\.\./);

    try {
      const chromium = this._playwright.chromium;
      const nodeMatch = await nodeMatchPromise;
      const worker = await chromium.connectToWorker(nodeMatch[1], { timeout: progress.timeUntilDeadline() });

      // Release the Electron process immediately if the user is debugging it.
      debuggerDisconnectPromise.then(() => worker.disconnect()).catch(() => {});

      const chromeMatch = await Promise.race([chromeMatchPromise, waitForXserverError]);
      const browser = await chromium.connectOverCDP(chromeMatch[1], { timeout: progress.timeUntilDeadline(), isLocal: true });

      app = new ElectronApplication(worker, browser, launchedProcess);
      await progress.race(app._initialize());
      return app;
    } catch (error) {
      await kill();
      throw error;
    }
  }
}

export class ElectronApplication extends EventEmitter implements api.ElectronApplication {
  private _worker: Worker;
  private _browser: Browser;
  private _process: childProcess.ChildProcess;
  private _context: BrowserContext;
  private _windows = new Map<Page, JSHandle<BrowserWindow> | undefined>();
  private _appHandlePromise = new ManualPromise<JSHandle<ElectronAppType>>();
  private _closedPromise: Promise<void> | undefined;

  constructor(worker: Worker, browser: Browser, process: childProcess.ChildProcess) {
    super();

    this._worker = worker;
    this._worker.on('console', message => this.emit(Events.ElectronApplication.Console, message));

    this._browser = browser;
    this._context = browser.contexts()[0];
    for (const page of this._context.pages())
      this._onPage(page);
    this._context.on('page', page => this._onPage(page));
    // Closing the BrowserContext should close the entire app; route both through close().
    this._context.close = () => this.close();

    this._process = process;
  }

  _onClose() {
    this.emit(Events.ElectronApplication.Close);
    this._closedPromise ??= Promise.resolve();
  }

  process(): childProcess.ChildProcess {
    return this._process;
  }

  _onPage(page: Page) {
    this._windows.set(page, undefined);
    this.emit(Events.ElectronApplication.Window, page);
    page.once('close', () => this._windows.delete(page));
  }

  windows(): Page[] {
    return [...this._windows.keys()];
  }

  async firstWindow(options?: { timeout?: number }): Promise<Page> {
    if (this._windows.size)
      return this._windows.keys().next().value!;
    return await this.waitForEvent('window', options);
  }

  context(): BrowserContext {
    return this._context;
  }

  async [Symbol.asyncDispose]() {
    await this.close();
  }

  async close() {
    if (!this._closedPromise) {
      this._closedPromise = new Promise<void>(f => this.once(Events.ElectronApplication.Close, f));
      await this._browser.close();
      const appHandle = await this._appHandlePromise;
      await appHandle.evaluate(({ app }) => app.quit()).catch(() => {});
      await this._worker.disconnect();
    }
    await this._closedPromise;
  }

  async waitForEvent(event: string, optionsOrPredicate: Function | { timeout?: number, predicate?: Function } = {}): Promise<any> {
    const promise = new ManualPromise<any>();

    const onEvent = async (eventArg: any) => {
      try {
        const predicate = typeof optionsOrPredicate === 'function' ? optionsOrPredicate : optionsOrPredicate.predicate;
        if (predicate && !(await predicate(eventArg)))
          return;
        promise.resolve(eventArg);
      } catch (e) {
        promise.reject(e);
      }
    };
    this.addListener(event, onEvent);

    const onClose = () => promise.reject(new Error('Electron application has been closed'));
    if (event !== Events.ElectronApplication.Close)
      this.addListener(Events.ElectronApplication.Close, onClose);

    try {
      const timeout = typeof optionsOrPredicate === 'function' ? 30000 : (optionsOrPredicate?.timeout ?? 30000);
      const progress = new Progress(timeout, `Timeout ${timeout}ms exceeded while waiting for event "${event}"`);
      return await progress.race(promise);
    } finally {
      this.removeListener(event, onEvent);
      this.removeListener(Events.ElectronApplication.Close, onClose);
    }
  }

  async _initialize() {
    await Promise.all([
      this._worker.evaluateHandle('__playwright_electron').then(handle => {
        this._appHandlePromise.resolve(handle as any);
        // Best-effort: in-process clients can rename the preview to make stack traces nicer.
        (handle as any)._connection?.toImpl?.(handle)?._setPreview('ElectronModule');
      }),
      // Defer Electron's `ready` until the browser side is wired up for auto-attach.
      this._worker.evaluate('__playwright_run()'),
    ]);
  }

  async browserWindow(page: Page): Promise<JSHandle<BrowserWindow>> {
    let browserWindow = this._windows.get(page);
    if (!browserWindow) {
      const cdpSession = await this._context.newCDPSession(page);
      const { targetInfo } = await cdpSession.send('Target.getTargetInfo');
      const appHandle = await this._appHandlePromise;
      browserWindow = await appHandle.evaluateHandle(({ BrowserWindow, webContents }, targetId) => {
        const wc = webContents.fromDevToolsTargetId(targetId);
        return BrowserWindow.fromWebContents(wc!)!;
      }, targetInfo.targetId);
      this._windows.set(page, browserWindow);
    }
    return browserWindow;
  }

  async evaluate<R, Arg>(pageFunction: any, arg: Arg): Promise<R> {
    const appHandle = await this._appHandlePromise;
    return appHandle.evaluate(pageFunction, arg);
  }

  async evaluateHandle<Arg>(pageFunction: any, arg: Arg): Promise<any> {
    const appHandle = await this._appHandlePromise;
    return await appHandle.evaluateHandle(pageFunction, arg);
  }
}

async function waitForLine(progress: Progress, process: childProcess.ChildProcess, regex: RegExp) {
  const promise = new ManualPromise<RegExpMatchArray>();

  // eslint-disable-next-line no-restricted-properties
  const rl = readline.createInterface({ input: process.stderr! });

  const failError = new Error('Process failed to launch!');
  const onFail = () => promise.reject(failError);
  const onLine = (line: string) => {
    const match = line.match(regex);
    if (match)
      promise.resolve(match);
  };

  rl.addListener('line', onLine);
  rl.addListener('close', onFail);
  process.addListener('exit', onFail);
  // Safe to add a listener — launchProcess attached its own error handler already.
  process.addListener('error', onFail);

  try {
    return await progress.race(promise);
  } finally {
    rl.removeListener('line', onLine);
    rl.removeListener('close', onFail);
    process.removeListener('exit', onFail);
    process.removeListener('error', onFail);
  }
}
