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

import util from 'util';

import { installRootRedirect, openTraceInBrowser, openTraceViewerApp, startTraceViewerServer } from 'playwright-core/lib/server';
import { ManualPromise, gracefullyProcessExitDoNotHang, isUnderTest } from 'playwright-core/lib/utils';
import { debug, open } from 'playwright-core/lib/utilsBundle';

import { loadConfig, resolveConfigLocation } from '../common/configLoader';
import ListReporter from '../reporters/list';
import { createReporterForTestServer } from './reporters';
import { SigIntWatcher } from './sigIntWatcher';
import { TestRunner } from './testRunner';

import type { TraceViewerRedirectOptions, TraceViewerServerOptions } from 'playwright-core/lib/server/trace/viewer/traceViewer';
import type { HttpServer, Transport } from 'playwright-core/lib/utils';
import type * as reporterTypes from '../../types/testReporter';
import type { ConfigLocation } from '../common/config';
import type { ConfigCLIOverrides } from '../common/ipc';
import type { RecoverFromStepErrorResult, ReportEntry, TestServerInterface, TestServerInterfaceEventEmitters } from '../isomorphic/testServerInterface';
import type { ReporterV2 } from '../reporters/reporterV2';

const originalDebugLog = debug.log;
// eslint-disable-next-line no-restricted-properties
const originalStdoutWrite = process.stdout.write;
// eslint-disable-next-line no-restricted-properties
const originalStderrWrite = process.stderr.write;

class TestServer {
  private _configLocation: ConfigLocation;
  private _configCLIOverrides: ConfigCLIOverrides;
  private _dispatcher: TestServerDispatcher | undefined;

  constructor(configLocation: ConfigLocation, configCLIOverrides: ConfigCLIOverrides) {
    this._configLocation = configLocation;
    this._configCLIOverrides = configCLIOverrides;
  }

  async start(options: { host?: string, port?: number }): Promise<HttpServer> {
    this._dispatcher = new TestServerDispatcher(this._configLocation, this._configCLIOverrides);
    return await startTraceViewerServer({ ...options, transport: this._dispatcher.transport });
  }

  async stop() {
    await this._dispatcher?._setInterceptStdio(false);
    await this._dispatcher?.runGlobalTeardown();
  }
}

export const TestRunnerEvent = {
  TestFilesChanged: 'testFilesChanged',
  RecoverFromStepError: 'recoverFromStepError',
} as const;

export type TestRunnerEventMap = {
  [TestRunnerEvent.TestFilesChanged]: [testFiles: string[]];
  [TestRunnerEvent.RecoverFromStepError]: [stepId: string, message: string, location: reporterTypes.Location];
};

export type ListTestsParams = {
  projects?: string[];
  locations?: string[];
  grep?: string;
  grepInvert?: string;
};

export type RunTestsParams = {
  locations?: string[];
  grep?: string;
  grepInvert?: string;
  testIds?: string[];
  headed?: boolean;
  workers?: number | string;
  updateSnapshots?: 'all' | 'changed' | 'missing' | 'none';
  updateSourceMethod?: 'overwrite' | 'patch' | '3way';
  reporters?: string[],
  trace?: 'on' | 'off';
  video?: 'on' | 'off';
  projects?: string[];
  reuseContext?: boolean;
  connectWsEndpoint?: string;
};

export class TestServerDispatcher implements TestServerInterface {
  readonly transport: Transport;
  private _serializer = require.resolve('./uiModeReporter');
  private _closeOnDisconnect = false;
  private _testRunner: TestRunner;
  private _globalSetupReport: ReportEntry[] | undefined;
  private _devServerReport: ReportEntry[] | undefined;
  readonly _dispatchEvent: TestServerInterfaceEventEmitters['dispatchEvent'];

  constructor(configLocation: ConfigLocation, configCLIOverrides: ConfigCLIOverrides) {
    this._testRunner = new TestRunner(configLocation, configCLIOverrides);
    this.transport = {
      onconnect: () => {},
      dispatch: (method, params) => (this as any)[method](params),
      onclose: () => {
        if (this._closeOnDisconnect)
          gracefullyProcessExitDoNotHang(0);
      },
    };

    this._dispatchEvent = (method, params) => this.transport.sendEvent?.(method, params);
    this._testRunner.on(TestRunnerEvent.TestFilesChanged, testFiles => this._dispatchEvent('testFilesChanged', { testFiles }));
    this._testRunner.on(TestRunnerEvent.RecoverFromStepError, (stepId, message, location) => this._dispatchEvent('recoverFromStepError', { stepId, message, location }));
  }

  private async _wireReporter(messageSink: (message: any) => void) {
    return await createReporterForTestServer(this._serializer, messageSink);
  }

  private async _collectingReporter(): Promise<{ reporter: ReporterV2, report: ReportEntry[] }> {
    const report: ReportEntry[] = [];
    return {
      reporter: await createReporterForTestServer(this._serializer, e => report.push(e)),
      report,
    };
  }

  async initialize(params: Parameters<TestServerInterface['initialize']>[0]): ReturnType<TestServerInterface['initialize']> {
    // Note: this method can be called multiple times, for example from a new connection after UI mode reload.
    this._serializer = params.serializer || require.resolve('./uiModeReporter');
    this._closeOnDisconnect = !!params.closeOnDisconnect;
    await this._setInterceptStdio(!!params.interceptStdio);
    await this._testRunner.initialize({
      watchTestDirs: !!params.watchTestDirs,
      populateDependenciesOnList: !!params.populateDependenciesOnList,
      recoverFromStepErrors: !!params.recoverFromStepErrors,
    });
  }

  async ping() {}

  async open(params: Parameters<TestServerInterface['open']>[0]): ReturnType<TestServerInterface['open']> {
    if (isUnderTest())
      return;
    // eslint-disable-next-line no-console
    open('vscode://file/' + params.location.file + ':' + params.location.line).catch(e => console.error(e));
  }

  async resizeTerminal(params: Parameters<TestServerInterface['resizeTerminal']>[0]): ReturnType<TestServerInterface['resizeTerminal']> {
    this._testRunner.resizeTerminal(params);
  }

  async checkBrowsers(): Promise<{ hasBrowsers: boolean; }> {
    return { hasBrowsers: this._testRunner.hasSomeBrowsers() };
  }

  async installBrowsers() {
    await this._testRunner.installBrowsers();
  }

  async runGlobalSetup(params: Parameters<TestServerInterface['runGlobalSetup']>[0]): ReturnType<TestServerInterface['runGlobalSetup']> {
    await this.runGlobalTeardown();

    const { reporter, report } = await this._collectingReporter();
    this._globalSetupReport = report;
    const { status } = await this._testRunner.runGlobalSetup([reporter, new ListReporter()]);
    return { report, status };
  }

  async runGlobalTeardown() {
    const { status } = await this._testRunner.runGlobalTeardown();
    const report = this._globalSetupReport || [];
    this._globalSetupReport = undefined;
    return { status, report };
  }

  async startDevServer(params: Parameters<TestServerInterface['startDevServer']>[0]): ReturnType<TestServerInterface['startDevServer']> {
    await this.stopDevServer({});

    const { reporter, report } = await this._collectingReporter();
    const { status } = await this._testRunner.startDevServer(reporter, 'out-of-process');
    return { report, status };
  }

  async stopDevServer(params: Parameters<TestServerInterface['stopDevServer']>[0]): ReturnType<TestServerInterface['stopDevServer']> {
    const { status } = await this._testRunner.stopDevServer();
    const report = this._devServerReport || [];
    this._devServerReport = undefined;
    return { status, report };
  }

  async clearCache(params: Parameters<TestServerInterface['clearCache']>[0]): ReturnType<TestServerInterface['clearCache']> {
    await this._testRunner.clearCache();
  }

  async listFiles(params: Parameters<TestServerInterface['listFiles']>[0]): ReturnType<TestServerInterface['listFiles']> {
    const { reporter, report } = await this._collectingReporter();
    const { status } = await this._testRunner.listFiles(reporter, params.projects);
    return { report, status };
  }

  async listTests(params: Parameters<TestServerInterface['listTests']>[0]): ReturnType<TestServerInterface['listTests']> {
    const { reporter, report } = await this._collectingReporter();
    const { status } = await this._testRunner.listTests(reporter, params);
    return { report, status };
  }

  async runTests(params: Parameters<TestServerInterface['runTests']>[0]): ReturnType<TestServerInterface['runTests']> {
    const wireReporter = await this._wireReporter(e => this._dispatchEvent('report', e));
    const { status } = await this._testRunner.runTests(wireReporter, params);
    return { status };
  }

  async resumeAfterStepError(params: RecoverFromStepErrorResult): Promise<void> {
    await this._testRunner.resumeAfterStepError(params);
  }

  async watch(params: { fileNames: string[]; }) {
    await this._testRunner.watch(params.fileNames);
  }

  async findRelatedTestFiles(params: Parameters<TestServerInterface['findRelatedTestFiles']>[0]): ReturnType<TestServerInterface['findRelatedTestFiles']> {
    return this._testRunner.findRelatedTestFiles(params.files);
  }

  async stopTests() {
    await this._testRunner.stopTests();
  }

  async _setInterceptStdio(intercept: boolean) {
    /* eslint-disable no-restricted-properties */
    if (process.env.PWTEST_DEBUG)
      return;
    if (intercept) {
      if (debug.log === originalDebugLog) {
        // Only if debug.log hasn't already been tampered with, don't intercept any DEBUG=* logging
        debug.log = (...args) => {
          const string = util.format(...args) + '\n';
          return (originalStderrWrite as any).apply(process.stderr, [string]);
        };
      }
      const stdoutWrite = (chunk: string | Buffer) => {
        this._dispatchEvent('stdio', chunkToPayload('stdout', chunk));
        return true;
      };
      const stderrWrite = (chunk: string | Buffer) => {
        this._dispatchEvent('stdio', chunkToPayload('stderr', chunk));
        return true;
      };
      process.stdout.write = stdoutWrite;
      process.stderr.write = stderrWrite;
    } else {
      debug.log = originalDebugLog;
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    }
    /* eslint-enable no-restricted-properties */
  }

  async closeGracefully() {
    await this._testRunner.closeGracefully();
  }
}

export async function runUIMode(configFile: string | undefined, configCLIOverrides: ConfigCLIOverrides, options: TraceViewerServerOptions & TraceViewerRedirectOptions): Promise<reporterTypes.FullResult['status']> {
  const configLocation = resolveConfigLocation(configFile);
  return await innerRunTestServer(configLocation, configCLIOverrides, options, async (server: HttpServer, cancelPromise: ManualPromise<void>) => {
    await installRootRedirect(server, [], { ...options, webApp: 'uiMode.html' });
    if (options.host !== undefined || options.port !== undefined) {
      await openTraceInBrowser(server.urlPrefix('human-readable'));
    } else {
      const channel = await installedChromiumChannelForUI(configLocation, configCLIOverrides);
      const page = await openTraceViewerApp(server.urlPrefix('precise'), 'chromium', {
        headless: isUnderTest() && process.env.PWTEST_HEADED_FOR_TEST !== '1',
        persistentContextOptions: {
          handleSIGINT: false,
          channel,
        },
      });
      page.on('close', () => cancelPromise.resolve());
    }
  });
}

// Pick first channel that is used by one of the projects, to ensure it is installed on the machine.
async function installedChromiumChannelForUI(configLocation: ConfigLocation, configCLIOverrides: ConfigCLIOverrides) {
  const config = await loadConfig(configLocation, configCLIOverrides).catch(e => null);
  if (!config)
    return undefined;
  if (config.projects.some(p => (!p.project.use.browserName || p.project.use.browserName === 'chromium') && !p.project.use.channel))
    return undefined;
  for (const channel of ['chromium', 'chrome', 'msedge']) {
    if (config.projects.some(p => p.project.use.channel === channel))
      return channel;
  }
  return undefined;
}

export async function runTestServer(configFile: string | undefined, configCLIOverrides: ConfigCLIOverrides, options: { host?: string, port?: number }): Promise<reporterTypes.FullResult['status']> {
  const configLocation = resolveConfigLocation(configFile);
  return await innerRunTestServer(configLocation, configCLIOverrides, options, async server => {
    // eslint-disable-next-line no-console
    console.log('Listening on ' + server.urlPrefix('precise').replace('http:', 'ws:') + '/' + server.wsGuid());
  });
}

async function innerRunTestServer(configLocation: ConfigLocation, configCLIOverrides: ConfigCLIOverrides, options: { host?: string, port?: number }, openUI: (server: HttpServer, cancelPromise: ManualPromise<void>) => Promise<void>): Promise<reporterTypes.FullResult['status']> {
  const testServer = new TestServer(configLocation, configCLIOverrides);
  const cancelPromise = new ManualPromise<void>();
  const sigintWatcher = new SigIntWatcher();
  process.stdin.on('close', () => gracefullyProcessExitDoNotHang(0));
  void sigintWatcher.promise().then(() => cancelPromise.resolve());
  try {
    const server = await testServer.start(options);
    await openUI(server, cancelPromise);
    await cancelPromise;
  } finally {
    await testServer.stop();
    sigintWatcher.disarm();
  }
  return sigintWatcher.hadSignal() ? 'interrupted' : 'passed';
}

type StdioPayload = {
  type: 'stdout' | 'stderr';
  text?: string;
  buffer?: string;
};

function chunkToPayload(type: 'stdout' | 'stderr', chunk: Buffer | string): StdioPayload {
  if (chunk instanceof Uint8Array)
    return { type, buffer: chunk.toString('base64') };
  return { type, text: chunk };
}
