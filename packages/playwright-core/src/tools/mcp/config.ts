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
import path from 'path';
import os from 'os';

import dotenv from 'dotenv';
import { chromiumChannelNames, isChromiumChannelName } from '@utils/chromiumChannels';
import { playwright } from '../../inprocess';
import { configFromIniFile } from './configIni';

import type * as playwrightTypes from '../../..';
import type { Config, ToolCapability } from './config.d';

async function fileExistsAsync(resolved: string) {
  try { return (await fs.promises.stat(resolved)).isFile(); } catch { return false; }
}

type ViewportSize = { width: number; height: number };

export type CLIOptions = {
  allowedHosts?: string[];
  allowedOrigins?: string[];
  allowUnrestrictedFileAccess?: boolean;
  blockedOrigins?: string[];
  blockServiceWorkers?: boolean;
  browser?: string;
  caps?: string[];
  cdpEndpoint?: string;
  cdpHeader?: Record<string, string>;
  cdpTimeout?: number;
  codegen?: 'typescript' | 'none';
  config?: string;
  consoleLevel?: 'error' | 'warning' | 'info' | 'debug';
  device?: string;
  endpoint?: string;
  extension?: boolean;
  executablePath?: string;
  grantPermissions?: string[];
  headless?: boolean;
  host?: string;
  ignoreHttpsErrors?: boolean;
  initScript?: string[];
  initPage?: string[];
  isolated?: boolean;
  imageResponses?: 'allow' | 'omit';
  sandbox?: boolean;
  outputDir?: string;
  port?: number;
  proxyBypass?: string;
  proxyServer?: string;
  saveSession?: boolean;
  secrets?: Record<string, string>;
  sharedBrowserContext?: boolean;
  snapshotMode?: 'full' | 'none';
  storageState?: string;
  testIdAttribute?: string;
  timeoutAction?: number;
  timeoutNavigation?: number;
  userAgent?: string;
  userDataDir?: string;
  viewportSize?: ViewportSize;
};

const defaultConfig: MergedConfig = {
  browser: {
    launchOptions: {},
    contextOptions: {},
  },
  timeouts: {
    action: 5000,
    navigation: 60000,
    expect: 5000,
  },
};

type BrowserUserConfig = NonNullable<Config['browser']>;

export type MergedConfig = Config & {
  browser: BrowserUserConfig & {
    launchOptions: NonNullable<BrowserUserConfig['launchOptions']>;
    contextOptions: NonNullable<BrowserUserConfig['contextOptions']>;
  }
};

export type FullConfig = MergedConfig & {
  browser: MergedConfig['browser'] & {
    browserName: 'chromium' | 'firefox' | 'webkit';
  },
  skillMode?: boolean;
  configFile?: string;
};

export async function resolveConfig(config: Config): Promise<FullConfig> {
  const merged = mergeConfig(defaultConfig, config);
  const browser = await validateBrowserConfig(merged.browser);
  return { ...merged, browser };
}

export async function resolveCLIConfigForMCP(cliOptions: CLIOptions, env?: NodeJS.ProcessEnv): Promise<FullConfig> {
  const envOverrides = configFromEnv(env);
  const cliOverrides = configFromCLIOptions(cliOptions);
  const configFile = cliOverrides.configFile ?? envOverrides.configFile;
  const configInFile = await loadConfig(configFile);

  let result = defaultConfig;
  result = mergeConfig(result, configInFile);
  result = mergeConfig(result, envOverrides);
  result = mergeConfig(result, cliOverrides);

  const browser = await validateBrowserConfig(result.browser);
  if (browser.launchOptions.headless === undefined)
    browser.launchOptions.headless = os.platform() === 'linux' && !process.env.DISPLAY;

  return { ...result, browser, configFile };
}

export async function resolveCLIConfigForCLI(daemonProfilesDir: string, sessionName: string, options: any, env?: NodeJS.ProcessEnv): Promise<FullConfig> {
  const config = options.config ? path.resolve(options.config) : undefined;
  try {
    const defaultConfigFile = path.resolve('.playwright', 'cli.config.json');
    if (!config && fs.existsSync(defaultConfigFile))
      options.config = defaultConfigFile;
  } catch {
  }

  const daemonOverrides = configFromCLIOptions({
    endpoint: options.endpoint,
    cdpEndpoint: options.cdp,
    config: options.config,
    browser: options.browser,
    headless: options.headed ? false : undefined,
    extension: options.extension,
    userDataDir: options.profile,
    snapshotMode: 'full',
  });

  const envOverrides = configFromEnv(env);
  const configFile = daemonOverrides.configFile ?? envOverrides.configFile;
  const configInFile = await loadConfig(configFile);
  const globalConfigPath = path.join((env ?? process.env)['PWTEST_CLI_GLOBAL_CONFIG'] ?? os.homedir(), '.playwright', 'cli.config.json');
  const globalConfigInFile = await loadConfig(fs.existsSync(globalConfigPath) ? globalConfigPath : undefined);

  let result = defaultConfig;
  result = mergeConfig(result, globalConfigInFile);
  result = mergeConfig(result, configInFile);
  result = mergeConfig(result, envOverrides);
  result = mergeConfig(result, daemonOverrides);

  if (result.browser.isolated === undefined)
    result.browser.isolated = !options.profile && !options.persistent && !result.browser.userDataDir && !result.browser.remoteEndpoint && !result.browser.cdpEndpoint && !result.extension;

  if (result.browser.launchOptions.headless === undefined)
    result.browser.launchOptions.headless = true;

  const browser = await validateBrowserConfig(result.browser);

  if (!result.extension && !browser.isolated && !browser.userDataDir && !browser.remoteEndpoint && !browser.cdpEndpoint) {
    // No custom value provided, use the daemon data dir.
    const browserToken = browser.launchOptions?.channel ?? browser?.browserName;
    const userDataDir = path.resolve(daemonProfilesDir, `ud-${sessionName}-${browserToken}`);
    browser.userDataDir = userDataDir;
  }

  return { ...result, browser, configFile, skillMode: true };
}

async function validateBrowserConfig(browser: MergedConfig['browser']): Promise<FullConfig['browser']> {
  let browserName = browser.browserName;
  if (!browserName) {
    browserName = 'chromium';
    // Assign channel only if the browserName is not provided, otherwise assume full control to the user.
    if (browser.launchOptions.channel === undefined)
      browser.launchOptions.channel = 'chrome';
  } else if (browserName !== 'chromium' && browserName !== 'firefox' && browserName !== 'webkit') {
    const value = browserName as string;
    const lines = [
      `Unsupported "browser.browserName": "${value}". It must be one of: "chromium", "firefox", "webkit".`,
    ];
    if (isChromiumChannelName(value)) {
      lines.push(`To use "${value}", set it as the launch channel instead:`);
      lines.push(JSON.stringify({ browser: { browserName: 'chromium', launchOptions: { channel: value } } }, null, 2));
    } else {
      lines.push(`Supported Chromium channels (set via "browser.launchOptions.channel"): ${chromiumChannelNames().join(', ')}.`);
    }
    throw new Error(lines.join('\n'));
  }

  if (browser.browserName === 'chromium' && browser.launchOptions.chromiumSandbox === undefined) {
    if (process.platform === 'linux')
      browser.launchOptions.chromiumSandbox = browser.launchOptions.channel !== 'chromium' && browser.launchOptions.channel !== 'chrome-for-testing';
    else
      browser.launchOptions.chromiumSandbox = true;
  }

  if (browser.isolated && browser.userDataDir)
    throw new Error('Browser userDataDir is not supported in isolated mode.');

  if (browser.initScript) {
    for (const script of browser.initScript) {
      if (!await fileExistsAsync(script))
        throw new Error(`Init script file does not exist: ${script}`);
    }
  }
  if (browser.initPage) {
    for (const page of browser.initPage) {
      if (!await fileExistsAsync(page))
        throw new Error(`Init page file does not exist: ${page}`);
    }
  }
  if (browser.contextOptions.viewport === undefined) {
    if (browser.launchOptions.headless)
      browser.contextOptions.viewport = { width: 1280, height: 720 };
    else
      browser.contextOptions.viewport = null;
  }

  if (browserName === 'chromium') {
    browser.launchOptions.args = browser.launchOptions.args ?? [];
    if (!browser.launchOptions.args.some(a => a.includes('--disable-blink-features')))
      browser.launchOptions.args.push(`--disable-blink-features=AutomationControlled`);
  }

  return { ...browser, browserName };
}

function configFromCLIOptions(cliOptions: CLIOptions): Config & { configFile?: string } {
  let browserName: 'chromium' | 'firefox' | 'webkit' | undefined;
  let channel: string | undefined;
  if (cliOptions.browser && isChromiumChannelName(cliOptions.browser)) {
    browserName = 'chromium';
    channel = cliOptions.browser;
  } else {
    switch (cliOptions.browser) {
      case 'chromium':
        // Never use old headless.
        browserName = 'chromium';
        channel = 'chrome-for-testing';
        break;
      case 'firefox':
        browserName = 'firefox';
        break;
      case 'webkit':
        browserName = 'webkit';
        break;
    }
  }

  // Launch options
  const launchOptions: playwrightTypes.LaunchOptions = {
    channel,
    executablePath: cliOptions.executablePath,
    headless: cliOptions.headless,
  };

  // --sandbox was passed, enable the sandbox
  // --no-sandbox was passed, disable the sandbox
  if (cliOptions.sandbox !== undefined)
    launchOptions.chromiumSandbox = cliOptions.sandbox;

  if (cliOptions.device && cliOptions.cdpEndpoint)
    throw new Error('Device emulation is not supported with cdpEndpoint.');

  // Context options
  const contextOptions: playwrightTypes.BrowserContextOptions = cliOptions.device ? playwright.devices[cliOptions.device] : {};

  if (cliOptions.proxyServer) {
    const proxy: playwrightTypes.LaunchOptions['proxy'] = { server: cliOptions.proxyServer };
    if (cliOptions.proxyBypass)
      proxy.bypass = cliOptions.proxyBypass;
    // Set on both to ensure CLI takes precedence over any proxy set in the config file
    // (launchOptions.proxy applies at browser launch, contextOptions.proxy at context creation).
    launchOptions.proxy = proxy;
    contextOptions.proxy = proxy;
  }

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

  const config: Config = {
    browser: {
      browserName,
      isolated: cliOptions.isolated,
      userDataDir: cliOptions.userDataDir,
      launchOptions,
      contextOptions,
      cdpEndpoint: cliOptions.cdpEndpoint,
      cdpHeaders: cliOptions.cdpHeader,
      cdpTimeout: cliOptions.cdpTimeout,
      initPage: cliOptions.initPage,
      initScript: cliOptions.initScript,
      remoteEndpoint: cliOptions.endpoint,
    },
    extension: cliOptions.extension,
    server: {
      port: cliOptions.port,
      host: cliOptions.host,
      allowedHosts: cliOptions.allowedHosts,
    },
    capabilities: cliOptions.caps as ToolCapability[],
    console: {
      level: cliOptions.consoleLevel,
    },
    network: {
      allowedOrigins: cliOptions.allowedOrigins,
      blockedOrigins: cliOptions.blockedOrigins,
    },
    allowUnrestrictedFileAccess: cliOptions.allowUnrestrictedFileAccess,
    codegen: cliOptions.codegen,
    saveSession: cliOptions.saveSession,
    secrets: cliOptions.secrets,
    sharedBrowserContext: cliOptions.sharedBrowserContext,
    snapshot: cliOptions.snapshotMode ? { mode: cliOptions.snapshotMode } : undefined,
    outputDir: cliOptions.outputDir,
    imageResponses: cliOptions.imageResponses,
    testIdAttribute: cliOptions.testIdAttribute,
    timeouts: {
      action: cliOptions.timeoutAction,
      navigation: cliOptions.timeoutNavigation,
    },
  };

  return { ...config, configFile: cliOptions.config };
}

export function configFromEnv(env?: NodeJS.ProcessEnv): Config & { configFile?: string } {
  const e = env ?? process.env;
  const options: CLIOptions = {};
  options.allowedHosts = commaSeparatedList(e.PLAYWRIGHT_MCP_ALLOWED_HOSTS);
  options.allowedOrigins = semicolonSeparatedList(e.PLAYWRIGHT_MCP_ALLOWED_ORIGINS);
  options.allowUnrestrictedFileAccess = envToBoolean(e.PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS);
  options.blockedOrigins = semicolonSeparatedList(e.PLAYWRIGHT_MCP_BLOCKED_ORIGINS);
  options.blockServiceWorkers = envToBoolean(e.PLAYWRIGHT_MCP_BLOCK_SERVICE_WORKERS);
  options.browser = envToString(e.PLAYWRIGHT_MCP_BROWSER);
  options.caps = commaSeparatedList(e.PLAYWRIGHT_MCP_CAPS);
  options.cdpEndpoint = envToString(e.PLAYWRIGHT_MCP_CDP_ENDPOINT);
  options.cdpHeader = headerParser(envToString(e.PLAYWRIGHT_MCP_CDP_HEADERS));
  options.cdpTimeout = numberParser(e.PLAYWRIGHT_MCP_CDP_TIMEOUT);
  options.config = envToString(e.PLAYWRIGHT_MCP_CONFIG);
  if (e.PLAYWRIGHT_MCP_CONSOLE_LEVEL)
    options.consoleLevel = enumParser<'error' | 'warning' | 'info' | 'debug'>('--console-level', ['error', 'warning', 'info', 'debug'], e.PLAYWRIGHT_MCP_CONSOLE_LEVEL);
  options.device = envToString(e.PLAYWRIGHT_MCP_DEVICE);
  options.executablePath = envToString(e.PLAYWRIGHT_MCP_EXECUTABLE_PATH);
  options.extension = envToBoolean(e.PLAYWRIGHT_MCP_EXTENSION);
  options.grantPermissions = commaSeparatedList(e.PLAYWRIGHT_MCP_GRANT_PERMISSIONS);
  options.headless = envToBoolean(e.PLAYWRIGHT_MCP_HEADLESS);
  options.host = envToString(e.PLAYWRIGHT_MCP_HOST);
  options.ignoreHttpsErrors = envToBoolean(e.PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS);
  const initPage = envToString(e.PLAYWRIGHT_MCP_INIT_PAGE);
  if (initPage)
    options.initPage = [initPage];
  const initScript = envToString(e.PLAYWRIGHT_MCP_INIT_SCRIPT);
  if (initScript)
    options.initScript = [initScript];
  options.isolated = envToBoolean(e.PLAYWRIGHT_MCP_ISOLATED);
  if (e.PLAYWRIGHT_MCP_IMAGE_RESPONSES)
    options.imageResponses = enumParser<'allow' | 'omit'>('--image-responses', ['allow', 'omit'], e.PLAYWRIGHT_MCP_IMAGE_RESPONSES);
  options.sandbox = envToBoolean(e.PLAYWRIGHT_MCP_SANDBOX);
  options.outputDir = envToString(e.PLAYWRIGHT_MCP_OUTPUT_DIR);
  options.port = numberParser(e.PLAYWRIGHT_MCP_PORT);
  options.proxyBypass = envToString(e.PLAYWRIGHT_MCP_PROXY_BYPASS);
  options.proxyServer = envToString(e.PLAYWRIGHT_MCP_PROXY_SERVER);
  options.secrets = dotenvFileLoader(e.PLAYWRIGHT_MCP_SECRETS_FILE);
  options.storageState = envToString(e.PLAYWRIGHT_MCP_STORAGE_STATE);
  options.testIdAttribute = envToString(e.PLAYWRIGHT_MCP_TEST_ID_ATTRIBUTE);
  options.timeoutAction = numberParser(e.PLAYWRIGHT_MCP_TIMEOUT_ACTION);
  options.timeoutNavigation = numberParser(e.PLAYWRIGHT_MCP_TIMEOUT_NAVIGATION);
  options.userAgent = envToString(e.PLAYWRIGHT_MCP_USER_AGENT);
  options.userDataDir = envToString(e.PLAYWRIGHT_MCP_USER_DATA_DIR);
  options.viewportSize = resolutionParser('--viewport-size', e.PLAYWRIGHT_MCP_VIEWPORT_SIZE);
  return configFromCLIOptions(options);
}

export async function loadConfig(configFile: string | undefined): Promise<Config> {
  if (!configFile)
    return {};

  if (configFile.endsWith('.ini'))
    return configFromIniFile(configFile);

  try {
    const data = await fs.promises.readFile(configFile, 'utf8');
    return JSON.parse(data.charCodeAt(0) === 0xFEFF ? data.slice(1) : data);
  } catch {
    return configFromIniFile(configFile);
  }
}

function pickDefined<T extends object>(obj: T | undefined): Partial<T> {
  return Object.fromEntries(
      Object.entries(obj ?? {}).filter(([_, v]) => v !== undefined)
  ) as Partial<T>;
}

function mergeConfig(base: MergedConfig, overrides: Config): MergedConfig {
  const browser: Config['browser'] = {
    ...pickDefined(base.browser),
    ...pickDefined(overrides.browser),
    browserName: overrides.browser?.browserName ?? base.browser?.browserName,
    isolated: overrides.browser?.isolated ?? base.browser?.isolated,
    launchOptions: {
      ...pickDefined(base.browser?.launchOptions),
      ...pickDefined(overrides.browser?.launchOptions),
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
    console: {
      ...pickDefined(base.console),
      ...pickDefined(overrides.console),
    },
    network: {
      ...pickDefined(base.network),
      ...pickDefined(overrides.network),
    },
    server: {
      ...pickDefined(base.server),
      ...pickDefined(overrides.server),
    },
    snapshot: {
      ...pickDefined(base.snapshot),
      ...pickDefined(overrides.snapshot),
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

export function headerParser(arg: string | undefined, previous?: Record<string, string>): Record<string, string> | undefined {
  if (!arg)
    return previous;
  const result: Record<string, string> = { ...(previous ?? {}) };
  const colonIndex = arg.indexOf(':');

  const name = colonIndex === -1 ? arg.trim() : arg.substring(0, colonIndex).trim();
  const value = colonIndex === -1 ? '' : arg.substring(colonIndex + 1).trim();
  result[name] = value;
  return result;
}

export function enumParser<T extends string>(name: string, options: T[], value: string): T {
  if (!options.includes(value as T))
    throw new Error(`Invalid ${name}: ${value}. Valid values are: ${options.join(', ')}`);
  return value as T;
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
