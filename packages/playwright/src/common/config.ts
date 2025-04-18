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
import os from 'os';
import path from 'path';

import { getPackageJsonPath, mergeObjects } from '../util';

import type { Config, Fixtures, Metadata, Project, ReporterDescription } from '../../types/test';
import type { TestRunnerPluginRegistration } from '../plugins';
import type { Matcher } from '../util';
import type { ConfigCLIOverrides } from './ipc';
import type { Location } from '../../types/testReporter';
import type { FullConfig, FullProject } from '../../types/testReporter';

export type ConfigLocation = {
  resolvedConfigFile?: string;
  configDir: string;
};

export type FixturesWithLocation = {
  fixtures: Fixtures;
  location: Location;
};

export const defaultTimeout = 30000;

export class FullConfigInternal {
  readonly config: FullConfig;
  readonly configDir: string;
  readonly configCLIOverrides: ConfigCLIOverrides;
  readonly webServers: NonNullable<FullConfig['webServer']>[];
  readonly plugins: TestRunnerPluginRegistration[];
  readonly projects: FullProjectInternal[] = [];
  readonly singleTSConfigPath?: string;
  readonly captureGitInfo: Config['captureGitInfo'];
  readonly failOnFlakyTests: boolean;
  cliArgs: string[] = [];
  cliGrep: string | undefined;
  cliGrepInvert: string | undefined;
  cliOnlyChanged: string | undefined;
  cliProjectFilter?: string[];
  cliListOnly = false;
  cliPassWithNoTests?: boolean;
  cliLastFailed?: boolean;
  testIdMatcher?: Matcher;
  lastFailedTestIdMatcher?: Matcher;
  defineConfigWasUsed = false;

  globalSetups: string[] = [];
  globalTeardowns: string[] = [];

  constructor(location: ConfigLocation, userConfig: Config, configCLIOverrides: ConfigCLIOverrides, metadata?: Metadata) {
    if (configCLIOverrides.projects && userConfig.projects)
      throw new Error(`Cannot use --browser option when configuration file defines projects. Specify browserName in the projects instead.`);

    const { resolvedConfigFile, configDir } = location;
    const packageJsonPath = getPackageJsonPath(configDir);
    const packageJsonDir = packageJsonPath ? path.dirname(packageJsonPath) : process.cwd();

    this.configDir = configDir;
    this.configCLIOverrides = configCLIOverrides;
    const privateConfiguration = (userConfig as any)['@playwright/test'];
    this.plugins = (privateConfiguration?.plugins || []).map((p: any) => ({ factory: p }));
    this.singleTSConfigPath = pathResolve(configDir, userConfig.tsconfig);
    this.captureGitInfo = userConfig.captureGitInfo;
    this.failOnFlakyTests = takeFirst(configCLIOverrides.failOnFlakyTests, userConfig.failOnFlakyTests, false);

    this.globalSetups = (Array.isArray(userConfig.globalSetup) ? userConfig.globalSetup : [userConfig.globalSetup]).map(s => resolveScript(s, configDir)).filter(script => script !== undefined);
    this.globalTeardowns = (Array.isArray(userConfig.globalTeardown) ? userConfig.globalTeardown : [userConfig.globalTeardown]).map(s => resolveScript(s, configDir)).filter(script => script !== undefined);

    // Make sure we reuse same metadata instance between FullConfigInternal instances,
    // so that plugins such as gitCommitInfoPlugin can populate metadata once.
    userConfig.metadata = userConfig.metadata || {};

    this.config = {
      configFile: resolvedConfigFile,
      rootDir: pathResolve(configDir, userConfig.testDir) || configDir,
      forbidOnly: takeFirst(configCLIOverrides.forbidOnly, userConfig.forbidOnly, false),
      fullyParallel: takeFirst(configCLIOverrides.fullyParallel, userConfig.fullyParallel, false),
      globalSetup: this.globalSetups[0] ?? null,
      globalTeardown: this.globalTeardowns[0] ?? null,
      globalTimeout: takeFirst(configCLIOverrides.debug ? 0 : undefined, configCLIOverrides.globalTimeout, userConfig.globalTimeout, 0),
      grep: takeFirst(userConfig.grep, defaultGrep),
      grepInvert: takeFirst(userConfig.grepInvert, null),
      maxFailures: takeFirst(configCLIOverrides.debug ? 1 : undefined, configCLIOverrides.maxFailures, userConfig.maxFailures, 0),
      metadata: metadata ?? userConfig.metadata,
      preserveOutput: takeFirst(userConfig.preserveOutput, 'always'),
      reporter: takeFirst(configCLIOverrides.reporter, resolveReporters(userConfig.reporter, configDir), [[defaultReporter]]),
      reportSlowTests: takeFirst(userConfig.reportSlowTests, { max: 5, threshold: 300_000 /* 5 minutes */ }),
      quiet: takeFirst(configCLIOverrides.quiet, userConfig.quiet, false),
      projects: [],
      shard: takeFirst(configCLIOverrides.shard, userConfig.shard, null),
      updateSnapshots: takeFirst(configCLIOverrides.updateSnapshots, userConfig.updateSnapshots, 'missing'),
      updateSourceMethod: takeFirst(configCLIOverrides.updateSourceMethod, userConfig.updateSourceMethod, 'patch'),
      version: require('../../package.json').version,
      workers: resolveWorkers(takeFirst(configCLIOverrides.debug ? 1 : undefined, configCLIOverrides.workers, userConfig.workers, '50%')),
      webServer: null,
    };
    for (const key in userConfig) {
      if (key.startsWith('@'))
        (this.config as any)[key] = (userConfig as any)[key];
    }

    (this.config as any)[configInternalSymbol] = this;

    const webServers = takeFirst(userConfig.webServer, null);
    if (Array.isArray(webServers)) { // multiple web server mode
      // Due to previous choices, this value shows up to the user in globalSetup as part of FullConfig. Arrays are not supported by the old type.
      this.config.webServer = null;
      this.webServers = webServers;
    } else if (webServers) { // legacy singleton mode
      this.config.webServer = webServers;
      this.webServers = [webServers];
    } else {
      this.webServers = [];
    }

    const projectConfigs = configCLIOverrides.projects || userConfig.projects || [userConfig];
    this.projects = projectConfigs.map(p => new FullProjectInternal(configDir, userConfig, this, p, this.configCLIOverrides, packageJsonDir));
    resolveProjectDependencies(this.projects);
    this._assignUniqueProjectIds(this.projects);
    this.config.projects = this.projects.map(p => p.project);
  }

  private _assignUniqueProjectIds(projects: FullProjectInternal[]) {
    const usedNames = new Set();
    for (const p of projects) {
      const name = p.project.name || '';
      for (let i = 0; i < projects.length; ++i) {
        const candidate = name + (i ? i : '');
        if (usedNames.has(candidate))
          continue;
        p.id = candidate;
        (p.project as any).__projectId = p.id;
        usedNames.add(candidate);
        break;
      }
    }
  }
}

export class FullProjectInternal {
  readonly project: FullProject;
  readonly fullConfig: FullConfigInternal;
  readonly fullyParallel: boolean;
  readonly expect: Project['expect'];
  readonly respectGitIgnore: boolean;
  readonly snapshotPathTemplate: string | undefined;
  readonly ignoreSnapshots: boolean;
  readonly workers: number | undefined;
  id = '';
  deps: FullProjectInternal[] = [];
  teardown: FullProjectInternal | undefined;

  constructor(configDir: string, config: Config, fullConfig: FullConfigInternal, projectConfig: Project, configCLIOverrides: ConfigCLIOverrides, packageJsonDir: string) {
    this.fullConfig = fullConfig;
    const testDir = takeFirst(pathResolve(configDir, projectConfig.testDir), pathResolve(configDir, config.testDir), fullConfig.configDir);
    this.snapshotPathTemplate = takeFirst(projectConfig.snapshotPathTemplate, config.snapshotPathTemplate);

    this.project = {
      grep: takeFirst(projectConfig.grep, config.grep, defaultGrep),
      grepInvert: takeFirst(projectConfig.grepInvert, config.grepInvert, null),
      outputDir: takeFirst(configCLIOverrides.outputDir, pathResolve(configDir, projectConfig.outputDir), pathResolve(configDir, config.outputDir), path.join(packageJsonDir, 'test-results')),
      // Note: we either apply the cli override for repeatEach or not, depending on whether the
      // project is top-level vs dependency. See collectProjectsAndTestFiles in loadUtils.
      repeatEach: takeFirst(projectConfig.repeatEach, config.repeatEach, 1),
      retries: takeFirst(configCLIOverrides.retries, projectConfig.retries, config.retries, 0),
      metadata: takeFirst(projectConfig.metadata, config.metadata, {}),
      name: takeFirst(projectConfig.name, config.name, ''),
      testDir,
      snapshotDir: takeFirst(pathResolve(configDir, projectConfig.snapshotDir), pathResolve(configDir, config.snapshotDir), testDir),
      testIgnore: takeFirst(projectConfig.testIgnore, config.testIgnore, []),
      testMatch: takeFirst(projectConfig.testMatch, config.testMatch, '**/*.@(spec|test).?(c|m)[jt]s?(x)'),
      timeout: takeFirst(configCLIOverrides.debug ? 0 : undefined, configCLIOverrides.timeout, projectConfig.timeout, config.timeout, defaultTimeout),
      use: mergeObjects(config.use, projectConfig.use, configCLIOverrides.use),
      dependencies: projectConfig.dependencies || [],
      teardown: projectConfig.teardown,
    };
    this.fullyParallel = takeFirst(configCLIOverrides.fullyParallel, projectConfig.fullyParallel, config.fullyParallel, undefined);
    this.expect = takeFirst(projectConfig.expect, config.expect, {});
    if (this.expect.toHaveScreenshot?.stylePath) {
      const stylePaths = Array.isArray(this.expect.toHaveScreenshot.stylePath) ? this.expect.toHaveScreenshot.stylePath : [this.expect.toHaveScreenshot.stylePath];
      this.expect.toHaveScreenshot.stylePath = stylePaths.map(stylePath => path.resolve(configDir, stylePath));
    }
    this.respectGitIgnore = takeFirst(projectConfig.respectGitIgnore, config.respectGitIgnore, !projectConfig.testDir && !config.testDir);
    this.ignoreSnapshots = takeFirst(configCLIOverrides.ignoreSnapshots,  projectConfig.ignoreSnapshots, config.ignoreSnapshots, false);
    this.workers = projectConfig.workers ? resolveWorkers(projectConfig.workers) : undefined;
    if (configCLIOverrides.debug && this.workers)
      this.workers = 1;
  }
}

export function takeFirst<T>(...args: (T | undefined)[]): T {
  for (const arg of args) {
    if (arg !== undefined)
      return arg;
  }
  return undefined as any as T;
}

function pathResolve(baseDir: string, relative: string | undefined): string | undefined {
  if (!relative)
    return undefined;
  return path.resolve(baseDir, relative);
}

function resolveReporters(reporters: Config['reporter'], rootDir: string): ReporterDescription[] | undefined {
  return toReporters(reporters as any)?.map(([id, arg]) => {
    if (builtInReporters.includes(id as any))
      return [id, arg];
    return [require.resolve(id, { paths: [rootDir] }), arg];
  });
}

function resolveWorkers(workers: string | number): number {
  if (typeof workers === 'string') {
    if (workers.endsWith('%')) {
      const cpus = os.cpus().length;
      return Math.max(1, Math.floor(cpus * (parseInt(workers, 10) / 100)));
    }
    const parsedWorkers = parseInt(workers, 10);
    if (isNaN(parsedWorkers))
      throw new Error(`Workers ${workers} must be a number or percentage.`);
    return parsedWorkers;
  }
  return workers;
}

function resolveProjectDependencies(projects: FullProjectInternal[]) {
  const teardownSet = new Set<FullProjectInternal>();
  for (const project of projects) {
    for (const dependencyName of project.project.dependencies) {
      const dependencies = projects.filter(p => p.project.name === dependencyName);
      if (!dependencies.length)
        throw new Error(`Project '${project.project.name}' depends on unknown project '${dependencyName}'`);
      if (dependencies.length > 1)
        throw new Error(`Project dependencies should have unique names, reading ${dependencyName}`);
      project.deps.push(...dependencies);
    }
    if (project.project.teardown) {
      const teardowns = projects.filter(p => p.project.name === project.project.teardown);
      if (!teardowns.length)
        throw new Error(`Project '${project.project.name}' has unknown teardown project '${project.project.teardown}'`);
      if (teardowns.length > 1)
        throw new Error(`Project teardowns should have unique names, reading ${project.project.teardown}`);
      const teardown = teardowns[0];
      project.teardown = teardown;
      teardownSet.add(teardown);
    }
  }
  for (const teardown of teardownSet) {
    if (teardown.deps.length)
      throw new Error(`Teardown project ${teardown.project.name} must not have dependencies`);
  }
  for (const project of projects) {
    for (const dep of project.deps) {
      if (teardownSet.has(dep))
        throw new Error(`Project ${project.project.name} must not depend on a teardown project ${dep.project.name}`);
    }
  }
}

export function toReporters(reporters: BuiltInReporter | ReporterDescription[] | undefined): ReporterDescription[] | undefined {
  if (!reporters)
    return;
  if (typeof reporters === 'string')
    return [[reporters]];
  return reporters;
}

export const builtInReporters = ['list', 'line', 'dot', 'json', 'junit', 'null', 'github', 'html', 'blob'] as const;
export type BuiltInReporter = typeof builtInReporters[number];

export type ContextReuseMode = 'none' | 'when-possible';

function resolveScript(id: string | undefined, rootDir: string): string | undefined {
  if (!id)
    return undefined;
  const localPath = path.resolve(rootDir, id);
  if (fs.existsSync(localPath))
    return localPath;
  return require.resolve(id, { paths: [rootDir] });
}

export const defaultGrep = /.*/;
export const defaultReporter = process.env.CI ? 'dot' : 'list';

const configInternalSymbol = Symbol('configInternalSymbol');

export function getProjectId(project: FullProject): string {
  return (project as any).__projectId!;
}
