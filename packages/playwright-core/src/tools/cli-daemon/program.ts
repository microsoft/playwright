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
import os from 'os';
import path from 'path';

import { startCliDaemonServer } from './daemon';
import { setupExitWatchdog } from '../mcp/watchdog';
import { createBrowserWithInfo } from '../mcp/browserFactory';
import * as configUtils from '../mcp/config';
import { ClientInfo, createClientInfo } from '../cli-client/registry';
import { program } from '../../utilsBundle';
import { registry as browserRegistry } from '../../server/registry/index';

import type { FullConfig } from '../mcp/config';

program.argument('[session-name]', 'name of the session to create or connect to', 'default')
    .option('--headed', 'run in headed mode (non-headless)')
    .option('--extension', 'run with the extension')
    .option('--browser <name>', 'browser to use (chromium, chrome, firefox, webkit)')
    .option('--persistent', 'use a persistent browser context')
    .option('--profile <path>', 'path to the user data dir')
    .option('--config <path>', 'path to the config file; by default uses .playwright/cli.config.json in the project directory and ~/.playwright/cli.config.json as global config')
    .option('--attach <name-or-endpoint>', 'attach to a running Playwright browser by name or endpoint')
    .option('--init-workspace [value]', 'initialize workspace; pass "skills" to also install Claude skills')

    .action(async (sessionName: string, options: any) => {
      if (options.initWorkspace !== undefined) {
        await initWorkspace(options.initWorkspace === 'skills');
        return;
      }

      setupExitWatchdog();
      const clientInfo = createClientInfo();
      const mcpConfig = await resolveCLIConfig(clientInfo, sessionName, options);
      const clientInfoEx = {
        cwd: process.cwd(),
        sessionName,
        workspaceDir: clientInfo.workspaceDir,
      };

      try {
        const { browser, browserInfo } = await createBrowserWithInfo(mcpConfig, clientInfoEx);
        const browserContext = mcpConfig.browser.isolated ? await browser.newContext(mcpConfig.browser.contextOptions) : browser.contexts()[0];
        if (!browserContext)
          throw new Error('Error: unable to connect to a browser that does not have any contexts');
        const persistent = options.persistent || options.profile || mcpConfig.browser.userDataDir ? true : undefined;
        const socketPath = await startCliDaemonServer(sessionName, browserContext, browserInfo, mcpConfig, clientInfo, { persistent, exitOnClose: true });
        console.log(`### Success\nDaemon listening on ${socketPath}`);
        console.log('<EOF>');
      } catch (error) {
        const message = process.env.PWDEBUGIMPL ? (error as Error).stack || (error as Error).message : (error as Error).message;
        console.log(`### Error\n${message}`);
        console.log('<EOF>');
      }
    });

void program.parseAsync();

function defaultConfigFile(): string {
  return path.resolve('.playwright', 'cli.config.json');
}

function globalConfigFile(): string {
  return path.join(os.homedir(), '.playwright', 'cli.config.json');
}

export async function resolveCLIConfig(clientInfo: ClientInfo, sessionName: string, options: any): Promise<FullConfig> {
  const config = options.config ? path.resolve(options.config) : undefined;
  try {
    if (!config && fs.existsSync(defaultConfigFile()))
      options.config = defaultConfigFile();
  } catch {
  }

  const daemonOverrides = configUtils.configFromCLIOptions({
    config: options.config,
    browser: options.browser,
    headless: options.headed ? false : undefined,
    extension: options.extension,
    userDataDir: options.profile,
    snapshotMode: 'full',
  });
  daemonOverrides.browser!.remoteEndpoint = options.attach;

  const envOverrides = configUtils.configFromEnv();
  const configFile = envOverrides.configFile ?? daemonOverrides.configFile;
  const configInFile = await configUtils.loadConfig(configFile);
  const globalConfigPath = fs.existsSync(globalConfigFile()) ? globalConfigFile() : undefined;
  const globalConfigInFile = await configUtils.loadConfig(globalConfigPath);

  let result = configUtils.mergeConfig(configUtils.defaultConfig, {
    browser: {
      launchOptions: {
        headless: true,
      }
    }
  });

  result = configUtils.mergeConfig(result, globalConfigInFile);
  result = configUtils.mergeConfig(result, configInFile);
  result = configUtils.mergeConfig(result, daemonOverrides);
  result = configUtils.mergeConfig(result, envOverrides);

  if (result.browser.isolated === undefined)
    result.browser.isolated = !options.profile && !options.persistent && !result.browser.userDataDir && !result.browser.remoteEndpoint && !result.extension;

  if (!result.extension && !result.browser.isolated && !result.browser.userDataDir && !result.browser.remoteEndpoint) {
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

async function initWorkspace(installSkills: boolean) {
  const cwd = process.cwd();
  const playwrightDir = path.join(cwd, '.playwright');
  await fs.promises.mkdir(playwrightDir, { recursive: true });
  console.log(`✅ Workspace initialized at \`${cwd}\`.`);

  if (installSkills) {
    const skillSourceDir = path.join(__dirname, '../cli-client/skill');
    const skillDestDir = path.join(cwd, '.claude', 'skills', 'playwright-cli');
    if (!fs.existsSync(skillSourceDir)) {
      console.error('❌ Skills source directory not found:', skillSourceDir);
      // eslint-disable-next-line no-restricted-properties
      process.exit(1);
    }
    await fs.promises.cp(skillSourceDir, skillDestDir, { recursive: true });
    console.log(`✅ Skills installed to \`${path.relative(cwd, skillDestDir)}\`.`);
  }

  await ensureConfiguredBrowserInstalled();
}

async function ensureConfiguredBrowserInstalled() {
  if (fs.existsSync(defaultConfigFile()) || fs.existsSync(globalConfigFile())) {
    // Config exists, ensure configured browser is installed
    const clientInfo = createClientInfo();
    const config = await resolveCLIConfig(clientInfo, 'default', {});
    const browserName = config.browser.browserName;
    const channel = config.browser.launchOptions.channel;
    if (!channel || channel.startsWith('chromium')) {
      const executable = browserRegistry.findExecutable(channel ?? browserName);
      if (executable && !fs.existsSync(executable.executablePath()!))
        await browserRegistry.install([executable]);
    }
  } else {
    const channel = await findOrInstallDefaultBrowser();
    if (channel !== 'chrome')
      await createDefaultConfig(channel);
  }
}

async function findOrInstallDefaultBrowser() {
  const channels = ['chrome', 'msedge'];
  for (const channel of channels) {
    const executable = browserRegistry.findExecutable(channel);
    if (!executable?.executablePath())
      continue;
    console.log(`✅ Found ${channel}, will use it as the default browser.`);
    return channel;
  }
  const chromiumExecutable = browserRegistry.findExecutable('chromium');
  if (!fs.existsSync(chromiumExecutable?.executablePath()!))
    await browserRegistry.install([chromiumExecutable]);
  return 'chromium';
}

async function createDefaultConfig(channel: string) {
  const config = {
    browser: {
      browserName: 'chromium',
      launchOptions: { channel },
    },
  };
  await fs.promises.writeFile(defaultConfigFile(), JSON.stringify(config, null, 2));
  console.log(`✅ Created default config for ${channel} at ${path.relative(process.cwd(), defaultConfigFile())}.`);
}
