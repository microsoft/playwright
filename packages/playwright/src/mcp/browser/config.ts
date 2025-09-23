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

import fs from 'fs';
import os from 'os';
import path from 'path';

import { devices } from 'playwright-core';
import { dotenv } from 'playwright-core/lib/utilsBundle';
import { fileExistsAsync } from '../../util';

import { firstRootPath } from '../sdk/server';

import type * as playwright from '../../../types/test';
import type { Config, ToolCapability } from '../config';
import type { ClientInfo } from '../sdk/server';

type ViewportSize = { width: number; height: number };

export type CLIOptions = {
  allowedHosts?: string[];
  allowedOrigins?: string[];
  blockedOrigins?: string[];
  blockServiceWorkers?: boolean;
  browser?: string;
  caps?: string[];
  cdpEndpoint?: string;
  cdpHeader?: Record<string, string>;
  config?: string;
  device?: string;
  executablePath?: string;
  grantPermissions?: string[];
  headless?: boolean;
  host?: string;
  ignoreHttpsErrors?: boolean;
  initScript?: string[];
  isolated?: boolean;
  imageResponses?: 'allow' | 'omit';
  sandbox?: boolean;
  outputDir?: string;
  port?: number;
  proxyBypass?: string;
  proxyServer?: string;
  saveSession?: boolean;
  saveTrace?: boolean;
  saveVideo?: ViewportSize;
  secrets?: Record<string, string>;
  sharedBrowserContext?: boolean;
  storageState?: string;
  timeoutAction?: number;
  timeoutNavigation?: number;
  userAgent?: string;
  userDataDir?: string;
  viewportSize?: ViewportSize;
};

export const defaultConfig: FullConfig = {
  browser: {
    browserName: 'chromium',
    launchOptions: {
      channel: 'chrome',
      headless: os.platform() === 'linux' && !process.env.DISPLAY,
      chromiumSandbox: true,
    },
    contextOptions: {
      viewport: null,
    },
  },
  network: {
    allowedOrigins: undefined,
    blockedOrigins: undefined,
  },
  server: {},
  saveTrace: false,
  timeouts: {
    action: 5000,
    navigation: 60000,
  },
};

type BrowserUserConfig = NonNullable<Config['browser']>;

export type FullConfig = Config & {
  browser: Omit<BrowserUserConfig, 'browserName'> & {
    browserName: 'chromium' | 'firefox' | 'webkit';
    launchOptions: NonNullable<BrowserUserConfig['launchOptions']>;
    contextOptions: NonNullable<BrowserUserConfig['contextOptions']>;
  },
  network: NonNullable<Config['network']>,
  saveTrace: boolean;
  server: NonNullable<Config['server']>,
  timeouts: {
    action: number;
    navigation: number;
  },
};

export async function resolveConfig(config: Config): Promise<FullConfig> {
  return mergeConfig(defaultConfig, config);
}

export async function resolveCLIConfig(cliOptions: CLIOptions): Promise<FullConfig> {
  const configInFile = await loadConfig(cliOptions.config);
  const envOverrides = configFromEnv();
  const cliOverrides = configFromCLIOptions(cliOptions);
  let result = defaultConfig;
  result = mergeConfig(result, configInFile);
  result = mergeConfig(result, envOverrides);
  result = mergeConfig(result, cliOverrides);
  await validateConfig(result);
  return result;
}

async function validateConfig(config: FullConfig): Promise<void> {
  if (config.browser.initScript) {
    for (const script of config.browser.initScript) {
      if (!await fileExistsAsync(script))
        throw new Error(`Init script file does not exist: ${script}`);
    }
  }
  if (config.sharedBrowserContext && config.saveVideo)
    throw new Error('saveVideo is not supported when sharedBrowserContext is true');
}

export function configFromCLIOptions(cliOptions: CLIOptions): Config {
  let browserName: 'chromium' | 'firefox' | 'webkit' | undefined;
  let channel: string | undefined;
  switch (cliOptions.browser) {
    case 'chrome':
    case 'chrome-beta':
    case 'chrome-canary':
    case 'chrome-dev':
    case 'chromium':
    case 'msedge':
    case 'msedge-beta':
    case 'msedge-canary':
    case 'msedge-dev':
      browserName = 'chromium';
      channel = cliOptions.browser;
      break;
    case 'firefox':
      browserName = 'firefox';
      break;
    case 'webkit':
      browserName = 'webkit';
      break;
  }

  // Launch options
  const launchOptions: playwright.LaunchOptions = {
    channel,
    executablePath: cliOptions.executablePath,
    headless: cliOptions.headless,
  };

  // --no-sandbox was passed, disable the sandbox
  if (cliOptions.sandbox === false)
    launchOptions.chromiumSandbox = false;

  if (cliOptions.proxyServer) {
    launchOptions.proxy = {
      server: cliOptions.proxyServer
    };
    if (cliOptions.proxyBypass)
      launchOptions.proxy.bypass = cliOptions.proxyBypass;
  }

  if (cliOptions.device && cliOptions.cdpEndpoint)
    throw new Error('Device emulation is not supported with cdpEndpoint.');

  // Context options
  const contextOptions: playwright.BrowserContextOptions = cliOptions.device ? devices[cliOptions.device] : {};
  if (cliOptions.storageState)
    contextOptions.storageState = cliOptions.storageState;

  if (cliOptions.userAgent)
    contextOptions.userAgent = cliOptions.userAgent;

  if (cliOptions.viewportSize)
    contextOptions.viewport = cliOptions.viewportSize;

  if (cliOptions.ignoreHttpsErrors)
    contextOptions.ignoreHTTPSErrors = true;

  if (cliOptions.blockServiceWorkers)
    contextOptions.serviceWorkers = 'block';

  if (cliOptions.grantPermissions)
    contextOptions.permissions = cliOptions.grantPermissions;

  if (cliOptions.saveVideo) {
    contextOptions.recordVideo = {
      // Videos are moved to output directory on saveAs.
      dir: tmpDir(),
      size: cliOptions.saveVideo,
    };
  }

  const result: Config = {
    browser: {
      browserName,
      isolated: cliOptions.isolated,
      userDataDir: cliOptions.userDataDir,
      launchOptions,
      contextOptions,
      cdpEndpoint: cliOptions.cdpEndpoint,
      cdpHeaders: cliOptions.cdpHeader,
      initScript: cliOptions.initScript,
    },
    server: {
      port: cliOptions.port,
      host: cliOptions.host,
      allowedHosts: cliOptions.allowedHosts,
    },
    capabilities: cliOptions.caps as ToolCapability[],
    network: {
      allowedOrigins: cliOptions.allowedOrigins,
      blockedOrigins: cliOptions.blockedOrigins,
    },
    saveSession: cliOptions.saveSession,
    saveTrace: cliOptions.saveTrace,
    saveVideo: cliOptions.saveVideo,
    secrets: cliOptions.secrets,
    sharedBrowserContext: cliOptions.sharedBrowserContext,
    outputDir: cliOptions.outputDir,
    imageResponses: cliOptions.imageResponses,
    timeouts: {
      action: cliOptions.timeoutAction,
      navigation: cliOptions.timeoutNavigation,
    },
  };

  return result;
}

function configFromEnv(): Config {
  const options: CLIOptions = {};
  options.allowedHosts = commaSeparatedList(process.env.PLAYWRIGHT_MCP_ALLOWED_HOSTNAMES);
  options.allowedOrigins = semicolonSeparatedList(process.env.PLAYWRIGHT_MCP_ALLOWED_ORIGINS);
  options.blockedOrigins = semicolonSeparatedList(process.env.PLAYWRIGHT_MCP_BLOCKED_ORIGINS);
  options.blockServiceWorkers = envToBoolean(process.env.PLAYWRIGHT_MCP_BLOCK_SERVICE_WORKERS);
  options.browser = envToString(process.env.PLAYWRIGHT_MCP_BROWSER);
  options.caps = commaSeparatedList(process.env.PLAYWRIGHT_MCP_CAPS);
  options.cdpEndpoint = envToString(process.env.PLAYWRIGHT_MCP_CDP_ENDPOINT);
  options.cdpHeader = headerParser(process.env.PLAYWRIGHT_MCP_CDP_HEADERS, {});
  options.config = envToString(process.env.PLAYWRIGHT_MCP_CONFIG);
  options.device = envToString(process.env.PLAYWRIGHT_MCP_DEVICE);
  options.executablePath = envToString(process.env.PLAYWRIGHT_MCP_EXECUTABLE_PATH);
  options.grantPermissions = commaSeparatedList(process.env.PLAYWRIGHT_MCP_GRANT_PERMISSIONS);
  options.headless = envToBoolean(process.env.PLAYWRIGHT_MCP_HEADLESS);
  options.host = envToString(process.env.PLAYWRIGHT_MCP_HOST);
  options.ignoreHttpsErrors = envToBoolean(process.env.PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS);
  const initScript = envToString(process.env.PLAYWRIGHT_MCP_INIT_SCRIPT);
  if (initScript)
    options.initScript = [initScript];
  options.isolated = envToBoolean(process.env.PLAYWRIGHT_MCP_ISOLATED);
  if (process.env.PLAYWRIGHT_MCP_IMAGE_RESPONSES === 'omit')
    options.imageResponses = 'omit';
  options.sandbox = envToBoolean(process.env.PLAYWRIGHT_MCP_SANDBOX);
  options.outputDir = envToString(process.env.PLAYWRIGHT_MCP_OUTPUT_DIR);
  options.port = numberParser(process.env.PLAYWRIGHT_MCP_PORT);
  options.proxyBypass = envToString(process.env.PLAYWRIGHT_MCP_PROXY_BYPASS);
  options.proxyServer = envToString(process.env.PLAYWRIGHT_MCP_PROXY_SERVER);
  options.saveTrace = envToBoolean(process.env.PLAYWRIGHT_MCP_SAVE_TRACE);
  options.saveVideo = resolutionParser('--save-video', process.env.PLAYWRIGHT_MCP_SAVE_VIDEO);
  options.secrets = dotenvFileLoader(process.env.PLAYWRIGHT_MCP_SECRETS_FILE);
  options.storageState = envToString(process.env.PLAYWRIGHT_MCP_STORAGE_STATE);
  options.timeoutAction = numberParser(process.env.PLAYWRIGHT_MCP_TIMEOUT_ACTION);
  options.timeoutNavigation = numberParser(process.env.PLAYWRIGHT_MCP_TIMEOUT_NAVIGATION);
  options.userAgent = envToString(process.env.PLAYWRIGHT_MCP_USER_AGENT);
  options.userDataDir = envToString(process.env.PLAYWRIGHT_MCP_USER_DATA_DIR);
  options.viewportSize = resolutionParser('--viewport-size', process.env.PLAYWRIGHT_MCP_VIEWPORT_SIZE);
  return configFromCLIOptions(options);
}

async function loadConfig(configFile: string | undefined): Promise<Config> {
  if (!configFile)
    return {};

  try {
    return JSON.parse(await fs.promises.readFile(configFile, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to load config file: ${configFile}, ${error}`);
  }
}

function tmpDir(): string {
  return path.join(process.env.PW_TMPDIR_FOR_TEST ?? os.tmpdir(), 'playwright-mcp-output');
}

export function outputDir(config: FullConfig, clientInfo: ClientInfo): string {
  const rootPath = firstRootPath(clientInfo);
  return config.outputDir
    ?? (rootPath ? path.join(rootPath, '.playwright-mcp') : undefined)
    ?? path.join(tmpDir(), String(clientInfo.timestamp));
}

export async function outputFile(config: FullConfig, clientInfo: ClientInfo, fileName: string, options: { origin: 'code' | 'llm' | 'web' }): Promise<string> {
  const dir = outputDir(config, clientInfo);

  // Trust code.
  if (options.origin === 'code')
    return path.resolve(dir, fileName);

  // Trust llm to use valid characters in file names.
  if (options.origin === 'llm') {
    fileName = fileName.split('\\').join('/');
    const resolvedFile = path.resolve(dir, fileName);
    if (!resolvedFile.startsWith(path.resolve(dir) + path.sep))
      throw new Error(`Resolved file path for ${fileName} is outside of the output directory`);
    return resolvedFile;
  }

  // Do not trust web, at all.
  return path.join(dir, sanitizeForFilePath(fileName));
}

function pickDefined<T extends object>(obj: T | undefined): Partial<T> {
  return Object.fromEntries(
      Object.entries(obj ?? {}).filter(([_, v]) => v !== undefined)
  ) as Partial<T>;
}

function mergeConfig(base: FullConfig, overrides: Config): FullConfig {
  const browser: FullConfig['browser'] = {
    ...pickDefined(base.browser),
    ...pickDefined(overrides.browser),
    browserName: overrides.browser?.browserName ?? base.browser?.browserName ?? 'chromium',
    isolated: overrides.browser?.isolated ?? base.browser?.isolated ?? false,
    launchOptions: {
      ...pickDefined(base.browser?.launchOptions),
      ...pickDefined(overrides.browser?.launchOptions),
      ...{ assistantMode: true },
    },
    contextOptions: {
      ...pickDefined(base.browser?.contextOptions),
      ...pickDefined(overrides.browser?.contextOptions),
    },
  };

  if (browser.browserName !== 'chromium' && browser.launchOptions)
    delete browser.launchOptions.channel;

  return {
    ...pickDefined(base),
    ...pickDefined(overrides),
    browser,
    network: {
      ...pickDefined(base.network),
      ...pickDefined(overrides.network),
    },
    server: {
      ...pickDefined(base.server),
      ...pickDefined(overrides.server),
    },
    timeouts: {
      ...pickDefined(base.timeouts),
      ...pickDefined(overrides.timeouts),
    },
  } as FullConfig;
}

export function semicolonSeparatedList(value: string | undefined): string[] | undefined {
  if (!value)
    return undefined;
  return value.split(';').map(v => v.trim());
}

export function commaSeparatedList(value: string | undefined): string[] | undefined {
  if (!value)
    return undefined;
  return value.split(',').map(v => v.trim());
}

export function dotenvFileLoader(value: string | undefined): Record<string, string> | undefined {
  if (!value)
    return undefined;
  return dotenv.parse(fs.readFileSync(value, 'utf8'));
}

export function numberParser(value: string | undefined): number | undefined {
  if (!value)
    return undefined;
  return +value;
}

export function resolutionParser(name: string, value: string | undefined): ViewportSize | undefined {
  if (!value)
    return undefined;
  if (value.includes('x')) {
    const [width, height] = value.split('x').map(v => +v);
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0)
      throw new Error(`Invalid resolution format: use ${name}="800x600"`);
    return { width, height };
  }

  // Legacy format
  if (value.includes(',')) {
    const [width, height] = value.split(',').map(v => +v);
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0)
      throw new Error(`Invalid resolution format: use ${name}="800x600"`);
    return { width, height };
  }

  throw new Error(`Invalid resolution format: use ${name}="800x600"`);
}

export function headerParser(arg: string | undefined, previous?: Record<string, string>): Record<string, string> {
  if (!arg)
    return previous || {};
  const result: Record<string, string> = previous || {};
  const [name, value] = arg.split(':').map(v => v.trim());
  result[name] = value;
  return result;
}

function envToBoolean(value: string | undefined): boolean | undefined {
  if (value === 'true' || value === '1')
    return true;
  if (value === 'false' || value === '0')
    return false;
  return undefined;
}

function envToString(value: string | undefined): string | undefined {
  return value ? value.trim() : undefined;
}

function sanitizeForFilePath(s: string) {
  const sanitize = (s: string) => s.replace(/[\x00-\x2C\x2E-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, '-');
  const separator = s.lastIndexOf('.');
  if (separator === -1)
    return sanitize(s);
  return sanitize(s.substring(0, separator)) + '.' + sanitize(s.substring(separator + 1));
}
