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
import type { Reporter } from '../reporter';
import type { FullConfigInternal, GlobalInfo, TestPlugin, WebServerConfig } from './types';
import { WebServer } from './webServer';

class AttachmentReporter implements Reporter {
  private _stdout: string = '';
  private _stderr: string = '';
  private _info: () => GlobalInfo;
  private _options?: LoggingOptions;

  constructor(info: () => GlobalInfo, options?: LoggingOptions) {
    this._info = info;
    this._options = options;
  }

  onStdOut(chunk: string | Buffer) {
    if (this._options?.forwardToConsole) {
      // eslint-disable-next-line no-console
      console.log(chunk);
    }
    if (this._options?.attachToReport)
      this._stdout += chunk.toString();
  }

  onStdErr(chunk: string | Buffer) {
    if (this._options?.forwardToConsole) {
      // eslint-disable-next-line no-console
      console.error(chunk);
    }
    if (this._options?.attachToReport)
      this._stderr += chunk.toString();
  }

  async onEnd() {
    if (this._options?.attachToReport) {
      await Promise.all([
        this._info().attach('web-server.stdout.txt', { body: this._stdout }),
        this._info().attach('web-server.stderr.txt', { body: this._stderr }),
      ]);
    }
  }
}

export interface LoggingOptions {
  forwardToConsole?: boolean,
  attachToReport?: boolean,
}

export interface WebServerPluginConfig extends WebServerConfig {
  logging?: LoggingOptions;
}

export class WebServerPlugin implements TestPlugin {
  private _config: WebServerPluginConfig;
  private _server?: WebServer;

  constructor(config: WebServerPluginConfig) {
    this._config = { ...config, env: {
      ...config?.env,
      // Force the built-in webserver to output logs since the plugin manages the output itself
      DEBUG: `pw:webserver${config?.env?.DEBUG ? ',' + config?.env?.DEBUG : ''}`
    } };
  }

  async globalSetup(_config: FullConfigInternal, info: GlobalInfo) {
    this._server = await WebServer.create(this._config, new AttachmentReporter(() => info, this._config.logging));
  }

  async globalTeardown() {
    await this._server?.kill();
  }
}

export const webServer = (config: WebServerConfig) => new WebServerPlugin(config);
