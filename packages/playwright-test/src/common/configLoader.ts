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

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isRegExp } from 'playwright-core/lib/utils';
import type { ConfigCLIOverrides, SerializedConfig } from './ipc';
import { requireOrImport } from './transform';
import type { Config, FullConfigInternal, FullProjectInternal, Project, ReporterDescription } from './types';
import { errorWithFile, getPackageJsonPath, mergeObjects } from '../util';
import { setCurrentConfig } from './globals';

export const defaultTimeout = 30000;

export class ConfigLoader {
  private _fullConfig: FullConfigInternal;

  constructor(configCLIOverrides?: ConfigCLIOverrides) {
    this._fullConfig = { ...baseFullConfig };
    this._fullConfig._internal.configCLIOverrides = configCLIOverrides || {};
  }

  static async deserialize(data: SerializedConfig): Promise<ConfigLoader> {
    const loader = new ConfigLoader(data.configCLIOverrides);
    if (data.configFile)
      await loader.loadConfigFile(data.configFile);
    else
      await loader.loadEmptyConfig(data.configDir);
    return loader;
  }

  async loadConfigFile(file: string): Promise<FullConfigInternal> {
    if (this._fullConfig.configFile)
      throw new Error('Cannot load two config files');
    const config = await requireOrImportDefaultObject(file) as Config;
    await this._processConfigObject(config, path.dirname(file), file);
    setCurrentConfig(this._fullConfig);
    return this._fullConfig;
  }

  async loadEmptyConfig(configDir: string): Promise<Config> {
    await this._processConfigObject({}, configDir);
    setCurrentConfig(this._fullConfig);
    return {};
  }

  private async _processConfigObject(config: Config, configDir: string, configFile?: string) {
    // 1. Validate data provided in the config file.
    validateConfig(configFile || '<default config>', config);

    // 2. Override settings from CLI.
    const configCLIOverrides = this._fullConfig._internal.configCLIOverrides;
    config.forbidOnly = takeFirst(configCLIOverrides.forbidOnly, config.forbidOnly);
    config.fullyParallel = takeFirst(configCLIOverrides.fullyParallel, config.fullyParallel);
    config.globalTimeout = takeFirst(configCLIOverrides.globalTimeout, config.globalTimeout);
    config.maxFailures = takeFirst(configCLIOverrides.maxFailures, config.maxFailures);
    config.outputDir = takeFirst(configCLIOverrides.outputDir, config.outputDir);
    config.quiet = takeFirst(configCLIOverrides.quiet, config.quiet);
    config.repeatEach = takeFirst(configCLIOverrides.repeatEach, config.repeatEach);
    config.retries = takeFirst(configCLIOverrides.retries, config.retries);
    if (configCLIOverrides.reporter)
      config.reporter = toReporters(configCLIOverrides.reporter as any);
    config.shard = takeFirst(configCLIOverrides.shard, config.shard);
    config.timeout = takeFirst(configCLIOverrides.timeout, config.timeout);
    config.updateSnapshots = takeFirst(configCLIOverrides.updateSnapshots, config.updateSnapshots);
    config.ignoreSnapshots = takeFirst(configCLIOverrides.ignoreSnapshots, config.ignoreSnapshots);
    if (configCLIOverrides.projects && config.projects)
      throw new Error(`Cannot use --browser option when configuration file defines projects. Specify browserName in the projects instead.`);
    config.projects = takeFirst(configCLIOverrides.projects, config.projects as any);
    config.workers = takeFirst(configCLIOverrides.workers, config.workers);
    config.use = mergeObjects(config.use, configCLIOverrides.use);
    for (const project of config.projects || [])
      this._applyCLIOverridesToProject(project);

    // 3. Resolve config.
    const packageJsonPath = getPackageJsonPath(configDir);
    const packageJsonDir = packageJsonPath ? path.dirname(packageJsonPath) : undefined;
    const throwawayArtifactsPath = packageJsonDir || process.cwd();

    // Resolve script hooks relative to the root dir.
    if (config.globalSetup)
      config.globalSetup = resolveScript(config.globalSetup, configDir);
    if (config.globalTeardown)
      config.globalTeardown = resolveScript(config.globalTeardown, configDir);
    // Resolve all config dirs relative to configDir.
    if (config.testDir !== undefined)
      config.testDir = path.resolve(configDir, config.testDir);
    if (config.outputDir !== undefined)
      config.outputDir = path.resolve(configDir, config.outputDir);
    if (config.snapshotDir !== undefined)
      config.snapshotDir = path.resolve(configDir, config.snapshotDir);

    this._fullConfig._internal.configDir = configDir;
    this._fullConfig._internal.storeDir = path.resolve(configDir, config.storeDir || 'playwright');
    this._fullConfig.configFile = configFile;
    this._fullConfig.rootDir = config.testDir || configDir;
    this._fullConfig._internal.globalOutputDir = takeFirst(config.outputDir, throwawayArtifactsPath, baseFullConfig._internal.globalOutputDir);
    this._fullConfig.forbidOnly = takeFirst(config.forbidOnly, baseFullConfig.forbidOnly);
    this._fullConfig.fullyParallel = takeFirst(config.fullyParallel, baseFullConfig.fullyParallel);
    this._fullConfig.globalSetup = takeFirst(config.globalSetup, baseFullConfig.globalSetup);
    this._fullConfig.globalTeardown = takeFirst(config.globalTeardown, baseFullConfig.globalTeardown);
    this._fullConfig.globalTimeout = takeFirst(config.globalTimeout, baseFullConfig.globalTimeout);
    this._fullConfig.grep = takeFirst(config.grep, baseFullConfig.grep);
    this._fullConfig.grepInvert = takeFirst(config.grepInvert, baseFullConfig.grepInvert);
    this._fullConfig.maxFailures = takeFirst(config.maxFailures, baseFullConfig.maxFailures);
    this._fullConfig.preserveOutput = takeFirst(config.preserveOutput, baseFullConfig.preserveOutput);
    this._fullConfig.reporter = takeFirst(resolveReporters(config.reporter, configDir), baseFullConfig.reporter);
    this._fullConfig.reportSlowTests = takeFirst(config.reportSlowTests, baseFullConfig.reportSlowTests);
    this._fullConfig.quiet = takeFirst(config.quiet, baseFullConfig.quiet);
    this._fullConfig.shard = takeFirst(config.shard, baseFullConfig.shard);
    this._fullConfig._internal.ignoreSnapshots = takeFirst(config.ignoreSnapshots, baseFullConfig._internal.ignoreSnapshots);
    this._fullConfig.updateSnapshots = takeFirst(config.updateSnapshots, baseFullConfig.updateSnapshots);
    this._fullConfig._internal.plugins = ((config as any)._plugins || []).map((p: any) => ({ factory: p }));

    const workers = takeFirst(config.workers, '50%');
    if (typeof workers === 'string') {
      if (workers.endsWith('%')) {
        const cpus = os.cpus().length;
        this._fullConfig.workers = Math.max(1, Math.floor(cpus * (parseInt(workers, 10) / 100)));
      } else {
        this._fullConfig.workers = parseInt(workers, 10);
      }
    } else {
      this._fullConfig.workers = workers;
    }

    const webServers = takeFirst(config.webServer, baseFullConfig.webServer);
    if (Array.isArray(webServers)) { // multiple web server mode
      // Due to previous choices, this value shows up to the user in globalSetup as part of FullConfig. Arrays are not supported by the old type.
      this._fullConfig.webServer = null;
      this._fullConfig._internal.webServers = webServers;
    } else if (webServers) { // legacy singleton mode
      this._fullConfig.webServer = webServers;
      this._fullConfig._internal.webServers = [webServers];
    }
    this._fullConfig.metadata = takeFirst(config.metadata, baseFullConfig.metadata);
    this._fullConfig.projects = (config.projects || [config]).map(p => this._resolveProject(config, this._fullConfig, p, throwawayArtifactsPath));

    resolveProjectDependencies(this._fullConfig.projects);
    this._assignUniqueProjectIds(this._fullConfig.projects);
  }

  ignoreProjectDependencies() {
    for (const project of this._fullConfig.projects)
      project._internal.deps = [];
  }

  private _assignUniqueProjectIds(projects: FullProjectInternal[]) {
    const usedNames = new Set();
    for (const p of projects) {
      const name = p.name || '';
      for (let i = 0; i < projects.length; ++i) {
        const candidate = name + (i ? i : '');
        if (usedNames.has(candidate))
          continue;
        p._internal.id = candidate;
        usedNames.add(candidate);
        break;
      }
    }
  }

  fullConfig(): FullConfigInternal {
    return this._fullConfig;
  }

  private _applyCLIOverridesToProject(projectConfig: Project) {
    const configCLIOverrides = this._fullConfig._internal.configCLIOverrides;
    projectConfig.fullyParallel = takeFirst(configCLIOverrides.fullyParallel, projectConfig.fullyParallel);
    projectConfig.outputDir = takeFirst(configCLIOverrides.outputDir, projectConfig.outputDir);
    projectConfig.repeatEach = takeFirst(configCLIOverrides.repeatEach, projectConfig.repeatEach);
    projectConfig.retries = takeFirst(configCLIOverrides.retries, projectConfig.retries);
    projectConfig.timeout = takeFirst(configCLIOverrides.timeout, projectConfig.timeout);
    projectConfig.use = mergeObjects(projectConfig.use, configCLIOverrides.use);
  }

  private _resolveProject(config: Config, fullConfig: FullConfigInternal, projectConfig: Project, throwawayArtifactsPath: string): FullProjectInternal {
    // Resolve all config dirs relative to configDir.
    if (projectConfig.testDir !== undefined)
      projectConfig.testDir = path.resolve(fullConfig._internal.configDir, projectConfig.testDir);
    if (projectConfig.outputDir !== undefined)
      projectConfig.outputDir = path.resolve(fullConfig._internal.configDir, projectConfig.outputDir);
    if (projectConfig.snapshotDir !== undefined)
      projectConfig.snapshotDir = path.resolve(fullConfig._internal.configDir, projectConfig.snapshotDir);

    const testDir = takeFirst(projectConfig.testDir, config.testDir, fullConfig._internal.configDir);
    const respectGitIgnore = !projectConfig.testDir && !config.testDir;

    const outputDir = takeFirst(projectConfig.outputDir, config.outputDir, path.join(throwawayArtifactsPath, 'test-results'));
    const snapshotDir = takeFirst(projectConfig.snapshotDir, config.snapshotDir, testDir);
    const name = takeFirst(projectConfig.name, config.name, '');

    const defaultSnapshotPathTemplate = '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{-snapshotSuffix}{ext}';
    const snapshotPathTemplate = takeFirst(projectConfig.snapshotPathTemplate, config.snapshotPathTemplate, defaultSnapshotPathTemplate);
    return {
      _internal: {
        id: '',
        type: 'top-level',
        fullConfig: fullConfig,
        fullyParallel: takeFirst(projectConfig.fullyParallel, config.fullyParallel, undefined),
        expect: takeFirst(projectConfig.expect, config.expect, {}),
        deps: [],
        respectGitIgnore: respectGitIgnore,
      },
      grep: takeFirst(projectConfig.grep, config.grep, baseFullConfig.grep),
      grepInvert: takeFirst(projectConfig.grepInvert, config.grepInvert, baseFullConfig.grepInvert),
      outputDir,
      repeatEach: takeFirst(projectConfig.repeatEach, config.repeatEach, 1),
      retries: takeFirst(projectConfig.retries, config.retries, 0),
      metadata: takeFirst(projectConfig.metadata, config.metadata, undefined),
      name,
      testDir,
      snapshotDir,
      snapshotPathTemplate,
      testIgnore: takeFirst(projectConfig.testIgnore, config.testIgnore, []),
      testMatch: takeFirst(projectConfig.testMatch, config.testMatch, '**/?(*.)@(spec|test).*'),
      timeout: takeFirst(projectConfig.timeout, config.timeout, defaultTimeout),
      use: mergeObjects(config.use, projectConfig.use),
      dependencies: projectConfig.dependencies || [],
    };
  }
}

async function requireOrImportDefaultObject(file: string) {
  let object = await requireOrImport(file);
  if (object && typeof object === 'object' && ('default' in object))
    object = object['default'];
  return object;
}

function takeFirst<T>(...args: (T | undefined)[]): T {
  for (const arg of args) {
    if (arg !== undefined)
      return arg;
  }
  return undefined as any as T;
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
    if (typeof config.globalSetup !== 'string')
      throw errorWithFile(file, `config.globalSetup must be a string`);
  }

  if ('globalTeardown' in config && config.globalTeardown !== undefined) {
    if (typeof config.globalTeardown !== 'string')
      throw errorWithFile(file, `config.globalTeardown must be a string`);
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

  if ('ignoreSnapshots' in config && config.ignoreSnapshots !== undefined) {
    if (typeof config.ignoreSnapshots !== 'boolean')
      throw errorWithFile(file, `config.ignoreSnapshots must be a boolean`);
  }

  if ('updateSnapshots' in config && config.updateSnapshots !== undefined) {
    if (typeof config.updateSnapshots !== 'string' || !['all', 'none', 'missing'].includes(config.updateSnapshots))
      throw errorWithFile(file, `config.updateSnapshots must be one of "all", "none" or "missing"`);
  }

  if ('workers' in config && config.workers !== undefined) {
    if (typeof config.workers === 'number' && config.workers <= 0)
      throw errorWithFile(file, `config.workers must be a positive number`);
    else if (typeof config.workers === 'string' && !config.workers.endsWith('%'))
      throw errorWithFile(file, `config.workers must be a number or percentage`);
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
}

export const baseFullConfig: FullConfigInternal = {
  forbidOnly: false,
  fullyParallel: false,
  globalSetup: null,
  globalTeardown: null,
  globalTimeout: 0,
  grep: /.*/,
  grepInvert: null,
  maxFailures: 0,
  metadata: {},
  preserveOutput: 'always',
  projects: [],
  reporter: [[process.env.CI ? 'dot' : 'list']],
  reportSlowTests: { max: 5, threshold: 15000 },
  configFile: '',
  rootDir: path.resolve(process.cwd()),
  quiet: false,
  shard: null,
  updateSnapshots: 'missing',
  version: require('../../package.json').version,
  workers: 0,
  webServer: null,
  _internal: {
    webServers: [],
    globalOutputDir: path.resolve(process.cwd()),
    configDir: '',
    configCLIOverrides: {},
    storeDir: '',
    maxConcurrentTestGroups: 0,
    ignoreSnapshots: false,
    plugins: [],
    cliArgs: [],
    cliGrep: undefined,
    cliGrepInvert: undefined,
    listOnly: false,
  }
};

function resolveReporters(reporters: Config['reporter'], rootDir: string): ReporterDescription[]|undefined {
  return toReporters(reporters as any)?.map(([id, arg]) => {
    if (builtInReporters.includes(id as any))
      return [id, arg];
    return [require.resolve(id, { paths: [rootDir] }), arg];
  });
}

function resolveScript(id: string, rootDir: string) {
  const localPath = path.resolve(rootDir, id);
  if (fs.existsSync(localPath))
    return localPath;
  return require.resolve(id, { paths: [rootDir] });
}

function resolveProjectDependencies(projects: FullProjectInternal[]) {
  for (const project of projects) {
    for (const dependencyName of project.dependencies) {
      const dependencies = projects.filter(p => p.name === dependencyName);
      if (!dependencies.length)
        throw new Error(`Project '${project.name}' depends on unknown project '${dependencyName}'`);
      if (dependencies.length > 1)
        throw new Error(`Project dependencies should have unique names, reading ${dependencyName}`);
      project._internal.deps.push(...dependencies);
    }
  }
}

export const kDefaultConfigFiles = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs'];

export function resolveConfigFile(configFileOrDirectory: string): string | null {
  const resolveConfig = (configFile: string) => {
    if (fs.existsSync(configFile))
      return configFile;
  };

  const resolveConfigFileFromDirectory = (directory: string) => {
    for (const configName of kDefaultConfigFiles) {
      const configFile = resolveConfig(path.resolve(directory, configName));
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
    return null;
  } else {
    // When passed a file, it must be a config file.
    const configFile = resolveConfig(configFileOrDirectory);
    return configFile!;
  }
}

export const builtInReporters = ['list', 'line', 'dot', 'json', 'junit', 'null', 'github', 'html'] as const;
export type BuiltInReporter = typeof builtInReporters[number];

export function toReporters(reporters: BuiltInReporter | ReporterDescription[] | undefined): ReporterDescription[] | undefined {
  if (!reporters)
    return;
  if (typeof reporters === 'string')
    return [[reporters]];
  return reporters;
}
