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

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from '@playwright/test';

const schemaPath = path.join(__dirname, '..', '..', 'packages', 'playwright-core', 'src', 'tools', 'mcp', 'mcp-config.schema.json');

function loadSchema() {
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

test('schema is valid JSON with expected draft-07 structure', async () => {
  const schema = loadSchema();
  expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
  expect(schema.$id).toContain('mcp-config.schema.json');
  expect(schema.type).toBe('object');
  expect(schema.properties).toBeTruthy();
  expect(schema.title).toContain('Playwright');
  expect(schema.description).toContain('INI');
});

test('schema has all top-level config keys', async () => {
  const schema = loadSchema();
  const props = Object.keys(schema.properties);
  for (const key of [
    '$schema', 'browser', 'extension', 'server', 'capabilities', 'saveSession',
    'saveTrace', 'sharedBrowserContext', 'secrets', 'outputDir',
    'console', 'network', 'testIdAttribute', 'timeouts',
    'imageResponses', 'snapshot', 'allowUnrestrictedFileAccess', 'codegen',
  ])
    expect(props, `missing top-level key: ${key}`).toContain(key);
});

test('schema allows $schema property at top level', async () => {
  const schema = loadSchema();
  expect(schema.properties.$schema).toEqual({ type: 'string', description: expect.any(String) });
  expect(schema.additionalProperties).toBe(false);
});

test('schema sets additionalProperties: false on all object types', async () => {
  const schema = loadSchema();

  function checkAdditionalProperties(obj: any, path: string) {
    if (obj.type === 'object' && obj.properties) {
      expect(obj.additionalProperties, `${path} missing additionalProperties: false`).toBe(false);
      for (const [key, value] of Object.entries(obj.properties))
        checkAdditionalProperties(value as any, `${path}.${key}`);
    }
    if (obj.oneOf) {
      for (const item of obj.oneOf)
        checkAdditionalProperties(item, path);
    }
    if (obj.items)
      checkAdditionalProperties(obj.items, `${path}[]`);
  }

  checkAdditionalProperties(schema, 'root');
});

test('schema browser.browserName is a 3-value enum', async () => {
  const schema = loadSchema();
  expect(schema.properties.browser.properties.browserName.enum).toEqual(['chromium', 'firefox', 'webkit']);
});

test('schema enum types have correct values', async () => {
  const schema = loadSchema();
  expect(schema.properties.console.properties.level.enum).toEqual(['error', 'warning', 'info', 'debug']);
  expect(schema.properties.imageResponses.enum).toContain('allow');
  expect(schema.properties.imageResponses.enum).toContain('omit');
  expect(schema.properties.codegen.enum).toContain('typescript');
  expect(schema.properties.codegen.enum).toContain('none');
  expect(schema.properties.snapshot.properties.mode.enum).toContain('full');
  expect(schema.properties.snapshot.properties.mode.enum).toContain('none');

  const caps = schema.properties.capabilities;
  expect(caps.type).toBe('array');
  const capItems = caps.items;
  expect(capItems.enum).toContain('core');
  expect(capItems.enum).toContain('vision');
  expect(capItems.enum).toContain('devtools');
});

test('schema browser.launchOptions has expected properties', async () => {
  const schema = loadSchema();
  const launchOpts = schema.properties.browser.properties.launchOptions.properties;
  for (const key of ['headless', 'channel', 'executablePath', 'args', 'proxy', 'slowMo', 'timeout', 'chromiumSandbox', 'tracesDir', 'downloadsPath'])
    expect(Object.keys(launchOpts), `launchOptions missing: ${key}`).toContain(key);
});

test('schema browser.contextOptions has expected properties', async () => {
  const schema = loadSchema();
  const ctxOpts = schema.properties.browser.properties.contextOptions.properties;
  for (const key of ['viewport', 'locale', 'colorScheme', 'baseURL', 'storageState', 'permissions', 'geolocation', 'httpCredentials', 'clientCertificates'])
    expect(Object.keys(ctxOpts), `contextOptions missing: ${key}`).toContain(key);
});

test('schema excludes non-JSON types (Logger, Buffer)', async () => {
  const schema = loadSchema();
  const launchOpts = schema.properties.browser.properties.launchOptions.properties;
  const ctxOpts = schema.properties.browser.properties.contextOptions.properties;

  expect(launchOpts.logger).toBeUndefined();
  expect(ctxOpts.logger).toBeUndefined();

  const clientCerts = ctxOpts.clientCertificates?.items?.properties;
  if (clientCerts) {
    expect(clientCerts.cert).toBeUndefined();
    expect(clientCerts.key).toBeUndefined();
    expect(clientCerts.pfx).toBeUndefined();
    expect(clientCerts.certPath).toBeTruthy();
    expect(clientCerts.keyPath).toBeTruthy();
    expect(clientCerts.pfxPath).toBeTruthy();
  }
});

test('schema colorScheme allows null and string literals', async () => {
  const schema = loadSchema();
  const colorScheme = schema.properties.browser.properties.contextOptions.properties.colorScheme;
  expect(colorScheme.oneOf).toBeTruthy();
  expect(colorScheme.oneOf.some((s: any) => s.type === 'null')).toBe(true);
  expect(colorScheme.oneOf.some((s: any) => s.enum?.includes('light'))).toBe(true);
  expect(colorScheme.oneOf.some((s: any) => s.enum?.includes('dark'))).toBe(true);
});

test('schema ignoreDefaultArgs allows boolean or string array', async () => {
  const schema = loadSchema();
  const prop = schema.properties.browser.properties.launchOptions.properties.ignoreDefaultArgs;
  expect(prop.oneOf).toBeTruthy();
  expect(prop.oneOf.some((s: any) => s.type === 'boolean')).toBe(true);
  expect(prop.oneOf.some((s: any) => s.type === 'array' && s.items?.type === 'string')).toBe(true);
});

test('schema viewport allows null or object with required width/height', async () => {
  const schema = loadSchema();
  const viewport = schema.properties.browser.properties.contextOptions.properties.viewport;
  expect(viewport.oneOf).toBeTruthy();
  expect(viewport.oneOf.some((s: any) => s.type === 'null')).toBe(true);
  const objSchema = viewport.oneOf.find((s: any) => s.type === 'object');
  expect(objSchema).toBeTruthy();
  expect(objSchema.properties.width.type).toBe('number');
  expect(objSchema.properties.height.type).toBe('number');
  expect(objSchema.required).toContain('width');
  expect(objSchema.required).toContain('height');
});

test('schema proxy has server as required', async () => {
  const schema = loadSchema();
  const launchProxy = schema.properties.browser.properties.launchOptions.properties.proxy;
  const ctxProxy = schema.properties.browser.properties.contextOptions.properties.proxy;
  expect(launchProxy.required).toContain('server');
  expect(ctxProxy.required).toContain('server');
});

test('schema Record types use additionalProperties', async () => {
  const schema = loadSchema();
  const secrets = schema.properties.secrets;
  expect(secrets.type).toBe('object');
  expect(secrets.additionalProperties).toEqual({ type: 'string' });

  const cdpHeaders = schema.properties.browser.properties.cdpHeaders;
  expect(cdpHeaders.type).toBe('object');
  expect(cdpHeaders.additionalProperties).toEqual({ type: 'string' });
});

test('schema storageState allows string or structured object', async () => {
  const schema = loadSchema();
  const ss = schema.properties.browser.properties.contextOptions.properties.storageState;
  expect(ss.oneOf).toBeTruthy();
  expect(ss.oneOf.some((s: any) => s.type === 'string')).toBe(true);
  const objBranch = ss.oneOf.find((s: any) => s.type === 'object');
  expect(objBranch).toBeTruthy();
  expect(objBranch.properties.cookies).toBeTruthy();
  expect(objBranch.properties.origins).toBeTruthy();
});

test('schema storageState.origins[].localStorage[].name is string (regression)', async () => {
  const schema = loadSchema();
  const ss = schema.properties.browser.properties.contextOptions.properties.storageState;
  const objBranch = ss.oneOf.find((s: any) => s.type === 'object');
  const originsItem = objBranch.properties.origins.items;
  const lsItem = originsItem.properties.localStorage.items;
  expect(lsItem.properties.name.type, 'localStorage name should be string, not object').toBe('string');
  expect(lsItem.properties.value.type, 'localStorage value should be string, not object').toBe('string');
});

test('schema recordHar.urlFilter is string (RegExp mapped to string)', async () => {
  const schema = loadSchema();
  const recordHar = schema.properties.browser.properties.contextOptions.properties.recordHar;
  expect(recordHar.properties.urlFilter.type).toBe('string');
});

test('schema saveTrace is boolean', async () => {
  const schema = loadSchema();
  expect(schema.properties.saveTrace.type).toBe('boolean');
});

test('schema has descriptions for documented fields', async () => {
  const schema = loadSchema();
  expect(schema.properties.browser.properties.browserName.description).toBeTruthy();
  expect(schema.properties.browser.properties.isolated.description).toBeTruthy();
  expect(schema.properties.extension.description).toBeTruthy();
  expect(schema.properties.timeouts.properties.action.description).toBeTruthy();
  expect(schema.properties.timeouts.properties.navigation.description).toBeTruthy();
  expect(schema.properties.timeouts.properties.expect.description).toBeTruthy();
});

test('schema descriptions are plain text without markdown syntax', async () => {
  const schema = loadSchema();
  const markdownLinkPattern = /\[([^\]]*)\]\([^)]*\)/;
  const backtickPattern = /`[^`]+`/;

  function collectDescriptions(obj: any, path: string, result: Array<{ path: string; description: string }>) {
    if (!obj || typeof obj !== 'object')
      return;
    if (typeof obj.description === 'string')
      result.push({ path, description: obj.description });
    if (obj.properties) {
      for (const [key, value] of Object.entries(obj.properties))
        collectDescriptions(value, `${path}.${key}`, result);
    }
    if (obj.oneOf) {
      for (const item of obj.oneOf)
        collectDescriptions(item, path, result);
    }
    if (obj.items)
      collectDescriptions(obj.items, `${path}[]`, result);
  }

  const descriptions: Array<{ path: string; description: string }> = [];
  collectDescriptions(schema, 'root', descriptions);
  expect(descriptions.length).toBeGreaterThan(0);

  for (const { path, description } of descriptions) {
    expect(description, `markdown link found at ${path}`).not.toMatch(markdownLinkPattern);
    expect(description, `backtick found at ${path}`).not.toMatch(backtickPattern);
  }
});

test('committed schema is up to date with config.d.ts', async () => {
  const committed = fs.readFileSync(schemaPath, 'utf8');
  execSync('node utils/generate_mcp_config_schema.js', {
    cwd: path.join(__dirname, '..', '..'),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const afterGenerate = fs.readFileSync(schemaPath, 'utf8');
  expect(afterGenerate).toBe(committed);
});
