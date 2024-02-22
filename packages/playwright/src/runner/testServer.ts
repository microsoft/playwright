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
import { ManualPromise, createGuid } from 'playwright-core/lib/utils';
import { WSServer } from 'playwright-core/lib/utils';
import type { WebSocket } from 'playwright-core/lib/utilsBundle';
import type { FullResult } from 'playwright/types/testReporter';
import type { FullConfigInternal } from '../common/config';
import { ConfigLoader, resolveConfigFile, restartWithExperimentalTsEsm } from '../common/configLoader';
import { InternalReporter } from '../reporters/internalReporter';
import { Multiplexer } from '../reporters/multiplexer';
import { createReporters } from './reporters';
import { TestRun, createTaskRunnerForList, createTaskRunnerForTestServer } from './tasks';
import type { ConfigCLIOverrides } from '../common/ipc';

type PlaywrightTestOptions = {
  headed?: boolean,
  oneWorker?: boolean,
  trace?: 'on' | 'off',
  projects?: string[];
  grep?: string;
  reuseContext?: boolean,
  connectWsEndpoint?: string;
};

type ConfigPaths = {
  configFile: string | null;
  configDir: string;
};

export async function runTestServer(configFile: string | undefined) {
  process.env.PW_TEST_HTML_REPORT_OPEN = 'never';

  const configFileOrDirectory = configFile ? path.resolve(process.cwd(), configFile) : process.cwd();
  const resolvedConfigFile = resolveConfigFile(configFileOrDirectory);
  if (restartWithExperimentalTsEsm(resolvedConfigFile))
    return null;
  const configPaths: ConfigPaths = {
    configFile: resolvedConfigFile,
    configDir: resolvedConfigFile ? path.dirname(resolvedConfigFile) : configFileOrDirectory
  };

  const wss = new WSServer({
    onConnection(request: http.IncomingMessage, url: URL, ws: WebSocket, id: string) {
      const dispatcher = new Dispatcher(configPaths, ws);
      ws.on('message', async message => {
        const { id, method, params } = JSON.parse(message.toString());
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
  console.log(`Listening on ${url}`);
}

class Dispatcher {
  private _testRun: { run: Promise<FullResult['status']>, stop: ManualPromise<void> } | undefined;
  private _ws: WebSocket;
  private _configPaths: ConfigPaths;

  constructor(configPaths: ConfigPaths, ws: WebSocket) {
    this._configPaths = configPaths;
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

  async list(params: { locations: string[], reporter: string, env: NodeJS.ProcessEnv }) {
    for (const name in params.env)
      process.env[name] = params.env[name];
    await this._listTests(params.reporter, params.locations);
  }

  async test(params: { locations: string[], options: PlaywrightTestOptions, reporter: string, env: NodeJS.ProcessEnv }) {
    for (const name in params.env)
      process.env[name] = params.env[name];
    await this._runTests(params.reporter, params.locations, params.options);
  }

  async stop() {
    await this._stopTests();
  }

  private async _listTests(reporterPath: string, locations: string[] | undefined) {
    const config = await this._loadConfig({});
    config.cliArgs = [...(locations || []), '--reporter=null'];
    const reporter = new InternalReporter(new Multiplexer(await createReporters(config, 'list', [[reporterPath]])));
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

  private async _runTests(reporterPath: string, locations: string[] | undefined, options: PlaywrightTestOptions) {
    await this._stopTests();
    const overrides: ConfigCLIOverrides = {
      additionalReporters: [[reporterPath]],
      repeatEach: 1,
      retries: 0,
      preserveOutputDir: true,
      use: {
        trace: options.trace,
        headless: options.headed ? false : undefined,
        _optionContextReuseMode: options.reuseContext ? 'when-possible' : undefined,
        _optionConnectOptions: options.connectWsEndpoint ? { wsEndpoint: options.connectWsEndpoint } : undefined,
      },
      workers: options.oneWorker ? 1 : undefined,
    };

    const config = await this._loadConfig(overrides);
    config.cliListOnly = false;
    config.cliArgs = locations || [];
    config.cliGrep = options.grep;
    config.cliProjectFilter = options.projects?.length ? options.projects : undefined;

    const reporter = new InternalReporter(new Multiplexer(await createReporters(config, 'run')));
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

  private async _stopTests() {
    this._testRun?.stop?.resolve();
    await this._testRun?.run;
  }

  private async _loadConfig(overrides: ConfigCLIOverrides) {
    const configLoader = new ConfigLoader(overrides);
    let config: FullConfigInternal;
    if (this._configPaths.configFile)
      config = await configLoader.loadConfigFile(this._configPaths.configFile, false);
    else
      config = await configLoader.loadEmptyConfig(this._configPaths.configDir);
    return config;
  }

  private _dispatchEvent(method: string, params: any) {
    this._ws.send(JSON.stringify({ method, params }));
  }
}

function chunkToPayload(type: 'stdout' | 'stderr', chunk: Buffer | string) {
  if (chunk instanceof Buffer)
    return { type, buffer: chunk.toString('base64') };
  return { type, text: chunk };
}
