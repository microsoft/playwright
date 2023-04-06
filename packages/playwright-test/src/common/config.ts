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

import path from 'path';
import os from 'os';
import type { Config, Fixtures, Project, ReporterDescription } from '../../types/test';
import type { Location } from '../../types/testReporter';
import type { TestRunnerPluginRegistration } from '../plugins';
import type { Matcher } from '../util';
import { mergeObjects } from '../util';
import type { ConfigCLIOverrides } from './ipc';
import type { FullConfig, FullProject } from '../../types/test';

export type FixturesWithLocation = {
  fixtures: Fixtures;
  location: Location;
};
export type Annotation = { type: string, description?: string };

export const defaultTimeout = 30000;

export class FullConfigInternal {
  readonly config: FullConfig;
  globalOutputDir = path.resolve(process.cwd());
  configDir = '';
  configCLIOverrides: ConfigCLIOverrides = {};
  storeDir = '';
  maxConcurrentTestGroups = 0;
  ignoreSnapshots = false;
  webServers: Exclude<FullConfig['webServer'], null>[] = [];
  plugins: TestRunnerPluginRegistration[] = [];
  listOnly = false;
  cliArgs: string[] = [];
  cliGrep: string | undefined;
  cliGrepInvert: string | undefined;
  cliProjectFilter?: string[];
  testIdMatcher?: Matcher;
  passWithNoTests?: boolean;
  defineConfigWasUsed = false;
  projects: FullProjectInternal[] = [];

  static from(config: FullConfig): FullConfigInternal {
    return (config as any)[configInternalSymbol];
  }

  constructor(configDir: string, configFile: string | undefined, config: Config, throwawayArtifactsPath: string) {
    this.configDir = configDir;
    this.config = { ...baseFullConfig };
    (this.config as any)[configInternalSymbol] = this;
    this.storeDir = path.resolve(configDir, (config as any)._storeDir || 'playwright');
    this.globalOutputDir = takeFirst(config.outputDir, throwawayArtifactsPath, path.resolve(process.cwd()));
    this.ignoreSnapshots = takeFirst(config.ignoreSnapshots, false);
    this.plugins = ((config as any)._plugins || []).map((p: any) => ({ factory: p }));

    this.config.configFile = configFile;
    this.config.rootDir = config.testDir || configDir;
    this.config.forbidOnly = takeFirst(config.forbidOnly, baseFullConfig.forbidOnly);
    this.config.fullyParallel = takeFirst(config.fullyParallel, baseFullConfig.fullyParallel);
    this.config.globalSetup = takeFirst(config.globalSetup, baseFullConfig.globalSetup);
    this.config.globalTeardown = takeFirst(config.globalTeardown, baseFullConfig.globalTeardown);
    this.config.globalTimeout = takeFirst(config.globalTimeout, baseFullConfig.globalTimeout);
    this.config.grep = takeFirst(config.grep, baseFullConfig.grep);
    this.config.grepInvert = takeFirst(config.grepInvert, baseFullConfig.grepInvert);
    this.config.maxFailures = takeFirst(config.maxFailures, baseFullConfig.maxFailures);
    this.config.preserveOutput = takeFirst(config.preserveOutput, baseFullConfig.preserveOutput);
    this.config.reporter = takeFirst(resolveReporters(config.reporter, configDir), baseFullConfig.reporter);
    this.config.reportSlowTests = takeFirst(config.reportSlowTests, baseFullConfig.reportSlowTests);
    this.config.quiet = takeFirst(config.quiet, baseFullConfig.quiet);
    this.config.shard = takeFirst(config.shard, baseFullConfig.shard);
    this.config.updateSnapshots = takeFirst(config.updateSnapshots, baseFullConfig.updateSnapshots);

    const workers = takeFirst(config.workers, '50%');
    if (typeof workers === 'string') {
      if (workers.endsWith('%')) {
        const cpus = os.cpus().length;
        this.config.workers = Math.max(1, Math.floor(cpus * (parseInt(workers, 10) / 100)));
      } else {
        this.config.workers = parseInt(workers, 10);
      }
    } else {
      this.config.workers = workers;
    }

    const webServers = takeFirst(config.webServer, baseFullConfig.webServer);
    if (Array.isArray(webServers)) { // multiple web server mode
      // Due to previous choices, this value shows up to the user in globalSetup as part of FullConfig. Arrays are not supported by the old type.
      this.config.webServer = null;
      this.webServers = webServers;
    } else if (webServers) { // legacy singleton mode
      this.config.webServer = webServers;
      this.webServers = [webServers];
    }
    this.config.metadata = takeFirst(config.metadata, baseFullConfig.metadata);
    this.projects = (config.projects || [config]).map(p => this._resolveProject(config, p, throwawayArtifactsPath));
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
        usedNames.add(candidate);
        break;
      }
    }
  }

  private _resolveProject(config: Config, projectConfig: Project, throwawayArtifactsPath: string): FullProjectInternal {
    // Resolve all config dirs relative to configDir.
    if (projectConfig.testDir !== undefined)
      projectConfig.testDir = path.resolve(this.configDir, projectConfig.testDir);
    if (projectConfig.outputDir !== undefined)
      projectConfig.outputDir = path.resolve(this.configDir, projectConfig.outputDir);
    if (projectConfig.snapshotDir !== undefined)
      projectConfig.snapshotDir = path.resolve(this.configDir, projectConfig.snapshotDir);
    return new FullProjectInternal(config, this, projectConfig, throwawayArtifactsPath);
  }
}

export class FullProjectInternal {
  readonly project: FullProject;
  id = '';
  fullConfig: FullConfigInternal;
  fullyParallel: boolean;
  expect: Project['expect'];
  respectGitIgnore: boolean;
  deps: FullProjectInternal[] = [];
  snapshotPathTemplate: string;

  static from(project: FullProject): FullProjectInternal {
    return (project as any)[projectInternalSymbol];
  }

  constructor(config: Config, fullConfig: FullConfigInternal, projectConfig: Project, throwawayArtifactsPath: string) {
    this.fullConfig = fullConfig;

    const testDir = takeFirst(projectConfig.testDir, config.testDir, fullConfig.configDir);

    const outputDir = takeFirst(projectConfig.outputDir, config.outputDir, path.join(throwawayArtifactsPath, 'test-results'));
    const snapshotDir = takeFirst(projectConfig.snapshotDir, config.snapshotDir, testDir);
    const name = takeFirst(projectConfig.name, config.name, '');

    const defaultSnapshotPathTemplate = '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{-snapshotSuffix}{ext}';
    this.snapshotPathTemplate = takeFirst(projectConfig.snapshotPathTemplate, config.snapshotPathTemplate, defaultSnapshotPathTemplate);

    this.project = {
      grep: takeFirst(projectConfig.grep, config.grep, baseFullConfig.grep),
      grepInvert: takeFirst(projectConfig.grepInvert, config.grepInvert, baseFullConfig.grepInvert),
      outputDir,
      repeatEach: takeFirst(projectConfig.repeatEach, config.repeatEach, 1),
      retries: takeFirst(projectConfig.retries, config.retries, 0),
      metadata: takeFirst(projectConfig.metadata, config.metadata, undefined),
      name,
      testDir,
      snapshotDir,
      testIgnore: takeFirst(projectConfig.testIgnore, config.testIgnore, []),
      testMatch: takeFirst(projectConfig.testMatch, config.testMatch, '**/?(*.)@(spec|test).?(m)[jt]s?(x)'),
      timeout: takeFirst(projectConfig.timeout, config.timeout, defaultTimeout),
      use: mergeObjects(config.use, projectConfig.use),
      dependencies: projectConfig.dependencies || [],
    };
    (this.project as any)[projectInternalSymbol] = this;
    this.fullyParallel = takeFirst(projectConfig.fullyParallel, config.fullyParallel, undefined);
    this.expect = takeFirst(projectConfig.expect, config.expect, {});
    this.respectGitIgnore = !projectConfig.testDir && !config.testDir;
  }
}

export const baseFullConfig: FullConfig = {
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
  rootDir: path.resolve(process.cwd()),
  quiet: false,
  shard: null,
  updateSnapshots: 'missing',
  version: require('../../package.json').version,
  workers: 0,
  webServer: null,
};

export function takeFirst<T>(...args: (T | undefined)[]): T {
  for (const arg of args) {
    if (arg !== undefined)
      return arg;
  }
  return undefined as any as T;
}

function resolveReporters(reporters: Config['reporter'], rootDir: string): ReporterDescription[] | undefined {
  return toReporters(reporters as any)?.map(([id, arg]) => {
    if (builtInReporters.includes(id as any))
      return [id, arg];
    return [require.resolve(id, { paths: [rootDir] }), arg];
  });
}

function resolveProjectDependencies(projects: FullProjectInternal[]) {
  for (const project of projects) {
    for (const dependencyName of project.project.dependencies) {
      const dependencies = projects.filter(p => p.project.name === dependencyName);
      if (!dependencies.length)
        throw new Error(`Project '${project.project.name}' depends on unknown project '${dependencyName}'`);
      if (dependencies.length > 1)
        throw new Error(`Project dependencies should have unique names, reading ${dependencyName}`);
      project.deps.push(...dependencies);
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

export const builtInReporters = ['list', 'line', 'dot', 'json', 'junit', 'null', 'github', 'html'] as const;
export type BuiltInReporter = typeof builtInReporters[number];

export type ContextReuseMode = 'none' | 'force' | 'when-possible';

const configInternalSymbol = Symbol('configInternalSymbol');
const projectInternalSymbol = Symbol('projectInternalSymbol');
