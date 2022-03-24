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
import net from 'net';
import debug from 'debug';
import { raceAgainstTimeout } from 'playwright-core/lib/utils/async';
import { WebServerConfig } from './types';
import { launchProcess } from 'playwright-core/lib/utils/processLauncher';
import { Reporter } from '../types/testReporter';

const DEFAULT_ENVIRONMENT_VARIABLES = {
  'BROWSER': 'none', // Disable that create-react-app will open the page in the browser
};

const debugWebServer = debug('pw:webserver');

export class WebServer {
  private _isAvailable: () => Promise<boolean>;
  private _killProcess?: () => Promise<void>;
  private _processExitedPromise!: Promise<any>;

  constructor(private readonly config: WebServerConfig, private readonly reporter: Reporter) {
    this._isAvailable = getIsAvailableFunction(config, reporter.onStdErr?.bind(reporter));
  }

  public static async create(config: WebServerConfig, reporter: Reporter): Promise<WebServer> {
    const webServer = new WebServer(config, reporter);
    try {
      await webServer._startProcess();
      await webServer._waitForProcess();
      return webServer;
    } catch (error) {
      await webServer.kill();
      throw error;
    }
  }

  private async _startProcess(): Promise<void> {
    let processExitedReject = (error: Error) => { };
    this._processExitedPromise = new Promise((_, reject) => processExitedReject = reject);

    const isAlreadyAvailable = await this._isAvailable();
    if (isAlreadyAvailable) {
      if (this.config.reuseExistingServer)
        return;
      throw new Error(`${this.config.url ?? `http://localhost:${this.config.port}`} is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.`);
    }

    const { launchedProcess, kill } = await launchProcess({
      command: this.config.command,
      env: {
        ...DEFAULT_ENVIRONMENT_VARIABLES,
        ...process.env,
        ...this.config.env,
      },
      cwd: this.config.cwd,
      stdio: 'stdin',
      shell: true,
      attemptToGracefullyClose: async () => {},
      log: () => {},
      onExit: code => processExitedReject(new Error(`Process from config.webServer was not able to start. Exit code: ${code}`)),
      tempDirectories: [],
    });
    this._killProcess = kill;

    launchedProcess.stderr!.on('data', line => this.reporter.onStdErr?.('[WebServer] ' + line.toString()));
    launchedProcess.stdout!.on('data', line => {
      if (debugWebServer.enabled)
        this.reporter.onStdOut?.('[WebServer] ' + line.toString());
    });
  }

  private async _waitForProcess() {
    await this._waitForAvailability();
    if (this.config.port !== undefined)
      process.env.PLAYWRIGHT_TEST_BASE_URL = `http://localhost:${this.config.port}`;
  }

  private async _waitForAvailability() {
    const launchTimeout = this.config.timeout || 60 * 1000;
    const cancellationToken = { canceled: false };
    const { timedOut } = (await Promise.race([
      raceAgainstTimeout(() => waitFor(this._isAvailable, 100, cancellationToken), launchTimeout),
      this._processExitedPromise,
    ]));
    cancellationToken.canceled = true;
    if (timedOut)
      throw new Error(`Timed out waiting ${launchTimeout}ms from config.webServer.`);
  }
  public async kill() {
    await this._killProcess?.();
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
  const isHttps = url.protocol === 'https:';
  const requestOptions = isHttps ? {
    rejectUnauthorized: !ignoreHTTPSErrors,
  } : {};
  return new Promise<boolean>(resolve => {
    (isHttps ? https : http).get(url, requestOptions, res => {
      res.resume();
      const statusCode = res.statusCode ?? 0;
      resolve(statusCode >= 200 && statusCode < 300);
    }).on('error', error => {
      if ((error as NodeJS.ErrnoException).code === 'DEPTH_ZERO_SELF_SIGNED_CERT')
        onStdErr?.(`[WebServer] Self-signed certificate detected. Try adding ignoreHTTPSErrors: true to config.webServer.`);
      else
        debugWebServer(`Error while checking if ${url} is available: ${error.message}`);
      resolve(false);
    });
  });
}

async function waitFor(waitFn: () => Promise<boolean>, delay: number, cancellationToken: { canceled: boolean }) {
  while (!cancellationToken.canceled) {
    const connected = await waitFn();
    if (connected)
      return;
    await new Promise(x => setTimeout(x, delay));
  }
}

function getIsAvailableFunction({ url, port, ignoreHTTPSErrors }: Pick<WebServerConfig, 'port' | 'url' | 'ignoreHTTPSErrors'>, onStdErr: Reporter['onStdErr']) {
  if (url !== undefined && port === undefined) {
    const urlObject = new URL(url);
    return () => isURLAvailable(urlObject, ignoreHTTPSErrors, onStdErr);
  } else if (port !== undefined && url === undefined) {
    return () => isPortUsed(port);
  } else {
    throw new Error(`Exactly one of 'port' or 'url' is required in config.webServer.`);
  }
}
