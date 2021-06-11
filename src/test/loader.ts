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

import { installTransform } from './transform';
import type { FullConfig, Config, FullProject, Project, ReporterDescription, PreserveOutput } from './types';
import { errorWithCallLocation, isRegExp, mergeObjects, prependErrorMessage } from './util';
import { setCurrentlyLoadingFileSuite } from './globals';
import { Suite } from './test';
import { SerializedLoaderData } from './ipc';
import * as path from 'path';
import { ProjectImpl } from './project';
import { Reporter } from './reporter';

export class Loader {
  private _defaultConfig: Config;
  private _configOverrides: Config;
  private _fullConfig: FullConfig;
  private _config: Config = {};
  private _configFile: string | undefined;
  private _projects: ProjectImpl[] = [];
  private _fileSuites = new Map<string, Suite>();

  constructor(defaultConfig: Config, configOverrides: Config) {
    this._defaultConfig = defaultConfig;
    this._configOverrides = configOverrides;
    this._fullConfig = baseFullConfig;
  }

  static deserialize(data: SerializedLoaderData): Loader {
    const loader = new Loader(data.defaultConfig, data.overrides);
    if ('file' in data.configFile)
      loader.loadConfigFile(data.configFile.file);
    else
      loader.loadEmptyConfig(data.configFile.rootDir);
    return loader;
  }

  loadConfigFile(file: string): Config {
    if (this._configFile)
      throw new Error('Cannot load two config files');
    const revertBabelRequire = installTransform();
    try {
      let config = require(file);
      if (config && typeof config === 'object' && ('default' in config))
        config = config['default'];
      this._config = config;
      this._configFile = file;
      const rawConfig = { ...config };
      this._processConfigObject(path.dirname(file));
      return rawConfig;
    } catch (e) {
      prependErrorMessage(e, `Error while reading ${file}:\n`);
      throw e;
    } finally {
      revertBabelRequire();
    }
  }

  loadEmptyConfig(rootDir: string) {
    this._config = {};
    this._processConfigObject(rootDir);
  }

  private _processConfigObject(rootDir: string) {
    validateConfig(this._config);

    // Resolve script hooks relative to the root dir.
    if (this._config.globalSetup)
      this._config.globalSetup = path.resolve(rootDir, this._config.globalSetup);
    if (this._config.globalTeardown)
      this._config.globalTeardown = path.resolve(rootDir, this._config.globalTeardown);

    const configUse = mergeObjects(this._defaultConfig.use, this._config.use);
    this._config = mergeObjects(mergeObjects(this._defaultConfig, this._config), { use: configUse });

    if (('testDir' in this._config) && this._config.testDir !== undefined && !path.isAbsolute(this._config.testDir))
      this._config.testDir = path.resolve(rootDir, this._config.testDir);
    const projects: Project[] = ('projects' in this._config) && this._config.projects !== undefined ? this._config.projects : [this._config];

    this._fullConfig.rootDir = this._config.testDir || rootDir;
    this._fullConfig.forbidOnly = takeFirst(this._configOverrides.forbidOnly, this._config.forbidOnly, baseFullConfig.forbidOnly);
    this._fullConfig.globalSetup = takeFirst(this._configOverrides.globalSetup, this._config.globalSetup, baseFullConfig.globalSetup);
    this._fullConfig.globalTeardown = takeFirst(this._configOverrides.globalTeardown, this._config.globalTeardown, baseFullConfig.globalTeardown);
    this._fullConfig.globalTimeout = takeFirst(this._configOverrides.globalTimeout, this._configOverrides.globalTimeout, this._config.globalTimeout, baseFullConfig.globalTimeout);
    this._fullConfig.grep = takeFirst(this._configOverrides.grep, this._config.grep, baseFullConfig.grep);
    this._fullConfig.maxFailures = takeFirst(this._configOverrides.maxFailures, this._config.maxFailures, baseFullConfig.maxFailures);
    this._fullConfig.preserveOutput = takeFirst<PreserveOutput>(this._configOverrides.preserveOutput, this._config.preserveOutput, baseFullConfig.preserveOutput);
    this._fullConfig.reporter = takeFirst(toReporters(this._configOverrides.reporter), toReporters(this._config.reporter), baseFullConfig.reporter);
    this._fullConfig.quiet = takeFirst(this._configOverrides.quiet, this._config.quiet, baseFullConfig.quiet);
    this._fullConfig.shard = takeFirst(this._configOverrides.shard, this._config.shard, baseFullConfig.shard);
    this._fullConfig.updateSnapshots = takeFirst(this._configOverrides.updateSnapshots, this._config.updateSnapshots, baseFullConfig.updateSnapshots);
    this._fullConfig.workers = takeFirst(this._configOverrides.workers, this._config.workers, baseFullConfig.workers);

    for (const project of projects)
      this._addProject(project, this._fullConfig.rootDir);
    this._fullConfig.projects = this._projects.map(p => p.config);
  }

  loadTestFile(file: string) {
    if (this._fileSuites.has(file))
      return this._fileSuites.get(file)!;
    const revertBabelRequire = installTransform();
    try {
      const suite = new Suite('');
      suite.file = file;
      setCurrentlyLoadingFileSuite(suite);
      require(file);
      this._fileSuites.set(file, suite);
      return suite;
    } catch (e) {
      prependErrorMessage(e, `Error while reading ${file}:\n`);
      throw e;
    } finally {
      revertBabelRequire();
      setCurrentlyLoadingFileSuite(undefined);
    }
  }

  loadGlobalHook(file: string, name: string): (config: FullConfig) => any {
    const revertBabelRequire = installTransform();
    try {
      let hook = require(file);
      if (hook && typeof hook === 'object' && ('default' in hook))
        hook = hook['default'];
      if (typeof hook !== 'function')
        throw errorWithCallLocation(`${name} file must export a single function.`);
      return hook;
    } catch (e) {
      prependErrorMessage(e, `Error while reading ${file}:\n`);
      throw e;
    } finally {
      revertBabelRequire();
    }
  }

  loadReporter(file: string): new (arg?: any) => Reporter {
    const revertBabelRequire = installTransform();
    try {
      let func = require(path.resolve(this._fullConfig.rootDir, file));
      if (func && typeof func === 'object' && ('default' in func))
        func = func['default'];
      if (typeof func !== 'function')
        throw errorWithCallLocation(`Reporter file "${file}" must export a single class.`);
      return func;
    } catch (e) {
      prependErrorMessage(e, `Error while reading ${file}:\n`);
      throw e;
    } finally {
      revertBabelRequire();
    }
  }

  fullConfig(): FullConfig {
    return this._fullConfig;
  }

  projects() {
    return this._projects;
  }

  fileSuites() {
    return this._fileSuites;
  }

  serialize(): SerializedLoaderData {
    return {
      defaultConfig: this._defaultConfig,
      configFile: this._configFile ? { file: this._configFile } : { rootDir: this._fullConfig.rootDir },
      overrides: this._configOverrides,
    };
  }

  private _addProject(projectConfig: Project, rootDir: string) {
    let testDir = takeFirst(projectConfig.testDir, rootDir);
    if (!path.isAbsolute(testDir))
      testDir = path.resolve(rootDir, testDir);

    const fullProject: FullProject = {
      define: takeFirst(this._configOverrides.define, projectConfig.define, this._config.define, []),
      outputDir: takeFirst(this._configOverrides.outputDir, projectConfig.outputDir, this._config.outputDir, path.resolve(process.cwd(), 'test-results')),
      repeatEach: takeFirst(this._configOverrides.repeatEach, projectConfig.repeatEach, this._config.repeatEach, 1),
      retries: takeFirst(this._configOverrides.retries, projectConfig.retries, this._config.retries, 0),
      metadata: takeFirst(this._configOverrides.metadata, projectConfig.metadata, this._config.metadata, undefined),
      name: takeFirst(this._configOverrides.name, projectConfig.name, this._config.name, ''),
      testDir,
      testIgnore: takeFirst(this._configOverrides.testIgnore, projectConfig.testIgnore, this._config.testIgnore, []),
      testMatch: takeFirst(this._configOverrides.testMatch, projectConfig.testMatch, this._config.testMatch, '**/?(*.)+(spec|test).[jt]s'),
      timeout: takeFirst(this._configOverrides.timeout, projectConfig.timeout, this._config.timeout, 10000),
      use: mergeObjects(mergeObjects(this._config.use, projectConfig.use), this._configOverrides.use),
    };
    this._projects.push(new ProjectImpl(fullProject, this._projects.length));
  }
}

function takeFirst<T>(...args: (T | undefined)[]): T {
  for (const arg of args) {
    if (arg !== undefined)
      return arg;
  }
  return undefined as any as T;
}

function toReporters(reporters: 'dot' | 'line' | 'list' | 'junit' | 'json' | 'null' | ReporterDescription[] | undefined): ReporterDescription[] | undefined {
  if (!reporters)
    return;
  if (typeof reporters === 'string')
    return [ [reporters] ];
  return reporters;
}

function validateConfig(config: Config) {
  if (typeof config !== 'object' || !config)
    throw new Error(`Configuration file must export a single object`);

  validateProject(config, 'config');

  if ('forbidOnly' in config && config.forbidOnly !== undefined) {
    if (typeof config.forbidOnly !== 'boolean')
      throw new Error(`config.forbidOnly must be a boolean`);
  }

  if ('globalSetup' in config && config.globalSetup !== undefined) {
    if (typeof config.globalSetup !== 'string')
      throw new Error(`config.globalSetup must be a string`);
  }

  if ('globalTeardown' in config && config.globalTeardown !== undefined) {
    if (typeof config.globalTeardown !== 'string')
      throw new Error(`config.globalTeardown must be a string`);
  }

  if ('globalTimeout' in config && config.globalTimeout !== undefined) {
    if (typeof config.globalTimeout !== 'number' || config.globalTimeout < 0)
      throw new Error(`config.globalTimeout must be a non-negative number`);
  }

  if ('grep' in config && config.grep !== undefined) {
    if (Array.isArray(config.grep)) {
      config.grep.forEach((item, index) => {
        if (!isRegExp(item))
          throw new Error(`config.grep[${index}] must be a RegExp`);
      });
    } else if (!isRegExp(config.grep)) {
      throw new Error(`config.grep must be a RegExp`);
    }
  }

  if ('maxFailures' in config && config.maxFailures !== undefined) {
    if (typeof config.maxFailures !== 'number' || config.maxFailures < 0)
      throw new Error(`config.maxFailures must be a non-negative number`);
  }

  if ('preserveOutput' in config && config.preserveOutput !== undefined) {
    if (typeof config.preserveOutput !== 'string' || !['always', 'never', 'failures-only'].includes(config.preserveOutput))
      throw new Error(`config.preserveOutput must be one of "always", "never" or "failures-only"`);
  }

  if ('projects' in config && config.projects !== undefined) {
    if (!Array.isArray(config.projects))
      throw new Error(`config.projects must be an array`);
    config.projects.forEach((project, index) => {
      validateProject(project, `config.projects[${index}]`);
    });
  }

  if ('quiet' in config && config.quiet !== undefined) {
    if (typeof config.quiet !== 'boolean')
      throw new Error(`config.quiet must be a boolean`);
  }

  if ('reporter' in config && config.reporter !== undefined) {
    if (Array.isArray(config.reporter)) {
      config.reporter.forEach((item, index) => {
        if (!Array.isArray(item) || item.length <= 0 || item.length > 2 || typeof item[0] !== 'string')
          throw new Error(`config.reporter[${index}] must be a tuple [name, optionalArgument]`);
      });
    } else {
      const builtinReporters = ['dot', 'line', 'list', 'junit', 'json', 'null'];
      if (typeof config.reporter !== 'string' || !builtinReporters.includes(config.reporter))
        throw new Error(`config.reporter must be one of ${builtinReporters.map(name => `"${name}"`).join(', ')}`);
    }
  }

  if ('shard' in config && config.shard !== undefined && config.shard !== null) {
    if (!config.shard || typeof config.shard !== 'object')
      throw new Error(`config.shard must be an object`);
    if (!('total' in config.shard) || typeof config.shard.total !== 'number' || config.shard.total < 1)
      throw new Error(`config.shard.total must be a positive number`);
    if (!('current' in config.shard) || typeof config.shard.current !== 'number' || config.shard.current < 1 || config.shard.current > config.shard.total)
      throw new Error(`config.shard.current must be a positive number, not greater than config.shard.total`);
  }

  if ('updateSnapshots' in config && config.updateSnapshots !== undefined) {
    if (typeof config.updateSnapshots !== 'string' || !['all', 'none', 'missing'].includes(config.updateSnapshots))
      throw new Error(`config.updateSnapshots must be one of "all", "none" or "missing"`);
  }

  if ('workers' in config && config.workers !== undefined) {
    if (typeof config.workers !== 'number' || config.workers <= 0)
      throw new Error(`config.workers must be a positive number`);
  }
}

function validateProject(project: Project, title: string) {
  if (typeof project !== 'object' || !project)
    throw new Error(`${title} must be an object`);

  if ('define' in project && project.define !== undefined) {
    if (Array.isArray(project.define)) {
      project.define.forEach((item, index) => {
        validateDefine(item, `${title}.define[${index}]`);
      });
    } else {
      validateDefine(project.define, `${title}.define`);
    }
  }

  if ('name' in project && project.name !== undefined) {
    if (typeof project.name !== 'string')
      throw new Error(`${title}.name must be a string`);
  }

  if ('outputDir' in project && project.outputDir !== undefined) {
    if (typeof project.outputDir !== 'string')
      throw new Error(`${title}.outputDir must be a string`);
    if (!path.isAbsolute(project.outputDir))
      throw new Error(`${title}.outputDir must be an absolute path`);
  }

  if ('repeatEach' in project && project.repeatEach !== undefined) {
    if (typeof project.repeatEach !== 'number' || project.repeatEach < 0)
      throw new Error(`${title}.repeatEach must be a non-negative number`);
  }

  if ('retries' in project && project.retries !== undefined) {
    if (typeof project.retries !== 'number' || project.retries < 0)
      throw new Error(`${title}.retries must be a non-negative number`);
  }

  if ('testDir' in project && project.testDir !== undefined) {
    if (typeof project.testDir !== 'string')
      throw new Error(`${title}.testDir must be a string`);
  }

  for (const prop of ['testIgnore', 'testMatch'] as const) {
    if (prop in project && project[prop] !== undefined) {
      const value = project[prop];
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item !== 'string' && !isRegExp(item))
            throw new Error(`${title}.${prop}[${index}] must be a string or a RegExp`);
        });
      } else if (typeof value !== 'string' && !isRegExp(value)) {
        throw new Error(`${title}.${prop} must be a string or a RegExp`);
      }
    }
  }

  if ('timeout' in project && project.timeout !== undefined) {
    if (typeof project.timeout !== 'number' || project.timeout < 0)
      throw new Error(`${title}.timeout must be a non-negative number`);
  }

  if ('use' in project && project.use !== undefined) {
    if (!project.use || typeof project.use !== 'object')
      throw new Error(`${title}.use must be an object`);
  }
}

function validateDefine(define: any, title: string) {
  if (!define || typeof define !== 'object' || !define.test || !define.fixtures)
    throw new Error(`${title} must be an object with "test" and "fixtures" properties`);
}

const baseFullConfig: FullConfig = {
  forbidOnly: false,
  globalSetup: null,
  globalTeardown: null,
  globalTimeout: 0,
  grep: /.*/,
  maxFailures: 0,
  preserveOutput: 'always',
  projects: [],
  reporter: [ ['list'] ],
  rootDir: path.resolve(process.cwd()),
  quiet: false,
  shard: null,
  updateSnapshots: 'missing',
  workers: 1,
};
