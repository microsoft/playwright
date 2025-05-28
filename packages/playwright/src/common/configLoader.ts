/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import path from 'path';

import { isRegExp } from 'playwright-core/lib/utils';

import { requireOrImport, setSingleTSConfig, setTransformConfig } from '../transform/transform';
import { errorWithFile, fileIsModule } from '../util';
import { FullConfigInternal } from './config';
import { configureESMLoader, configureESMLoaderTransformConfig, registerESMLoader } from './esmLoaderHost';
import { addToCompilationCache } from '../transform/compilationCache';

import type { ConfigLocation } from './config';
import type { ConfigCLIOverrides, SerializedConfig } from './ipc';
import type { Config, Project } from '../../types/test';

const kDefineConfigWasUsed = Symbol('defineConfigWasUsed');
export const defineConfig = (...configs: any[]) => {
  let result = configs[0];
  for (let i = 1; i < configs.length; ++i) {
    const config = configs[i];
    result = {
      ...result,
      ...config,
      expect: {
        ...result.expect,
        ...config.expect,
      },
      use: {
        ...result.use,
        ...config.use,
      },
      build: {
        ...result.build,
        ...config.build,
      },
      webServer: [
        ...(Array.isArray(result.webServer) ? result.webServer : (result.webServer ? [result.webServer] : [])),
        ...(Array.isArray(config.webServer) ? config.webServer : (config.webServer ? [config.webServer] : [])),
      ]
    };

    if (!result.projects && !config.projects)
      continue;

    const projectOverrides = new Map<string, any>();
    for (const project of config.projects || [])
      projectOverrides.set(project.name, project);

    const projects = [];
    for (const project of result.projects || []) {
      const projectOverride = projectOverrides.get(project.name);
      if (projectOverride) {
        projects.push({
          ...project,
          ...projectOverride,
          use: {
            ...project.use,
            ...projectOverride.use,
          }
        });
        projectOverrides.delete(project.name);
      } else {
        projects.push(project);
      }
    }
    projects.push(...projectOverrides.values());
    result.projects = projects;
  }
  result[kDefineConfigWasUsed] = true;
  return result;
};

export async function deserializeConfig(data: SerializedConfig): Promise<FullConfigInternal> {
  if (data.compilationCache)
    addToCompilationCache(data.compilationCache);
  return await loadConfig(data.location, data.configCLIOverrides, undefined, data.metadata ? JSON.parse(data.metadata) : undefined);
}

async function loadUserConfig(location: ConfigLocation): Promise<Config> {
  let object = location.resolvedConfigFile ? await requireOrImport(location.resolvedConfigFile) : {};
  if (object && typeof object === 'object' && ('default' in object))
    object = object['default'];
  return object as Config;
}

export async function loadConfig(location: ConfigLocation, overrides?: ConfigCLIOverrides, ignoreProjectDependencies = false, metadata?: Config['metadata']): Promise<FullConfigInternal> {
  // 0. Setup ESM loader if needed.
  if (!registerESMLoader()) {
    // In Node.js < 18, complain if the config file is ESM. Historically, we would restart
    // the process with --loader, but now we require newer Node.js.
    if (location.resolvedConfigFile && fileIsModule(location.resolvedConfigFile))
      throw errorWithFile(location.resolvedConfigFile, `Playwright requires Node.js 18.19 or higher to load esm modules. Please update your version of Node.js.`);
  }

  // 1. Setup tsconfig; configure ESM loader with tsconfig and compilation cache.
  setSingleTSConfig(overrides?.tsconfig);
  await configureESMLoader();

  // 2. Load and validate playwright config.
  const userConfig = await loadUserConfig(location);
  validateConfig(location.resolvedConfigFile || '<default config>', userConfig);
  const fullConfig = new FullConfigInternal(location, userConfig, overrides || {}, metadata);
  fullConfig.defineConfigWasUsed = !!(userConfig as any)[kDefineConfigWasUsed];
  if (ignoreProjectDependencies) {
    for (const project of fullConfig.projects) {
      project.deps = [];
      project.teardown = undefined;
    }
  }

  // 3. Load transform options from the playwright config.
  const babelPlugins = (userConfig as any)['@playwright/test']?.babelPlugins || [];
  const external = userConfig.build?.external || [];
  setTransformConfig({ babelPlugins, external });
  if (!overrides?.tsconfig)
    setSingleTSConfig(fullConfig?.singleTSConfigPath);

  // 4. Send transform options to ESM loader.
  await configureESMLoaderTransformConfig();

  return fullConfig;
}

function validateConfig(file: string, config: Config) {
  if (typeof config !== 'object' || !config)
    throw errorWithFile(file, `Configuration file must export a single object`);

  validateProject(file, config, 'config');

  if ('forbidOnly' in config && config.forbidOnly !== undefined) {
    if (typeof config.forbidOnly !== 'boolean')
      throw errorWithFile(file, `config.forbidOnly must be a boolean`);
  }

  if ('globalSetup' in config && config.globalSetup !== undefined) {
    if (Array.isArray(config.globalSetup)) {
      config.globalSetup.forEach((item, index) => {
        if (typeof item !== 'string')
          throw errorWithFile(file, `config.globalSetup[${index}] must be a string`);
      });
    } else if (typeof config.globalSetup !== 'string') {
      throw errorWithFile(file, `config.globalSetup must be a string`);
    }
  }

  if ('globalTeardown' in config && config.globalTeardown !== undefined) {
    if (Array.isArray(config.globalTeardown)) {
      config.globalTeardown.forEach((item, index) => {
        if (typeof item !== 'string')
          throw errorWithFile(file, `config.globalTeardown[${index}] must be a string`);
      });
    } else if (typeof config.globalTeardown !== 'string') {
      throw errorWithFile(file, `config.globalTeardown must be a string`);
    }
  }

  if ('globalTimeout' in config && config.globalTimeout !== undefined) {
    if (typeof config.globalTimeout !== 'number' || config.globalTimeout < 0)
      throw errorWithFile(file, `config.globalTimeout must be a non-negative number`);
  }

  if ('grep' in config && config.grep !== undefined) {
    if (Array.isArray(config.grep)) {
      config.grep.forEach((item, index) => {
        if (!isRegExp(item))
          throw errorWithFile(file, `config.grep[${index}] must be a RegExp`);
      });
    } else if (!isRegExp(config.grep)) {
      throw errorWithFile(file, `config.grep must be a RegExp`);
    }
  }

  if ('grepInvert' in config && config.grepInvert !== undefined) {
    if (Array.isArray(config.grepInvert)) {
      config.grepInvert.forEach((item, index) => {
        if (!isRegExp(item))
          throw errorWithFile(file, `config.grepInvert[${index}] must be a RegExp`);
      });
    } else if (!isRegExp(config.grepInvert)) {
      throw errorWithFile(file, `config.grepInvert must be a RegExp`);
    }
  }

  if ('maxFailures' in config && config.maxFailures !== undefined) {
    if (typeof config.maxFailures !== 'number' || config.maxFailures < 0)
      throw errorWithFile(file, `config.maxFailures must be a non-negative number`);
  }

  if ('preserveOutput' in config && config.preserveOutput !== undefined) {
    if (typeof config.preserveOutput !== 'string' || !['always', 'never', 'failures-only'].includes(config.preserveOutput))
      throw errorWithFile(file, `config.preserveOutput must be one of "always", "never" or "failures-only"`);
  }

  if ('projects' in config && config.projects !== undefined) {
    if (!Array.isArray(config.projects))
      throw errorWithFile(file, `config.projects must be an array`);
    config.projects.forEach((project, index) => {
      validateProject(file, project, `config.projects[${index}]`);
    });
  }

  if ('quiet' in config && config.quiet !== undefined) {
    if (typeof config.quiet !== 'boolean')
      throw errorWithFile(file, `config.quiet must be a boolean`);
  }

  if ('reporter' in config && config.reporter !== undefined) {
    if (Array.isArray(config.reporter)) {
      config.reporter.forEach((item, index) => {
        if (!Array.isArray(item) || item.length <= 0 || item.length > 2 || typeof item[0] !== 'string')
          throw errorWithFile(file, `config.reporter[${index}] must be a tuple [name, optionalArgument]`);
      });
    } else if (typeof config.reporter !== 'string') {
      throw errorWithFile(file, `config.reporter must be a string`);
    }
  }

  if ('reportSlowTests' in config && config.reportSlowTests !== undefined && config.reportSlowTests !== null) {
    if (!config.reportSlowTests || typeof config.reportSlowTests !== 'object')
      throw errorWithFile(file, `config.reportSlowTests must be an object`);
    if (!('max' in config.reportSlowTests) || typeof config.reportSlowTests.max !== 'number' || config.reportSlowTests.max < 0)
      throw errorWithFile(file, `config.reportSlowTests.max must be a non-negative number`);
    if (!('threshold' in config.reportSlowTests) || typeof config.reportSlowTests.threshold !== 'number' || config.reportSlowTests.threshold < 0)
      throw errorWithFile(file, `config.reportSlowTests.threshold must be a non-negative number`);
  }

  if ('shard' in config && config.shard !== undefined && config.shard !== null) {
    if (!config.shard || typeof config.shard !== 'object')
      throw errorWithFile(file, `config.shard must be an object`);
    if (!('total' in config.shard) || typeof config.shard.total !== 'number' || config.shard.total < 1)
      throw errorWithFile(file, `config.shard.total must be a positive number`);
    if (!('current' in config.shard) || typeof config.shard.current !== 'number' || config.shard.current < 1 || config.shard.current > config.shard.total)
      throw errorWithFile(file, `config.shard.current must be a positive number, not greater than config.shard.total`);
  }

  if ('updateSnapshots' in config && config.updateSnapshots !== undefined) {
    if (typeof config.updateSnapshots !== 'string' || !['all', 'changed', 'missing', 'none'].includes(config.updateSnapshots))
      throw errorWithFile(file, `config.updateSnapshots must be one of "all", "changed", "missing" or "none"`);
  }

  if ('tsconfig' in config && config.tsconfig !== undefined) {
    if (typeof config.tsconfig !== 'string')
      throw errorWithFile(file, `config.tsconfig must be a string`);
    if (!fs.existsSync(path.resolve(file, '..', config.tsconfig)))
      throw errorWithFile(file, `config.tsconfig does not exist`);
  }
}

function validateProject(file: string, project: Project, title: string) {
  if (typeof project !== 'object' || !project)
    throw errorWithFile(file, `${title} must be an object`);

  if ('name' in project && project.name !== undefined) {
    if (typeof project.name !== 'string')
      throw errorWithFile(file, `${title}.name must be a string`);
  }

  if ('outputDir' in project && project.outputDir !== undefined) {
    if (typeof project.outputDir !== 'string')
      throw errorWithFile(file, `${title}.outputDir must be a string`);
  }

  if ('repeatEach' in project && project.repeatEach !== undefined) {
    if (typeof project.repeatEach !== 'number' || project.repeatEach < 0)
      throw errorWithFile(file, `${title}.repeatEach must be a non-negative number`);
  }

  if ('retries' in project && project.retries !== undefined) {
    if (typeof project.retries !== 'number' || project.retries < 0)
      throw errorWithFile(file, `${title}.retries must be a non-negative number`);
  }

  if ('testDir' in project && project.testDir !== undefined) {
    if (typeof project.testDir !== 'string')
      throw errorWithFile(file, `${title}.testDir must be a string`);
  }

  for (const prop of ['testIgnore', 'testMatch'] as const) {
    if (prop in project && project[prop] !== undefined) {
      const value = project[prop];
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item !== 'string' && !isRegExp(item))
            throw errorWithFile(file, `${title}.${prop}[${index}] must be a string or a RegExp`);
        });
      } else if (typeof value !== 'string' && !isRegExp(value)) {
        throw errorWithFile(file, `${title}.${prop} must be a string or a RegExp`);
      }
    }
  }

  if ('timeout' in project && project.timeout !== undefined) {
    if (typeof project.timeout !== 'number' || project.timeout < 0)
      throw errorWithFile(file, `${title}.timeout must be a non-negative number`);
  }

  if ('use' in project && project.use !== undefined) {
    if (!project.use || typeof project.use !== 'object')
      throw errorWithFile(file, `${title}.use must be an object`);
  }

  if ('ignoreSnapshots' in project && project.ignoreSnapshots !== undefined) {
    if (typeof project.ignoreSnapshots !== 'boolean')
      throw errorWithFile(file, `${title}.ignoreSnapshots must be a boolean`);
  }

  if ('workers' in project && project.workers !== undefined) {
    if (typeof project.workers === 'number' && project.workers <= 0)
      throw errorWithFile(file, `${title}.workers must be a positive number`);
    else if (typeof project.workers === 'string' && !project.workers.endsWith('%'))
      throw errorWithFile(file, `${title}.workers must be a number or percentage`);
  }
}

export function resolveConfigLocation(configFile: string | undefined): ConfigLocation {
  const configFileOrDirectory = configFile ? path.resolve(process.cwd(), configFile) : process.cwd();
  const resolvedConfigFile = resolveConfigFile(configFileOrDirectory);
  return {
    resolvedConfigFile,
    configDir: resolvedConfigFile ? path.dirname(resolvedConfigFile) : configFileOrDirectory,
  };
}

function resolveConfigFile(configFileOrDirectory: string): string | undefined {
  const resolveConfig = (configFile: string) => {
    if (fs.existsSync(configFile))
      return configFile;
  };

  const resolveConfigFileFromDirectory = (directory: string) => {
    for (const ext of ['.ts', '.js', '.mts', '.mjs', '.cts', '.cjs']) {
      const configFile = resolveConfig(path.resolve(directory, 'playwright.config' + ext));
      if (configFile)
        return configFile;
    }
  };

  if (!fs.existsSync(configFileOrDirectory))
    throw new Error(`${configFileOrDirectory} does not exist`);
  if (fs.statSync(configFileOrDirectory).isDirectory()) {
    // When passed a directory, look for a config file inside.
    const configFile = resolveConfigFileFromDirectory(configFileOrDirectory);
    if (configFile)
      return configFile;
    // If there is no config, assume this as a root testing directory.
    return undefined;
  }
  // When passed a file, it must be a config file.
  return configFileOrDirectory!;
}

export async function loadConfigFromFile(configFile: string | undefined, overrides?: ConfigCLIOverrides, ignoreDeps?: boolean): Promise<FullConfigInternal> {
  return await loadConfig(resolveConfigLocation(configFile), overrides, ignoreDeps);
}

export async function loadEmptyConfigForMergeReports() {
  // Merge reports is "different" for no good reason. It should not pick up local config from the cwd.
  return await loadConfig({ configDir: process.cwd() });
}
