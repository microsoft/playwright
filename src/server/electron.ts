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

import * as path from 'path';
import { CRBrowser, CRBrowserContext } from '../chromium/crBrowser';
import { CRConnection, CRSession } from '../chromium/crConnection';
import { CRExecutionContext } from '../chromium/crExecutionContext';
import { Events } from '../events';
import * as js from '../javascript';
import { Loggers, Logger } from '../logger';
import { Page } from '../page';
import { TimeoutSettings } from '../timeoutSettings';
import { WebSocketTransport } from '../transport';
import * as types from '../types';
import { launchProcess, waitForLine } from './processLauncher';
import { BrowserContext } from '../browserContext';
import type {BrowserWindow} from 'electron';
import { runAbortableTask, ProgressController } from '../progress';
import { EventEmitter } from 'events';
import { helper } from '../helper';
import { LoggerSink } from '../loggerSink';
import { BrowserProcess } from '../browser';

export type ElectronLaunchOptionsBase = {
  args?: string[],
  cwd?: string,
  env?: types.Env,
  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  timeout?: number,
};

export const ElectronEvents = {
  ElectronApplication: {
    Close: 'close',
    Window: 'window',
  }
};

export interface ElectronPage extends Page {
  browserWindow: js.JSHandle<BrowserWindow>;
  _browserWindowId: number;
}

export class ElectronApplication extends EventEmitter {
  private _apiLogger: Logger;
  private _browserContext: CRBrowserContext;
  private _nodeConnection: CRConnection;
  private _nodeSession: CRSession;
  private _nodeExecutionContext: js.ExecutionContext | undefined;
  _nodeElectronHandle: js.JSHandle<any> | undefined;
  private _windows = new Set<ElectronPage>();
  private _lastWindowId = 0;
  readonly _timeoutSettings = new TimeoutSettings();

  constructor(logger: Loggers, browser: CRBrowser, nodeConnection: CRConnection) {
    super();
    this._apiLogger = logger.api;
    this._browserContext = browser._defaultContext as CRBrowserContext;
    this._browserContext.on(Events.BrowserContext.Close, () => {
      // Emit application closed after context closed.
      Promise.resolve().then(() => this.emit(ElectronEvents.ElectronApplication.Close));
    });
    this._browserContext.on(Events.BrowserContext.Page, event => this._onPage(event));
    this._nodeConnection = nodeConnection;
    this._nodeSession = nodeConnection.rootSession;
  }

  private async _onPage(page: ElectronPage) {
    // Needs to be sync.
    const windowId = ++this._lastWindowId;
    // Can be async.
    const handle = await this._nodeElectronHandle!.evaluateHandle(({ BrowserWindow }, windowId) => BrowserWindow.fromId(windowId), windowId).catch(e => {});
    if (!handle)
      return;
    page.browserWindow = handle;
    page._browserWindowId = windowId;
    page.on(Events.Page.Close, () => {
      page.browserWindow.dispose();
      this._windows.delete(page);
    });
    this._windows.add(page);
    await page.waitForLoadState('domcontentloaded').catch(e => {}); // can happen after detach
    this.emit(ElectronEvents.ElectronApplication.Window, page);
  }

  windows(): Page[] {
    return [...this._windows];
  }

  async firstWindow(): Promise<Page> {
    if (this._windows.size)
      return this._windows.values().next().value;
    return this.waitForEvent('window');
  }

  async newBrowserWindow(options: any): Promise<Page> {
    const windowId = await this.evaluate(async ({ BrowserWindow }, options) => {
      const win = new BrowserWindow(options);
      win.loadURL('about:blank');
      return win.id;
    }, options);

    for (const page of this._windows) {
      if (page._browserWindowId === windowId)
        return page;
    }

    return await this.waitForEvent(ElectronEvents.ElectronApplication.Window, (page: ElectronPage) => page._browserWindowId === windowId);
  }

  context(): BrowserContext {
    return this._browserContext;
  }

  async close() {
    const closed = this.waitForEvent(ElectronEvents.ElectronApplication.Close);
    await this.evaluate(({ app }) => app.quit());
    this._nodeConnection.close();
    await closed;
  }

  async waitForEvent(event: string, optionsOrPredicate: types.WaitForEventOptions = {}): Promise<any> {
    const options = typeof optionsOrPredicate === 'function' ? { predicate: optionsOrPredicate } : optionsOrPredicate;
    const progressController = new ProgressController(this._apiLogger, this._timeoutSettings.timeout(options), 'electron.waitForEvent');
    if (event !== ElectronEvents.ElectronApplication.Close)
      this._browserContext._closePromise.then(error => progressController.abort(error));
    return progressController.run(progress => helper.waitForEvent(progress, this, event, options.predicate).promise);
  }

  async _init()  {
    this._nodeSession.once('Runtime.executionContextCreated', event => {
      this._nodeExecutionContext = new js.ExecutionContext(new CRExecutionContext(this._nodeSession, event.context));
    });
    await this._nodeSession.send('Runtime.enable', {}).catch(e => {});
    this._nodeElectronHandle = await js.evaluate(this._nodeExecutionContext!, false /* returnByValue */, () => {
      // Resolving the race between the debugger and the boot-time script.
      if ((global as any)._playwrightRun)
        return (global as any)._playwrightRun();
      return new Promise(f => (global as any)._playwrightRunCallback = f);
    });
  }

  async evaluate<R, Arg>(pageFunction: js.FuncOn<any, Arg, R>, arg: Arg): Promise<R>;
  async evaluate<R>(pageFunction: js.FuncOn<any, void, R>, arg?: any): Promise<R>;
  async evaluate<R, Arg>(pageFunction: js.FuncOn<any, Arg, R>, arg: Arg): Promise<R> {
    return this._nodeElectronHandle!.evaluate(pageFunction, arg);
  }

  async evaluateHandle<R, Arg>(pageFunction: js.FuncOn<any, Arg, R>, arg: Arg): Promise<js.SmartHandle<R>>;
  async evaluateHandle<R>(pageFunction: js.FuncOn<any, void, R>, arg?: any): Promise<js.SmartHandle<R>>;
  async evaluateHandle<R, Arg>(pageFunction: js.FuncOn<any, Arg, R>, arg: Arg): Promise<js.SmartHandle<R>> {
    return this._nodeElectronHandle!.evaluateHandle(pageFunction, arg);
  }
}

export class Electron  {
  async launch(executablePath: string, options: ElectronLaunchOptionsBase & { logger?: LoggerSink } = {}): Promise<ElectronApplication> {
    const {
      args = [],
      env = process.env,
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
    } = options;
    const loggers = new Loggers(options.logger);
    return runAbortableTask(async progress => {
      let app: ElectronApplication | undefined = undefined;
      const electronArguments = ['--inspect=0', '--remote-debugging-port=0', '--require', path.join(__dirname, 'electronLoader.js'), ...args];
      const { launchedProcess, gracefullyClose, kill } = await launchProcess({
        executablePath,
        args: electronArguments,
        env,
        handleSIGINT,
        handleSIGTERM,
        handleSIGHUP,
        progress,
        pipe: true,
        cwd: options.cwd,
        tempDirectories: [],
        attemptToGracefullyClose: () => app!.close(),
        onExit: (exitCode, signal) => {},
      });

      const nodeMatch = await waitForLine(progress, launchedProcess, launchedProcess.stderr, /^Debugger listening on (ws:\/\/.*)$/);
      const nodeTransport = await WebSocketTransport.connect(progress, nodeMatch[1]);
      const nodeConnection = new CRConnection(nodeTransport, loggers);

      const chromeMatch = await waitForLine(progress, launchedProcess, launchedProcess.stderr, /^DevTools listening on (ws:\/\/.*)$/);
      const chromeTransport = await WebSocketTransport.connect(progress, chromeMatch[1]);
      const browserProcess: BrowserProcess = {
        onclose: undefined,
        process: launchedProcess,
        close: gracefullyClose,
        kill
      };
      const browser = await CRBrowser.connect(chromeTransport, { name: 'electron', headful: true, loggers, persistent: { viewport: null }, browserProcess });
      app = new ElectronApplication(loggers, browser, nodeConnection);
      await app._init();
      return app;
    }, loggers.browser, TimeoutSettings.timeout(options), 'electron.launch');
  }
}
