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
import { Dispatcher } from './dispatcher';
import { createMatcher, monotonicTime, raceAgainstDeadline } from './util';
import { Suite } from './test';
import { Loader } from './loader';
import { Reporter } from './reporter';
import { Multiplexer } from './reporters/multiplexer';
import DotReporter from './reporters/dot';
import LineReporter from './reporters/line';
import ListReporter from './reporters/list';
import JSONReporter from './reporters/json';
import JUnitReporter from './reporters/junit';
import EmptyReporter from './reporters/empty';
import { ProjectImpl } from './project';
import { Minimatch } from 'minimatch';
import { Config } from './types';

const removeFolderAsync = promisify(rimraf);
const readDirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);

type RunResult = 'passed' | 'failed' | 'sigint' | 'forbid-only' | 'no-tests' | 'timedout';

export class Runner {
  private _loader: Loader;
  private _reporter!: Reporter;
  private _didBegin = false;

  constructor(defaultConfig: Config, configOverrides: Config) {
    this._loader = new Loader(defaultConfig, configOverrides);
  }

  private _createReporter() {
    const reporters: Reporter[] = [];
    const defaultReporters = {
      dot: DotReporter,
      line: LineReporter,
      list: ListReporter,
      json: JSONReporter,
      junit: JUnitReporter,
      null: EmptyReporter,
    };
    for (const r of this._loader.fullConfig().reporter) {
      const [name, arg] = r;
      if (name in defaultReporters) {
        reporters.push(new defaultReporters[name as keyof typeof defaultReporters](arg));
      } else {
        const reporterConstructor = this._loader.loadReporter(name);
        reporters.push(new reporterConstructor(arg));
      }
    }
    return new Multiplexer(reporters);
  }

  loadConfigFile(file: string): Config {
    return this._loader.loadConfigFile(file);
  }

  loadEmptyConfig(rootDir: string) {
    this._loader.loadEmptyConfig(rootDir);
  }

  async run(list: boolean, testFileReFilters: RegExp[], projectName?: string): Promise<RunResult> {
    this._reporter = this._createReporter();
    const config = this._loader.fullConfig();
    const globalDeadline = config.globalTimeout ? config.globalTimeout + monotonicTime() : undefined;
    const { result, timedOut } = await raceAgainstDeadline(this._run(list, testFileReFilters, projectName), globalDeadline);
    if (timedOut) {
      if (!this._didBegin)
        this._reporter.onBegin(config, new Suite(''));
      this._reporter.onTimeout(config.globalTimeout);
      await this._flushOutput();
      return 'failed';
    }
    if (result === 'forbid-only') {
      console.error('=====================================');
      console.error(' --forbid-only found a focused test.');
      console.error('=====================================');
    } else if (result === 'no-tests') {
      console.error('=================');
      console.error(' no tests found.');
      console.error('=================');
    }
    await this._flushOutput();
    return result!;
  }

  async _flushOutput() {
    // Calling process.exit() might truncate large stdout/stderr output.
    // See https://github.com/nodejs/node/issues/6456.
    //
    // We can use writableNeedDrain to workaround this, but it is only available
    // since node v15.2.0.
    // See https://nodejs.org/api/stream.html#stream_writable_writableneeddrain.
    if ((process.stdout as any).writableNeedDrain)
      await new Promise(f => process.stdout.on('drain', f));
    if ((process.stderr as any).writableNeedDrain)
      await new Promise(f => process.stderr.on('drain', f));
  }

  async _run(list: boolean, testFileReFilters: RegExp[], projectName?: string): Promise<RunResult> {
    const testFileFilter = testFileReFilters.length ? createMatcher(testFileReFilters) : () => true;
    const config = this._loader.fullConfig();

    const projects = this._loader.projects().filter(project => {
      return !projectName || project.config.name.toLocaleLowerCase() === projectName.toLocaleLowerCase();
    });
    if (projectName && !projects.length) {
      const names = this._loader.projects().map(p => p.config.name).filter(name => !!name);
      if (!names.length)
        throw new Error(`No named projects are specified in the configuration file`);
      throw new Error(`Project "${projectName}" not found. Available named projects: ${names.map(name => `"${name}"`).join(', ')}`);
    }

    const files = new Map<ProjectImpl, string[]>();
    const allTestFiles = new Set<string>();
    for (const project of projects) {
      const testDir = project.config.testDir;
      if (!fs.existsSync(testDir))
        throw new Error(`${testDir} does not exist`);
      if (!fs.statSync(testDir).isDirectory())
        throw new Error(`${testDir} is not a directory`);
      const allFiles = await collectFiles(project.config.testDir);
      const testMatch = createMatcher(project.config.testMatch);
      const testIgnore = createMatcher(project.config.testIgnore);
      const testFileExtension = (file: string) => ['.js', '.ts'].includes(path.extname(file));
      const testFiles = allFiles.filter(file => !testIgnore(file) && testMatch(file) && testFileFilter(file) && testFileExtension(file));
      files.set(project, testFiles);
      testFiles.forEach(file => allTestFiles.add(file));
    }

    let globalSetupResult: any;
    if (config.globalSetup)
      globalSetupResult = await this._loader.loadGlobalHook(config.globalSetup, 'globalSetup')(this._loader.fullConfig());
    try {
      for (const file of allTestFiles)
        this._loader.loadTestFile(file);

      const rootSuite = new Suite('');
      for (const fileSuite of this._loader.fileSuites().values())
        rootSuite._addSuite(fileSuite);
      if (config.forbidOnly && rootSuite._hasOnly())
        return 'forbid-only';
      filterOnly(rootSuite);

      const fileSuites = new Map<string, Suite>();
      for (const fileSuite of rootSuite.suites)
        fileSuites.set(fileSuite.file, fileSuite);

      const outputDirs = new Set<string>();
      const grepMatcher = createMatcher(config.grep);
      for (const project of projects) {
        for (const file of files.get(project)!) {
          const fileSuite = fileSuites.get(file);
          if (!fileSuite)
            continue;
          for (const spec of fileSuite._allSpecs()) {
            if (grepMatcher(spec._testFullTitle(project.config.name)))
              project.generateTests(spec);
          }
        }
        outputDirs.add(project.config.outputDir);
      }

      const total = rootSuite.totalTestCount();
      if (!total)
        return 'no-tests';

      await Promise.all(Array.from(outputDirs).map(outputDir => removeFolderAsync(outputDir).catch(e => {})));

      let sigint = false;
      let sigintCallback: () => void;
      const sigIntPromise = new Promise<void>(f => sigintCallback = f);
      const sigintHandler = () => {
        // We remove handler so that double Ctrl+C immediately kills the runner,
        // for the case where our shutdown takes a lot of time or is buggy.
        // Removing the handler synchronously sometimes triggers the default handler
        // that exits the process, so we remove asynchronously.
        setTimeout(() => process.off('SIGINT', sigintHandler), 0);
        sigint = true;
        sigintCallback();
      };
      process.on('SIGINT', sigintHandler);

      if (process.stdout.isTTY) {
        const workers = new Set();
        rootSuite.findTest(test => {
          workers.add(test.spec.file + test._workerHash);
        });
        console.log();
        const jobs = Math.min(config.workers, workers.size);
        const shard = config.shard;
        const shardDetails = shard ? `, shard ${shard.current + 1} of ${shard.total}` : '';
        console.log(`Running ${total} test${total > 1 ? 's' : ''} using ${jobs} worker${jobs > 1 ? 's' : ''}${shardDetails}`);
      }

      this._reporter.onBegin(config, rootSuite);
      this._didBegin = true;
      let hasWorkerErrors = false;
      if (!list) {
        const dispatcher = new Dispatcher(this._loader, rootSuite, this._reporter);
        await Promise.race([dispatcher.run(), sigIntPromise]);
        await dispatcher.stop();
        hasWorkerErrors = dispatcher.hasWorkerErrors();
      }
      this._reporter.onEnd();

      if (sigint)
        return 'sigint';
      return hasWorkerErrors || rootSuite.findSpec(spec => !spec.ok()) ? 'failed' : 'passed';
    } finally {
      if (globalSetupResult && typeof globalSetupResult === 'function')
        await globalSetupResult(this._loader.fullConfig());
      if (config.globalTeardown)
        await this._loader.loadGlobalHook(config.globalTeardown, 'globalTeardown')(this._loader.fullConfig());
    }
  }
}

function filterOnly(suite: Suite) {
  const onlySuites = suite.suites.filter(child => filterOnly(child) || child._only);
  const onlyTests = suite.specs.filter(spec => spec._only);
  const onlyEntries = new Set([...onlySuites, ...onlyTests]);
  if (onlyEntries.size) {
    suite.suites = onlySuites;
    suite.specs = onlyTests;
    suite._entries = suite._entries.filter(e => onlyEntries.has(e)); // Preserve the order.
    return true;
  }
  return false;
}

async function collectFiles(testDir: string): Promise<string[]> {
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
