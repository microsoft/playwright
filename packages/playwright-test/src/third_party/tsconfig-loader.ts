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
interface Tsconfig {
  extends?: string;
  compilerOptions?: {
    baseUrl?: string;
    paths?: { [key: string]: Array<string> };
    strict?: boolean;
    allowJs?: boolean;
  };
}

export interface TsConfigLoaderResult {
  tsConfigPath: string | undefined;
  baseUrl: string | undefined;
  paths: { [key: string]: Array<string> } | undefined;
  serialized: string | undefined;
  allowJs: boolean;
}

export interface TsConfigLoaderParams {
  cwd: string;
}

export function tsConfigLoader({
  cwd,
}: TsConfigLoaderParams): TsConfigLoaderResult {
  const loadResult = loadSyncDefault(cwd);
  loadResult.serialized = JSON.stringify(loadResult);
  return loadResult;
}

function loadSyncDefault(
  cwd: string,
): TsConfigLoaderResult {
  // Tsconfig.loadSync uses path.resolve. This is why we can use an absolute path as filename

  const configPath = resolveConfigPath(cwd);

  if (!configPath) {
    return {
      tsConfigPath: undefined,
      baseUrl: undefined,
      paths: undefined,
      serialized: undefined,
      allowJs: false,
    };
  }
  const config = loadTsconfig(configPath);

  return {
    tsConfigPath: configPath,
    baseUrl:
      (config && config.compilerOptions && config.compilerOptions.baseUrl),
    paths: config && config.compilerOptions && config.compilerOptions.paths,
    serialized: undefined,
    allowJs: !!config?.compilerOptions?.allowJs,
  };
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

function loadTsconfig(
  configFilePath: string,
  existsSync: (path: string) => boolean = fs.existsSync,
  readFileSync: (filename: string) => string = (filename: string) =>
    fs.readFileSync(filename, "utf8")
): Tsconfig | undefined {
  if (!existsSync(configFilePath)) {
    return undefined;
  }

  const configString = readFileSync(configFilePath);
  const cleanedJson = StripBom(configString);
  let config: Tsconfig = json5.parse(cleanedJson);
  let extendedConfig = config.extends;

  if (extendedConfig) {
    if (
      typeof extendedConfig === "string" &&
      extendedConfig.indexOf(".json") === -1
    ) {
      extendedConfig += ".json";
    }
    const currentDir = path.dirname(configFilePath);
    let extendedConfigPath = path.join(currentDir, extendedConfig);
    if (
      extendedConfig.indexOf("/") !== -1 &&
      extendedConfig.indexOf(".") !== -1 &&
      !existsSync(extendedConfigPath)
    ) {
      extendedConfigPath = path.join(
        currentDir,
        "node_modules",
        extendedConfig
      );
    }

    const base =
      loadTsconfig(extendedConfigPath, existsSync, readFileSync) || {};

    // baseUrl should be interpreted as relative to the base tsconfig,
    // but we need to update it so it is relative to the original tsconfig being loaded
    if (base.compilerOptions && base.compilerOptions.baseUrl) {
      const extendsDir = path.dirname(extendedConfig);
      base.compilerOptions.baseUrl = path.join(
        extendsDir,
        base.compilerOptions.baseUrl
      );
    }

    config = {
      ...base,
      ...config,
      compilerOptions: {
        ...base.compilerOptions,
        ...config.compilerOptions,
      },
    };
  }

  if (path.basename(configFilePath) === 'jsconfig.json' && config.compilerOptions?.allowJs === undefined) {
    config.compilerOptions = config.compilerOptions || {};
    config.compilerOptions.allowJs = true;
  }

  return config;
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
