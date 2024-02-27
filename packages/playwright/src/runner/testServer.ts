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

import type http from 'http';
import path from 'path';
import { ManualPromise, createGuid, gracefullyProcessExitDoNotHang } from 'playwright-core/lib/utils';
import { WSServer } from 'playwright-core/lib/utils';
import type { WebSocket } from 'playwright-core/lib/utilsBundle';
import type { FullResult, TestError } from 'playwright/types/testReporter';
import { loadConfig, restartWithExperimentalTsEsm } from '../common/configLoader';
import { InternalReporter } from '../reporters/internalReporter';
import { Multiplexer } from '../reporters/multiplexer';
import { createReporters } from './reporters';
import { TestRun, createTaskRunnerForList, createTaskRunnerForTestServer } from './tasks';
import type { ConfigCLIOverrides } from '../common/ipc';
import { Runner } from './runner';
import type { FindRelatedTestFilesReport } from './runner';
import type { FullConfigInternal } from '../common/config';
import type { TestServerInterface } from './testServerInterface';
import { serializeError } from '../util';
import { prepareErrorStack } from '../reporters/base';
import { loadReporter } from './loadUtils';
import { wrapReporterAsV2 } from '../reporters/reporterV2';

export async function runTestServer() {
  if (restartWithExperimentalTsEsm(undefined, true))
    return null;
  process.env.PW_TEST_HTML_REPORT_OPEN = 'never';
  const wss = new WSServer({
    onConnection(request: http.IncomingMessage, url: URL, ws: WebSocket, id: string) {
      const dispatcher = new Dispatcher(ws);
      ws.on('message', async message => {
        const { id, method, params } = JSON.parse(String(message));
        try {
          const result = await (dispatcher as any)[method](params);
          ws.send(JSON.stringify({ id, result }));
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e);
        }
      });
      return {
        async close() {}
      };
    },
  });
  const url = await wss.listen(0, 'localhost', '/' + createGuid());
  // eslint-disable-next-line no-console
  process.on('exit', () => wss.close().catch(console.error));
  // eslint-disable-next-line no-console
  console.log(`Listening on ${url}`);
  process.stdin.on('close', () => gracefullyProcessExitDoNotHang(0));
}

class Dispatcher implements TestServerInterface {
  private _testRun: { run: Promise<FullResult['status']>, stop: ManualPromise<void> } | undefined;
  private _ws: WebSocket;

  constructor(ws: WebSocket) {
    this._ws = ws;

    process.stdout.write = ((chunk: string | Buffer, cb?: Buffer | Function, cb2?: Function) => {
      this._dispatchEvent('stdio', chunkToPayload('stdout', chunk));
      if (typeof cb === 'function')
        (cb as any)();
      if (typeof cb2 === 'function')
        (cb2 as any)();
      return true;
    }) as any;
    process.stderr.write = ((chunk: string | Buffer, cb?: Buffer | Function, cb2?: Function) => {
      this._dispatchEvent('stdio', chunkToPayload('stderr', chunk));
      if (typeof cb === 'function')
        (cb as any)();
      if (typeof cb2 === 'function')
        (cb2 as any)();
      return true;
    }) as any;
  }

  async listFiles(params: {
    configFile: string;
  }): Promise<{
    projects: {
      name: string;
      testDir: string;
      use: { testIdAttribute?: string };
      files: string[];
    }[];
    cliEntryPoint?: string;
    error?: TestError;
  }> {
    try {
      const config = await this._loadConfig(params.configFile);
      const runner = new Runner(config);
      return runner.listTestFiles();
    } catch (e) {
      const error: TestError = serializeError(e);
      error.location = prepareErrorStack(e.stack).location;
      return { projects: [], error };
    }
  }

  async listTests(params: {
    configFile: string;
    locations: string[];
    reporter: string;
    env: NodeJS.ProcessEnv;
  }) {
    const config = await this._loadConfig(params.configFile);
    config.cliArgs = params.locations || [];
    const wireReporter = await this._createReporter(params.reporter);
    const reporter = new InternalReporter(new Multiplexer([wireReporter]));
    const taskRunner = createTaskRunnerForList(config, reporter, 'out-of-process', { failOnLoadErrors: true });
    const testRun = new TestRun(config, reporter);
    reporter.onConfigure(config.config);

    const taskStatus = await taskRunner.run(testRun, 0);
    let status: FullResult['status'] = testRun.failureTracker.result();
    if (status === 'passed' && taskStatus !== 'passed')
      status = taskStatus;
    const modifiedResult = await reporter.onEnd({ status });
    if (modifiedResult && modifiedResult.status)
      status = modifiedResult.status;
    await reporter.onExit();
  }

  async test(params: {
    configFile: string;
    locations: string[];
    reporter: string;
    env: NodeJS.ProcessEnv;
    headed?: boolean;
    oneWorker?: boolean;
    trace?: 'on' | 'off';
    projects?: string[];
    grep?: string;
    reuseContext?: boolean;
    connectWsEndpoint?: string;
  }) {
    await this._stopTests();

    const overrides: ConfigCLIOverrides = {
      repeatEach: 1,
      retries: 0,
      preserveOutputDir: true,
      use: {
        trace: params.trace,
        headless: params.headed ? false : undefined,
        _optionContextReuseMode: params.reuseContext ? 'when-possible' : undefined,
        _optionConnectOptions: params.connectWsEndpoint ? { wsEndpoint: params.connectWsEndpoint } : undefined,
      },
      workers: params.oneWorker ? 1 : undefined,
    };

    const config = await this._loadConfig(params.configFile, overrides);
    config.cliListOnly = false;
    config.cliArgs = params.locations || [];
    config.cliGrep = params.grep;
    config.cliProjectFilter = params.projects?.length ? params.projects : undefined;

    const wireReporter = await this._createReporter(params.reporter);
    const configReporters = await createReporters(config, 'run');
    const reporter = new InternalReporter(new Multiplexer([...configReporters, wireReporter]));
    const taskRunner = createTaskRunnerForTestServer(config, reporter);
    const testRun = new TestRun(config, reporter);
    reporter.onConfigure(config.config);
    const stop = new ManualPromise();
    const run = taskRunner.run(testRun, 0, stop).then(async status => {
      await reporter.onEnd({ status });
      await reporter.onExit();
      this._testRun = undefined;
      return status;
    });
    this._testRun = { run, stop };
    await run;
  }

  async findRelatedTestFiles(params:  {
    configFile: string;
    files: string[];
  }): Promise<FindRelatedTestFilesReport> {
    const config = await this._loadConfig(params.configFile);
    const runner = new Runner(config);
    return runner.findRelatedTestFiles('out-of-process', params.files);
  }

  async stop(params: {
    configFile: string;
  }) {
    await this._stopTests();
  }

  async closeGracefully() {
    gracefullyProcessExitDoNotHang(0);
  }

  private async _stopTests() {
    this._testRun?.stop?.resolve();
    await this._testRun?.run;
  }

  private _dispatchEvent(method: string, params: any) {
    this._ws.send(JSON.stringify({ method, params }));
  }

  private async _loadConfig(configFile: string, overrides?: ConfigCLIOverrides): Promise<FullConfigInternal> {
    return loadConfig({ resolvedConfigFile: configFile, configDir: path.dirname(configFile) }, overrides);
  }

  private async _createReporter(file: string) {
    const reporterConstructor = await loadReporter(undefined, file);
    const instance = new reporterConstructor((message: any) => this._dispatchEvent('report', message));
    return wrapReporterAsV2(instance);
  }
}

function chunkToPayload(type: 'stdout' | 'stderr', chunk: Buffer | string) {
  if (chunk instanceof Buffer)
    return { type, buffer: chunk.toString('base64') };
  return { type, text: chunk };
}
