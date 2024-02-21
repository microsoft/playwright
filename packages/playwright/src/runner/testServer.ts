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
import { ManualPromise, createGuid } from 'playwright-core/lib/utils';
import { WSServer } from 'playwright-core/lib/utils';
import type { WebSocket } from 'playwright-core/lib/utilsBundle';
import type { FullResult } from 'playwright/types/testReporter';
import type { FullConfigInternal } from '../common/config';
import { loadConfigFromFile } from '../common/configLoader';
import { InternalReporter } from '../reporters/internalReporter';
import { Multiplexer } from '../reporters/multiplexer';
import { createReporters } from './reporters';
import { TestRun, createTaskRunnerForList, createTaskRunnerForTestServer } from './tasks';

type PlaywrightTestOptions = {
  headed?: boolean,
  oneWorker?: boolean,
  trace?: 'on' | 'off',
  projects?: string[];
  grep?: string;
  reuseContext?: boolean,
  connectWsEndpoint?: string;
};

export async function runTestServer(configFile: string) {
  process.env.PW_TEST_HTML_REPORT_OPEN = 'never';
  process.env.FORCE_COLOR = '1';

  const config = await loadConfigFromFile(configFile);
  if (!config)
    return;

  const wss = new WSServer({
    onConnection(request: http.IncomingMessage, url: URL, ws: WebSocket, id: string) {
      const dispatcher = new Dispatcher(config, ws);
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
  private _config: FullConfigInternal;
  private _testRun: { run: Promise<FullResult['status']>, stop: ManualPromise<void> } | undefined;
  private _ws: WebSocket;

  constructor(config: FullConfigInternal, ws: WebSocket) {
    this._config = config;
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
    this._config.cliArgs = [...(locations || []), '--reporter=null'];
    const reporter = new InternalReporter(new Multiplexer(await createReporters(this._config, 'list', [[reporterPath]])));
    const taskRunner = createTaskRunnerForList(this._config, reporter, 'out-of-process', { failOnLoadErrors: true });
    const testRun = new TestRun(this._config, reporter);
    reporter.onConfigure(this._config.config);

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
    this._config.cliListOnly = false;
    this._config.cliArgs = locations || [];
    this._config.cliGrep = options.grep;
    this._config.cliProjectFilter = options.projects?.length ? options.projects : undefined;
    this._config.configCLIOverrides.reporter = [[reporterPath]];
    this._config.configCLIOverrides.repeatEach = 1;
    this._config.configCLIOverrides.retries = 0;
    this._config.configCLIOverrides.preserveOutputDir = true;
    this._config.configCLIOverrides.use =  {
      trace: options.trace,
      headless: options.headed ? false : undefined,
      _optionContextReuseMode: options.reuseContext ? 'when-possible' : undefined,
      _optionConnectOptions: options.connectWsEndpoint ? { wsEndpoint: options.connectWsEndpoint } : undefined,
    };
    // Too late to adjust via overrides for this one.
    if (options.oneWorker)
      this._config.config.workers = 1;

    const reporter = new InternalReporter(new Multiplexer(await createReporters(this._config, 'run')));
    const taskRunner = createTaskRunnerForTestServer(this._config, reporter);
    const testRun = new TestRun(this._config, reporter);
    reporter.onConfigure(this._config.config);
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

  private _dispatchEvent(method: string, params: any) {
    this._ws.send(JSON.stringify({ method, params }));
  }
}

function chunkToPayload(type: 'stdout' | 'stderr', chunk: Buffer | string) {
  if (chunk instanceof Buffer)
    return { type, buffer: chunk.toString('base64') };
  return { type, text: chunk };
}
