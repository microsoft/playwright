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

import { ProgramOption } from 'playwright-core/lib/utilsBundle';
import * as mcpServer from './sdk/server';
import { commaSeparatedList, dotenvFileLoader, headerParser, numberParser, resolveCLIConfig, semicolonSeparatedList } from './browser/config';
import { Context } from './browser/context';
import { contextFactory } from './browser/browserContextFactory';
import { ProxyBackend } from './sdk/proxyBackend';
import { BrowserServerBackend } from './browser/browserServerBackend';
import { ExtensionContextFactory } from './extension/extensionContextFactory';
import { runVSCodeTools } from './vscode/host';

import type { Command } from 'playwright-core/lib/utilsBundle';
import type { MCPProvider } from './sdk/proxyBackend';

export function decorateCommand(command: Command, version: string) {
  command.option('--allowed-origins <origins>', 'semicolon-separated list of origins to allow the browser to request. Default is to allow all.', semicolonSeparatedList)
      .option('--blocked-origins <origins>', 'semicolon-separated list of origins to block the browser from requesting. Blocklist is evaluated before allowlist. If used without the allowlist, requests not matching the blocklist are still allowed.', semicolonSeparatedList)
      .option('--block-service-workers', 'block service workers')
      .option('--browser <browser>', 'browser or chrome channel to use, possible values: chrome, firefox, webkit, msedge.')
      .option('--caps <caps>', 'comma-separated list of additional capabilities to enable, possible values: vision, pdf.', commaSeparatedList)
      .option('--cdp-endpoint <endpoint>', 'CDP endpoint to connect to.')
      .option('--cdp-header <headers...>', 'CDP headers to send with the connect request, multiple can be specified.', headerParser)
      .option('--config <path>', 'path to the configuration file.')
      .option('--device <device>', 'device to emulate, for example: "iPhone 15"')
      .option('--executable-path <path>', 'path to the browser executable.')
      .option('--extension', 'Connect to a running browser instance (Edge/Chrome only). Requires the "Playwright MCP Bridge" browser extension to be installed.')
      .option('--headless', 'run browser in headless mode, headed by default')
      .option('--host <host>', 'host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.')
      .option('--ignore-https-errors', 'ignore https errors')
      .option('--isolated', 'keep the browser profile in memory, do not save it to disk.')
      .option('--image-responses <mode>', 'whether to send image responses to the client. Can be "allow" or "omit", Defaults to "allow".')
      .option('--no-sandbox', 'disable the sandbox for all process types that are normally sandboxed.')
      .option('--output-dir <path>', 'path to the directory for output files.')
      .option('--port <port>', 'port to listen on for SSE transport.')
      .option('--proxy-bypass <bypass>', 'comma-separated domains to bypass proxy, for example ".com,chromium.org,.domain.com"')
      .option('--proxy-server <proxy>', 'specify proxy server, for example "http://myproxy:3128" or "socks5://myproxy:8080"')
      .option('--save-session', 'Whether to save the Playwright MCP session into the output directory.')
      .option('--save-trace', 'Whether to save the Playwright Trace of the session into the output directory.')
      .option('--secrets <path>', 'path to a file containing secrets in the dotenv format', dotenvFileLoader)
      .option('--storage-state <path>', 'path to the storage state file for isolated sessions.')
      .option('--timeout-action <timeout>', 'specify action timeout in milliseconds, defaults to 5000ms', numberParser)
      .option('--timeout-navigation <timeout>', 'specify navigation timeout in milliseconds, defaults to 60000ms', numberParser)
      .option('--user-agent <ua string>', 'specify user agent string')
      .option('--user-data-dir <path>', 'path to the user data directory. If not specified, a temporary directory will be created.')
      .option('--viewport-size <size>', 'specify browser viewport size in pixels, for example "1280, 720"')
      .addOption(new ProgramOption('--connect-tool', 'Allow to switch between different browser connection methods.').hideHelp())
      .addOption(new ProgramOption('--vscode', 'VS Code tools.').hideHelp())
      .addOption(new ProgramOption('--vision', 'Legacy option, use --caps=vision instead').hideHelp())
      .action(async options => {
        setupExitWatchdog();

        if (options.vision) {
          // eslint-disable-next-line no-console
          console.error('The --vision option is deprecated, use --caps=vision instead');
          options.caps = 'vision';
        }

        const config = await resolveCLIConfig(options);
        const browserContextFactory = contextFactory(config);
        const extensionContextFactory = new ExtensionContextFactory(config.browser.launchOptions.channel || 'chrome', config.browser.userDataDir, config.browser.launchOptions.executablePath);

        if (options.extension) {
          const serverBackendFactory: mcpServer.ServerBackendFactory = {
            name: 'Playwright w/ extension',
            nameInConfig: 'playwright-extension',
            version,
            create: () => new BrowserServerBackend(config, extensionContextFactory)
          };
          await mcpServer.start(serverBackendFactory, config.server);
          return;
        }

        if (options.vscode) {
          await runVSCodeTools(config);
          return;
        }

        if (options.connectTool) {
          const providers: MCPProvider[] = [
            {
              name: 'default',
              description: 'Starts standalone browser',
              connect: () => mcpServer.wrapInProcess(new BrowserServerBackend(config, browserContextFactory)),
            },
            {
              name: 'extension',
              description: 'Connect to a browser using the Playwright MCP extension',
              connect: () => mcpServer.wrapInProcess(new BrowserServerBackend(config, extensionContextFactory)),
            },
          ];
          const factory: mcpServer.ServerBackendFactory = {
            name: 'Playwright w/ switch',
            nameInConfig: 'playwright-switch',
            version,
            create: () => new ProxyBackend(providers),
          };
          await mcpServer.start(factory, config.server);
          return;
        }

        const factory: mcpServer.ServerBackendFactory = {
          name: 'Playwright',
          nameInConfig: 'playwright',
          version,
          create: () => new BrowserServerBackend(config, browserContextFactory)
        };
        await mcpServer.start(factory, config.server);
      });
}

function setupExitWatchdog() {
  let isExiting = false;
  const handleExit = async () => {
    if (isExiting)
      return;
    isExiting = true;
    // eslint-disable-next-line no-restricted-properties
    setTimeout(() => process.exit(0), 15000);
    await Context.disposeAll();
    // eslint-disable-next-line no-restricted-properties
    process.exit(0);
  };

  process.stdin.on('close', handleExit);
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
}
