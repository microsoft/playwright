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

/* eslint-disable no-console */

import fs from 'fs';
import path from 'path';

import { startCliDaemonServer } from './daemon';
import { setupExitWatchdog } from '../../mcp/watchdog';
import { createBrowser } from '../../mcp/browserFactory';
import * as configUtils from '../../mcp/config';
import { ClientInfo, createClientInfo } from '../client/registry';

import type { Command } from '../../utilsBundle';
import type { FullConfig } from '../../mcp/config';

export function decorateCLICommand(command: Command, version: string) {
  command
      .version(version)
      .argument('[session-name]', 'name of the session to create or connect to', 'default')
      .option('--headed', 'run in headed mode (non-headless)')
      .option('--extension', 'run with the extension')
      .option('--browser <name>', 'browser to use (chromium, chrome, firefox, webkit)')
      .option('--persistent', 'use a persistent browser context')
      .option('--profile <path>', 'path to the user data dir')
      .option('--config <path>', 'path to the config file')
      .option('--attach <name-or-endpoint>', 'attach to a running Playwright browser by name or endpoint')

      .action(async (sessionName: string, options: any) => {
        setupExitWatchdog();
        const clientInfo = createClientInfo();
        const mcpConfig = await resolveCLIConfig(clientInfo, sessionName, options);
        const mcpClientInfo = { cwd: process.cwd() };

        try {
          const browser = await createBrowser(mcpConfig, mcpClientInfo);
          const browserContext = mcpConfig.browser.isolated ? await browser.newContext(mcpConfig.browser.contextOptions) : browser.contexts()[0];
          const socketPath = await startCliDaemonServer(sessionName, browserContext, mcpConfig, clientInfo, { ...options, exitOnClose: true });
          console.log(`### Success\nDaemon listening on ${socketPath}`);
          console.log('<EOF>');
          // TODO: pass workspaceDir.
          await (browser as any)._startServer(sessionName);
          browserContext.on('close', () => (browser as any)._stopServer().catch(() => {}));
        } catch (error) {
          const message = process.env.PWDEBUGIMPL ? (error as Error).stack || (error as Error).message : (error as Error).message;
          console.log(`### Error\n${message}`);
          console.log('<EOF>');
        }
      });
}

function defaultConfigFile(): string {
  return path.resolve('.playwright', 'cli.config.json');
}

export async function resolveCLIConfig(clientInfo: ClientInfo, sessionName: string, options: any): Promise<FullConfig> {
  const config = options.config ? path.resolve(options.config) : undefined;
  try {
    if (!config && fs.existsSync(defaultConfigFile()))
      options.config = defaultConfigFile();
  } catch {
  }

  if (!options.persistent && options.profile)
    options.persistent = true;

  const daemonOverrides = configUtils.configFromCLIOptions({
    config: options.config,
    browser: options.browser,
    isolated: options.persistent === true ? false : undefined,
    headless: options.headed ? false : undefined,
    extension: options.extension,
    userDataDir: options.profile,
    outputMode: 'file',
    snapshotMode: 'full',
  });
  daemonOverrides.browser!.remoteEndpoint = options.attach;

  const envOverrides = configUtils.configFromEnv();
  const configFile = envOverrides.configFile ?? daemonOverrides.configFile;
  const configInFile = await configUtils.loadConfig(configFile);

  let result = configUtils.mergeConfig(configUtils.defaultConfig, {
    browser: {
      launchOptions: {
        headless: true,
      },
      isolated: true,
    }
  });

  result = configUtils.mergeConfig(result, configInFile);
  result = configUtils.mergeConfig(result, daemonOverrides);
  result = configUtils.mergeConfig(result, envOverrides);

  if (!result.extension && !result.browser.userDataDir) {
    // No custom value provided, use the daemon data dir.
    const browserToken = result.browser.launchOptions?.channel ?? result.browser?.browserName;
    const userDataDir = path.resolve(clientInfo.daemonProfilesDir, `ud-${sessionName}-${browserToken}`);
    result.browser.userDataDir = userDataDir;
  }

  result.configFile = configFile;
  result.skillMode = true;
  if (result.browser.launchOptions.headless !== false)
    result.browser.contextOptions.viewport ??= { width: 1280, height: 720 };

  await configUtils.validateConfig(result);

  return result;
}
