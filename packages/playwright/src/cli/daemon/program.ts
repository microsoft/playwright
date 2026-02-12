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

import { startMcpDaemonServer } from './daemon';
import { setupExitWatchdog } from '../../mcp/browser/watchdog';
import { contextFactory } from '../../mcp/browser/browserContextFactory';
import { ExtensionContextFactory } from '../../mcp/extension/extensionContextFactory';
import { configFromCLIOptions, configFromEnv, defaultConfig, loadConfig, mergeConfig, validateConfig } from '../../mcp/browser/config';

import type { Command } from 'playwright-core/lib/utilsBundle';
import type { SessionConfig } from '../client/registry';
import type { FullConfig } from '../../mcp/browser/config';

export function decorateCLICommand(command: Command, version: string) {
  command
      .version(version)
      .option('--daemon-session <path>', 'path to the daemon config.')
      .action(async options => {
        // normalize the --no-chromium-sandbox option: chromiumSandbox = true => nothing was passed, chromiumSandbox = false => --no-chromium-sandbox was passed.
        options.chromiumSandbox = options.chromiumSandbox === true ? undefined : false;
        setupExitWatchdog();

        const config = await resolveCLIConfig(options.daemonSession);
        const browserContextFactory = contextFactory(config);
        const extensionContextFactory = new ExtensionContextFactory(config.browser.launchOptions.channel || 'chrome', config.browser.userDataDir, config.browser.launchOptions.executablePath);

        const cf = config.extension ? extensionContextFactory : browserContextFactory;
        try {
          const socketPath = await startMcpDaemonServer(config, cf);
          console.log(`### Config`);
          console.log('```json');
          console.log(JSON.stringify(config, null, 2));
          console.log('```');
          console.log(`### Success\nDaemon listening on ${socketPath}`);
          console.log('<EOF>');
        } catch (error) {
          const message = process.env.PWDEBUGIMPL ? (error as Error).stack || (error as Error).message : (error as Error).message;
          console.log(`### Error\n${message}`);
          console.log('<EOF>');
        }
      });
}

export async function resolveCLIConfig(daemonSession: string): Promise<FullConfig> {
  const sessionConfig = await fs.promises.readFile(daemonSession, 'utf-8').then(data => JSON.parse(data) as SessionConfig);
  const daemonOverrides = configFromCLIOptions({
    config: sessionConfig.cli.config,
    browser: sessionConfig.cli.browser,
    isolated: sessionConfig.cli.persistent === true ? false : undefined,
    headless: sessionConfig.cli.headed ? false : undefined,
    extension: sessionConfig.cli.extension,
    userDataDir: sessionConfig.cli.profile,
    outputMode: 'file',
    snapshotMode: 'full',
  });

  const envOverrides = configFromEnv();
  const configFile = envOverrides.configFile ?? daemonOverrides.configFile;
  const configInFile = await loadConfig(configFile);

  let result = mergeConfig(defaultConfig, {
    browser: {
      launchOptions: {
        headless: true,
      },
      isolated: true,
    }
  });

  result = mergeConfig(result, configInFile);
  result = mergeConfig(result, daemonOverrides);
  result = mergeConfig(result, envOverrides);

  if (!result.extension && !result.browser.userDataDir && sessionConfig.userDataDirPrefix) {
    // No custom value provided, use the daemon data dir.
    const browserToken = result.browser.launchOptions?.channel ?? result.browser?.browserName;
    const userDataDir = `${sessionConfig.userDataDirPrefix}-${browserToken}`;
    result.browser.userDataDir = userDataDir;
  }

  result.configFile = configFile;
  result.sessionConfig = sessionConfig;
  result.skillMode = true;
  if (result.sessionConfig && result.browser.launchOptions.headless !== false)
    result.browser.contextOptions.viewport ??= { width: 1280, height: 720 };

  await validateConfig(result);

  return result;
}
