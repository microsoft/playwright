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

import * as os from 'os';
import { CRBrowser, CRBrowserContext } from '../chromium/crBrowser';
import { CRConnection, CRSession } from '../chromium/crConnection';
import { CRExecutionContext } from '../chromium/crExecutionContext';
import * as js from '../javascript';
import { Page } from '../page';
import { TimeoutSettings } from '../../utils/timeoutSettings';
import { WebSocketTransport } from '../transport';
import * as types from '../types';
import { launchProcess, envArrayToObject } from '../processLauncher';
import { BrowserContext } from '../browserContext';
import type {BrowserWindow} from 'electron';
import { Progress, ProgressController, runAbortableTask } from '../progress';
import { EventEmitter } from 'events';
import { helper } from '../helper';
import { BrowserOptions, BrowserProcess } from '../browser';
import * as childProcess from 'child_process';
import * as readline from 'readline';

export type ElectronLaunchOptionsBase = {
  args?: string[],
  cwd?: string,
  env?: types.EnvArray,
  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  timeout?: number,
};

export interface ElectronPage extends Page {
  browserWindow: js.JSHandle<BrowserWindow>;
  _browserWindowId: number;
}

export class ElectronApplication extends EventEmitter {
  static Events = {
    Close: 'close',
    Window: 'window',
  };

  private _browserContext: CRBrowserContext;
  private _nodeConnection: CRConnection;
  private _nodeSession: CRSession;
  private _nodeExecutionContext: js.ExecutionContext | undefined;
  _nodeElectronHandle: js.JSHandle<any> | undefined;
  private _windows = new Set<ElectronPage>();
  private _lastWindowId = 0;
  readonly _timeoutSettings = new TimeoutSettings();

  constructor(browser: CRBrowser, nodeConnection: CRConnection) {
    super();
    this._browserContext = browser._defaultContext as CRBrowserContext;
    this._browserContext.on(BrowserContext.Events.Close, () => {
      // Emit application closed after context closed.
      Promise.resolve().then(() => this.emit(ElectronApplication.Events.Close));
    });
    this._browserContext.on(BrowserContext.Events.Page, event => this._onPage(event));
    this._nodeConnection = nodeConnection;
    this._nodeSession = nodeConnection.rootSession;
  }

  private async _onPage(page: ElectronPage) {
    // Needs to be sync.
    const windowId = ++this._lastWindowId;
    page.on(Page.Events.Close, () => {
      page.browserWindow.dispose();
      this._windows.delete(page);
    });
    page._browserWindowId = windowId;
    this._windows.add(page);

    // Below is async.
    const handle = await this._nodeElectronHandle!.evaluateHandle(({ BrowserWindow }, windowId) => BrowserWindow.fromId(windowId), windowId).catch(e => {});
    if (!handle)
      return;
    page.browserWindow = handle;
    await runAbortableTask(progress => page.mainFrame()._waitForLoadState(progress, 'domcontentloaded'), page._timeoutSettings.navigationTimeout({})).catch(e => {}); // can happen after detach
    this.emit(ElectronApplication.Events.Window, page);
  }

  async newBrowserWindow(options: any): Promise<Page> {
    const windowId = await this._nodeElectronHandle!.evaluate(async ({ BrowserWindow }, options) => {
      const win = new BrowserWindow(options);
      win.loadURL('about:blank');
      return win.id;
    }, options);

    for (const page of this._windows) {
      if (page._browserWindowId === windowId)
        return page;
    }

    return await this._waitForEvent(ElectronApplication.Events.Window, (page: ElectronPage) => page._browserWindowId === windowId);
  }

  context(): BrowserContext {
    return this._browserContext;
  }

  async close() {
    const closed = this._waitForEvent(ElectronApplication.Events.Close);
    await this._nodeElectronHandle!.evaluate(({ app }) => app.quit());
    this._nodeConnection.close();
    await closed;
  }

  private async _waitForEvent(event: string, predicate?: Function): Promise<any> {
    const progressController = new ProgressController();
    if (event !== ElectronApplication.Events.Close)
      this._browserContext._closePromise.then(error => progressController.abort(error));
    return progressController.run(progress => helper.waitForEvent(progress, this, event, predicate).promise, this._timeoutSettings.timeout({}));
  }

  async _init()  {
    this._nodeSession.on('Runtime.executionContextCreated', (event: any) => {
      if (event.context.auxData && event.context.auxData.isDefault)
        this._nodeExecutionContext = new js.ExecutionContext(new CRExecutionContext(this._nodeSession, event.context));
    });
    await this._nodeSession.send('Runtime.enable', {}).catch(e => {});
    this._nodeElectronHandle = await js.evaluate(this._nodeExecutionContext!, false /* returnByValue */, `process.mainModule.require('electron')`);
  }
}

export class Electron  {
  async launch(executablePath: string, options: ElectronLaunchOptionsBase = {}): Promise<ElectronApplication> {
    const {
      args = [],
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
    } = options;
    const controller = new ProgressController();
    controller.setLogName('browser');
    return controller.run(async progress => {
      let app: ElectronApplication | undefined = undefined;
      const electronArguments = ['--inspect=0', '--remote-debugging-port=0', ...args];

      if (os.platform() === 'linux') {
        const runningAsRoot = process.geteuid && process.geteuid() === 0;
        if (runningAsRoot && electronArguments.indexOf('--no-sandbox') === -1)
          electronArguments.push('--no-sandbox');
      }

      const { launchedProcess, gracefullyClose, kill } = await launchProcess({
        executablePath,
        args: electronArguments,
        env: options.env ? envArrayToObject(options.env) : process.env,
        handleSIGINT,
        handleSIGTERM,
        handleSIGHUP,
        progress,
        stdio: 'pipe',
        cwd: options.cwd,
        tempDirectories: [],
        attemptToGracefullyClose: () => app!.close(),
        onExit: () => {},
      });

      const nodeMatch = await waitForLine(progress, launchedProcess, /^Debugger listening on (ws:\/\/.*)$/);
      const nodeTransport = await WebSocketTransport.connect(progress, nodeMatch[1]);
      const nodeConnection = new CRConnection(nodeTransport, helper.debugProtocolLogger());

      const chromeMatch = await waitForLine(progress, launchedProcess, /^DevTools listening on (ws:\/\/.*)$/);
      const chromeTransport = await WebSocketTransport.connect(progress, chromeMatch[1]);
      const browserProcess: BrowserProcess = {
        onclose: undefined,
        process: launchedProcess,
        close: gracefullyClose,
        kill
      };
      const browserOptions: BrowserOptions = {
        name: 'electron',
        headful: true,
        persistent: { noDefaultViewport: true },
        browserProcess,
        protocolLogger: helper.debugProtocolLogger(),
      };
      const browser = await CRBrowser.connect(chromeTransport, browserOptions);
      app = new ElectronApplication(browser, nodeConnection);
      await app._init();
      return app;
    }, TimeoutSettings.timeout(options));
  }
}

function waitForLine(progress: Progress, process: childProcess.ChildProcess, regex: RegExp): Promise<RegExpMatchArray> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stderr });
    const failError = new Error('Process failed to launch!');
    const listeners = [
      helper.addEventListener(rl, 'line', onLine),
      helper.addEventListener(rl, 'close', reject.bind(null, failError)),
      helper.addEventListener(process, 'exit', reject.bind(null, failError)),
      // It is Ok to remove error handler because we did not create process and there is another listener.
      helper.addEventListener(process, 'error', reject.bind(null, failError))
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
      helper.removeEventListeners(listeners);
    }
  });
}
