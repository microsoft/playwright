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

import rimraf from 'rimraf';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Dispatcher, TestGroup } from './dispatcher';
import { createFileMatcher, createTitleMatcher, FilePatternFilter, serializeError } from './util';
import { TestCase, Suite } from './test';
import { Loader } from './loader';
import { FullResult, Reporter, TestError } from '../types/testReporter';
import { Multiplexer } from './reporters/multiplexer';
import DotReporter from './reporters/dot';
import GitHubReporter from './reporters/github';
import LineReporter from './reporters/line';
import ListReporter from './reporters/list';
import JSONReporter from './reporters/json';
import JUnitReporter from './reporters/junit';
import EmptyReporter from './reporters/empty';
import HtmlReporter from './reporters/html';
import { ProjectImpl } from './project';
import { Minimatch } from 'minimatch';
import { Config, FullConfig } from './types';
import { WebServer } from './webServer';
import { raceAgainstTimeout } from 'playwright-core/lib/utils/async';
import { SigIntWatcher } from 'playwright-core/lib/utils/utils';

const removeFolderAsync = promisify(rimraf);
const readDirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);
export const kDefaultConfigFiles = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs'];

type InternalGlobalSetupFunction = () => Promise<() => Promise<void>>;

type RunOptions = {
  listOnly?: boolean;
  filePatternFilter?: FilePatternFilter[];
  projectFilter?: string[];
};

export class Runner {
  private _loader: Loader;
  private _reporter!: Reporter;
  private _internalGlobalSetups: Array<InternalGlobalSetupFunction> = [];

  constructor(configOverrides: Config, options: { defaultConfig?: Config } = {}) {
    this._loader = new Loader(options.defaultConfig || {}, configOverrides);
  }

  async loadConfigFromFile(configFileOrDirectory: string): Promise<Config> {
    const loadConfig = async (configFile: string) => {
      if (fs.existsSync(configFile))
        return await this._loader.loadConfigFile(configFile);
    };

    const loadConfigFromDirectory = async (directory: string) => {
      for (const configName of kDefaultConfigFiles) {
        const config = await loadConfig(path.resolve(directory, configName));
        if (config)
          return config;
      }
    };

    if (!fs.existsSync(configFileOrDirectory))
      throw new Error(`${configFileOrDirectory} does not exist`);
    if (fs.statSync(configFileOrDirectory).isDirectory()) {
      // When passed a directory, look for a config file inside.
      const config = await loadConfigFromDirectory(configFileOrDirectory);
      if (config)
        return config;
      // If there is no config, assume this as a root testing directory.
      return this._loader.loadEmptyConfig(configFileOrDirectory);
    } else {
      // When passed a file, it must be a config file.
      const config = await loadConfig(configFileOrDirectory);
      return config!;
    }
  }

  private async _createReporter(list: boolean) {
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
    for (const r of this._loader.fullConfig().reporter) {
      const [name, arg] = r;
      if (name in defaultReporters) {
        reporters.push(new defaultReporters[name as keyof typeof defaultReporters](arg));
      } else {
        const reporterConstructor = await this._loader.loadReporter(name);
        reporters.push(new reporterConstructor(arg));
      }
    }
    if (process.env.PW_TEST_REPORTER) {
      const reporterConstructor = await this._loader.loadReporter(process.env.PW_TEST_REPORTER);
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
        reporters.unshift(process.stdout.isTTY && !process.env.CI ? new LineReporter({ omitFailures: true }) : new DotReporter({ omitFailures: true }));
    }
    return new Multiplexer(reporters);
  }

  addInternalGlobalSetup(internalGlobalSetup: InternalGlobalSetupFunction) {
    this._internalGlobalSetups.push(internalGlobalSetup);
  }

  async runAllTests(options: RunOptions = {}): Promise<FullResult> {
    this._reporter = await this._createReporter(!!options.listOnly);
    const config = this._loader.fullConfig();

    let legacyGlobalTearDown: (() => Promise<void>) | undefined;
    if (process.env.PW_TEST_LEGACY_GLOBAL_SETUP_MODE) {
      legacyGlobalTearDown = await this._performGlobalSetup(config);
      if (!legacyGlobalTearDown)
        return { status: 'failed' };
    }

    const result = await raceAgainstTimeout(() => this._run(!!options.listOnly, options.filePatternFilter || [], options.projectFilter), config.globalTimeout);
    let fullResult: FullResult;
    if (result.timedOut) {
      this._reporter.onError?.(createStacklessError(`Timed out waiting ${config.globalTimeout / 1000}s for the entire test run`));
      fullResult = { status: 'timedout' };
    } else {
      fullResult = result.result;
    }
    await this._reporter.onEnd?.(fullResult);
    await legacyGlobalTearDown?.();

    // Calling process.exit() might truncate large stdout/stderr output.
    // See https://github.com/nodejs/node/issues/6456.
    // See https://github.com/nodejs/node/issues/12921
    await new Promise<void>(resolve => process.stdout.write('', () => resolve()));
    await new Promise<void>(resolve => process.stderr.write('', () => resolve()));

    return fullResult;
  }

  async listTestFiles(configFile: string, projectNames: string[] | undefined): Promise<any> {
    const filesByProject = await this._collectFiles([], projectNames);
    const report: any = {
      projects: []
    };
    for (const [project, files] of filesByProject) {
      report.projects.push({
        name: project.config.name,
        testDir: path.resolve(configFile, project.config.testDir),
        files: files
      });
    }
    return report;
  }

  private async _run(list: boolean, testFileReFilters: FilePatternFilter[], projectNames?: string[]): Promise<FullResult> {
    const filesByProject = await this._collectFiles(testFileReFilters, projectNames);
    return await this._runFiles(list, filesByProject, testFileReFilters);
  }

  private async _collectFiles(testFileReFilters: FilePatternFilter[], projectNames?: string[]): Promise<Map<ProjectImpl, string[]>> {
    const testFileFilter = testFileReFilters.length ? createFileMatcher(testFileReFilters.map(e => e.re)) : () => true;
    let projectsToFind: Set<string> | undefined;
    let unknownProjects: Map<string, string> | undefined;
    if (projectNames) {
      projectsToFind = new Set();
      unknownProjects = new Map();
      projectNames.forEach(n => {
        const name = n.toLocaleLowerCase();
        projectsToFind!.add(name);
        unknownProjects!.set(name, n);
      });
    }
    const projects = this._loader.projects().filter(project => {
      if (!projectsToFind)
        return true;
      const name = project.config.name.toLocaleLowerCase();
      unknownProjects!.delete(name);
      return projectsToFind.has(name);
    });
    if (unknownProjects && unknownProjects.size) {
      const names = this._loader.projects().map(p => p.config.name).filter(name => !!name);
      if (!names.length)
        throw new Error(`No named projects are specified in the configuration file`);
      const unknownProjectNames = Array.from(unknownProjects.values()).map(n => `"${n}"`).join(', ');
      throw new Error(`Project(s) ${unknownProjectNames} not found. Available named projects: ${names.map(name => `"${name}"`).join(', ')}`);
    }

    const files = new Map<ProjectImpl, string[]>();
    for (const project of projects) {
      const allFiles = await collectFiles(project.config.testDir);
      const testMatch = createFileMatcher(project.config.testMatch);
      const testIgnore = createFileMatcher(project.config.testIgnore);
      const extensions = ['.js', '.ts', '.mjs', '.tsx', '.jsx'];
      const testFileExtension = (file: string) => extensions.includes(path.extname(file));
      const testFiles = allFiles.filter(file => !testIgnore(file) && testMatch(file) && testFileFilter(file) && testFileExtension(file));
      files.set(project, testFiles);
    }
    return files;
  }

  private async _runFiles(list: boolean, filesByProject: Map<ProjectImpl, string[]>, testFileReFilters: FilePatternFilter[]): Promise<FullResult> {
    const allTestFiles = new Set<string>();
    for (const files of filesByProject.values())
      files.forEach(file => allTestFiles.add(file));

    const config = this._loader.fullConfig();

    const fatalErrors: TestError[] = [];

    // 1. Add all tests.
    const preprocessRoot = new Suite('');
    for (const file of allTestFiles) {
      const fileSuite = await this._loader.loadTestFile(file, 'runner');
      if (fileSuite._loadError)
        fatalErrors.push(fileSuite._loadError);
      preprocessRoot._addSuite(fileSuite);
    }

    // 2. Filter tests to respect column filter.
    filterByFocusedLine(preprocessRoot, testFileReFilters);

    // 3. Complain about only.
    if (config.forbidOnly) {
      const onlyTestsAndSuites = preprocessRoot._getOnlyItems();
      if (onlyTestsAndSuites.length > 0)
        fatalErrors.push(createForbidOnlyError(config, onlyTestsAndSuites));
    }

    // 4. Filter only
    if (!list)
      filterOnly(preprocessRoot);

    // 5. Complain about clashing.
    const clashingTests = getClashingTestsPerSuite(preprocessRoot);
    if (clashingTests.size > 0)
      fatalErrors.push(createDuplicateTitlesError(config, clashingTests));

    // 6. Generate projects.
    const fileSuites = new Map<string, Suite>();
    for (const fileSuite of preprocessRoot.suites)
      fileSuites.set(fileSuite._requireFile, fileSuite);

    const outputDirs = new Set<string>();
    const grepMatcher = createTitleMatcher(config.grep);
    const grepInvertMatcher = config.grepInvert ? createTitleMatcher(config.grepInvert) : null;
    const rootSuite = new Suite('');
    for (const [project, files] of filesByProject) {
      const projectSuite = new Suite(project.config.name);
      projectSuite._projectConfig = project.config;
      rootSuite._addSuite(projectSuite);
      for (const file of files) {
        const fileSuite = fileSuites.get(file);
        if (!fileSuite)
          continue;
        for (let repeatEachIndex = 0; repeatEachIndex < project.config.repeatEach; repeatEachIndex++) {
          const cloned = project.cloneFileSuite(fileSuite, repeatEachIndex, test => {
            const grepTitle = test.titlePath().join(' ');
            if (grepInvertMatcher?.(grepTitle))
              return false;
            return grepMatcher(grepTitle);
          });
          if (cloned)
            projectSuite._addSuite(cloned);
        }
      }
      outputDirs.add(project.config.outputDir);
    }

    // 7. Fail when no tests.
    let total = rootSuite.allTests().length;
    if (!total)
      fatalErrors.push(createNoTestsError());

    // 8. Fail when output fails.
    await Promise.all(Array.from(outputDirs).map(outputDir => removeFolderAsync(outputDir).catch(e => {
      fatalErrors.push(serializeError(e));
    })));

    // 9. Compute shards.
    let testGroups = createTestGroups(rootSuite);

    const shard = config.shard;
    if (shard) {
      const shardGroups: TestGroup[] = [];
      const shardTests = new Set<TestCase>();

      // Each shard gets some tests.
      const shardSize = Math.floor(total / shard.total);
      // First few shards get one more test each.
      const extraOne = total - shardSize * shard.total;

      const currentShard = shard.current - 1; // Make it zero-based for calculations.
      const from = shardSize * currentShard + Math.min(extraOne, currentShard);
      const to = from + shardSize + (currentShard < extraOne ? 1 : 0);
      let current = 0;
      for (const group of testGroups) {
        // Any test group goes to the shard that contains the first test of this group.
        // So, this shard gets any group that starts at [from; to)
        if (current >= from && current < to) {
          shardGroups.push(group);
          for (const test of group.tests)
            shardTests.add(test);
        }
        current += group.tests.length;
      }

      testGroups = shardGroups;
      filterSuiteWithOnlySemantics(rootSuite, () => false, test => shardTests.has(test));
      total = rootSuite.allTests().length;
    }
    (config as any).__testGroupsCount = testGroups.length;

    // 10. Report begin
    this._reporter.onBegin?.(config, rootSuite);

    // 11. Bail out on errors prior to running global setup.
    if (fatalErrors.length) {
      for (const error of fatalErrors)
        this._reporter.onError?.(error);
      return { status: 'failed' };
    }

    // 12. Bail out if list mode only, don't do any work.
    if (list)
      return { status: 'passed' };


    // 13. Run Global setup.
    let globalTearDown: (() => Promise<void>) | undefined;
    if (!process.env.PW_TEST_LEGACY_GLOBAL_SETUP_MODE) {
      globalTearDown = await this._performGlobalSetup(config);
      if (!globalTearDown)
        return { status: 'failed' };
    }

    const result: FullResult = { status: 'passed' };

    // 14. Run tests.
    try {
      const sigintWatcher = new SigIntWatcher();

      let hasWorkerErrors = false;
      const dispatcher = new Dispatcher(this._loader, testGroups, this._reporter);
      await Promise.race([dispatcher.run(), sigintWatcher.promise()]);
      if (!sigintWatcher.hadSignal()) {
        // We know for sure there was no Ctrl+C, so we remove custom SIGINT handler
        // as soon as we can.
        sigintWatcher.disarm();
      }
      await dispatcher.stop();
      hasWorkerErrors = dispatcher.hasWorkerErrors();

      if (!sigintWatcher.hadSignal()) {
        const failed = hasWorkerErrors || rootSuite.allTests().some(test => !test.ok());
        result.status = failed ? 'failed' : 'passed';
      } else {
        result.status = 'interrupted';
      }
    } catch (e) {
      this._reporter.onError?.(serializeError(e));
      return { status: 'failed' };
    } finally {
      await globalTearDown?.();
    }
    return result;
  }

  private async _performGlobalSetup(config: FullConfig): Promise<(() => Promise<void>) | undefined> {
    const result: FullResult = { status: 'passed' };
    const internalGlobalTeardowns: (() => Promise<void>)[] = [];
    let globalSetupResult: any;
    let webServer: WebServer | undefined;

    const tearDown = async () => {
      await this._runAndReportError(async () => {
        if (globalSetupResult && typeof globalSetupResult === 'function')
          await globalSetupResult(this._loader.fullConfig());
      }, result);

      await this._runAndReportError(async () => {
        if (config.globalTeardown)
          await (await this._loader.loadGlobalHook(config.globalTeardown, 'globalTeardown'))(this._loader.fullConfig());
      }, result);

      await this._runAndReportError(async () => {
        await webServer?.kill();
      }, result);

      await this._runAndReportError(async () => {
        for (const internalGlobalTeardown of internalGlobalTeardowns)
          await internalGlobalTeardown();
      }, result);
    };

    await this._runAndReportError(async () => {
      for (const internalGlobalSetup of this._internalGlobalSetups)
        internalGlobalTeardowns.push(await internalGlobalSetup());
      webServer = config.webServer ? await WebServer.create(config.webServer, this._reporter) : undefined;
      if (config.globalSetup)
        globalSetupResult = await (await this._loader.loadGlobalHook(config.globalSetup, 'globalSetup'))(this._loader.fullConfig());
    }, result);

    if (result.status !== 'passed') {
      await tearDown();
      return;
    }

    return tearDown;
  }

  private async _runAndReportError(callback: () => Promise<void>, result: FullResult) {
    try {
      await callback();
    } catch (e) {
      result.status = 'failed';
      this._reporter.onError?.(serializeError(e));
    }
  }
}

function filterOnly(suite: Suite) {
  const suiteFilter = (suite: Suite) => suite._only;
  const testFilter = (test: TestCase) => test._only;
  return filterSuiteWithOnlySemantics(suite, suiteFilter, testFilter);
}

function filterByFocusedLine(suite: Suite, focusedTestFileLines: FilePatternFilter[]) {
  const filterWithLine = !!focusedTestFileLines.find(f => f.line !== null);
  if (!filterWithLine)
    return;

  const testFileLineMatches = (testFileName: string, testLine: number) => focusedTestFileLines.some(({ re, line }) => {
    re.lastIndex = 0;
    return re.test(testFileName) && (line === testLine || line === null);
  });
  const suiteFilter = (suite: Suite) => {
    return !!suite.location && testFileLineMatches(suite.location.file, suite.location.line);
  };
  const testFilter = (test: TestCase) => testFileLineMatches(test.location.file, test.location.line);
  return filterSuite(suite, suiteFilter, testFilter);
}

function filterSuiteWithOnlySemantics(suite: Suite, suiteFilter: (suites: Suite) => boolean, testFilter: (test: TestCase) => boolean) {
  const onlySuites = suite.suites.filter(child => filterSuiteWithOnlySemantics(child, suiteFilter, testFilter) || suiteFilter(child));
  const onlyTests = suite.tests.filter(testFilter);
  const onlyEntries = new Set([...onlySuites, ...onlyTests]);
  if (onlyEntries.size) {
    suite.suites = onlySuites;
    suite.tests = onlyTests;
    suite._entries = suite._entries.filter(e => onlyEntries.has(e)); // Preserve the order.
    return true;
  }
  return false;
}

function filterSuite(suite: Suite, suiteFilter: (suites: Suite) => boolean, testFilter: (test: TestCase) => boolean) {
  for (const child of suite.suites) {
    if (!suiteFilter(child))
      filterSuite(child, suiteFilter, testFilter);
  }
  suite.tests = suite.tests.filter(testFilter);
  const entries = new Set([...suite.suites, ...suite.tests]);
  suite._entries = suite._entries.filter(e => entries.has(e)); // Preserve the order.
}

async function collectFiles(testDir: string): Promise<string[]> {
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

    const gitignore = entries.find(e => e.isFile() && e.name === '.gitignore');
    if (gitignore) {
      const content = await readFileAsync(path.join(dir, gitignore.name), 'utf8');
      const newRules: Rule[] = content.split(/\r?\n/).map(s => {
        s = s.trim();
        if (!s)
          return;
        // Use flipNegate, because we handle negation ourselves.
        const rule = new Minimatch(s, { matchBase: true, dot: true, flipNegate: true }) as any;
        if (rule.comment)
          return;
        rule.dir = dir;
        return rule;
      }).filter(rule => !!rule);
      rules = [...rules, ...newRules];
    }

    for (const entry of entries) {
      if (entry === gitignore || entry.name === '.' || entry.name === '..')
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

function getClashingTestsPerSuite(rootSuite: Suite): Map<string, TestCase[]> {
  function visit(suite: Suite, clashingTests: Map<string, TestCase[]>) {
    for (const childSuite of suite.suites)
      visit(childSuite, clashingTests);
    for (const test of suite.tests) {
      const fullTitle = test.titlePath().slice(2).join(' ');
      if (!clashingTests.has(fullTitle))
        clashingTests.set(fullTitle, []);
      clashingTests.set(fullTitle, clashingTests.get(fullTitle)!.concat(test));
    }
  }
  const out = new Map<string, TestCase[]>();
  for (const fileSuite of rootSuite.suites) {
    const clashingTests = new Map<string, TestCase[]>();
    visit(fileSuite, clashingTests);
    for (const [title, tests] of clashingTests.entries()) {
      if (tests.length > 1)
        out.set(title, tests);
    }
  }
  return out;
}

function buildItemLocation(rootDir: string, testOrSuite: Suite | TestCase) {
  if (!testOrSuite.location)
    return '';
  return `${path.relative(rootDir, testOrSuite.location.file)}:${testOrSuite.location.line}`;
}

function createTestGroups(rootSuite: Suite): TestGroup[] {
  // This function groups tests that can be run together.
  // Tests cannot be run together when:
  // - They belong to different projects - requires different workers.
  // - They have a different repeatEachIndex - requires different workers.
  // - They have a different set of worker fixtures in the pool - requires different workers.
  // - They have a different requireFile - reuses the worker, but runs each requireFile separately.
  // - They belong to a parallel suite.

  // Using the map "workerHash -> requireFile -> group" makes us preserve the natural order
  // of worker hashes and require files for the simple cases.
  const groups = new Map<string, Map<string, { general: TestGroup, parallel: TestGroup[] }>>();

  const createGroup = (test: TestCase): TestGroup => {
    return {
      workerHash: test._workerHash,
      requireFile: test._requireFile,
      repeatEachIndex: test.repeatEachIndex,
      projectIndex: test._projectIndex,
      tests: [],
    };
  };

  for (const projectSuite of rootSuite.suites) {
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
          parallel: [],
        };
        withWorkerHash.set(test._requireFile, withRequireFile);
      }

      let insideParallel = false;
      for (let parent: Suite | undefined = test.parent; parent; parent = parent.parent)
        insideParallel = insideParallel || parent._parallelMode === 'parallel';

      if (insideParallel) {
        const group = createGroup(test);
        group.tests.push(test);
        withRequireFile.parallel.push(group);
      } else {
        withRequireFile.general.tests.push(test);
      }
    }
  }

  const result: TestGroup[] = [];
  for (const withWorkerHash of groups.values()) {
    for (const withRequireFile of withWorkerHash.values()) {
      if (withRequireFile.general.tests.length)
        result.push(withRequireFile.general);
      result.push(...withRequireFile.parallel);
    }
  }
  return result;
}

class ListModeReporter implements Reporter {
  onBegin(config: FullConfig, suite: Suite): void {
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
}

function createForbidOnlyError(config: FullConfig, onlyTestsAndSuites: (TestCase | Suite)[]): TestError {
  const errorMessage = [
    '=====================================',
    ' --forbid-only found a focused test.',
  ];
  for (const testOrSuite of onlyTestsAndSuites) {
    // Skip root and file.
    const title = testOrSuite.titlePath().slice(2).join(' ');
    errorMessage.push(` - ${buildItemLocation(config.rootDir, testOrSuite)} > ${title}`);
  }
  errorMessage.push('=====================================');
  return createStacklessError(errorMessage.join('\n'));
}

function createDuplicateTitlesError(config: FullConfig, clashingTests: Map<string, TestCase[]>): TestError {
  const errorMessage = [
    '========================================',
    ' duplicate test titles are not allowed.',
  ];
  for (const [title, tests] of clashingTests.entries()) {
    errorMessage.push(` - title: ${title}`);
    for (const test of tests)
      errorMessage.push(`   - ${buildItemLocation(config.rootDir, test)}`);
  }
  errorMessage.push('========================================');
  return createStacklessError(errorMessage.join('\n'));
}

function createNoTestsError(): TestError {
  return createStacklessError(`=================\n no tests found.\n=================`);
}

function createStacklessError(message: string): TestError {
  return { message };
}

export const builtInReporters = ['list', 'line', 'dot', 'json', 'junit', 'null', 'github', 'html'] as const;
export type BuiltInReporter = typeof builtInReporters[number];
