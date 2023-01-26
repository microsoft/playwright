/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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
import * as path from 'path';
import { monotonicTime } from 'playwright-core/lib/utils';
import { colors, minimatch, rimraf } from 'playwright-core/lib/utilsBundle';
import { promisify } from 'util';
import type { FullResult, Reporter, TestError } from '../types/testReporter';
import type { TestGroup } from './dispatcher';
import { Dispatcher } from './dispatcher';
import { ConfigLoader } from './configLoader';
import type { TestRunnerPlugin } from './plugins';
import { setRunnerToAddPluginsTo } from './plugins';
import { dockerPlugin } from './plugins/dockerPlugin';
import { webServerPluginsForConfig } from './plugins/webServerPlugin';
import { formatError } from './reporters/base';
import DotReporter from './reporters/dot';
import EmptyReporter from './reporters/empty';
import GitHubReporter from './reporters/github';
import HtmlReporter from './reporters/html';
import JSONReporter from './reporters/json';
import JUnitReporter from './reporters/junit';
import LineReporter from './reporters/line';
import ListReporter from './reporters/list';
import { Multiplexer } from './reporters/multiplexer';
import type { TestCase } from './test';
import { Suite } from './test';
import type { Config, FullConfigInternal, FullProjectInternal } from './types';
import { createFileMatcher, createFileMatcherFromFilters, createTitleMatcher } from './util';
import type { Matcher, TestFileFilter } from './util';
import { buildFileSuiteForProject, filterOnly, filterSuite, filterSuiteWithOnlySemantics, filterTestsRemoveEmptySuites } from './suiteUtils';
import { LoaderHost } from './loaderHost';
import { loadTestFilesInProcess } from './testLoader';
import { TaskRunner } from './taskRunner';
import type { Task } from './taskRunner';
import type { LoadError } from './fixtures';

const removeFolderAsync = promisify(rimraf);
const readDirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);
export const kDefaultConfigFiles = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs'];

type RunOptions = {
  listOnly: boolean;
  testFileFilters: TestFileFilter[];
  testTitleMatcher: Matcher;
  projectFilter?: string[];
  passWithNoTests?: boolean;
};

export type ConfigCLIOverrides = {
  forbidOnly?: boolean;
  fullyParallel?: boolean;
  globalTimeout?: number;
  maxFailures?: number;
  outputDir?: string;
  quiet?: boolean;
  repeatEach?: number;
  retries?: number;
  reporter?: string;
  shard?: { current: number, total: number };
  timeout?: number;
  ignoreSnapshots?: boolean;
  updateSnapshots?: 'all'|'none'|'missing';
  workers?: number;
  projects?: { name: string, use?: any }[],
  use?: any;
};

type TaskRunnerContext = {
  reporter: Multiplexer;
  config: FullConfigInternal;
  configLoader: ConfigLoader;
  options: RunOptions;
  rootSuite?: Suite;
  testGroups?: TestGroup[];
  dispatcher?: Dispatcher;
};

export class Runner {
  private _configLoader: ConfigLoader;
  private _plugins: TestRunnerPlugin[] = [];

  constructor(configCLIOverrides?: ConfigCLIOverrides) {
    this._configLoader = new ConfigLoader(configCLIOverrides);
    setRunnerToAddPluginsTo(this);
  }

  addPlugin(plugin: TestRunnerPlugin) {
    this._plugins.push(plugin);
  }

  async loadConfigFromResolvedFile(resolvedConfigFile: string): Promise<FullConfigInternal> {
    return await this._configLoader.loadConfigFile(resolvedConfigFile);
  }

  loadEmptyConfig(configFileOrDirectory: string): Promise<Config> {
    return this._configLoader.loadEmptyConfig(configFileOrDirectory);
  }

  async listTestFiles(projectNames: string[] | undefined): Promise<any> {
    const projects = collectProjects(this._configLoader, projectNames);
    const filesByProject = await collectFilesForProjects(projects, []);
    const report: any = {
      projects: []
    };
    for (const [project, files] of filesByProject) {
      report.projects.push({
        ...sanitizeConfigForJSON(project, new Set()),
        files
      });
    }
    return report;
  }

  async runAllTests(options: RunOptions): Promise<FullResult['status']> {
    const config = this._configLoader.fullConfig();
    const deadline = config.globalTimeout ? monotonicTime() + config.globalTimeout : 0;

    // Legacy webServer support.
    this._plugins.push(...webServerPluginsForConfig(config));
    // Docker support.
    this._plugins.push(dockerPlugin);

    const reporter = await createReporter(this._configLoader, options.listOnly);
    const taskRunner = createTaskRunner(config, reporter, this._plugins, options);

    const context: TaskRunnerContext = {
      config,
      configLoader: this._configLoader,
      options,
      reporter,
    };

    reporter.onConfigure(config);
    const taskStatus = await taskRunner.run(context, deadline);
    let status: FullResult['status'] = 'passed';
    if (context.dispatcher?.hasWorkerErrors() || context.rootSuite?.allTests().some(test => !test.ok()))
      status = 'failed';
    if (status === 'passed' && taskStatus !== 'passed')
      status = taskStatus;
    await reporter.onExit({ status });

    // Calling process.exit() might truncate large stdout/stderr output.
    // See https://github.com/nodejs/node/issues/6456.
    // See https://github.com/nodejs/node/issues/12921
    await new Promise<void>(resolve => process.stdout.write('', () => resolve()));
    await new Promise<void>(resolve => process.stderr.write('', () => resolve()));
    return status;
  }
}

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

async function createReporter(configLoader: ConfigLoader, list: boolean) {
  const defaultReporters: {[key in BuiltInReporter]: new(arg: any) => Reporter} = {
    dot: list ? ListModeReporter : DotReporter,
    line: list ? ListModeReporter : LineReporter,
    list: list ? ListModeReporter : ListReporter,
    github: GitHubReporter,
    json: JSONReporter,
    junit: JUnitReporter,
    null: EmptyReporter,
    html: HtmlReporter,
  };
  const reporters: Reporter[] = [];
  for (const r of configLoader.fullConfig().reporter) {
    const [name, arg] = r;
    if (name in defaultReporters) {
      reporters.push(new defaultReporters[name as keyof typeof defaultReporters](arg));
    } else {
      const reporterConstructor = await configLoader.loadReporter(name);
      reporters.push(new reporterConstructor(arg));
    }
  }
  if (process.env.PW_TEST_REPORTER) {
    const reporterConstructor = await configLoader.loadReporter(process.env.PW_TEST_REPORTER);
    reporters.push(new reporterConstructor());
  }

  const someReporterPrintsToStdio = reporters.some(r => {
    const prints = r.printsToStdio ? r.printsToStdio() : true;
    return prints;
  });
  if (reporters.length && !someReporterPrintsToStdio) {
    // Add a line/dot/list-mode reporter for convenience.
    // Important to put it first, jsut in case some other reporter stalls onEnd.
    if (list)
      reporters.unshift(new ListModeReporter());
    else
      reporters.unshift(!process.env.CI ? new LineReporter({ omitFailures: true }) : new DotReporter());
  }
  return new Multiplexer(reporters);
}

function collectProjects(configLoader: ConfigLoader, projectNames?: string[]): FullProjectInternal[] {
  const fullConfig = configLoader.fullConfig();
  if (!projectNames)
    return [...fullConfig.projects];
  const projectsToFind = new Set<string>();
  const unknownProjects = new Map<string, string>();
  projectNames.forEach(n => {
    const name = n.toLocaleLowerCase();
    projectsToFind.add(name);
    unknownProjects.set(name, n);
  });
  const projects = fullConfig.projects.filter(project => {
    const name = project.name.toLocaleLowerCase();
    unknownProjects.delete(name);
    return projectsToFind.has(name);
  });
  if (unknownProjects.size) {
    const names = fullConfig.projects.map(p => p.name).filter(name => !!name);
    if (!names.length)
      throw new Error(`No named projects are specified in the configuration file`);
    const unknownProjectNames = Array.from(unknownProjects.values()).map(n => `"${n}"`).join(', ');
    throw new Error(`Project(s) ${unknownProjectNames} not found. Available named projects: ${names.map(name => `"${name}"`).join(', ')}`);
  }
  return projects;
}

async function collectFilesForProjects(projects: FullProjectInternal[], commandLineFileFilters: TestFileFilter[]): Promise<Map<FullProjectInternal, string[]>> {
  const extensions = ['.js', '.ts', '.mjs', '.tsx', '.jsx'];
  const testFileExtension = (file: string) => extensions.includes(path.extname(file));
  const filesByProject = new Map<FullProjectInternal, string[]>();
  const fileToProjectName = new Map<string, string>();
  const commandLineFileMatcher = commandLineFileFilters.length ? createFileMatcherFromFilters(commandLineFileFilters) : () => true;
  for (const project of projects) {
    const allFiles = await collectFiles(project.testDir, project._respectGitIgnore);
    const testMatch = createFileMatcher(project.testMatch);
    const testIgnore = createFileMatcher(project.testIgnore);
    const testFiles = allFiles.filter(file => {
      if (!testFileExtension(file))
        return false;
      const isTest = !testIgnore(file) && testMatch(file) && commandLineFileMatcher(file);
      if (!isTest)
        return false;
      fileToProjectName.set(file, project.name);
      return true;
    });
    filesByProject.set(project, testFiles);
  }

  return filesByProject;
}

async function loadAllTests(configLoader: ConfigLoader, reporter: Multiplexer, options: RunOptions, errors: TestError[]): Promise<{ rootSuite: Suite, testGroups: TestGroup[] }> {
  const config = configLoader.fullConfig();
  const projects = collectProjects(configLoader, options.projectFilter);
  const filesByProject = await collectFilesForProjects(projects, options.testFileFilters);
  const allTestFiles = new Set<string>();
  for (const files of filesByProject.values())
    files.forEach(file => allTestFiles.add(file));

  // Load all tests.
  const preprocessRoot = await loadTests(configLoader, reporter, allTestFiles, errors);

  // Complain about duplicate titles.
  errors.push(...createDuplicateTitlesErrors(config, preprocessRoot));

  // Filter tests to respect line/column filter.
  filterByFocusedLine(preprocessRoot, options.testFileFilters);

  // Complain about only.
  if (config.forbidOnly) {
    const onlyTestsAndSuites = preprocessRoot._getOnlyItems();
    if (onlyTestsAndSuites.length > 0)
      errors.push(...createForbidOnlyErrors(onlyTestsAndSuites));
  }

  // Filter only.
  if (!options.listOnly)
    filterOnly(preprocessRoot);

  const rootSuite = await createRootSuite(preprocessRoot, options, filesByProject);

  // Do not create test groups when listing.
  if (options.listOnly)
    return { rootSuite, testGroups: [] };

  const testGroups = createTestGroups(rootSuite.suites, config.workers);
  return { rootSuite, testGroups };
}

async function createRootSuite(preprocessRoot: Suite, options: RunOptions, filesByProject: Map<FullProjectInternal, string[]>): Promise<Suite> {
  // Generate projects.
  const fileSuites = new Map<string, Suite>();
  for (const fileSuite of preprocessRoot.suites)
    fileSuites.set(fileSuite._requireFile, fileSuite);

  const rootSuite = new Suite('', 'root');
  for (const [project, files] of filesByProject) {
    const grepMatcher = createTitleMatcher(project.grep);
    const grepInvertMatcher = project.grepInvert ? createTitleMatcher(project.grepInvert) : null;

    const titleMatcher = (test: TestCase) => {
      const grepTitle = test.titlePath().join(' ');
      if (grepInvertMatcher?.(grepTitle))
        return false;
      return grepMatcher(grepTitle) && options.testTitleMatcher(grepTitle);
    };

    const projectSuite = new Suite(project.name, 'project');
    projectSuite._projectConfig = project;
    if (project._fullyParallel)
      projectSuite._parallelMode = 'parallel';
    rootSuite._addSuite(projectSuite);
    for (const file of files) {
      const fileSuite = fileSuites.get(file);
      if (!fileSuite)
        continue;
      for (let repeatEachIndex = 0; repeatEachIndex < project.repeatEach; repeatEachIndex++) {
        const builtSuite = buildFileSuiteForProject(project, fileSuite, repeatEachIndex);
        if (!filterTestsRemoveEmptySuites(builtSuite, titleMatcher))
          continue;
        projectSuite._addSuite(builtSuite);
      }
    }
  }
  return rootSuite;
}

async function loadTests(configLoader: ConfigLoader, reporter: Multiplexer, testFiles: Set<string>, errors: TestError[]): Promise<Suite> {
  if (process.env.PW_TEST_OOP_LOADER) {
    const loaderHost = new LoaderHost();
    await loaderHost.start(configLoader.serializedConfig());
    try {
      return await loaderHost.loadTestFiles([...testFiles], reporter);
    } finally {
      await loaderHost.stop();
    }
  }
  const loadErrors: LoadError[] = [];
  try {
    return await loadTestFilesInProcess(configLoader.fullConfig(), [...testFiles], loadErrors);
  } finally {
    errors.push(...loadErrors);
  }
}

async function filterForCurrentShard(configLoader: ConfigLoader, rootSuite: Suite, testGroups: TestGroup[]) {
  const shard = configLoader.fullConfig().shard;
  if (!shard)
    return;

  // Each shard includes:
  // - its portion of the regular tests
  // - project setup tests for the projects that have regular tests in this shard
  let shardableTotal = 0;
  for (const group of testGroups)
    shardableTotal += group.tests.length;

  const shardTests = new Set<TestCase>();

  // Each shard gets some tests.
  const shardSize = Math.floor(shardableTotal / shard.total);
  // First few shards get one more test each.
  const extraOne = shardableTotal - shardSize * shard.total;

  const currentShard = shard.current - 1; // Make it zero-based for calculations.
  const from = shardSize * currentShard + Math.min(extraOne, currentShard);
  const to = from + shardSize + (currentShard < extraOne ? 1 : 0);
  let current = 0;
  const shardProjects = new Set<string>();
  const shardTestGroups = [];
  for (const group of testGroups) {
    // Any test group goes to the shard that contains the first test of this group.
    // So, this shard gets any group that starts at [from; to)
    if (current >= from && current < to) {
      shardProjects.add(group.projectId);
      shardTestGroups.push(group);
      for (const test of group.tests)
        shardTests.add(test);
    }
    current += group.tests.length;
  }
  testGroups.length = 0;
  testGroups.push(...shardTestGroups);

  if (!shardTests.size) {
    // Filtering with "only semantics" does not work when we have zero tests - it leaves all the tests.
    // We need an empty suite in this case.
    rootSuite._entries = [];
  } else {
    filterSuiteWithOnlySemantics(rootSuite, () => false, test => shardTests.has(test));
  }
}

function createPluginSetupTask(plugin: TestRunnerPlugin): Task<TaskRunnerContext> {
  return async ({ config, reporter }) => {
    await plugin.setup?.(config, config._configDir, reporter);
    return () => plugin.teardown?.();
  };
}

function createGlobalSetupTask(): Task<TaskRunnerContext> {
  return async ({ config, configLoader }) => {
    const setupHook = config.globalSetup ? await configLoader.loadGlobalHook(config.globalSetup) : undefined;
    const teardownHook = config.globalTeardown ? await configLoader.loadGlobalHook(config.globalTeardown) : undefined;
    const globalSetupResult = setupHook ? await setupHook(configLoader.fullConfig()) : undefined;
    return async () => {
      if (typeof globalSetupResult === 'function')
        await globalSetupResult();
      await teardownHook?.(config);
    };
  };
}

function createLoadTask(): Task<TaskRunnerContext> {
  return async (context, errors) => {
    const { reporter, options, configLoader } = context;
    const { rootSuite, testGroups } = await loadAllTests(configLoader, reporter, options, errors);
    context.rootSuite = rootSuite;
    context.testGroups = testGroups;
    if (errors.length)
      return;

    // Fail when no tests.
    if (!rootSuite.allTests().length && !context.options.passWithNoTests)
      throw new Error(`No tests found`);

    if (!context.options.listOnly) {
      filterForCurrentShard(context.configLoader, rootSuite, testGroups);
      context.config._maxConcurrentTestGroups = testGroups.length;
    }
  };
}

function createSetupWorkersTask(): Task<TaskRunnerContext> {
  return async params => {
    const { config, configLoader, testGroups, reporter } = params;
    if (config._ignoreSnapshots) {
      reporter.onStdOut(colors.dim([
        'NOTE: running with "ignoreSnapshots" option. All of the following asserts are silently ignored:',
        '- expect().toMatchSnapshot()',
        '- expect().toHaveScreenshot()',
        '',
      ].join('\n')));
    }

    const dispatcher = new Dispatcher(configLoader, testGroups!, reporter);
    params.dispatcher = dispatcher;
    return async () => {
      await dispatcher.stop();
    };
  };
}

function createTaskRunner(config: FullConfigInternal, reporter: Multiplexer, plugins: TestRunnerPlugin[], options: RunOptions): TaskRunner<TaskRunnerContext> {
  const taskRunner = new TaskRunner<TaskRunnerContext>(reporter, config.globalTimeout);

  for (const plugin of plugins)
    taskRunner.addTask('plugin setup', createPluginSetupTask(plugin));
  if (config.globalSetup || config.globalTeardown)
    taskRunner.addTask('global setup', createGlobalSetupTask());
  taskRunner.addTask('load tests', createLoadTask());

  if (!options.listOnly) {
    taskRunner.addTask('prepare to run', createRemoveOutputDirsTask());
    taskRunner.addTask('plugin begin', async ({ rootSuite }) => {
      for (const plugin of plugins)
        await plugin.begin?.(rootSuite!);
    });
  }

  taskRunner.addTask('report begin', async ({ reporter, rootSuite }) => {
    reporter.onBegin?.(config, rootSuite!);
    return () => reporter.onEnd();
  });

  if (!options.listOnly) {
    taskRunner.addTask('setup workers', createSetupWorkersTask());
    taskRunner.addTask('test suite', async ({ dispatcher }) => dispatcher!.run());
  }

  return taskRunner;
}

function createRemoveOutputDirsTask(): Task<TaskRunnerContext> {
  return async ({ options, configLoader }) => {
    const config = configLoader.fullConfig();
    const outputDirs = new Set<string>();
    for (const p of config.projects) {
      if (!options.projectFilter || options.projectFilter.includes(p.name))
        outputDirs.add(p.outputDir);
    }

    await Promise.all(Array.from(outputDirs).map(outputDir => removeFolderAsync(outputDir).catch(async (error: any) => {
      if ((error as any).code === 'EBUSY') {
        // We failed to remove folder, might be due to the whole folder being mounted inside a container:
        //   https://github.com/microsoft/playwright/issues/12106
        // Do a best-effort to remove all files inside of it instead.
        const entries = await readDirAsync(outputDir).catch(e => []);
        await Promise.all(entries.map(entry => removeFolderAsync(path.join(outputDir, entry))));
      } else {
        throw error;
      }
    })));
  };
}

function createFileMatcherFromFilter(filter: TestFileFilter) {
  const fileMatcher = createFileMatcher(filter.re || filter.exact || '');
  return (testFileName: string, testLine: number, testColumn: number) =>
    fileMatcher(testFileName) && (filter.line === testLine || filter.line === null) && (filter.column === testColumn || filter.column === null);
}

function filterByFocusedLine(suite: Suite, focusedTestFileLines: TestFileFilter[]) {
  if (!focusedTestFileLines.length)
    return;
  const matchers = focusedTestFileLines.map(createFileMatcherFromFilter);
  const testFileLineMatches = (testFileName: string, testLine: number, testColumn: number) => matchers.some(m => m(testFileName, testLine, testColumn));
  const suiteFilter = (suite: Suite) => !!suite.location && testFileLineMatches(suite.location.file, suite.location.line, suite.location.column);
  const testFilter = (test: TestCase) => testFileLineMatches(test.location.file, test.location.line, test.location.column);
  return filterSuite(suite, suiteFilter, testFilter);
}

async function collectFiles(testDir: string, respectGitIgnore: boolean): Promise<string[]> {
  if (!fs.existsSync(testDir))
    return [];
  if (!fs.statSync(testDir).isDirectory())
    return [];

  type Rule = {
    dir: string;
    negate: boolean;
    match: (s: string, partial?: boolean) => boolean
  };
  type IgnoreStatus = 'ignored' | 'included' | 'ignored-but-recurse';

  const checkIgnores = (entryPath: string, rules: Rule[], isDirectory: boolean, parentStatus: IgnoreStatus) => {
    let status = parentStatus;
    for (const rule of rules) {
      const ruleIncludes = rule.negate;
      if ((status === 'included') === ruleIncludes)
        continue;
      const relative = path.relative(rule.dir, entryPath);
      if (rule.match('/' + relative) || rule.match(relative)) {
        // Matches "/dir/file" or "dir/file"
        status = ruleIncludes ? 'included' : 'ignored';
      } else if (isDirectory && (rule.match('/' + relative + '/') || rule.match(relative + '/'))) {
        // Matches "/dir/subdir/" or "dir/subdir/" for directories.
        status = ruleIncludes ? 'included' : 'ignored';
      } else if (isDirectory && ruleIncludes && (rule.match('/' + relative, true) || rule.match(relative, true))) {
        // Matches "/dir/donotskip/" when "/dir" is excluded, but "!/dir/donotskip/file" is included.
        status = 'ignored-but-recurse';
      }
    }
    return status;
  };

  const files: string[] = [];

  const visit = async (dir: string, rules: Rule[], status: IgnoreStatus) => {
    const entries = await readDirAsync(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    if (respectGitIgnore) {
      const gitignore = entries.find(e => e.isFile() && e.name === '.gitignore');
      if (gitignore) {
        const content = await readFileAsync(path.join(dir, gitignore.name), 'utf8');
        const newRules: Rule[] = content.split(/\r?\n/).map(s => {
          s = s.trim();
          if (!s)
            return;
          // Use flipNegate, because we handle negation ourselves.
          const rule = new minimatch.Minimatch(s, { matchBase: true, dot: true, flipNegate: true }) as any;
          if (rule.comment)
            return;
          rule.dir = dir;
          return rule;
        }).filter(rule => !!rule);
        rules = [...rules, ...newRules];
      }
    }

    for (const entry of entries) {
      if (entry.name === '.' || entry.name === '..')
        continue;
      if (entry.isFile() && entry.name === '.gitignore')
        continue;
      if (entry.isDirectory() && entry.name === 'node_modules')
        continue;
      const entryPath = path.join(dir, entry.name);
      const entryStatus = checkIgnores(entryPath, rules, entry.isDirectory(), status);
      if (entry.isDirectory() && entryStatus !== 'ignored')
        await visit(entryPath, rules, entryStatus);
      else if (entry.isFile() && entryStatus === 'included')
        files.push(entryPath);
    }
  };
  await visit(testDir, [], 'included');
  return files;
}

function buildItemLocation(rootDir: string, testOrSuite: Suite | TestCase) {
  if (!testOrSuite.location)
    return '';
  return `${path.relative(rootDir, testOrSuite.location.file)}:${testOrSuite.location.line}`;
}

function createTestGroups(projectSuites: Suite[], workers: number): TestGroup[] {
  // This function groups tests that can be run together.
  // Tests cannot be run together when:
  // - They belong to different projects - requires different workers.
  // - They have a different repeatEachIndex - requires different workers.
  // - They have a different set of worker fixtures in the pool - requires different workers.
  // - They have a different requireFile - reuses the worker, but runs each requireFile separately.
  // - They belong to a parallel suite.

  // Using the map "workerHash -> requireFile -> group" makes us preserve the natural order
  // of worker hashes and require files for the simple cases.
  const groups = new Map<string, Map<string, {
    // Tests that must be run in order are in the same group.
    general: TestGroup,

    // There are 3 kinds of parallel tests:
    // - Tests belonging to parallel suites, without beforeAll/afterAll hooks.
    //   These can be run independently, they are put into their own group, key === test.
    // - Tests belonging to parallel suites, with beforeAll/afterAll hooks.
    //   These should share the worker as much as possible, put into single parallelWithHooks group.
    //   We'll divide them into equally-sized groups later.
    // - Tests belonging to serial suites inside parallel suites.
    //   These should run as a serial group, each group is independent, key === serial suite.
    parallel: Map<Suite | TestCase, TestGroup>,
    parallelWithHooks: TestGroup,
  }>>();

  const createGroup = (test: TestCase): TestGroup => {
    return {
      workerHash: test._workerHash,
      requireFile: test._requireFile,
      repeatEachIndex: test.repeatEachIndex,
      projectId: test._projectId,
      tests: [],
    };
  };

  for (const projectSuite of projectSuites) {
    for (const test of projectSuite.allTests()) {
      let withWorkerHash = groups.get(test._workerHash);
      if (!withWorkerHash) {
        withWorkerHash = new Map();
        groups.set(test._workerHash, withWorkerHash);
      }
      let withRequireFile = withWorkerHash.get(test._requireFile);
      if (!withRequireFile) {
        withRequireFile = {
          general: createGroup(test),
          parallel: new Map(),
          parallelWithHooks: createGroup(test),
        };
        withWorkerHash.set(test._requireFile, withRequireFile);
      }

      // Note that a parallel suite cannot be inside a serial suite. This is enforced in TestType.
      let insideParallel = false;
      let outerMostSerialSuite: Suite | undefined;
      let hasAllHooks = false;
      for (let parent: Suite | undefined = test.parent; parent; parent = parent.parent) {
        if (parent._parallelMode === 'serial')
          outerMostSerialSuite = parent;
        insideParallel = insideParallel || parent._parallelMode === 'parallel';
        hasAllHooks = hasAllHooks || parent._hooks.some(hook => hook.type === 'beforeAll' || hook.type === 'afterAll');
      }

      if (insideParallel) {
        if (hasAllHooks && !outerMostSerialSuite) {
          withRequireFile.parallelWithHooks.tests.push(test);
        } else {
          const key = outerMostSerialSuite || test;
          let group = withRequireFile.parallel.get(key);
          if (!group) {
            group = createGroup(test);
            withRequireFile.parallel.set(key, group);
          }
          group.tests.push(test);
        }
      } else {
        withRequireFile.general.tests.push(test);
      }
    }
  }

  const result: TestGroup[] = [];
  for (const withWorkerHash of groups.values()) {
    for (const withRequireFile of withWorkerHash.values()) {
      // Tests without parallel mode should run serially as a single group.
      if (withRequireFile.general.tests.length)
        result.push(withRequireFile.general);

      // Parallel test groups without beforeAll/afterAll can be run independently.
      result.push(...withRequireFile.parallel.values());

      // Tests with beforeAll/afterAll should try to share workers as much as possible.
      const parallelWithHooksGroupSize = Math.ceil(withRequireFile.parallelWithHooks.tests.length / workers);
      let lastGroup: TestGroup | undefined;
      for (const test of withRequireFile.parallelWithHooks.tests) {
        if (!lastGroup || lastGroup.tests.length >= parallelWithHooksGroupSize) {
          lastGroup = createGroup(test);
          result.push(lastGroup);
        }
        lastGroup.tests.push(test);
      }
    }
  }
  return result;
}

class ListModeReporter implements Reporter {
  private config!: FullConfigInternal;

  onBegin(config: FullConfigInternal, suite: Suite): void {
    this.config = config;
    // eslint-disable-next-line no-console
    console.log(`Listing tests:`);
    const tests = suite.allTests();
    const files = new Set<string>();
    for (const test of tests) {
      // root, project, file, ...describes, test
      const [, projectName, , ...titles] = test.titlePath();
      const location = `${path.relative(config.rootDir, test.location.file)}:${test.location.line}:${test.location.column}`;
      const projectTitle = projectName ? `[${projectName}] › ` : '';
      // eslint-disable-next-line no-console
      console.log(`  ${projectTitle}${location} › ${titles.join(' ')}`);
      files.add(test.location.file);
    }
    // eslint-disable-next-line no-console
    console.log(`Total: ${tests.length} ${tests.length === 1 ? 'test' : 'tests'} in ${files.size} ${files.size === 1 ? 'file' : 'files'}`);
  }

  onError(error: TestError) {
    // eslint-disable-next-line no-console
    console.error('\n' + formatError(this.config, error, false).message);
  }
}

function createForbidOnlyErrors(onlyTestsAndSuites: (TestCase | Suite)[]): TestError[] {
  const errors: TestError[] = [];
  for (const testOrSuite of onlyTestsAndSuites) {
    // Skip root and file.
    const title = testOrSuite.titlePath().slice(2).join(' ');
    const error: TestError = {
      message: `Error: focused item found in the --forbid-only mode: "${title}"`,
      location: testOrSuite.location!,
    };
    errors.push(error);
  }
  return errors;
}

function createDuplicateTitlesErrors(config: FullConfigInternal, rootSuite: Suite): TestError[] {
  const errors: TestError[] = [];
  for (const fileSuite of rootSuite.suites) {
    const testsByFullTitle = new Map<string, TestCase>();
    for (const test of fileSuite.allTests()) {
      const fullTitle = test.titlePath().slice(2).join(' › ');
      const existingTest = testsByFullTitle.get(fullTitle);
      if (existingTest) {
        const error: TestError = {
          message: `Error: duplicate test title "${fullTitle}", first declared in ${buildItemLocation(config.rootDir, existingTest)}`,
          location: test.location,
        };
        errors.push(error);
      }
      testsByFullTitle.set(fullTitle, test);
    }
  }
  return errors;
}

function sanitizeConfigForJSON(object: any, visited: Set<any>): any {
  const type = typeof object;
  if (type === 'function' || type === 'symbol')
    return undefined;
  if (!object || type !== 'object')
    return object;

  if (object instanceof RegExp)
    return String(object);
  if (object instanceof Date)
    return object.toISOString();

  if (visited.has(object))
    return undefined;
  visited.add(object);

  if (Array.isArray(object))
    return object.map(a => sanitizeConfigForJSON(a, visited));

  const result: any = {};
  const keys = Object.keys(object).slice(0, 100);
  for (const key of keys) {
    if (key.startsWith('_'))
      continue;
    result[key] = sanitizeConfigForJSON(object[key], visited);
  }
  return result;
}

export const builtInReporters = ['list', 'line', 'dot', 'json', 'junit', 'null', 'github', 'html'] as const;
export type BuiltInReporter = typeof builtInReporters[number];
