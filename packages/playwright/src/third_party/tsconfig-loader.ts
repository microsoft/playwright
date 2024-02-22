/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 Jonas Kello
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/* eslint-disable */

import * as path from 'path';
import * as fs from 'fs';
import { json5 } from '../utilsBundle';

/**
 * Typing for the parts of tsconfig that we care about
 */
interface TsConfig {
  extends?: string;
  compilerOptions?: {
    baseUrl?: string;
    paths?: { [key: string]: Array<string> };
    strict?: boolean;
    allowJs?: boolean;
  };
  references?: { path: string }[];
}

export interface LoadedTsConfig {
  tsConfigPath: string;
  baseUrl?: string;
  paths?: { [key: string]: Array<string> };
  allowJs?: boolean;
}

export interface TsConfigLoaderParams {
  cwd: string;
}

export function tsConfigLoader({ cwd, }: TsConfigLoaderParams): LoadedTsConfig[] {
  const configPath = resolveConfigPath(cwd);

  if (!configPath)
    return [];

  const references: LoadedTsConfig[] = [];
  const config = loadTsConfig(configPath, references);
  return [config, ...references];
}

function resolveConfigPath(cwd: string): string | undefined {
  if (fs.statSync(cwd).isFile()) {
    return path.resolve(cwd);
  }

  const configAbsolutePath = walkForTsConfig(cwd);
  return configAbsolutePath ? path.resolve(configAbsolutePath) : undefined;
}

export function walkForTsConfig(
  directory: string,
  existsSync: (path: string) => boolean = fs.existsSync
): string | undefined {
  const tsconfigPath = path.join(directory, "./tsconfig.json");
  if (existsSync(tsconfigPath)) {
    return tsconfigPath;
  }
  const jsconfigPath = path.join(directory, "./jsconfig.json");
  if (existsSync(jsconfigPath)) {
    return jsconfigPath;
  }

  const parentDirectory = path.join(directory, "../");

  // If we reached the top
  if (directory === parentDirectory) {
    return undefined;
  }

  return walkForTsConfig(parentDirectory, existsSync);
}

function resolveConfigFile(baseConfigFile: string, referencedConfigFile: string) {
  if (!referencedConfigFile.endsWith('.json'))
    referencedConfigFile += '.json';
  const currentDir = path.dirname(baseConfigFile);
  let resolvedConfigFile = path.resolve(currentDir, referencedConfigFile);
  if (referencedConfigFile.indexOf('/') !== -1 && referencedConfigFile.indexOf('.') !== -1 && !fs.existsSync(referencedConfigFile))
    resolvedConfigFile = path.join(currentDir, 'node_modules', referencedConfigFile);
  return resolvedConfigFile;
}

function loadTsConfig(
  configFilePath: string,
  references: LoadedTsConfig[],
  visited = new Map<string, LoadedTsConfig>(),
): LoadedTsConfig {
  if (visited.has(configFilePath))
    return visited.get(configFilePath)!;

  let result: LoadedTsConfig = {
    tsConfigPath: configFilePath,
  };
  visited.set(configFilePath, result);

  if (!fs.existsSync(configFilePath))
    return result;

  const configString = fs.readFileSync(configFilePath, 'utf-8');
  const cleanedJson = StripBom(configString);
  const parsedConfig: TsConfig = json5.parse(cleanedJson);

  const extendsArray = Array.isArray(parsedConfig.extends) ? parsedConfig.extends : (parsedConfig.extends ? [parsedConfig.extends] : []);
  for (const extendedConfig of extendsArray) {
    const extendedConfigPath = resolveConfigFile(configFilePath, extendedConfig);
    const base = loadTsConfig(extendedConfigPath, references, visited);

    // baseUrl should be interpreted as relative to the base tsconfig,
    // but we need to update it so it is relative to the original tsconfig being loaded
    if (base.baseUrl && base.baseUrl) {
      const extendsDir = path.dirname(extendedConfig);
      base.baseUrl = path.join(extendsDir, base.baseUrl);
    }
    result = { ...result, ...base, tsConfigPath: configFilePath };
  }

  const loadedConfig = Object.fromEntries(Object.entries({
    baseUrl: parsedConfig.compilerOptions?.baseUrl,
    paths: parsedConfig.compilerOptions?.paths,
    allowJs: parsedConfig?.compilerOptions?.allowJs,
  }).filter(([, value]) => value !== undefined));

  result = { ...result, ...loadedConfig };

  for (const ref of parsedConfig.references || [])
    references.push(loadTsConfig(resolveConfigFile(configFilePath, ref.path), references, visited));

  if (path.basename(configFilePath) === 'jsconfig.json' && result.allowJs === undefined)
    result.allowJs = true;
  return result;
}

function StripBom(string: string) {
	if (typeof string !== 'string') {
		throw new TypeError(`Expected a string, got ${typeof string}`);
	}

	// Catches EFBBBF (UTF-8 BOM) because the buffer-to-string
	// conversion translates it to FEFF (UTF-16 BOM).
	if (string.charCodeAt(0) === 0xFEFF) {
		return string.slice(1);
	}

	return string;
}
