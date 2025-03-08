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
import net from 'net';
import path from 'path';

import { launchProcess, isURLAvailable, monotonicTime, raceAgainstDeadline } from 'playwright-core/lib/utils';
import { colors } from 'playwright-core/lib/utils';
import { debug } from 'playwright-core/lib/utilsBundle';

import type { TestRunnerPlugin } from '.';
import type { FullConfig } from '../../types/testReporter';
import type { FullConfigInternal } from '../common/config';
import type { ReporterV2 } from '../reporters/reporterV2';


export type WebServerPluginOptions = {
  command: string;
  url?: string;
  ignoreHTTPSErrors?: boolean;
  timeout?: number;
  gracefulShutdown?: { signal: 'SIGINT' | 'SIGTERM', timeout?: number };
  reuseExistingServer?: boolean;
  cwd?: string;
  env?: { [key: string]: string; };
  stdout?: 'pipe' | 'ignore';
  stderr?: 'pipe' | 'ignore';
  name?: string;
};

const DEFAULT_ENVIRONMENT_VARIABLES = {
  'BROWSER': 'none', // Disable that create-react-app will open the page in the browser
  'FORCE_COLOR': '1',
  'DEBUG_COLORS': '1',
};

const debugWebServer = debug('pw:webserver');

export class WebServerPlugin implements TestRunnerPlugin {
  private _isAvailableCallback?: () => Promise<boolean>;
  private _killProcess?: () => Promise<void>;
  private _processExitedPromise!: Promise<any>;
  private _options: WebServerPluginOptions;
  private _checkPortOnly: boolean;
  private _reporter?: ReporterV2;
  name = 'playwright:webserver';

  constructor(options: WebServerPluginOptions, checkPortOnly: boolean) {
    this._options = options;
    this._checkPortOnly = checkPortOnly;
  }

  public async setup(config: FullConfig, configDir: string, reporter: ReporterV2) {
    this._reporter = reporter;
    this._isAvailableCallback = this._options.url ? getIsAvailableFunction(this._options.url, this._checkPortOnly, !!this._options.ignoreHTTPSErrors, this._reporter.onStdErr?.bind(this._reporter)) : undefined;
    this._options.cwd = this._options.cwd ? path.resolve(configDir, this._options.cwd) : configDir;
    try {
      await this._startProcess();
      await this._waitForProcess();
    } catch (error) {
      await this.teardown();
      throw error;
    }
  }

  public async teardown() {
    debugWebServer(`Terminating the WebServer`);
    await this._killProcess?.();
    debugWebServer(`Terminated the WebServer`);
  }

  private async _startProcess(): Promise<void> {
    let processExitedReject = (error: Error) => { };
    this._processExitedPromise = new Promise((_, reject) => processExitedReject = reject);

    const isAlreadyAvailable = await this._isAvailableCallback?.();
    if (isAlreadyAvailable) {
      debugWebServer(`WebServer is already available`);
      if (this._options.reuseExistingServer)
        return;
      const port = new URL(this._options.url!).port;
      throw new Error(`${this._options.url ?? `http://localhost${port ? ':' + port : ''}`} is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.`);
    }

    debugWebServer(`Starting WebServer process ${this._options.command}...`);
    const { launchedProcess, gracefullyClose } = await launchProcess({
      command: this._options.command,
      env: {
        ...DEFAULT_ENVIRONMENT_VARIABLES,
        ...process.env,
        ...this._options.env,
      },
      cwd: this._options.cwd,
      stdio: 'stdin',
      shell: true,
      attemptToGracefullyClose: async () => {
        if (process.platform === 'win32')
          throw new Error('Graceful shutdown is not supported on Windows');
        if (!this._options.gracefulShutdown)
          throw new Error('skip graceful shutdown');

        const { signal, timeout = 0 } = this._options.gracefulShutdown;

        // proper usage of SIGINT is to send it to the entire process group, see https://www.cons.org/cracauer/sigint.html
        // there's no such convention for SIGTERM, so we decide what we want. signaling the process group for consistency.
        process.kill(-launchedProcess.pid!, signal);

        return new Promise<void>((resolve, reject) => {
          const timer = timeout !== 0
            ? setTimeout(() => reject(new Error(`process didn't close gracefully within timeout`)), timeout)
            : undefined;
          launchedProcess.once('close', (...args) => {
            clearTimeout(timer);
            resolve();
          });
        });
      },
      log: () => {},
      onExit: code => processExitedReject(new Error(code ? `Process from config.webServer was not able to start. Exit code: ${code}` : 'Process from config.webServer exited early.')),
      tempDirectories: [],
    });
    this._killProcess = gracefullyClose;

    debugWebServer(`Process started`);

    launchedProcess.stderr!.on('data', data => {
      if (debugWebServer.enabled || (this._options.stderr === 'pipe' || !this._options.stderr))
        this._reporter!.onStdErr?.(prefixOutputLines(data.toString(), this._options.name));
    });
    launchedProcess.stdout!.on('data', data => {
      if (debugWebServer.enabled || this._options.stdout === 'pipe')
        this._reporter!.onStdOut?.(prefixOutputLines(data.toString(), this._options.name));
    });
  }

  private async _waitForProcess() {
    if (!this._isAvailableCallback) {
      this._processExitedPromise.catch(() => {});
      return;
    }
    debugWebServer(`Waiting for availability...`);
    const launchTimeout = this._options.timeout || 60 * 1000;
    const cancellationToken = { canceled: false };
    const { timedOut } = (await Promise.race([
      raceAgainstDeadline(() => waitFor(this._isAvailableCallback!, cancellationToken), monotonicTime() + launchTimeout),
      this._processExitedPromise,
    ]));
    cancellationToken.canceled = true;
    if (timedOut)
      throw new Error(`Timed out waiting ${launchTimeout}ms from config.webServer.`);
    debugWebServer(`WebServer available`);
  }
}

async function isPortUsed(port: number): Promise<boolean> {
  const innerIsPortUsed = (host: string) => new Promise<boolean>(resolve => {
    const conn = net
        .connect(port, host)
        .on('error', () => {
          resolve(false);
        })
        .on('connect', () => {
          conn.end();
          resolve(true);
        });
  });
  return await innerIsPortUsed('127.0.0.1') || await innerIsPortUsed('::1');
}

async function waitFor(waitFn: () => Promise<boolean>, cancellationToken: { canceled: boolean }) {
  const logScale = [100, 250, 500];
  while (!cancellationToken.canceled) {
    const connected = await waitFn();
    if (connected)
      return;
    const delay = logScale.shift() || 1000;
    debugWebServer(`Waiting ${delay}ms`);
    await new Promise(x => setTimeout(x, delay));
  }
}

function getIsAvailableFunction(url: string, checkPortOnly: boolean, ignoreHTTPSErrors: boolean, onStdErr: ReporterV2['onStdErr']) {
  const urlObject = new URL(url);
  if (!checkPortOnly)
    return () => isURLAvailable(urlObject, ignoreHTTPSErrors, debugWebServer, onStdErr);
  const port = urlObject.port;
  return () => isPortUsed(+port);
}

export const webServer = (options: WebServerPluginOptions): TestRunnerPlugin => {
  return new WebServerPlugin(options, false);
};

export const webServerPluginsForConfig = (config: FullConfigInternal): TestRunnerPlugin[] => {
  const shouldSetBaseUrl = !!config.config.webServer;
  const webServerPlugins = [];
  for (const webServerConfig of config.webServers) {
    if (webServerConfig.port && webServerConfig.url)
      throw new Error(`Either 'port' or 'url' should be specified in config.webServer.`);

    let url: string | undefined;
    if (webServerConfig.port || webServerConfig.url) {
      url = webServerConfig.url || `http://localhost:${webServerConfig.port}`;

      // We only set base url when only the port is given. That's a legacy mode we have regrets about.
      if (shouldSetBaseUrl && !webServerConfig.url)
        process.env.PLAYWRIGHT_TEST_BASE_URL = url;
    }
    webServerPlugins.push(new WebServerPlugin({ ...webServerConfig,  url }, webServerConfig.port !== undefined));
  }

  return webServerPlugins;
};

function prefixOutputLines(output: string, prefixName: string = 'WebServer'): string {
  const lastIsNewLine = output[output.length - 1] === '\n';
  let lines = output.split('\n');
  if (lastIsNewLine)
    lines.pop();
  lines = lines.map(line => colors.dim(`[${prefixName}] `) + line);
  if (lastIsNewLine)
    lines.push('');
  return lines.join('\n');
}
