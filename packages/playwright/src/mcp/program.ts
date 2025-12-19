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

import { colors, ProgramOption } from 'playwright-core/lib/utilsBundle';
import { registry } from 'playwright-core/lib/server';

import * as mcpServer from './sdk/server';
import { commaSeparatedList, dotenvFileLoader, enumParser, headerParser, numberParser, resolutionParser, resolveCLIConfig, semicolonSeparatedList } from './browser/config';
import { setupExitWatchdog } from './browser/watchdog';
import { contextFactory } from './browser/browserContextFactory';
import { BrowserServerBackend } from './browser/browserServerBackend';
import { ExtensionContextFactory } from './extension/extensionContextFactory';

import type { Command } from 'playwright-core/lib/utilsBundle';

export function decorateCommand(command: Command, version: string) {
  command
      .option('--allowed-hosts <hosts...>', 'comma-separated list of hosts this server is allowed to serve from. Defaults to the host the server is bound to. Pass \'*\' to disable the host check.', commaSeparatedList)
      .option('--allowed-origins <origins>', 'semicolon-separated list of TRUSTED origins to allow the browser to request. Default is to allow all.\nImportant: *does not* serve as a security boundary and *does not* affect redirects. ', semicolonSeparatedList)
      .option('--blocked-origins <origins>', 'semicolon-separated list of origins to block the browser from requesting. Blocklist is evaluated before allowlist. If used without the allowlist, requests not matching the blocklist are still allowed.\nImportant: *does not* serve as a security boundary and *does not* affect redirects.', semicolonSeparatedList)
      .option('--block-service-workers', 'block service workers')
      .option('--browser <browser>', 'browser or chrome channel to use, possible values: chrome, firefox, webkit, msedge.')
      .option('--caps <caps>', 'comma-separated list of additional capabilities to enable, possible values: vision, pdf.', commaSeparatedList)
      .option('--cdp-endpoint <endpoint>', 'CDP endpoint to connect to.')
      .option('--cdp-header <headers...>', 'CDP headers to send with the connect request, multiple can be specified.', headerParser)
      .option('--config <path>', 'path to the configuration file.')
      .option('--console-level <level>', 'level of console messages to return: "error", "warning", "info", "debug". Each level includes the messages of more severe levels.', enumParser.bind(null, '--console-level', ['error', 'warning', 'info', 'debug']))
      .option('--device <device>', 'device to emulate, for example: "iPhone 15"')
      .option('--executable-path <path>', 'path to the browser executable.')
      .option('--extension', 'Connect to a running browser instance (Edge/Chrome only). Requires the "Playwright MCP Bridge" browser extension to be installed.')
      .option('--grant-permissions <permissions...>', 'List of permissions to grant to the browser context, for example "geolocation", "clipboard-read", "clipboard-write".', commaSeparatedList)
      .option('--headless', 'run browser in headless mode, headed by default')
      .option('--host <host>', 'host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.')
      .option('--ignore-https-errors', 'ignore https errors')
      .option('--init-page <path...>', 'path to TypeScript file to evaluate on Playwright page object')
      .option('--init-script <path...>', 'path to JavaScript file to add as an initialization script. The script will be evaluated in every page before any of the page\'s scripts. Can be specified multiple times.')
      .option('--isolated', 'keep the browser profile in memory, do not save it to disk.')
      .option('--image-responses <mode>', 'whether to send image responses to the client. Can be "allow" or "omit", Defaults to "allow".', enumParser.bind(null, '--image-responses', ['allow', 'omit']))
      .option('--no-sandbox', 'disable the sandbox for all process types that are normally sandboxed.')
      .option('--output-dir <path>', 'path to the directory for output files.')
      .option('--port <port>', 'port to listen on for SSE transport.')
      .option('--proxy-bypass <bypass>', 'comma-separated domains to bypass proxy, for example ".com,chromium.org,.domain.com"')
      .option('--proxy-server <proxy>', 'specify proxy server, for example "http://myproxy:3128" or "socks5://myproxy:8080"')
      .option('--save-session', 'Whether to save the Playwright MCP session into the output directory.')
      .option('--save-trace', 'Whether to save the Playwright Trace of the session into the output directory.')
      .option('--save-video <size>', 'Whether to save the video of the session into the output directory. For example "--save-video=800x600"', resolutionParser.bind(null, '--save-video'))
      .option('--secrets <path>', 'path to a file containing secrets in the dotenv format', dotenvFileLoader)
      .option('--shared-browser-context', 'reuse the same browser context between all connected HTTP clients.')
      .option('--snapshot-mode <mode>', 'when taking snapshots for responses, specifies the mode to use. Can be "incremental", "full", or "none". Default is incremental.')
      .option('--storage-state <path>', 'path to the storage state file for isolated sessions.')
      .option('--test-id-attribute <attribute>', 'specify the attribute to use for test ids, defaults to "data-testid"')
      .option('--timeout-action <timeout>', 'specify action timeout in milliseconds, defaults to 5000ms', numberParser)
      .option('--timeout-navigation <timeout>', 'specify navigation timeout in milliseconds, defaults to 60000ms', numberParser)
      .option('--user-agent <ua string>', 'specify user agent string')
      .option('--user-data-dir <path>', 'path to the user data directory. If not specified, a temporary directory will be created.')
      .option('--viewport-size <size>', 'specify browser viewport size in pixels, for example "1280x720"', resolutionParser.bind(null, '--viewport-size'))
      .addOption(new ProgramOption('--vision', 'Legacy option, use --caps=vision instead').hideHelp())
      .action(async options => {
        setupExitWatchdog();

        if (options.vision) {
          console.error('The --vision option is deprecated, use --caps=vision instead');
          options.caps = 'vision';
        }

        const config = await resolveCLIConfig(options);

        // Chromium browsers require ffmpeg to be installed to save video.
        if (config.saveVideo && !checkFfmpeg()) {
          console.error(colors.red(`\nError: ffmpeg required to save the video is not installed.`));
          console.error(`\nPlease run the command below. It will install a local copy of ffmpeg and will not change any system-wide settings.`);
          console.error(`\n    npx playwright install ffmpeg\n`);
          // eslint-disable-next-line no-restricted-properties
          process.exit(1);
        }

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

        const factory: mcpServer.ServerBackendFactory = {
          name: 'Playwright',
          nameInConfig: 'playwright',
          version,
          create: () => new BrowserServerBackend(config, browserContextFactory)
        };
        await mcpServer.start(factory, config.server);
      });
}

function checkFfmpeg(): boolean {
  try {
    const executable = registry.findExecutable('ffmpeg')!;
    return fs.existsSync(executable.executablePath('javascript')!);
  } catch (error) {
    return false;
  }
}
