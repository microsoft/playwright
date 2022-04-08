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
import * as js from '../javascript';
import type { Page } from '../page';
import { TimeoutSettings } from '../../common/timeoutSettings';
import { wrapInASCIIBox } from '../../utils';
import { WebSocketTransport } from '../transport';
import { launchProcess, envArrayToObject } from '../../utils/processLauncher';
import { BrowserContext, validateBrowserContextOptions } from '../browserContext';
import type { BrowserWindow } from 'electron';
import type { Progress } from '../progress';
import { ProgressController } from '../progress';
import { helper } from '../helper';
import { eventsHelper } from '../../utils/eventsHelper';
import type { BrowserOptions, BrowserProcess, PlaywrightOptions } from '../browser';
import type * as childProcess from 'child_process';
import * as readline from 'readline';
import { RecentLogsCollector } from '../../common/debugLogger';
import { serverSideCallMetadata, SdkObject } from '../instrumentation';
import type * as channels from '../../protocol/channels';
import type { BrowserContextOptions } from '../types';

const ARTIFACTS_FOLDER = path.join(os.tmpdir(), 'playwright-artifacts-');

export class ElectronApplication extends SdkObject {
  static Events = {
    Close: 'close',
  };

  private _browserContext: CRBrowserContext;
  private _nodeConnection: CRConnection;
  private _nodeSession: CRSession;
  private _nodeExecutionContext: js.ExecutionContext | undefined;
  _nodeElectronHandlePromise: Promise<js.JSHandle<any>>;
  readonly _timeoutSettings = new TimeoutSettings();
  private _process: childProcess.ChildProcess;

  constructor(parent: SdkObject, browser: CRBrowser, nodeConnection: CRConnection, process: childProcess.ChildProcess) {
    super(parent, 'electron-app');
    this._process = process;
    this._browserContext = browser._defaultContext as CRBrowserContext;
    this._browserContext.on(BrowserContext.Events.Close, () => {
      // Emit application closed after context closed.
      Promise.resolve().then(() => this.emit(ElectronApplication.Events.Close));
    });
    this._nodeConnection = nodeConnection;
    this._nodeSession = nodeConnection.rootSession;
    this._nodeElectronHandlePromise = new Promise(f => {
      this._nodeSession.on('Runtime.executionContextCreated', async (event: any) => {
        if (event.context.auxData && event.context.auxData.isDefault) {
          this._nodeExecutionContext = new js.ExecutionContext(this, new CRExecutionContext(this._nodeSession, event.context));
          f(await js.evaluate(this._nodeExecutionContext, false /* returnByValue */, `process.mainModule.require('electron')`));
        }
      });
    });
    this._browserContext.setCustomCloseHandler(async () => {
      const electronHandle = await this._nodeElectronHandlePromise;
      await electronHandle.evaluate(({ app }) => app.quit());
    });
    this._nodeSession.send('Runtime.enable', {}).catch(e => {});
  }

  process(): childProcess.ChildProcess {
    return this._process;
  }

  context(): BrowserContext {
    return this._browserContext;
  }

  async close() {
    const progressController = new ProgressController(serverSideCallMetadata(), this);
    const closed = progressController.run(progress => helper.waitForEvent(progress, this, ElectronApplication.Events.Close).promise);
    await this._browserContext.close(serverSideCallMetadata());
    this._nodeConnection.close();
    await closed;
  }

  async browserWindow(page: Page): Promise<js.JSHandle<BrowserWindow>> {
    // Assume CRPage as Electron is always Chromium.
    const targetId = (page._delegate as CRPage)._targetId;
    const electronHandle = await this._nodeElectronHandlePromise;
    return await electronHandle.evaluateHandle(({ BrowserWindow, webContents }, targetId) => {
      const wc = webContents.fromDevToolsTargetId(targetId);
      return BrowserWindow.fromWebContents(wc);
    }, targetId);
  }
}

export class Electron extends SdkObject {
  private _playwrightOptions: PlaywrightOptions;

  constructor(playwrightOptions: PlaywrightOptions) {
    super(playwrightOptions.rootSdkObject, 'electron');
    this._playwrightOptions = playwrightOptions;
  }

  async launch(options: channels.ElectronLaunchParams): Promise<ElectronApplication> {
    const {
      args = [],
    } = options;
    const controller = new ProgressController(serverSideCallMetadata(), this);
    controller.setLogName('browser');
    return controller.run(async progress => {
      let app: ElectronApplication | undefined = undefined;
      const electronArguments = ['--inspect=0', '--remote-debugging-port=0', ...args];

      if (os.platform() === 'linux') {
        const runningAsRoot = process.geteuid && process.geteuid() === 0;
        if (runningAsRoot && electronArguments.indexOf('--no-sandbox') === -1)
          electronArguments.push('--no-sandbox');
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
        stdio: 'pipe',
        cwd: options.cwd,
        tempDirectories: [ artifactsDir ],
        attemptToGracefullyClose: () => app!.close(),
        handleSIGINT: true,
        handleSIGTERM: true,
        handleSIGHUP: true,
        onExit: () => {},
      });

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

      const nodeMatch = await waitForLine(progress, launchedProcess, /^Debugger listening on (ws:\/\/.*)$/);
      const nodeTransport = await WebSocketTransport.connect(progress, nodeMatch[1]);
      const nodeConnection = new CRConnection(nodeTransport, helper.debugProtocolLogger(), browserLogsCollector);

      // Immediately release exiting process under debug.
      waitForLine(progress, launchedProcess, /Waiting for the debugger to disconnect\.\.\./).then(() => {
        nodeTransport.close();
      }).catch(() => {});
      const chromeMatch = await Promise.race([
        waitForLine(progress, launchedProcess, /^DevTools listening on (ws:\/\/.*)$/),
        waitForXserverError,
      ]) as RegExpMatchArray;
      const chromeTransport = await WebSocketTransport.connect(progress, chromeMatch[1]);
      const browserProcess: BrowserProcess = {
        onclose: undefined,
        process: launchedProcess,
        close: gracefullyClose,
        kill
      };
      const contextOptions: BrowserContextOptions = {
        ...options,
        noDefaultViewport: true,
      };
      const browserOptions: BrowserOptions = {
        ...this._playwrightOptions,
        name: 'electron',
        isChromium: true,
        headful: true,
        persistent: contextOptions,
        browserProcess,
        protocolLogger: helper.debugProtocolLogger(),
        browserLogsCollector,
        artifactsDir,
        downloadsPath: artifactsDir,
        tracesDir: artifactsDir,
      };
      validateBrowserContextOptions(contextOptions, browserOptions);
      const browser = await CRBrowser.connect(chromeTransport, browserOptions);
      app = new ElectronApplication(this, browser, nodeConnection, launchedProcess);
      return app;
    }, TimeoutSettings.timeout(options));
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
