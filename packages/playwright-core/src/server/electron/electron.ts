/**
 * Copyright (c) Microsoft Corporation.
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
import os from 'os';
import path from 'path';
import type { CRBrowserContext } from '../chromium/crBrowser';
import { CRBrowser } from '../chromium/crBrowser';
import type { CRSession } from '../chromium/crConnection';
import { CRConnection } from '../chromium/crConnection';
import type { CRPage } from '../chromium/crPage';
import { CRExecutionContext } from '../chromium/crExecutionContext';
import type { Protocol } from '../chromium/protocol';
import * as js from '../javascript';
import type { Page } from '../page';
import { TimeoutSettings } from '../../common/timeoutSettings';
import { ManualPromise, wrapInASCIIBox } from '../../utils';
import { WebSocketTransport } from '../transport';
import { launchProcess, envArrayToObject } from '../../utils/processLauncher';
import type { BrowserContext } from '../browserContext';
import { validateBrowserContextOptions } from '../browserContext';
import type { BrowserWindow } from 'electron';
import type { Progress } from '../progress';
import { ProgressController } from '../progress';
import { helper } from '../helper';
import type * as types from '../types';
import { eventsHelper } from '../../utils/eventsHelper';
import type { BrowserOptions, BrowserProcess } from '../browser';
import type { Playwright } from '../playwright';
import type * as childProcess from 'child_process';
import * as readline from 'readline';
import { RecentLogsCollector } from '../../utils/debugLogger';
import { serverSideCallMetadata, SdkObject } from '../instrumentation';
import type * as channels from '@protocol/channels';
import { toConsoleMessageLocation } from '../chromium/crProtocolHelper';
import { ConsoleMessage } from '../console';

const ARTIFACTS_FOLDER = path.join(os.tmpdir(), 'playwright-artifacts-');

export class ElectronApplication extends SdkObject {
  static Events = {
    Close: 'close',
    Console: 'console',
  };

  private _browserContext: CRBrowserContext;
  private _nodeConnection: CRConnection;
  private _nodeSession: CRSession;
  private _nodeExecutionContext: js.ExecutionContext | undefined;
  _nodeElectronHandlePromise: ManualPromise<js.JSHandle<typeof import('electron')>> = new ManualPromise();
  readonly _timeoutSettings = new TimeoutSettings();
  private _process: childProcess.ChildProcess;

  constructor(parent: SdkObject, browser: CRBrowser, nodeConnection: CRConnection, process: childProcess.ChildProcess) {
    super(parent, 'electron-app');
    this._process = process;
    this._browserContext = browser._defaultContext as CRBrowserContext;
    this._nodeConnection = nodeConnection;
    this._nodeSession = nodeConnection.rootSession;
    this._nodeSession.on('Runtime.executionContextCreated', async (event: Protocol.Runtime.executionContextCreatedPayload) => {
      if (!event.context.auxData || !event.context.auxData.isDefault)
        return;
      const crExecutionContext = new CRExecutionContext(this._nodeSession, event.context);
      this._nodeExecutionContext = new js.ExecutionContext(this, crExecutionContext, 'electron');
      const { result: remoteObject } = await crExecutionContext._client.send('Runtime.evaluate', {
        expression: `require('electron')`,
        contextId: event.context.id,
        // Needed after Electron 28 to get access to require: https://github.com/microsoft/playwright/issues/28048
        includeCommandLineAPI: true,
      });
      this._nodeElectronHandlePromise.resolve(new js.JSHandle(this._nodeExecutionContext!, 'object', 'ElectronModule', remoteObject.objectId!));
    });
    this._nodeSession.on('Runtime.consoleAPICalled', event => this._onConsoleAPI(event));
    const appClosePromise = new Promise(f => this.once(ElectronApplication.Events.Close, f));
    this._browserContext.setCustomCloseHandler(async () => {
      await this._browserContext.stopVideoRecording();
      const electronHandle = await this._nodeElectronHandlePromise;
      await electronHandle.evaluate(({ app }) => app.quit()).catch(() => {});
      this._nodeConnection.close();
      await appClosePromise;
    });
  }

  async _onConsoleAPI(event: Protocol.Runtime.consoleAPICalledPayload) {
    if (event.executionContextId === 0) {
      // DevTools protocol stores the last 1000 console messages. These
      // messages are always reported even for removed execution contexts. In
      // this case, they are marked with executionContextId = 0 and are
      // reported upon enabling Runtime agent.
      //
      // Ignore these messages since:
      // - there's no execution context we can use to operate with message
      //   arguments
      // - these messages are reported before Playwright clients can subscribe
      //   to the 'console'
      //   page event.
      //
      // @see https://github.com/GoogleChrome/puppeteer/issues/3865
      return;
    }
    if (!this._nodeExecutionContext)
      return;
    const args = event.args.map(arg => this._nodeExecutionContext!.createHandle(arg));
    const message = new ConsoleMessage(null, event.type, undefined, args, toConsoleMessageLocation(event.stackTrace));
    this.emit(ElectronApplication.Events.Console, message);
  }

  async initialize() {
    await this._nodeSession.send('Runtime.enable', {});
    // Delay loading the app until browser is started and the browser targets are configured to auto-attach.
    await this._nodeSession.send('Runtime.evaluate', { expression: '__playwright_run()' });
  }

  process(): childProcess.ChildProcess {
    return this._process;
  }

  context(): BrowserContext {
    return this._browserContext;
  }

  async close() {
    // This will call BrowserContext.setCustomCloseHandler.
    await this._browserContext.close({ reason: 'Application exited' });
  }

  async browserWindow(page: Page): Promise<js.JSHandle<BrowserWindow>> {
    // Assume CRPage as Electron is always Chromium.
    const targetId = (page._delegate as CRPage)._targetId;
    const electronHandle = await this._nodeElectronHandlePromise;
    return await electronHandle.evaluateHandle(({ BrowserWindow, webContents }, targetId) => {
      const wc = webContents.fromDevToolsTargetId(targetId);
      return BrowserWindow.fromWebContents(wc!)!;
    }, targetId);
  }
}

export class Electron extends SdkObject {
  constructor(playwright: Playwright) {
    super(playwright, 'electron');
  }

  async launch(options: channels.ElectronLaunchParams): Promise<ElectronApplication> {
    const {
      args = [],
    } = options;
    const controller = new ProgressController(serverSideCallMetadata(), this);
    controller.setLogName('browser');
    return controller.run(async progress => {
      let app: ElectronApplication | undefined = undefined;
      // --remote-debugging-port=0 must be the last playwright's argument, loader.ts relies on it.
      let electronArguments = ['--inspect=0', '--remote-debugging-port=0', ...args];

      if (os.platform() === 'linux') {
        const runningAsRoot = process.geteuid && process.geteuid() === 0;
        if (runningAsRoot && electronArguments.indexOf('--no-sandbox') === -1)
          electronArguments.unshift('--no-sandbox');
      }

      const artifactsDir = await fs.promises.mkdtemp(ARTIFACTS_FOLDER);

      const browserLogsCollector = new RecentLogsCollector();
      const env = options.env ? envArrayToObject(options.env) : process.env;

      let command: string;
      if (options.executablePath) {
        command = options.executablePath;
      } else {
        try {
          // By default we fallback to the Electron App executable path.
          // 'electron/index.js' resolves to the actual Electron App.
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
        // Only use our own loader for non-packaged apps.
        // Packaged apps might have their own command line handling.
        electronArguments.unshift('-r', require.resolve('./loader'));
      }
      let shell = false;
      if (process.platform === 'win32') {
        // On Windows in order to run .cmd files, shell: true is required.
        // https://github.com/nodejs/node/issues/52554
        shell = true;
        // On Windows, we need to quote the executable path due to shell: true.
        command = `"${command}"`;
        // On Windows, we need to quote the arguments due to shell: true.
        electronArguments = electronArguments.map(arg => `"${arg}"`);
      }

      // When debugging Playwright test that runs Electron, NODE_OPTIONS
      // will make the debugger attach to Electron's Node. But Playwright
      // also needs to attach to drive the automation. Disable external debugging.
      delete env.NODE_OPTIONS;
      const { launchedProcess, gracefullyClose, kill } = await launchProcess({
        command,
        args: electronArguments,
        env,
        log: (message: string) => {
          progress.log(message);
          browserLogsCollector.log(message);
        },
        shell,
        stdio: 'pipe',
        cwd: options.cwd,
        tempDirectories: [artifactsDir],
        attemptToGracefullyClose: () => app!.close(),
        handleSIGINT: true,
        handleSIGTERM: true,
        handleSIGHUP: true,
        onExit: () => app?.emit(ElectronApplication.Events.Close),
      });

      // All waitForLines must be started immediately.
      // Otherwise the lines might come before we are ready.
      const waitForXserverError = new Promise(async (resolve, reject) => {
        waitForLine(progress, launchedProcess, /Unable to open X display/).then(() => reject(new Error([
          'Unable to open X display!',
          `================================`,
          'Most likely this is because there is no X server available.',
          "Use 'xvfb-run' on Linux to launch your tests with an emulated display server.",
          "For example: 'xvfb-run npm run test:e2e'",
          `================================`,
          progress.metadata.log
        ].join('\n')))).catch(() => {});
      });
      const nodeMatchPromise = waitForLine(progress, launchedProcess, /^Debugger listening on (ws:\/\/.*)$/);
      const chromeMatchPromise = waitForLine(progress, launchedProcess, /^DevTools listening on (ws:\/\/.*)$/);
      const debuggerDisconnectPromise = waitForLine(progress, launchedProcess, /Waiting for the debugger to disconnect\.\.\./);

      const nodeMatch = await nodeMatchPromise;
      const nodeTransport = await WebSocketTransport.connect(progress, nodeMatch[1]);
      const nodeConnection = new CRConnection(nodeTransport, helper.debugProtocolLogger(), browserLogsCollector);

      // Immediately release exiting process under debug.
      debuggerDisconnectPromise.then(() => {
        nodeTransport.close();
      }).catch(() => {});
      const chromeMatch = await Promise.race([
        chromeMatchPromise,
        waitForXserverError,
      ]) as RegExpMatchArray;
      const chromeTransport = await WebSocketTransport.connect(progress, chromeMatch[1]);
      const browserProcess: BrowserProcess = {
        onclose: undefined,
        process: launchedProcess,
        close: gracefullyClose,
        kill
      };
      const contextOptions: types.BrowserContextOptions = {
        ...options,
        noDefaultViewport: true,
      };
      const browserOptions: BrowserOptions = {
        name: 'electron',
        isChromium: true,
        headful: true,
        persistent: contextOptions,
        browserProcess,
        protocolLogger: helper.debugProtocolLogger(),
        browserLogsCollector,
        artifactsDir,
        downloadsPath: artifactsDir,
        tracesDir: options.tracesDir || artifactsDir,
        originalLaunchOptions: {},
      };
      validateBrowserContextOptions(contextOptions, browserOptions);
      const browser = await CRBrowser.connect(this.attribution.playwright, chromeTransport, browserOptions);
      app = new ElectronApplication(this, browser, nodeConnection, launchedProcess);
      await app.initialize();
      return app;
    }, TimeoutSettings.launchTimeout(options));
  }
}

function waitForLine(progress: Progress, process: childProcess.ChildProcess, regex: RegExp): Promise<RegExpMatchArray> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stderr! });
    const failError = new Error('Process failed to launch!');
    const listeners = [
      eventsHelper.addEventListener(rl, 'line', onLine),
      eventsHelper.addEventListener(rl, 'close', reject.bind(null, failError)),
      eventsHelper.addEventListener(process, 'exit', reject.bind(null, failError)),
      // It is Ok to remove error handler because we did not create process and there is another listener.
      eventsHelper.addEventListener(process, 'error', reject.bind(null, failError))
    ];

    progress.cleanupWhenAborted(cleanup);

    function onLine(line: string) {
      const match = line.match(regex);
      if (!match)
        return;
      cleanup();
      resolve(match);
    }

    function cleanup() {
      eventsHelper.removeEventListeners(listeners);
    }
  });
}
