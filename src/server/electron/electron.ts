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
import { CRBrowser, CRBrowserContext } from '../chromium/crBrowser';
import { CRConnection, CRSession } from '../chromium/crConnection';
import { CRExecutionContext } from '../chromium/crExecutionContext';
import * as js from '../javascript';
import { Page } from '../page';
import { TimeoutSettings } from '../../utils/timeoutSettings';
import { WebSocketTransport } from '../transport';
import { launchProcess, envArrayToObject } from '../../utils/processLauncher';
import { BrowserContext } from '../browserContext';
import type {BrowserWindow} from 'electron';
import { Progress, ProgressController } from '../progress';
import { helper } from '../helper';
import { eventsHelper } from '../../utils/eventsHelper';
import { BrowserOptions, BrowserProcess, PlaywrightOptions } from '../browser';
import * as childProcess from 'child_process';
import * as readline from 'readline';
import { RecentLogsCollector } from '../../utils/debugLogger';
import { internalCallMetadata, SdkObject } from '../instrumentation';
import * as channels from '../../protocol/channels';

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
  private _lastWindowId = 0;
  readonly _timeoutSettings = new TimeoutSettings();

  constructor(parent: SdkObject, browser: CRBrowser, nodeConnection: CRConnection) {
    super(parent, 'electron-app');
    this._browserContext = browser._defaultContext as CRBrowserContext;
    this._browserContext.on(BrowserContext.Events.Close, () => {
      // Emit application closed after context closed.
      Promise.resolve().then(() => this.emit(ElectronApplication.Events.Close));
    });
    for (const page of this._browserContext.pages())
      this._onPage(page);
    this._browserContext.on(BrowserContext.Events.Page, event => this._onPage(event));
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
    this._nodeSession.send('Runtime.enable', {}).catch(e => {});
  }

  private _onPage(page: Page) {
    // Needs to be sync.
    const windowId = ++this._lastWindowId;
    (page as any)._browserWindowId = windowId;
  }

  context(): BrowserContext {
    return this._browserContext;
  }

  async close() {
    const progressController = new ProgressController(internalCallMetadata(), this);
    const closed = progressController.run(progress => helper.waitForEvent(progress, this, ElectronApplication.Events.Close).promise, this._timeoutSettings.timeout({}));
    const electronHandle = await this._nodeElectronHandlePromise;
    await electronHandle.evaluate(({ app }) => app.quit());
    this._nodeConnection.close();
    await closed;
  }

  async browserWindow(page: Page): Promise<js.JSHandle<BrowserWindow>> {
    const electronHandle = await this._nodeElectronHandlePromise;
    return await electronHandle.evaluateHandle(({ BrowserWindow }, windowId) => BrowserWindow.fromId(windowId), (page as any)._browserWindowId);
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
    const controller = new ProgressController(internalCallMetadata(), this);
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
      const { launchedProcess, gracefullyClose, kill } = await launchProcess({
        command: options.executablePath || require('electron/index.js'),
        args: electronArguments,
        env: options.env ? envArrayToObject(options.env) : process.env,
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

      const nodeMatch = await waitForLine(progress, launchedProcess, /^Debugger listening on (ws:\/\/.*)$/);
      const nodeTransport = await WebSocketTransport.connect(progress, nodeMatch[1]);
      const nodeConnection = new CRConnection(nodeTransport, helper.debugProtocolLogger(), browserLogsCollector);

      const chromeMatch = await waitForLine(progress, launchedProcess, /^DevTools listening on (ws:\/\/.*)$/);
      const chromeTransport = await WebSocketTransport.connect(progress, chromeMatch[1]);
      const browserProcess: BrowserProcess = {
        onclose: undefined,
        process: launchedProcess,
        close: gracefullyClose,
        kill
      };
      const browserOptions: BrowserOptions = {
        ...this._playwrightOptions,
        name: 'electron',
        isChromium: true,
        headful: true,
        persistent: {
          sdkLanguage: options.sdkLanguage,
          noDefaultViewport: true,
          acceptDownloads: options.acceptDownloads,
          bypassCSP: options.bypassCSP,
          colorScheme: options.colorScheme,
          extraHTTPHeaders: options.extraHTTPHeaders,
          geolocation: options.geolocation,
          httpCredentials: options.httpCredentials,
          ignoreHTTPSErrors: options.ignoreHTTPSErrors,
          locale: options.locale,
          offline: options.offline,
          recordHar: options.recordHar,
          recordVideo: options.recordVideo,
          timezoneId: options.timezoneId,
        },
        browserProcess,
        protocolLogger: helper.debugProtocolLogger(),
        browserLogsCollector,
        artifactsDir,
        downloadsPath: artifactsDir,
        tracesDir: artifactsDir,
      };
      const browser = await CRBrowser.connect(chromeTransport, browserOptions);
      app = new ElectronApplication(this, browser, nodeConnection);
      return app;
    }, TimeoutSettings.timeout(options));
  }
}

function waitForLine(progress: Progress, process: childProcess.ChildProcess, regex: RegExp): Promise<RegExpMatchArray> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stderr });
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
