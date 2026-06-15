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

import { Option as ProgramOption } from 'commander';
import * as mcpServer from '../utils/mcp/server';
import { commaSeparatedList, dotenvFileLoader, enumParser, headerParser, numberParser, resolutionParser, resolveBrowserParam, resolveCLIConfigForMCP, semicolonSeparatedList } from './config';
import { setupExitWatchdog } from './watchdog';
import { createBrowserWithInfo } from './browserFactory';
import { BrowserBackend } from '../backend/browserBackend';
import { filteredTools } from '../backend/tools';
import { testDebug } from './log';
import { packageJSON } from '../../package';
import { attachKeyboardMock } from '../../lib/keyboard/attachKeyboardMock.js';
import { attachAutoNavigate } from '../../lib/attachAutoNavigate.js';

import type { Command } from 'commander';
import type { ClientInfo } from '../utils/mcp/server';
import type { FullConfig } from './config';

/**
 * Default Expo dev-server port the fork falls back to when no CLI
 * flag, env var, or registry slot is set. Picked to match the
 * `expo start` default — keep them in sync if Expo ever changes it.
 */
export const DEFAULT_DEV_SERVER_PORT = 8081;

/**
 * Pure resolution chain for the dev-server `baseUrl`. Order:
 *   1. `cliFlag`        — `--base-url` from the user on the command line
 *   2. `env.EXPO_DEV_SERVER_URL` — the env var Expo sets when it boots
 *   3. `registry`       — first slot's metro port from the wf registry
 *                         (caller formats `http://localhost:<port>`);
 *                         pass `undefined` to skip this layer
 *   4. `http://localhost:<defaultPort>` — last-resort default
 *
 * Pure so the workflow-cli's doctor can import + unit-test it
 * without spinning up a fork. The CLI `action` handler
 * (`decorateMCPCommand`) reads `process.env` and the on-disk
 * registry itself and calls into this helper, so the production
 * resolution still works the same — only the test surface gained
 * a clean entry point.
 */
export function resolveBaseUrl(
  cliFlag: string | undefined,
  env: { EXPO_DEV_SERVER_URL?: string | undefined } | NodeJS.ProcessEnv,
  registry: string | undefined,
  defaultPort: number = DEFAULT_DEV_SERVER_PORT
): string {
  return (
    cliFlag
    ?? (env as { EXPO_DEV_SERVER_URL?: string }).EXPO_DEV_SERVER_URL
    ?? registry
    ?? `http://localhost:${defaultPort}`
  );
}

/**
 * Read the first slot's metro port from the on-disk wf registry
 * and format it as a `baseUrl`. Returns `undefined` on any
 * failure — the caller treats undefined as "no signal at this
 * layer" and falls back to the default. The registry shape is
 * out-of-process and may be anything, so we catch all errors.
 */
function readRegistryBaseUrl(): string | undefined {
  // Lazy require: keeps the import graph small and the helper
  // safe to call from a frozen test environment.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const os = require('os') as typeof import('os');
  try {
    const regDir = process.env.WF_REGISTRY_DIR ?? path.join(os.homedir(), '.local/state/wf-registry');
    const reg = JSON.parse(fs.readFileSync(path.join(regDir, 'registry.json'), 'utf-8')) as { slots?: Record<string, { metro_claims?: { metroPort?: number } }> };
    const firstSlot = Object.values(reg.slots ?? {})[0];
    return firstSlot?.metro_claims?.metroPort !== undefined
      ? `http://localhost:${firstSlot.metro_claims.metroPort}`
      : undefined;
  } catch {
    return undefined;
  }
}
import type * as playwright from '../../..';

const version = packageJSON.version;

/**
 * Per-slot config override hook (no longer used by the multi-slot server;
 * the per-call `browser=` arg is now applied inside the factory). Kept
 * here for reference — see git history for the previous implementation.
 */

export function decorateMCPCommand(command: Command) {
  command
      .option('--allowed-hosts <hosts...>', 'comma-separated list of hosts this server is allowed to serve from. Defaults to the host the server is bound to. Pass \'*\' to disable the host check.', commaSeparatedList)
      .option('--allowed-origins <origins>', 'semicolon-separated list of TRUSTED origins to allow the browser to request. Default is to allow all.\nImportant: *does not* serve as a security boundary and *does not* affect redirects. ', semicolonSeparatedList)
      .option('--allow-unrestricted-file-access', 'allow access to files outside of the workspace roots. Also allows unrestricted access to file:// URLs. By default access to file system is restricted to workspace root directories (or cwd if no roots are configured) only, and navigation to file:// URLs is blocked.')
      .option('--blocked-origins <origins>', 'semicolon-separated list of origins to block the browser from requesting. Blocklist is evaluated before allowlist. If used without the allowlist, requests not matching the blocklist are still allowed.\nImportant: *does not* serve as a security boundary and *does not* affect redirects.', semicolonSeparatedList)
      .option('--block-service-workers', 'block service workers')
      .option('--browser <browser>', 'browser or chrome channel to use, possible values: chrome, firefox, webkit, msedge.')
      .option('--caps <caps>', 'comma-separated list of additional capabilities to enable, possible values: vision, pdf, devtools.', commaSeparatedList)
      .option('--cdp-endpoint <endpoint>', 'CDP endpoint to connect to.')
      .option('--cdp-header <headers...>', 'CDP headers to send with the connect request, multiple can be specified.', headerParser)
      .option('--cdp-timeout <timeout>', 'timeout in milliseconds for connecting to CDP endpoint, defaults to 30000ms', numberParser)
      .option('--codegen <lang>', 'specify the language to use for code generation, possible values: "typescript", "none". Default is "typescript".', enumParser.bind(null, '--codegen', ['none', 'typescript']))
      .option('--config <path>', 'path to the configuration file.')
      .option('--console-level <level>', 'level of console messages to return: "error", "warning", "info", "debug". Each level includes the messages of more severe levels.', enumParser.bind(null, '--console-level', ['error', 'warning', 'info', 'debug']))
      .option('--device <device>', 'device to emulate, for example: "iPhone 15"')
      .option('--executable-path <path>', 'path to the browser executable.')
      .option('--extension', 'Connect to a running browser instance (Edge/Chrome only). Requires the "Playwright Extension" to be installed.')
      .option('--endpoint <endpoint>', 'Bound browser endpoint to connect to.')
      .option('--grant-permissions <permissions...>', 'List of permissions to grant to the browser context, for example "geolocation", "clipboard-read", "clipboard-write".', commaSeparatedList)
      .option('--headless', 'run browser in headless mode, headed by default')
      .option('--host <host>', 'host to bind server to. Default is localhost. Use 0.0.0.0 to bind to all interfaces.')
      .option('--ignore-https-errors', 'ignore https errors')
      .option('--init-script <path...>', 'path to JavaScript file to add as an initialization script. The script will be evaluated in every page before any of the page\'s scripts. Can be specified multiple times.')
      .option('--isolated', 'keep the browser profile in memory, do not save it to disk.')
      .option('--image-responses <mode>', 'whether to send image responses to the client. Can be "allow" or "omit", Defaults to "allow".', enumParser.bind(null, '--image-responses', ['allow', 'omit']))
      .option('--keyboard-mock', 'inject mobile keyboard mock into every browser context (default: true).')
      .option('--no-keyboard-mock', 'disable the mobile keyboard mock.')
      .option('--no-sandbox', 'disable the sandbox for all process types that are normally sandboxed.')
      .option('--output-dir <path>', 'path to the directory for output files.')
      .option('--output-max-size <bytes>', 'Threshold for evicting old output files, in bytes.', numberParser)
      .option('--output-mode <mode>', 'whether to save snapshots, console messages, network logs to a file or to the standard output. Can be "file" or "stdout". Default is "stdout".', enumParser.bind(null, '--output-mode', ['file', 'stdout']))
      .option('--port <port>', 'port to listen on for SSE transport.')
      .option('--proxy-bypass <bypass>', 'comma-separated domains to bypass proxy, for example ".com,chromium.org,.domain.com"')
      .option('--proxy-server <proxy>', 'specify proxy server, for example "http://myproxy:3128" or "socks5://myproxy:8080"')
      .addOption(new ProgramOption('--remote-header <headers...>', 'headers to send with the remote endpoint connect request, multiple can be specified.').argParser(headerParser).hideHelp())
      .option('--sandbox', 'enable the sandbox for all process types that are normally not sandboxed.')
      .option('--save-session', 'Whether to save the Playwright MCP session into the output directory.')
      .option('--secrets <path>', 'path to a file containing secrets in the dotenv format', dotenvFileLoader)
      .option('--shared-browser-context', 'reuse the same browser context between all connected HTTP clients.')
      .option('--snapshot-mode <mode>', 'when taking snapshots for responses, specifies the mode to use. Can be "full" or "none". Default is "full".')
      .option('--storage-state <path>', 'path to the storage state file for isolated sessions.')
      .option('--test-id-attribute <attribute>', 'specify the attribute to use for test ids, defaults to "data-testid"')
      .option('--timeout-action <timeout>', 'specify action timeout in milliseconds, defaults to 5000ms', numberParser)
      .option('--timeout-navigation <timeout>', 'specify navigation timeout in milliseconds, defaults to 60000ms', numberParser)
      .option('--user-agent <ua string>', 'specify user agent string')
      .option('--user-data-dir <path>', 'path to the user data directory. If not specified, a temporary directory will be created.')
      .option('--viewport-size <size>', 'specify browser viewport size in pixels, for example "1280x720"', resolutionParser.bind(null, '--viewport-size'))
      .addOption(new ProgramOption('--vision', 'Legacy option, use --caps=vision instead').hideHelp())
      .option('--multi', 'enable multi-slot mode (one BrowserContext per slotId; each tool call must include a slotId).')
      .option('--no-multi', 'opt out of multi-slot mode (legacy single-slot).')
      .option('--single', 'legacy mode: no slotId, one browser. Equivalent to --no-multi.')
      .option('--base-url <url>', 'override the dev server URL (e.g. for staging or direct fork use). Falls back to EXPO_DEV_SERVER_URL env, then registry first slot\'s metroPort, then http://localhost:8081.')
      .option('--max-restarts <n>', 'supervisor: max auto-restart attempts before giving up (0-10, default 3)', numberParser)
      .option('--restart-delay <ms>', 'supervisor: base backoff delay in ms (default 1000)', numberParser)
      .option('--max-restart-delay <ms>', 'supervisor: cap on backoff in ms (default 30000)', numberParser)
      .option('--no-auto-restart', 'supervisor: disable automatic respawn on child death (manual only)')
      .option('--no-watch', 'supervisor: disable dist file watcher')
      .option('--watch-path <path>', 'supervisor: override the watched directory')
      .option('--child', 'Run as a child MCP server (no supervision). Used by `wf mcp inspect` and tests.')
      .action(async options => {

        // normalize the --no-sandbox option: sandbox = true => nothing was passed, sandbox = false => --no-sandbox was passed.
        options.sandbox = options.sandbox === true ? undefined : false;

        setupExitWatchdog();

        if (options.vision) {
          // eslint-disable-next-line no-console
          console.error('The --vision option is deprecated, use --caps=vision instead');
          options.caps = 'vision';
        }

        if (options.caps?.includes('tracing'))
          options.caps.push('devtools');

        const config = await resolveCLIConfigForMCP(options);

        // Resolve dev server URL (CLI wins over env, which wins over registry,
        // which wins over default). Only set if not already on the config (a
        // config file may have set it explicitly).
        if (!config.browser.baseUrl) {
          config.browser.baseUrl = resolveBaseUrl(
            options.baseUrl,
            process.env,
            readRegistryBaseUrl()
          );
        }

        const tools = filteredTools(config);
        // In multi-slot mode with --isolated we want a fresh browser per slot
        // so each BrowserContext is truly independent. sharedBrowserContext is
        // the explicit opt-in; --isolated alone should not force sharing.
        const useSharedBrowser = config.sharedBrowserContext && !config.browser.isolated;
        let sharedBrowserPromise: Promise<playwright.Browser> | undefined;
        let clientCount = 0;
        const clientNameCounters = new Map<string, number>();

        const factory: mcpServer.ServerBackendFactory = {
          name: 'Playwright',
          nameInConfig: 'playwright',
          version,
          toolSchemas: tools.map(tool => tool.schema),
          create: async (clientInfo: ClientInfo, _slotContext?: mcpServer.SlotContext) => {
            // Per-call browser selection happens inside the multi-slot
            // manager (see server.ts); the factory always uses the base
            // config here.
            const slotConfig = config;
            if (useSharedBrowser && !sharedBrowserPromise) {
              sharedBrowserPromise = (async () => {
                const { browser, canBind } = await createBrowserWithInfo(slotConfig, clientInfo, options);
                if (canBind)
                  await browser.bind(clientInfo.clientName, { workspaceDir: clientInfo.cwd });
                return browser;
              })().catch(error => {
                sharedBrowserPromise = undefined;
                throw error;
              });
            }
            clientCount++;
            // Per-slot browser + shared-browser are mutually exclusive:
            // a single browser process can only be one engine. The
            // multi-slot server disables useSharedBrowser for slots with
            // an override, so this path is reached only when the slot
            // either has no override or matches the shared default.
            const { browser, canBind } = sharedBrowserPromise ? { browser: await sharedBrowserPromise, canBind: false } : await createBrowserWithInfo(slotConfig, clientInfo, options);
            if (canBind) {
              const count = (clientNameCounters.get(clientInfo.clientName) ?? 0) + 1;
              clientNameCounters.set(clientInfo.clientName, count);
              const sessionName = count > 1 ? `${clientInfo.clientName} (${count})` : clientInfo.clientName;
              await browser.bind(sessionName, { workspaceDir: clientInfo.cwd });
            }
            const browserContext = slotConfig.browser.isolated ? await browser.newContext(slotConfig.browser.contextOptions) : browser.contexts()[0];
            await attachKeyboardMock(browserContext, slotConfig.browser.keyboardMock);
            await attachAutoNavigate(browserContext, slotConfig.browser.baseUrl);
            return new BrowserBackend(slotConfig, browserContext, tools);
          },
          disposed: async backend => {
            clientCount--;
            if (sharedBrowserPromise && clientCount > 0)
              return;

            testDebug('close browser');
            sharedBrowserPromise = undefined;
            const browserContext = (backend as BrowserBackend).browserContext;
            await browserContext.close().catch(() => { });
            await browserContext.browser()!.close().catch(() => { });
          }
        };
        // Default is multi-slot; --no-multi (or the legacy alias --single)
        // opts out and routes to the upstream single-server path.
        const useMulti = options.multi !== false;
        if (useMulti) {
          // Label the multi-slot fork distinctly so doctor's
          // `checkMultiSlotFork` (and the 3 fork-only checks) can
          // identify it via `serverInfo.name`. Legacy path keeps
          // the upstream name 'Playwright' for zero regression.
          factory.name = 'wf-playwright-multi';
          // The fork's global `--browser` flag becomes the per-slot
          // default for tool calls that omit `browser` — same chrome/
          // chromium/firefox/webkit string. Falls back to 'chrome' if
          // the user passed nothing.
          const defaultBrowser: 'chrome' | 'chromium' | 'firefox' | 'webkit' =
            options.browser === 'chrome' || options.browser === 'chromium' || options.browser === 'firefox' || options.browser === 'webkit'
              ? options.browser
              : 'chrome';
          await mcpServer.startMultiServer(factory, { ...config.server, defaultBrowser });
        } else {
          await mcpServer.start(factory, config.server);
        }
      });
}
