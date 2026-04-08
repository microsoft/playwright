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

import '../bootstrap';
import { program } from 'commander';
import { gracefullyProcessExitDoNotHang } from '@utils/processLauncher';
import { getPackageManagerExecCommand } from '@utils/env';
import { packageJSON } from '../package';
import { addTraceCommands } from '../tools/trace/traceCli';
import { runDriver, runServer, printApiJson, launchBrowserServer } from './driver';
import { markDockerImage } from './installActions';
import { open, codegen } from './browserActions';
import { installBrowsers, uninstallBrowsers, installDeps } from './installActions';
import { runTraceInBrowser, runTraceViewerApp } from '../server/trace/viewer/traceViewer';
import { screenshot, pdf } from './browserActions';
import { program as cliProgram } from '../tools/cli-client/program';

import type { TraceViewerServerOptions } from '../server/trace/viewer/traceViewer';
import type { Command } from '../utilsBundle';

export function decorateProgram(program: Command) {

  program
      .version('Version ' + (process.env.PW_CLI_DISPLAY_VERSION || packageJSON.version))
      .name(buildBasePlaywrightCLICommand(process.env.PW_LANG_NAME));

  program
      .command('mark-docker-image [dockerImageNameTemplate]', { hidden: true })
      .description('mark docker image')
      .allowUnknownOption(true)
      .action(async function(dockerImageNameTemplate) {
        markDockerImage(dockerImageNameTemplate).catch(logErrorAndExit);
      });

  commandWithOpenOptions('open [url]', 'open page in browser specified via -b, --browser', [])
      .action(async function(url, options) {
        open(options, url).catch(logErrorAndExit);
      })
      .addHelpText('afterAll', `
  Examples:

    $ open
    $ open -b webkit https://example.com`);

  commandWithOpenOptions('codegen [url]', 'open page and generate code for user actions',
      [
        ['-o, --output <file name>', 'saves the generated script to a file'],
        ['--target <language>', `language to generate, one of javascript, playwright-test, python, python-async, python-pytest, csharp, csharp-mstest, csharp-nunit, java, java-junit`, codegenId()],
        ['--test-id-attribute <attributeName>', 'use the specified attribute to generate data test ID selectors'],
      ]).action(async function(url, options) {
    await codegen(options, url);
  }).addHelpText('afterAll', `
  Examples:

    $ codegen
    $ codegen --target=python
    $ codegen -b webkit https://example.com`);

  program
      .command('install [browser...]')
      .description('ensure browsers necessary for this version of Playwright are installed')
      .option('--with-deps', 'install system dependencies for browsers')
      .option('--dry-run', 'do not execute installation, only print information')
      .option('--list', 'prints list of browsers from all playwright installations')
      .option('--force', 'force reinstall of already installed browsers')
      .option('--only-shell', 'only install headless shell when installing chromium')
      .option('--no-shell', 'do not install chromium headless shell')
      .action(async function(args: string[], options: { withDeps?: boolean, force?: boolean, dryRun?: boolean, list?: boolean, shell?: boolean, noShell?: boolean, onlyShell?: boolean }) {
        try {
          await installBrowsers(args, options);
        } catch (e) {
          console.log(`Failed to install browsers\n${e}`);
          gracefullyProcessExitDoNotHang(1);
        }
      }).addHelpText('afterAll', `

  Examples:
    - $ install
      Install default browsers.

    - $ install chrome firefox
      Install custom browsers, supports chromium, firefox, webkit, chromium-headless-shell.`);

  program
      .command('uninstall')
      .description('Removes browsers used by this installation of Playwright from the system (chromium, firefox, webkit, ffmpeg). This does not include branded channels.')
      .option('--all', 'Removes all browsers used by any Playwright installation from the system.')
      .action(async (options: { all?: boolean }) => {
        uninstallBrowsers(options).catch(logErrorAndExit);
      });

  program
      .command('install-deps [browser...]')
      .description('install dependencies necessary to run browsers (will ask for sudo permissions)')
      .option('--dry-run', 'Do not execute installation commands, only print them')
      .action(async function(args: string[], options: { dryRun?: boolean }) {
        try {
          await installDeps(args, options);
        } catch (e) {
          console.log(`Failed to install browser dependencies\n${e}`);
          gracefullyProcessExitDoNotHang(1);
        }
      }).addHelpText('afterAll', `
  Examples:
    - $ install-deps
      Install dependencies for default browsers.

    - $ install-deps chrome firefox
      Install dependencies for specific browsers, supports chromium, firefox, webkit, chromium-headless-shell.`);

  const browsers = [
    { alias: 'cr', name: 'Chromium', type: 'chromium' },
    { alias: 'ff', name: 'Firefox', type: 'firefox' },
    { alias: 'wk', name: 'WebKit', type: 'webkit' },
  ];

  for (const { alias, name, type } of browsers) {
    commandWithOpenOptions(`${alias} [url]`, `open page in ${name}`, [])
        .action(async function(url, options) {
          open({ ...options, browser: type }, url).catch(logErrorAndExit);
        }).addHelpText('afterAll', `
  Examples:

    $ ${alias} https://example.com`);
  }

  commandWithOpenOptions('screenshot <url> <filename>', 'capture a page screenshot',
      [
        ['--wait-for-selector <selector>', 'wait for selector before taking a screenshot'],
        ['--wait-for-timeout <timeout>', 'wait for timeout in milliseconds before taking a screenshot'],
        ['--full-page', 'whether to take a full page screenshot (entire scrollable area)'],
      ]).action(async function(url, filename, command) {
    screenshot(command, command, url, filename).catch(logErrorAndExit);
  }).addHelpText('afterAll', `
  Examples:

    $ screenshot -b webkit https://example.com example.png`);

  commandWithOpenOptions('pdf <url> <filename>', 'save page as pdf',
      [
        ['--paper-format <format>', 'paper format: Letter, Legal, Tabloid, Ledger, A0, A1, A2, A3, A4, A5, A6'],
        ['--wait-for-selector <selector>', 'wait for given selector before saving as pdf'],
        ['--wait-for-timeout <timeout>', 'wait for given timeout in milliseconds before saving as pdf'],
      ]).action(async function(url, filename, options) {
    pdf(options, options, url, filename).catch(logErrorAndExit);
  }).addHelpText('afterAll', `
  Examples:

    $ pdf https://example.com example.pdf`);

  program
      .command('run-driver', { hidden: true })
      .action(async function(options) {
        runDriver();
      });

  program
      .command('run-server', { hidden: true })
      .option('--port <port>', 'Server port')
      .option('--host <host>', 'Server host')
      .option('--path <path>', 'Endpoint Path', '/')
      .option('--max-clients <maxClients>', 'Maximum clients')
      .option('--mode <mode>', 'Server mode, either "default" or "extension"')
      .option('--artifacts-dir <artifactsDir>', 'Artifacts directory')
      .action(async function(options) {
        runServer({
          port: options.port ? +options.port : undefined,
          host: options.host,
          path: options.path,
          maxConnections: options.maxClients ? +options.maxClients : Infinity,
          extension: options.mode === 'extension' || !!process.env.PW_EXTENSION_MODE,
          artifactsDir: options.artifactsDir,
        }).catch(logErrorAndExit);
      });

  program
      .command('print-api-json', { hidden: true })
      .action(async function(options) {
        printApiJson();
      });

  program
      .command('launch-server', { hidden: true })
      .requiredOption('--browser <browserName>', 'Browser name, one of "chromium", "firefox" or "webkit"')
      .option('--config <path-to-config-file>', 'JSON file with launchServer options')
      .action(async function(options) {
        launchBrowserServer(options.browser, options.config);
      });

  program
      .command('show-trace [trace]')
      .option('-b, --browser <browserType>', 'browser to use, one of cr, chromium, ff, firefox, wk, webkit', 'chromium')
      .option('-h, --host <host>', 'Host to serve trace on; specifying this option opens trace in a browser tab')
      .option('-p, --port <port>', 'Port to serve trace on, 0 for any free port; specifying this option opens trace in a browser tab')
      .option('--stdin', 'Accept trace URLs over stdin to update the viewer')
      .description('show trace viewer')
      .action(async function(trace, options) {
        if (options.browser === 'cr')
          options.browser = 'chromium';
        if (options.browser === 'ff')
          options.browser = 'firefox';
        if (options.browser === 'wk')
          options.browser = 'webkit';

        const openOptions: TraceViewerServerOptions = {
          host: options.host,
          port: +options.port,
          isServer: !!options.stdin,
        };

        if (options.port !== undefined || options.host !== undefined)
          runTraceInBrowser(trace, openOptions).catch(logErrorAndExit);
        else
          runTraceViewerApp(trace, options.browser, openOptions).catch(logErrorAndExit);
      }).addHelpText('afterAll', `
  Examples:

    $ show-trace
    $ show-trace https://example.com/trace.zip`);

  addTraceCommands(program, logErrorAndExit);

  program
      .command('cli', { hidden: true })
      .allowExcessArguments(true)
      .allowUnknownOption(true)
      .action(async options => {
        process.argv.splice(process.argv.indexOf('cli'), 1);
        cliProgram().catch(logErrorAndExit);
      });
}

function logErrorAndExit(e: Error) {
  if (process.env.PWDEBUGIMPL)
    console.error(e);
  else
    console.error(e.name + ': ' + e.message);
  gracefullyProcessExitDoNotHang(1);
}

function codegenId(): string {
  return process.env.PW_LANG_NAME || 'playwright-test';
}

function commandWithOpenOptions(command: string, description: string, options: any[][]): Command {
  let result = program.command(command).description(description);
  for (const option of options)
    result = result.option(option[0], ...option.slice(1));
  return result
      .option('-b, --browser <browserType>', 'browser to use, one of cr, chromium, ff, firefox, wk, webkit', 'chromium')
      .option('--block-service-workers', 'block service workers')
      .option('--channel <channel>', 'Chromium distribution channel, "chrome", "chrome-beta", "msedge-dev", etc')
      .option('--color-scheme <scheme>', 'emulate preferred color scheme, "light" or "dark"')
      .option('--device <deviceName>', 'emulate device, for example  "iPhone 11"')
      .option('--geolocation <coordinates>', 'specify geolocation coordinates, for example "37.819722,-122.478611"')
      .option('--ignore-https-errors', 'ignore https errors')
      .option('--load-storage <filename>', 'load context storage state from the file, previously saved with --save-storage')
      .option('--lang <language>', 'specify language / locale, for example "en-GB"')
      .option('--proxy-server <proxy>', 'specify proxy server, for example "http://myproxy:3128" or "socks5://myproxy:8080"')
      .option('--proxy-bypass <bypass>', 'comma-separated domains to bypass proxy, for example ".com,chromium.org,.domain.com"')
      .option('--save-har <filename>', 'save HAR file with all network activity at the end')
      .option('--save-har-glob <glob pattern>', 'filter entries in the HAR by matching url against this glob pattern')
      .option('--save-storage <filename>', 'save context storage state at the end, for later use with --load-storage')
      .option('--timezone <time zone>', 'time zone to emulate, for example "Europe/Rome"')
      .option('--timeout <timeout>', 'timeout for Playwright actions in milliseconds, no timeout by default')
      .option('--user-agent <ua string>', 'specify user agent string')
      .option('--user-data-dir <directory>', 'use the specified user data directory instead of a new context')
      .option('--viewport-size <size>', 'specify browser viewport size in pixels, for example "1280, 720"');
}

function buildBasePlaywrightCLICommand(cliTargetLang: string | undefined): string {
  switch (cliTargetLang) {
    case 'python':
      return `playwright`;
    case 'java':
      return `mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="...options.."`;
    case 'csharp':
      return `pwsh bin/Debug/netX/playwright.ps1`;
    default: {
      const packageManagerCommand = getPackageManagerExecCommand();
      return `${packageManagerCommand} playwright`;
    }
  }
}
