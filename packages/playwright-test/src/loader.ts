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

import { installTransform, setCurrentlyLoadingTestFile } from './transform';
import type { Config, FullProject, Project, ReporterDescription, PreserveOutput } from './types';
import type { FullConfigInternal } from './types';
import { mergeObjects, errorWithFile } from './util';
import { setCurrentlyLoadingFileSuite } from './globals';
import { Suite } from './test';
import { SerializedLoaderData } from './ipc';
import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';
import { ProjectImpl } from './project';
import { Reporter } from '../types/testReporter';
import { BuiltInReporter, builtInReporters } from './runner';
import { isRegExp } from 'playwright-core/lib/utils/utils';
import { serializeError } from './util';

// To allow multiple loaders in the same process without clearing require cache,
// we make these maps global.
const cachedFileSuites = new Map<string, Suite>();

export class Loader {
  private _defaultConfig: Config;
  private _configOverrides: Config;
  private _fullConfig: FullConfigInternal;
  private _configDir: string = '';
  private _configFile: string | undefined;
  private _projects: ProjectImpl[] = [];

  constructor(defaultConfig: Config, configOverrides: Config) {
    this._defaultConfig = defaultConfig;
    this._configOverrides = configOverrides;
    this._fullConfig = { ...baseFullConfig };
  }

  static async deserialize(data: SerializedLoaderData): Promise<Loader> {
    const loader = new Loader(data.defaultConfig, data.overrides);
    if ('file' in data.configFile)
      await loader.loadConfigFile(data.configFile.file);
    else
      loader.loadEmptyConfig(data.configFile.configDir);
    return loader;
  }

  async loadConfigFile(file: string): Promise<Config> {
    if (this._configFile)
      throw new Error('Cannot load two config files');
    let config = await this._requireOrImport(file);
    if (config && typeof config === 'object' && ('default' in config))
      config = config['default'];
    this._configFile = file;
    const rawConfig = { ...config };
    this._processConfigObject(config, path.dirname(file));
    return rawConfig;
  }

  loadEmptyConfig(configDir: string): Config {
    this._processConfigObject({}, configDir);
    return {};
  }

  private _processConfigObject(config: Config, configDir: string) {
    this._configDir = configDir;
    const packageJsonPath = getPackageJsonPath(configDir);
    const packageJsonDir = packageJsonPath ? path.dirname(packageJsonPath) : undefined;
    const throwawayArtifactsPath = packageJsonDir || process.cwd();
    validateConfig(this._configFile || '<default config>', config);

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
    if (config.screenshotsDir !== undefined)
      config.screenshotsDir = path.resolve(configDir, config.screenshotsDir);
    if (config.snapshotDir !== undefined)
      config.snapshotDir = path.resolve(configDir, config.snapshotDir);

    const configUse = mergeObjects(this._defaultConfig.use, config.use);
    config = mergeObjects(mergeObjects(this._defaultConfig, config), { use: configUse });

    this._fullConfig.rootDir = config.testDir || this._configDir;
    this._fullConfig.forbidOnly = takeFirst(this._configOverrides.forbidOnly, config.forbidOnly, baseFullConfig.forbidOnly);
    this._fullConfig.fullyParallel = takeFirst(this._configOverrides.fullyParallel, config.fullyParallel, baseFullConfig.fullyParallel);
    this._fullConfig.globalSetup = takeFirst(this._configOverrides.globalSetup, config.globalSetup, baseFullConfig.globalSetup);
    this._fullConfig.globalTeardown = takeFirst(this._configOverrides.globalTeardown, config.globalTeardown, baseFullConfig.globalTeardown);
    this._fullConfig.globalTimeout = takeFirst(this._configOverrides.globalTimeout, this._configOverrides.globalTimeout, config.globalTimeout, baseFullConfig.globalTimeout);
    this._fullConfig.grep = takeFirst(this._configOverrides.grep, config.grep, baseFullConfig.grep);
    this._fullConfig.grepInvert = takeFirst(this._configOverrides.grepInvert, config.grepInvert, baseFullConfig.grepInvert);
    this._fullConfig.maxFailures = takeFirst(this._configOverrides.maxFailures, config.maxFailures, baseFullConfig.maxFailures);
    this._fullConfig.preserveOutput = takeFirst<PreserveOutput>(this._configOverrides.preserveOutput, config.preserveOutput, baseFullConfig.preserveOutput);
    this._fullConfig.reporter = takeFirst(toReporters(this._configOverrides.reporter as any), resolveReporters(config.reporter, configDir), baseFullConfig.reporter);
    this._fullConfig.reportSlowTests = takeFirst(this._configOverrides.reportSlowTests, config.reportSlowTests, baseFullConfig.reportSlowTests);
    this._fullConfig.quiet = takeFirst(this._configOverrides.quiet, config.quiet, baseFullConfig.quiet);
    this._fullConfig.shard = takeFirst(this._configOverrides.shard, config.shard, baseFullConfig.shard);
    this._fullConfig.updateSnapshots = takeFirst(this._configOverrides.updateSnapshots, config.updateSnapshots, baseFullConfig.updateSnapshots);
    this._fullConfig.workers = takeFirst(this._configOverrides.workers, config.workers, baseFullConfig.workers);
    this._fullConfig.webServer = takeFirst(this._configOverrides.webServer, config.webServer, baseFullConfig.webServer);

    const projects: Project[] = ('projects' in config) && config.projects !== undefined ? config.projects : [config];
    for (const project of projects)
      this._addProject(config, project, throwawayArtifactsPath);
    this._fullConfig.projects = this._projects.map(p => p.config);
  }

  async loadTestFile(file: string, environment: 'runner' | 'worker') {
    if (cachedFileSuites.has(file))
      return cachedFileSuites.get(file)!;
    const suite = new Suite(path.relative(this._fullConfig.rootDir, file) || path.basename(file));
    suite._requireFile = file;
    suite.location = { file, line: 0, column: 0 };

    setCurrentlyLoadingTestFile(file);
    setCurrentlyLoadingFileSuite(suite);
    try {
      await this._requireOrImport(file);
      cachedFileSuites.set(file, suite);
    } catch (e) {
      if (environment === 'worker')
        throw e;
      suite._loadError = serializeError(e);
    } finally {
      setCurrentlyLoadingTestFile(null);
      setCurrentlyLoadingFileSuite(undefined);
    }

    {
      // Test locations that we discover potentially have different file name.
      // This could be due to either
      //   a) use of source maps or due to
      //   b) require of one file from another.
      // Try fixing (a) w/o regressing (b).

      const files = new Set<string>();
      suite.allTests().map(t => files.add(t.location.file));
      if (files.size === 1) {
        // All tests point to one file.
        const mappedFile = files.values().next().value;
        if (suite.location.file !== mappedFile) {
          // The file is different, check for a likely source map case.
          if (path.extname(mappedFile) !== path.extname(suite.location.file))
            suite.location.file = mappedFile;
        }
      }
    }

    return suite;
  }

  async loadGlobalHook(file: string, name: string): Promise<(config: FullConfigInternal) => any> {
    let hook = await this._requireOrImport(file);
    if (hook && typeof hook === 'object' && ('default' in hook))
      hook = hook['default'];
    if (typeof hook !== 'function')
      throw errorWithFile(file, `${name} file must export a single function.`);
    return hook;
  }

  async loadReporter(file: string): Promise<new (arg?: any) => Reporter> {
    let func = await this._requireOrImport(path.resolve(this._fullConfig.rootDir, file));
    if (func && typeof func === 'object' && ('default' in func))
      func = func['default'];
    if (typeof func !== 'function')
      throw errorWithFile(file, `reporter file must export a single class.`);
    return func;
  }

  fullConfig(): FullConfigInternal {
    return this._fullConfig;
  }

  projects() {
    return this._projects;
  }

  serialize(): SerializedLoaderData {
    return {
      defaultConfig: this._defaultConfig,
      configFile: this._configFile ? { file: this._configFile } : { configDir: this._configDir },
      overrides: this._configOverrides,
    };
  }

  private _addProject(config: Config, projectConfig: Project, throwawayArtifactsPath: string) {
    // Resolve all config dirs relative to configDir.
    if (projectConfig.testDir !== undefined)
      projectConfig.testDir = path.resolve(this._configDir, projectConfig.testDir);
    if (projectConfig.outputDir !== undefined)
      projectConfig.outputDir = path.resolve(this._configDir, projectConfig.outputDir);
    if (projectConfig.screenshotsDir !== undefined)
      projectConfig.screenshotsDir = path.resolve(this._configDir, projectConfig.screenshotsDir);
    if (projectConfig.snapshotDir !== undefined)
      projectConfig.snapshotDir = path.resolve(this._configDir, projectConfig.snapshotDir);

    const testDir = takeFirst(this._configOverrides.testDir, projectConfig.testDir, config.testDir, this._configDir);

    const outputDir = takeFirst(this._configOverrides.outputDir, projectConfig.outputDir, config.outputDir, path.join(throwawayArtifactsPath, 'test-results'));
    const snapshotDir = takeFirst(this._configOverrides.snapshotDir, projectConfig.snapshotDir, config.snapshotDir, testDir);
    const name = takeFirst(this._configOverrides.name, projectConfig.name, config.name, '');
    const screenshotsDir = takeFirst(this._configOverrides.screenshotsDir, projectConfig.screenshotsDir, config.screenshotsDir, path.join(testDir, '__screenshots__', process.platform, name));
    const fullProject: FullProject = {
      fullyParallel: takeFirst(this._configOverrides.fullyParallel, projectConfig.fullyParallel, config.fullyParallel, undefined),
      expect: takeFirst(this._configOverrides.expect, projectConfig.expect, config.expect, undefined),
      grep: takeFirst(this._configOverrides.grep, projectConfig.grep, config.grep, baseFullConfig.grep),
      grepInvert: takeFirst(this._configOverrides.grepInvert, projectConfig.grepInvert, config.grepInvert, baseFullConfig.grepInvert),
      outputDir,
      repeatEach: takeFirst(this._configOverrides.repeatEach, projectConfig.repeatEach, config.repeatEach, 1),
      retries: takeFirst(this._configOverrides.retries, projectConfig.retries, config.retries, 0),
      metadata: takeFirst(this._configOverrides.metadata, projectConfig.metadata, config.metadata, undefined),
      name,
      testDir,
      snapshotDir,
      screenshotsDir,
      testIgnore: takeFirst(this._configOverrides.testIgnore, projectConfig.testIgnore, config.testIgnore, []),
      testMatch: takeFirst(this._configOverrides.testMatch, projectConfig.testMatch, config.testMatch, '**/?(*.)@(spec|test).*'),
      timeout: takeFirst(this._configOverrides.timeout, projectConfig.timeout, config.timeout, 10000),
      use: mergeObjects(mergeObjects(config.use, projectConfig.use), this._configOverrides.use),
    };
    this._projects.push(new ProjectImpl(fullProject, this._projects.length));
  }

  private async _requireOrImport(file: string) {
    const revertBabelRequire = installTransform();
    const isModule = fileIsModule(file);
    try {
      const esmImport = () => eval(`import(${JSON.stringify(url.pathToFileURL(file))})`);
      if (isModule)
        return await esmImport();
      return require(file);
    } catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('Did you mean to import')) {
        const didYouMean = /Did you mean to import (.*)\?/.exec(error.message)?.[1];
        if (didYouMean?.endsWith('.ts'))
          throw errorWithFile(file, 'Cannot import a typescript file from an esmodule.');
      }
      if (error.code === 'ERR_UNKNOWN_FILE_EXTENSION' && error.message.includes('.ts')) {
        throw errorWithFile(file, `Cannot import a typescript file from an esmodule.\n${'='.repeat(80)}\nMake sure that:
  - you are using Node.js 16+,
  - your package.json contains "type": "module",
  - you are using TypeScript for playwright.config.ts.
${'='.repeat(80)}\n`);
      }

      if (error instanceof SyntaxError && error.message.includes('Cannot use import statement outside a module'))
        throw errorWithFile(file, 'JavaScript files must end with .mjs to use import.');

      throw error;
    } finally {
      revertBabelRequire();
    }
  }
}

function takeFirst<T>(...args: (T | undefined)[]): T {
  for (const arg of args) {
    if (arg !== undefined)
      return arg;
  }
  return undefined as any as T;
}

function toReporters(reporters: BuiltInReporter | ReporterDescription[] | undefined): ReporterDescription[] | undefined {
  if (!reporters)
    return;
  if (typeof reporters === 'string')
    return [ [reporters] ];
  return reporters;
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
      throw errorWithFile(file, `config.grep must be a RegExp`);
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
    if (typeof config.updateSnapshots !== 'string' || !['all', 'none', 'missing'].includes(config.updateSnapshots))
      throw errorWithFile(file, `config.updateSnapshots must be one of "all", "none" or "missing"`);
  }

  if ('workers' in config && config.workers !== undefined) {
    if (typeof config.workers !== 'number' || config.workers <= 0)
      throw errorWithFile(file, `config.workers must be a positive number`);
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

const baseFullConfig: FullConfigInternal = {
  forbidOnly: false,
  fullyParallel: false,
  globalSetup: null,
  globalTeardown: null,
  globalTimeout: 0,
  grep: /.*/,
  grepInvert: null,
  maxFailures: 0,
  preserveOutput: 'always',
  projects: [],
  reporter: [ ['list'] ],
  reportSlowTests: null,
  rootDir: path.resolve(process.cwd()),
  quiet: false,
  shard: null,
  updateSnapshots: 'missing',
  version: require('../package.json').version,
  workers: 1,
  webServer: null,
  attachments: [],
};

function resolveReporters(reporters: Config['reporter'], rootDir: string): ReporterDescription[]|undefined {
  return toReporters(reporters as any)?.map(([id, arg]) => {
    if (builtInReporters.includes(id as any))
      return [id, arg];
    return [require.resolve(id, { paths: [ rootDir ] }), arg];
  });
}

function resolveScript(id: string, rootDir: string) {
  const localPath = path.resolve(rootDir, id);
  if (fs.existsSync(localPath))
    return localPath;
  return require.resolve(id, { paths: [rootDir] });
}

export function fileIsModule(file: string): boolean {
  if (file.endsWith('.mjs'))
    return true;

  const folder = path.dirname(file);
  return folderIsModule(folder);
}

const folderToPackageJsonPath = new Map<string, string>();

function getPackageJsonPath(folderPath: string): string {
  const cached = folderToPackageJsonPath.get(folderPath);
  if (cached !== undefined)
    return cached;

  const packageJsonPath = path.join(folderPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    folderToPackageJsonPath.set(folderPath, packageJsonPath);
    return packageJsonPath;
  }

  const parentFolder = path.dirname(folderPath);
  if (folderPath === parentFolder) {
    folderToPackageJsonPath.set(folderPath, '');
    return '';
  }

  const result = getPackageJsonPath(parentFolder);
  folderToPackageJsonPath.set(folderPath, result);
  return result;
}

export function folderIsModule(folder: string): boolean {
  const packageJsonPath = getPackageJsonPath(folder);
  if (!packageJsonPath)
    return false;
  // Rely on `require` internal caching logic.
  return require(packageJsonPath).type === 'module';
}
