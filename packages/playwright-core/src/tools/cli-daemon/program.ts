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

import { getAsBooleanFromENV } from '@utils/env';
import { libPath } from '../../package';
import { startCliDaemonServer } from './daemon';
import { setupExitWatchdog } from '../mcp/watchdog';
import { createBrowserWithInfo } from '../mcp/browserFactory';
import * as configUtils from '../mcp/config';
import { createClientInfo } from '../cli-client/registry';
import { guessClientName } from '../cli-client/utils';
import { registry as browserRegistry } from '../../server/registry/index';
import type { Command } from 'commander';

export function decorateProgram(program: Command) {
  program.argument('[session-name]', 'name of the session to create or connect to', 'default')
      .option('--headed', 'run in headed mode (non-headless)')
      .option('--extension', 'run with the extension')
      .option('--browser <name>', 'browser to use (chromium, chrome, firefox, webkit)')
      .option('--persistent', 'use a persistent browser context')
      .option('--profile <path>', 'path to the user data dir')
      .option('--config <path>', 'path to the config file; by default uses .playwright/cli.config.json in the project directory and ~/.playwright/cli.config.json as global config')
      .option('--cdp <url>', 'connect to an existing browser via CDP endpoint URL')
      .option('--endpoint <endpoint>', 'attach to a running Playwright browser endpoint')
      .option('--init-workspace', 'initialize workspace')
      .option('--init-skills <value>', 'install skills for the given agent type ("claude" or "agents")')

      .action(async (sessionName: string, options: any) => {
        if (options.initWorkspace) {
          await initWorkspace(options.initSkills);
          return;
        }

        setupExitWatchdog();
        const clientInfo = createClientInfo();
        const mcpConfig = await configUtils.resolveCLIConfigForCLI(clientInfo.daemonProfilesDir, sessionName, options);
        const mcpClientInfo = {
          cwd: process.cwd(),
          clientName: guessClientName(),
        };

        try {
          const { browser, browserInfo, canBind, ownership } = await createBrowserWithInfo(mcpConfig, mcpClientInfo);
          if (canBind)
            await browser.bind(sessionName, { workspaceDir: clientInfo.workspaceDir });
          const browserContext = mcpConfig.browser.isolated ? await browser.newContext(mcpConfig.browser.contextOptions) : browser.contexts()[0];
          if (!browserContext)
            throw new Error('Error: unable to connect to a browser that does not have any contexts');
          const persistent = options.persistent || options.profile || mcpConfig.browser.userDataDir ? true : undefined;
          const socketPath = await startCliDaemonServer(sessionName, browserContext, browserInfo, mcpConfig, clientInfo, mcpClientInfo, { persistent, exitOnClose: true, ownership });
          console.log(`### Success\nDaemon listening on ${socketPath}`);
          console.log('<EOF>');
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

function globalConfigFile(): string {
  return path.join(process.env['PWTEST_CLI_GLOBAL_CONFIG'] ?? os.homedir(), '.playwright', 'cli.config.json');
}

async function initWorkspace(initSkills: string | undefined) {
  const cwd = process.cwd();
  const playwrightDir = path.join(cwd, '.playwright');
  await fs.promises.mkdir(playwrightDir, { recursive: true });
  console.log(`✅ Workspace initialized at \`${cwd}\`.`);

  if (initSkills) {
    const skillSourceDir = libPath('tools', 'cli-client', 'skill');
    const target = initSkills === 'agents' ? 'agents' : 'claude';
    const skillDestDir = path.join(cwd, `.${target}`, 'skills', 'playwright-cli');
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
  if (getAsBooleanFromENV('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD'))
    return;
  if (fs.existsSync(defaultConfigFile()) || fs.existsSync(globalConfigFile())) {
    // Config exists, ensure configured browser is installed
    const clientInfo = createClientInfo();
    const config = await configUtils.resolveCLIConfigForCLI(clientInfo.daemonProfilesDir, 'default', {});
    const browserName = config.browser.browserName;
    const channel = config.browser.launchOptions.channel;
    if (!channel || channel.startsWith('chromium'))
      await resolveAndInstall(channel ?? browserName);
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
    await resolveAndInstall('ffmpeg');
    console.log(`✅ Found ${channel}, will use it as the default browser.`);
    return channel;
  }
  await resolveAndInstall('chromium');
  return 'chromium';
}

async function resolveAndInstall(nameOrChannel: string) {
  const executables = browserRegistry.resolveBrowsers([nameOrChannel], { shell: 'no' });
  await browserRegistry.install(executables);
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
