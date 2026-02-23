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

import { ini } from 'playwright-core/lib/utilsBundle';

import type { Config } from '../config';

export function configFromIniFile(filePath: string): Config {
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = ini.parse(content);
  return iniEntriesToConfig(parsed);
}

export function configsFromIniFile(filePath: string): Map<string, Config> {
  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = ini.parse(content);
  const result = new Map<string, Config>();
  for (const [sectionName, sectionData] of Object.entries(parsed)) {
    if (typeof sectionData !== 'object' || sectionData === null)
      continue;
    result.set(sectionName, iniEntriesToConfig(sectionData as Record<string, any>));
  }
  return result;
}

function iniEntriesToConfig(entries: Record<string, any>): Config {
  const config: Record<string, any> = {};
  for (const [targetPath, rawValue] of Object.entries(entries)) {
    const type = longhandTypes[targetPath];
    const value = type ? coerceToType(rawValue, type) : coerceIniValue(rawValue);
    setNestedValue(config, targetPath, value);
  }
  return config as Config;
}

function coerceToType(value: any, type: LonghandType): any {
  switch (type) {
    case 'string':
      return String(value);
    case 'number':
      return Number(value);
    case 'boolean':
      if (typeof value === 'boolean')
        return value;
      return value === 'true' || value === '1';
    case 'string[]':
      if (Array.isArray(value))
        return value.map(String);
      return [String(value)];
    case 'size': {
      if (typeof value === 'string' && value.includes('x')) {
        const [w, h] = value.split('x').map(Number);
        if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0)
          return { width: w, height: h };
      }
      return undefined;
    }
  }
}

function coerceIniValue(value: any): any {
  if (typeof value !== 'string')
    return value;
  const trimmed = value.trim();
  if (trimmed === '')
    return trimmed;
  const num = Number(trimmed);
  if (!isNaN(num))
    return num;
  return value;
}

function setNestedValue(obj: Record<string, any>, dotPath: string, value: any) {
  const parts = dotPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null)
      current[part] = {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

// Regenerate this based on packages/playwright/src/mcp/config.d.ts when config changes.

type LonghandType = 'string' | 'number' | 'boolean' | 'string[]' | 'size';

const longhandTypes: Record<string, LonghandType> = {
  // browser direct
  'browser.browserName': 'string',
  'browser.isolated': 'boolean',
  'browser.userDataDir': 'string',
  'browser.cdpEndpoint': 'string',
  'browser.cdpTimeout': 'number',
  'browser.remoteEndpoint': 'string',
  'browser.initPage': 'string[]',
  'browser.initScript': 'string[]',

  // browser.launchOptions
  'browser.launchOptions.channel': 'string',
  'browser.launchOptions.headless': 'boolean',
  'browser.launchOptions.executablePath': 'string',
  'browser.launchOptions.chromiumSandbox': 'boolean',
  'browser.launchOptions.args': 'string[]',
  'browser.launchOptions.downloadsPath': 'string',
  'browser.launchOptions.handleSIGHUP': 'boolean',
  'browser.launchOptions.handleSIGINT': 'boolean',
  'browser.launchOptions.handleSIGTERM': 'boolean',
  'browser.launchOptions.slowMo': 'number',
  'browser.launchOptions.timeout': 'number',
  'browser.launchOptions.tracesDir': 'string',
  'browser.launchOptions.proxy.server': 'string',
  'browser.launchOptions.proxy.bypass': 'string',
  'browser.launchOptions.proxy.username': 'string',
  'browser.launchOptions.proxy.password': 'string',

  // browser.contextOptions
  'browser.contextOptions.acceptDownloads': 'boolean',
  'browser.contextOptions.baseURL': 'string',
  'browser.contextOptions.bypassCSP': 'boolean',
  'browser.contextOptions.colorScheme': 'string',
  'browser.contextOptions.contrast': 'string',
  'browser.contextOptions.deviceScaleFactor': 'number',
  'browser.contextOptions.forcedColors': 'string',
  'browser.contextOptions.hasTouch': 'boolean',
  'browser.contextOptions.ignoreHTTPSErrors': 'boolean',
  'browser.contextOptions.isMobile': 'boolean',
  'browser.contextOptions.javaScriptEnabled': 'boolean',
  'browser.contextOptions.locale': 'string',
  'browser.contextOptions.offline': 'boolean',
  'browser.contextOptions.permissions': 'string[]',
  'browser.contextOptions.reducedMotion': 'string',
  'browser.contextOptions.screen': 'size',
  'browser.contextOptions.serviceWorkers': 'string',
  'browser.contextOptions.storageState': 'string',
  'browser.contextOptions.strictSelectors': 'boolean',
  'browser.contextOptions.timezoneId': 'string',
  'browser.contextOptions.userAgent': 'string',
  'browser.contextOptions.viewport': 'size',

  // top-level
  'extension': 'boolean',
  'capabilities': 'string[]',
  'saveSession': 'boolean',
  'saveTrace': 'boolean',
  'saveVideo': 'size',
  'sharedBrowserContext': 'boolean',
  'outputDir': 'string',
  'outputMode': 'string',
  'imageResponses': 'string',
  'allowUnrestrictedFileAccess': 'boolean',
  'codegen': 'string',
  'testIdAttribute': 'string',

  // server
  'server.port': 'number',
  'server.host': 'string',
  'server.allowedHosts': 'string[]',

  // console
  'console.level': 'string',

  // network
  'network.allowedOrigins': 'string[]',
  'network.blockedOrigins': 'string[]',

  // timeouts
  'timeouts.action': 'number',
  'timeouts.navigation': 'number',

  // snapshot
  'snapshot.mode': 'string',
};
