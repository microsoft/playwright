/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { default as ignore } from 'fstream-ignore';
import * as commander from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import EmptyReporter from './reporters/empty';
import DotReporter from './reporters/dot';
import JSONReporter from './reporters/json';
import JUnitReporter from './reporters/junit';
import LineReporter from './reporters/line';
import ListReporter from './reporters/list';
import { Multiplexer } from './reporters/multiplexer';
import { Runner } from './runner';
import { Config, FullConfig, Reporter } from './types';
import { Loader } from './loader';
import { createMatcher } from './util';

export const reporters: { [name: string]: new () => Reporter } = {
  'dot': DotReporter,
  'json': JSONReporter,
  'junit': JUnitReporter,
  'line': LineReporter,
  'list': ListReporter,
  'null': EmptyReporter,
};

const availableReporters = Object.keys(reporters).map(r => `"${r}"`).join();

const defaultConfig: FullConfig = {
  forbidOnly: false,
  globalTimeout: 0,
  grep: /.*/,
  maxFailures: 0,
  outputDir: path.resolve(process.cwd(), 'test-results'),
  quiet: false,
  repeatEach: 1,
  retries: 0,
  shard: null,
  snapshotDir: '__snapshots__',
  testDir: path.resolve(process.cwd()),
  testIgnore: 'node_modules/**',
  testMatch: '**/?(*.)+(spec|test).[jt]s',
  timeout: 10000,
  updateSnapshots: false,
  workers: Math.ceil(require('os').cpus().length / 2),
};

const loadProgram = new commander.Command();
loadProgram.helpOption(false);
addRunnerOptions(loadProgram);
loadProgram.action(async command => {
  try {
    await runTests(command);
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
});
loadProgram.parse(process.argv);

async function runTests(command: any) {
  if (command.help === undefined) {
    console.log(loadProgram.helpInformation());
    process.exit(0);
  }

  const reporterList: string[] = command.reporter.split(',');
  const reporterObjects: Reporter[] = reporterList.map(c => {
    if (reporters[c])
      return new reporters[c]();
    try {
      const p = path.resolve(process.cwd(), c);
      return new (require(p).default)();
    } catch (e) {
      console.error('Invalid reporter ' + c, e);
      process.exit(1);
    }
  });

  const loader = new Loader();
  loader.addConfig(defaultConfig);

  function loadConfig(configName: string) {
    const configFile = path.resolve(process.cwd(), configName);
    if (fs.existsSync(configFile)) {
      loader.loadConfigFile(configFile);
      return true;
    }
    return false;
  }

  if (command.config) {
    if (!loadConfig(command.config))
      throw new Error(`${command.config} does not exist`);
  } else if (!loadConfig('folio.config.ts') && !loadConfig('folio.config.js')) {
    throw new Error(`Configuration file not found. Either pass --config, or create folio.config.(js|ts) file`);
  }

  loader.addConfig(configFromCommand(command));
  loader.addConfig({ testMatch: normalizeFilePatterns(loader.config().testMatch) });
  loader.addConfig({ testIgnore: normalizeFilePatterns(loader.config().testIgnore) });

  const testDir = loader.config().testDir;
  if (!fs.existsSync(testDir))
    throw new Error(`${testDir} does not exist`);
  if (!fs.statSync(testDir).isDirectory())
    throw new Error(`${testDir} is not a directory`);

  const allAliases = new Set(loader.runLists().map(s => s.alias));
  const runListFilter: string[] = [];
  const testFileFilter: string[] = [];
  for (const arg of command.args) {
    if (allAliases.has(arg))
      runListFilter.push(arg);
    else
      testFileFilter.push(arg);
  }

  const allFiles = await collectFiles(testDir);
  const testFiles = filterFiles(testDir, allFiles, testFileFilter, createMatcher(loader.config().testMatch), createMatcher(loader.config().testIgnore));
  for (const file of testFiles)
    loader.loadTestFile(file);

  const reporter = new Multiplexer(reporterObjects);
  const runner = new Runner(loader, reporter, runListFilter.length ? runListFilter : undefined);

  if (command.list) {
    runner.list();
    return;
  }

  const result = await runner.run();
  if (result === 'sigint')
    process.exit(130);

  if (result === 'forbid-only') {
    console.error('=====================================');
    console.error(' --forbid-only found a focused test.');
    console.error('=====================================');
    process.exit(1);
  }
  if (result === 'no-tests') {
    console.error('=================');
    console.error(' no tests found.');
    console.error('=================');
    process.exit(1);
  }
  process.exit(result === 'failed' ? 1 : 0);
}

async function collectFiles(testDir: string): Promise<string[]> {
  const entries: any[] = [];
  let callback = () => {};
  const promise = new Promise<void>(f => callback = f);
  ignore({ path: testDir, ignoreFiles: ['.gitignore'] })
      .on('child', (entry: any) => entries.push(entry))
      .on('end', callback);
  await promise;
  return entries.filter(e => e.type === 'File').sort((a, b) => {
    if (a.depth !== b.depth && (a.dirname.startsWith(b.dirname) || b.dirname.startsWith(a.dirname)))
      return a.depth - b.depth;
    return a.path > b.path ? 1 : (a.path < b.path ? -1 : 0);
  }).map(e => e.path);
}

function filterFiles(base: string, files: string[], filters: string[], filesMatch: (value: string) => boolean, filesIgnore: (value: string) => boolean): string[] {
  return files.filter(file => {
    file = path.relative(base, file);
    if (filesIgnore(file))
      return false;
    if (!filesMatch(file))
      return false;
    if (filters.length && !filters.find(filter => file.includes(filter)))
      return false;
    return true;
  });
}

function addRunnerOptions(program: commander.Command) {
  program = program
      .version('Version alpha')
      .option('-c, --config <file>', `Configuration file (default: "folio.config.ts" or "folio.config.js")`)
      .option('--forbid-only', `Fail if exclusive test(s) encountered (default: ${defaultConfig.forbidOnly})`)
      .option('-g, --grep <grep>', `Only run tests matching this string or regexp (default: "${defaultConfig.grep}")`)
      .option('--global-timeout <timeout>', `Specify maximum time this test suite can run in milliseconds (default: 0 for unlimited)`)
      .option('-h, --help', `Display help`)
      .option('-j, --workers <workers>', `Number of concurrent workers, use 1 to run in single worker (default: number of CPU cores / 2)`)
      .option('--list', `Only collect all the test and report them`)
      .option('--max-failures <N>', `Stop after the first N failures (default: ${defaultConfig.maxFailures})`)
      .option('--output <dir>', `Folder for output artifacts (default: "test-results")`)
      .option('--quiet', `Suppress stdio`)
      .option('--repeat-each <repeat-each>', `Specify how many times to run the tests (default: ${defaultConfig.repeatEach})`)
      .option('--reporter <reporter>', `Specify reporter to use, comma-separated, can be ${availableReporters}`, process.env.CI ? 'dot' : 'line')
      .option('--retries <retries>', `Specify retry count (default: ${defaultConfig.retries})`)
      .option('--shard <shard>', `Shard tests and execute only selected shard, specify in the form "current/all", 1-based, for example "3/5"`)
      .option('--snapshot-dir <dir>', `Snapshot directory, relative to tests directory (default: "${defaultConfig.snapshotDir}"`)
      .option('--test-dir <dir>', `Directory containing test files (default: current directory)`)
      .option('--test-ignore <pattern>', `Pattern used to ignore test files (default: "${defaultConfig.testIgnore}")`)
      .option('--test-match <pattern>', `Pattern used to find test files (default: "${defaultConfig.testMatch}")`)
      .option('--timeout <timeout>', `Specify test timeout threshold in milliseconds (default: ${defaultConfig.timeout})`)
      .option('-u, --update-snapshots', `Whether to update snapshots with actual results (default: ${defaultConfig.updateSnapshots})`)
      .option('-x', `Stop after the first failure`);
}

function configFromCommand(command: any): Config {
  const config: Config = {};
  if (command.forbidOnly)
    config.forbidOnly = true;
  if (command.globalTimeout)
    config.globalTimeout = parseInt(command.globalTimeout, 10);
  if (command.grep)
    config.grep = maybeRegExp(command.grep);
  if (command.maxFailures || command.x)
    config.maxFailures = command.x ? 1 : parseInt(command.maxFailures, 10);
  if (command.output)
    config.outputDir = path.resolve(process.cwd(), command.output);
  if (command.quiet)
    config.quiet = command.quiet;
  if (command.repeatEach)
    config.repeatEach = parseInt(command.repeatEach, 10);
  if (command.retries)
    config.retries = parseInt(command.retries, 10);
  if (command.shard) {
    const pair = command.shard.split('/').map((t: string) => parseInt(t, 10));
    config.shard = { current: pair[0] - 1, total: pair[1] };
  }
  if (command.snapshotDir)
    config.snapshotDir = command.snapshotDir;
  if (command.testDir)
    config.testDir = path.resolve(process.cwd(), command.testDir);
  if (command.testMatch)
    config.testMatch = maybeRegExp(command.testMatch);
  if (command.testIgnore)
    config.testIgnore = maybeRegExp(command.testIgnore);
  if (command.timeout)
    config.timeout = parseInt(command.timeout, 10);
  if (command.updateSnapshots)
    config.updateSnapshots = !!command.updateSnapshots;
  if (command.workers)
    config.workers = parseInt(command.workers, 10);
  return config;
}

function normalizeFilePattern(pattern: string): string {
  if (!pattern.includes('/') && !pattern.includes('\\'))
    pattern = '**/' + pattern;
  return pattern;
}

function normalizeFilePatterns(patterns: string | RegExp | (string | RegExp)[]) {
  if (typeof patterns === 'string')
    patterns = normalizeFilePattern(patterns);
  else if (Array.isArray(patterns))
    patterns = patterns.map(item => typeof item === 'string' ? normalizeFilePattern(item) : item);
  return patterns;
}

function maybeRegExp(pattern: string): string | RegExp {
  const match = pattern.match(/^\/(.*)\/([gi]*)$/);
  if (match)
    return new RegExp(match[1], match[2]);
  return pattern;
}
