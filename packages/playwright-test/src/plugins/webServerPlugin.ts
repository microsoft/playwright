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
import http from 'http';
import https from 'https';
import path from 'path';
import net from 'net';

import { debug } from 'playwright-core/lib/utilsBundle';
import { raceAgainstTimeout } from 'playwright-core/lib/utils/timeoutRunner';
import { launchProcess } from 'playwright-core/lib/utils/processLauncher';

import type { PlaywrightTestConfig, TestPlugin } from '../types';
import type { Reporter } from '../../types/testReporter';

export type WebServerPluginOptions = {
  command: string;
  url: string;
  ignoreHTTPSErrors?: boolean;
  timeout?: number;
  reuseExistingServer?: boolean;
  cwd?: string;
  env?: { [key: string]: string; };
};

interface InternalWebServerConfigOptions extends Omit<WebServerPluginOptions, 'url'> {
  setBaseURL: boolean;
  url?: string;
  port?: number;
}

const DEFAULT_ENVIRONMENT_VARIABLES = {
  'BROWSER': 'none', // Disable that create-react-app will open the page in the browser
};

const debugWebServer = debug('pw:webserver');

export class InternalWebServerPlugin implements TestPlugin {
  private _isAvailable: () => Promise<boolean>;
  private _killProcess?: () => Promise<void>;
  private _processExitedPromise!: Promise<any>;
  private _config: InternalWebServerConfigOptions;
  private _reporter: Reporter;

  constructor(config: InternalWebServerConfigOptions, reporter: Reporter) {
    this._reporter = reporter;
    this._config = { ...config };
    this._config.setBaseURL = this._config.setBaseURL ?? true;
    this._isAvailable = getIsAvailableFunction(config, this._reporter.onStdErr?.bind(this._reporter));
  }

  get name() {
    const target = this._config.url || `http://localhost:${this._config.port}`;
    return `playwright:webserver [${target}]`;
  }

  public async configure(config: PlaywrightTestConfig, configDir: string) {
    this._config.cwd = this._config.cwd ? path.resolve(configDir, this._config.cwd) : configDir;
    if (this._config.setBaseURL && this._config.port !== undefined && !config.use?.baseURL) {
      config.use = (config.use || {});
      config.use.baseURL = `http://localhost:${this._config.port}`;
    }
  }

  public async setup() {
    try {
      await this._startProcess();
      await this._waitForProcess();
    } catch (error) {
      await this.teardown();
      throw error;
    }
  }

  public async teardown() {
    await this._killProcess?.();
  }

  private async _startProcess(): Promise<void> {
    let processExitedReject = (error: Error) => { };
    this._processExitedPromise = new Promise((_, reject) => processExitedReject = reject);

    const isAlreadyAvailable = await this._isAvailable();
    if (isAlreadyAvailable) {
      debugWebServer(`WebServer is already available`);
      if (this._config.reuseExistingServer)
        return;
      throw new Error(`${this._config.url ?? `http://localhost:${this._config.port}`} is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.`);
    }

    debugWebServer(`Starting WebServer process ${this._config.command}...`);
    const { launchedProcess, kill } = await launchProcess({
      command: this._config.command,
      env: {
        ...DEFAULT_ENVIRONMENT_VARIABLES,
        ...process.env,
        ...this._config.env,
      },
      cwd: this._config.cwd,
      stdio: 'stdin',
      shell: true,
      attemptToGracefullyClose: async () => {},
      log: () => {},
      onExit: code => processExitedReject(new Error(`Process from config.webServer was not able to start. Exit code: ${code}`)),
      tempDirectories: [],
    });
    this._killProcess = kill;

    debugWebServer(`Process started`);

    launchedProcess.stderr!.on('data', line => this._reporter.onStdErr?.('[WebServer] ' + line.toString()));
    launchedProcess.stdout!.on('data', line => {
      if (debugWebServer.enabled)
        this._reporter.onStdOut?.('[WebServer] ' + line.toString());
    });
  }

  private async _waitForProcess() {
    debugWebServer(`Waiting for availability...`);
    await this._waitForAvailability();
    debugWebServer(`WebServer available`);
  }

  private async _waitForAvailability() {
    const launchTimeout = this._config.timeout || 60 * 1000;
    const cancellationToken = { canceled: false };
    const { timedOut } = (await Promise.race([
      raceAgainstTimeout(() => waitFor(this._isAvailable, cancellationToken), launchTimeout),
      this._processExitedPromise,
    ]));
    cancellationToken.canceled = true;
    if (timedOut)
      throw new Error(`Timed out waiting ${launchTimeout}ms from config.webServer.`);
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

async function isURLAvailable(url: URL, ignoreHTTPSErrors: boolean | undefined, onStdErr: Reporter['onStdErr']) {
  let statusCode = await httpStatusCode(url, ignoreHTTPSErrors, onStdErr);
  if (statusCode === 404 && url.pathname === '/') {
    const indexUrl = new URL(url);
    indexUrl.pathname = '/index.html';
    statusCode = await httpStatusCode(indexUrl, ignoreHTTPSErrors, onStdErr);
  }
  return statusCode >= 200 && statusCode < 300;
}

async function httpStatusCode(url: URL, ignoreHTTPSErrors: boolean | undefined, onStdErr: Reporter['onStdErr']): Promise<number> {
  const isHttps = url.protocol === 'https:';
  const requestOptions = isHttps ? {
    rejectUnauthorized: !ignoreHTTPSErrors,
  } : {};
  return new Promise(resolve => {
    debugWebServer(`HTTP GET: ${url}`);
    (isHttps ? https : http).get(url, requestOptions, res => {
      res.resume();
      const statusCode = res.statusCode ?? 0;
      debugWebServer(`HTTP Status: ${statusCode}`);
      resolve(statusCode);
    }).on('error', error => {
      if ((error as NodeJS.ErrnoException).code === 'DEPTH_ZERO_SELF_SIGNED_CERT')
        onStdErr?.(`[WebServer] Self-signed certificate detected. Try adding ignoreHTTPSErrors: true to config.webServer.`);
      debugWebServer(`Error while checking if ${url} is available: ${error.message}`);
      resolve(0);
    });
  });
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

function getIsAvailableFunction({ url, port, ignoreHTTPSErrors }: Pick<InternalWebServerConfigOptions, 'port' | 'url' | 'ignoreHTTPSErrors'>, onStdErr: Reporter['onStdErr']) {
  if (url !== undefined && port === undefined) {
    const urlObject = new URL(url);
    return () => isURLAvailable(urlObject, ignoreHTTPSErrors, onStdErr);
  } else if (port !== undefined && url === undefined) {
    return () => isPortUsed(port);
  } else {
    throw new Error(`Exactly one of 'port' or 'url' is required in config.webServer.`);
  }
}

export const webServer = (config: WebServerPluginOptions): TestPlugin => {
  // eslint-disable-next-line no-console
  return new InternalWebServerPlugin({ ...config, setBaseURL: false }, { onStdOut: d => console.log(d.toString()), onStdErr: d => console.error(d.toString()) });
};

export const _legacyWebServer = (config: Omit<InternalWebServerConfigOptions, 'setBaseURL'>): TestPlugin => {
  // eslint-disable-next-line no-console
  return new InternalWebServerPlugin({ ...config, setBaseURL: true }, { onStdOut: d => console.log(d.toString()), onStdErr: d => console.error(d.toString()) });
};
