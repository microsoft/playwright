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
import { TestRun, createTaskRunnerForList, createTaskRunnerForWatch } from './tasks';

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

  const dispatcher = new Dispatcher(config);
  const wss = new WSServer({
    onConnection(request: http.IncomingMessage, url: URL, ws: WebSocket, id: string) {
      ws.on('message', async message => {
        const { id, method, params } = JSON.parse(message.toString());
        const result = await (dispatcher as any)[method](params);
        ws.send(JSON.stringify({ id, result }));
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

  constructor(config: FullConfigInternal) {
    this._config = config;
  }

  async test(params: { mode: 'list' | 'run', locations: string[], options: PlaywrightTestOptions, reporter: string, env: NodeJS.ProcessEnv }) {
    for (const name in params.env)
      process.env[name] = params.env[name];
    if (params.mode === 'list')
      await listTests(this._config, params.reporter, params.locations);
    if (params.mode === 'run')
      await runTests(this._config, params.reporter, params.locations, params.options);
  }
}


async function listTests(config: FullConfigInternal, reporterPath: string, locations: string[] | undefined) {
  config.cliArgs = [...(locations || []), '--reporter=null'];
  const reporter = new InternalReporter(new Multiplexer(await createReporters(config, 'list', [[reporterPath]])));
  const taskRunner = createTaskRunnerForList(config, reporter, 'out-of-process', { failOnLoadErrors: false });
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

async function runTests(config: FullConfigInternal, reporterPath: string, locations: string[] | undefined, options: PlaywrightTestOptions) {
  config.cliArgs = locations || [];
  config.cliGrep = options.grep;
  config.cliProjectFilter = options.projects;

  config.configCLIOverrides.reporter = [[reporterPath]];
  config.configCLIOverrides.repeatEach = 1;
  config.configCLIOverrides.retries = 0;
  config.configCLIOverrides.workers = options.oneWorker ? 1 : undefined;
  config.configCLIOverrides.preserveOutputDir = true;
  config.configCLIOverrides.use =  {
    trace: options.trace,
    headless: options.headed ? false : undefined,
    _optionContextReuseMode: options.reuseContext ? 'when-possible' : undefined,
    _optionConnectOptions: options.connectWsEndpoint ? { wsEndpoint: options.connectWsEndpoint } : undefined,
  };

  const reporter = new InternalReporter(new Multiplexer(await createReporters(config, 'run')));
  const taskRunner = createTaskRunnerForWatch(config, reporter);
  const testRun = new TestRun(config, reporter);
  reporter.onConfigure(config.config);
  const stop = new ManualPromise();
  const status = await taskRunner.run(testRun, 0, stop);
  await reporter.onEnd({ status });
  await reporter.onExit();
}
