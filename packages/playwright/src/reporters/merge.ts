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

import fs from 'fs';
import path from 'path';
import type { ReporterDescription } from '../../types/test';
import type { FullConfigInternal } from '../common/config';
import type { JsonConfig, JsonEvent, JsonFullResult, JsonLocation, JsonProject, JsonSuite, JsonTestCase, JsonTestResultEnd, JsonTestStepStart } from '../isomorphic/teleReceiver';
import { TeleReporterReceiver } from '../isomorphic/teleReceiver';
import { JsonStringInternalizer, StringInternPool } from '../isomorphic/stringInternPool';
import { createReporters } from '../runner/reporters';
import { Multiplexer } from './multiplexer';
import { ZipFile } from 'playwright-core/lib/utils';
import { currentBlobReportVersion, type BlobReportMetadata } from './blob';
import { relativeFilePath } from '../util';
import type { TestError } from '../../types/testReporter';
import type * as blobV1 from './versions/blobV1';

type StatusCallback = (message: string) => void;

type ReportData = {
  eventPatchers: JsonEventPatchers;
  reportFile: string;
  metadata: BlobReportMetadata;
};

export async function createMergedReport(config: FullConfigInternal, dir: string, reporterDescriptions: ReporterDescription[], rootDirOverride: string | undefined) {
  const reporters = await createReporters(config, 'merge', false, reporterDescriptions);
  const multiplexer = new Multiplexer(reporters);
  const stringPool = new StringInternPool();

  let printStatus: StatusCallback = () => {};
  if (!multiplexer.printsToStdio()) {
    printStatus = printStatusToStdout;
    printStatus(`merging reports from ${dir}`);
  }

  const shardFiles = await sortedShardFiles(dir);
  if (shardFiles.length === 0)
    throw new Error(`No report files found in ${dir}`);
  const eventData = await mergeEvents(dir, shardFiles, stringPool, printStatus, rootDirOverride);
  // If explicit config is provided, use platform path separator, otherwise use the one from the report (if any).
  const pathSeparator = rootDirOverride ? path.sep : (eventData.pathSeparatorFromMetadata ?? path.sep);
  const receiver = new TeleReporterReceiver(multiplexer, {
    mergeProjects: false,
    mergeTestCases: false,
    resolvePath: (rootDir, relativePath) => stringPool.internString(rootDir + pathSeparator + relativePath),
    configOverrides: config.config,
  });
  printStatus(`processing test events`);

  const dispatchEvents = async (events: JsonEvent[]) => {
    for (const event of events) {
      if (event.method === 'onEnd')
        printStatus(`building final report`);
      await receiver.dispatch(event);
      if (event.method === 'onEnd')
        printStatus(`finished building report`);
    }
  };

  await dispatchEvents(eventData.prologue);
  for (const { reportFile, eventPatchers, metadata } of eventData.reports) {
    const reportJsonl = await fs.promises.readFile(reportFile);
    const events = parseTestEvents(reportJsonl);
    new JsonStringInternalizer(stringPool).traverse(events);
    eventPatchers.patchers.push(new AttachmentPathPatcher(dir));
    if (metadata.name)
      eventPatchers.patchers.push(new GlobalErrorPatcher(metadata.name));
    eventPatchers.patchEvents(events);
    await dispatchEvents(events);
  }
  await dispatchEvents(eventData.epilogue);
}

const commonEventNames = ['onBlobReportMetadata', 'onConfigure', 'onProject', 'onBegin', 'onEnd'];
const commonEvents = new Set(commonEventNames);
const commonEventRegex = new RegExp(`${commonEventNames.join('|')}`);

function parseCommonEvents(reportJsonl: Buffer): JsonEvent[] {
  return splitBufferLines(reportJsonl)
      .map(line => line.toString('utf8'))
      .filter(line => commonEventRegex.test(line)) // quick filter
      .map(line => JSON.parse(line) as JsonEvent)
      .filter(event => commonEvents.has(event.method));
}

function parseTestEvents(reportJsonl: Buffer): JsonEvent[] {
  return splitBufferLines(reportJsonl)
      .map(line => line.toString('utf8'))
      .filter(line => line.length)
      .map(line => JSON.parse(line) as JsonEvent)
      .filter(event => !commonEvents.has(event.method));
}

function splitBufferLines(buffer: Buffer) {
  const lines = [];
  let start = 0;
  while (start < buffer.length) {
    // 0x0A is the byte for '\n'
    const end = buffer.indexOf(0x0A, start);
    if (end === -1) {
      lines.push(buffer.slice(start));
      break;
    }
    lines.push(buffer.slice(start, end));
    start = end + 1;
  }
  return lines;
}

async function extractAndParseReports(dir: string, shardFiles: string[], internalizer: JsonStringInternalizer, printStatus: StatusCallback) {
  const shardEvents: { file: string, localPath: string, metadata: BlobReportMetadata, parsedEvents: JsonEvent[] }[] = [];
  await fs.promises.mkdir(path.join(dir, 'resources'), { recursive: true });

  const reportNames = new UniqueFileNameGenerator();
  for (const file of shardFiles) {
    const absolutePath = path.join(dir, file);
    printStatus(`extracting: ${relativeFilePath(absolutePath)}`);
    const zipFile = new ZipFile(absolutePath);
    const entryNames = await zipFile.entries();
    for (const entryName of entryNames.sort()) {
      let fileName = path.join(dir, entryName);
      const content = await zipFile.read(entryName);
      if (entryName.endsWith('.jsonl')) {
        fileName = reportNames.makeUnique(fileName);
        let parsedEvents = parseCommonEvents(content);
        // Passing reviver to JSON.parse doesn't work, as the original strings
        // keep being used. To work around that we traverse the parsed events
        // as a post-processing step.
        internalizer.traverse(parsedEvents);
        const metadata = findMetadata(parsedEvents, file);
        parsedEvents = modernizer.modernize(metadata.version, parsedEvents);
        shardEvents.push({
          file,
          localPath: fileName,
          metadata,
          parsedEvents
        });
      }
      await fs.promises.writeFile(fileName, content);
    }
    zipFile.close();
  }
  return shardEvents;
}

function findMetadata(events: JsonEvent[], file: string): BlobReportMetadata {
  if (events[0]?.method !== 'onBlobReportMetadata')
    throw new Error(`No metadata event found in ${file}`);
  const metadata = (events[0].params as BlobReportMetadata);
  if (metadata.version > currentBlobReportVersion)
    throw new Error(`Blob report ${file} was created with a newer version of Playwright.`);
  return metadata;
}

async function mergeEvents(dir: string, shardReportFiles: string[], stringPool: StringInternPool, printStatus: StatusCallback, rootDirOverride: string | undefined) {
  const internalizer = new JsonStringInternalizer(stringPool);

  const configureEvents: JsonEvent[] = [];
  const projectEvents: JsonEvent[] = [];
  const endEvents: JsonEvent[] = [];

  const blobs = await extractAndParseReports(dir, shardReportFiles, internalizer, printStatus);
  // Sort by (report name; shard; file name), so that salt generation below is deterministic when:
  // - report names are unique;
  // - report names are missing;
  // - report names are clashing between shards.
  blobs.sort((a, b) => {
    const nameA = a.metadata.name ?? '';
    const nameB = b.metadata.name ?? '';
    if (nameA !== nameB)
      return nameA.localeCompare(nameB);
    const shardA = a.metadata.shard?.current ?? 0;
    const shardB = b.metadata.shard?.current ?? 0;
    if (shardA !== shardB)
      return shardA - shardB;
    return a.file.localeCompare(b.file);
  });

  printStatus(`merging events`);

  const reports: ReportData[] = [];
  const globalTestIdSet = new Set<string>();

  for (let i = 0; i < blobs.length; ++i) {
    // Generate unique salt for each blob.
    const { parsedEvents, metadata, localPath } = blobs[i];
    const eventPatchers = new JsonEventPatchers();
    eventPatchers.patchers.push(new IdsPatcher(
        stringPool,
        metadata.name,
        String(i),
        globalTestIdSet,
    ));
    // Only patch path separators if we are merging reports with explicit config.
    if (rootDirOverride)
      eventPatchers.patchers.push(new PathSeparatorPatcher(metadata.pathSeparator));
    eventPatchers.patchEvents(parsedEvents);

    for (const event of parsedEvents) {
      if (event.method === 'onConfigure')
        configureEvents.push(event);
      else if (event.method === 'onProject')
        projectEvents.push(event);
      else if (event.method === 'onEnd')
        endEvents.push(event);
    }

    // Save information about the reports to stream their test events later.
    reports.push({
      eventPatchers,
      reportFile: localPath,
      metadata,
    });
  }

  return {
    prologue: [
      mergeConfigureEvents(configureEvents, rootDirOverride),
      ...projectEvents,
      { method: 'onBegin', params: undefined },
    ],
    reports,
    epilogue: [
      mergeEndEvents(endEvents),
      { method: 'onExit', params: undefined },
    ],
    pathSeparatorFromMetadata: blobs[0]?.metadata.pathSeparator,
  };
}

function mergeConfigureEvents(configureEvents: JsonEvent[], rootDirOverride: string | undefined): JsonEvent {
  if (!configureEvents.length)
    throw new Error('No configure events found');
  let config: JsonConfig = {
    configFile: undefined,
    globalTimeout: 0,
    maxFailures: 0,
    metadata: {
    },
    rootDir: '',
    version: '',
    workers: 0,
  };
  for (const event of configureEvents)
    config = mergeConfigs(config, event.params.config);

  if (rootDirOverride) {
    config.rootDir = rootDirOverride;
  } else {
    const rootDirs = new Set(configureEvents.map(e => e.params.config.rootDir));
    if (rootDirs.size > 1) {
      throw new Error([
        `Blob reports being merged were recorded with different test directories, and`,
        `merging cannot proceed. This may happen if you are merging reports from`,
        `machines with different environments, like different operating systems or`,
        `if the tests ran with different playwright configs.`,
        ``,
        `You can force merge by specifying a merge config file with "-c" option. If`,
        `you'd like all test paths to be correct, make sure 'testDir' in the merge config`,
        `file points to the actual tests location.`,
        ``,
        `Found directories:`,
        ...rootDirs
      ].join('\n'));
    }
  }

  return {
    method: 'onConfigure',
    params: {
      config,
    }
  };
}

function mergeConfigs(to: JsonConfig, from: JsonConfig): JsonConfig {
  return {
    ...to,
    ...from,
    metadata: {
      ...to.metadata,
      ...from.metadata,
      actualWorkers: (to.metadata.actualWorkers || 0) + (from.metadata.actualWorkers || 0),
    },
    workers: to.workers + from.workers,
  };
}

function mergeEndEvents(endEvents: JsonEvent[]): JsonEvent {
  let startTime = endEvents.length ? 10000000000000 : Date.now();
  let status: JsonFullResult['status'] = 'passed';
  let duration: number = 0;

  for (const event of endEvents) {
    const shardResult: JsonFullResult = event.params.result;
    if (shardResult.status === 'failed')
      status = 'failed';
    else if (shardResult.status === 'timedout' && status !== 'failed')
      status = 'timedout';
    else if (shardResult.status === 'interrupted' && status !== 'failed' && status !== 'timedout')
      status = 'interrupted';
    startTime = Math.min(startTime, shardResult.startTime);
    duration = Math.max(duration, shardResult.duration);
  }
  const result: JsonFullResult = {
    status,
    startTime,
    duration,
  };
  return {
    method: 'onEnd',
    params: {
      result
    }
  };
}

async function sortedShardFiles(dir: string) {
  const files = await fs.promises.readdir(dir);
  return files.filter(file => file.endsWith('.zip')).sort();
}

function printStatusToStdout(message: string) {
  process.stdout.write(`${message}\n`);
}

class UniqueFileNameGenerator {
  private _usedNames = new Set<string>();

  makeUnique(name: string): string {
    if (!this._usedNames.has(name)) {
      this._usedNames.add(name);
      return name;
    }
    const extension = path.extname(name);
    name = name.substring(0, name.length - extension.length);
    let index = 0;
    while (true) {
      const candidate = `${name}-${++index}${extension}`;
      if (!this._usedNames.has(candidate)) {
        this._usedNames.add(candidate);
        return candidate;
      }
    }
  }
}

class IdsPatcher {
  private _stringPool: StringInternPool;
  private _botName: string | undefined;
  private _salt: string;
  private _testIdsMap: Map<string, string>;
  private _globalTestIdSet: Set<string>;

  constructor(
    stringPool: StringInternPool,
    botName: string | undefined,
    salt: string,
    globalTestIdSet: Set<string>,
  ) {
    this._stringPool = stringPool;
    this._botName = botName;
    this._salt = salt;
    this._testIdsMap = new Map();
    this._globalTestIdSet = globalTestIdSet;
  }

  patchEvent(event: JsonEvent) {
    const { method, params } = event;
    switch (method) {
      case 'onProject':
        this._onProject(params.project);
        return;
      case 'onTestBegin':
      case 'onStepBegin':
      case 'onStepEnd':
      case 'onStdIO':
        params.testId = this._mapTestId(params.testId);
        return;
      case 'onTestEnd':
        params.test.testId = this._mapTestId(params.test.testId);
        return;
    }
  }

  private _onProject(project: JsonProject) {
    project.metadata ??= {};
    project.suites.forEach(suite => this._updateTestIds(suite));
  }

  private _updateTestIds(suite: JsonSuite) {
    suite.entries.forEach(entry => {
      if ('testId' in entry)
        this._updateTestId(entry);
      else
        this._updateTestIds(entry);
    });
  }

  private _updateTestId(test: JsonTestCase) {
    test.testId = this._mapTestId(test.testId);
    if (this._botName) {
      test.tags = test.tags || [];
      test.tags.unshift('@' + this._botName);
    }
  }

  private _mapTestId(testId: string): string {
    const t1 = this._stringPool.internString(testId);
    if (this._testIdsMap.has(t1))
      // already mapped
      return this._testIdsMap.get(t1)!;
    if (this._globalTestIdSet.has(t1)) {
      // test id is used in another blob, so we need to salt it.
      const t2 = this._stringPool.internString(testId + this._salt);
      this._globalTestIdSet.add(t2);
      this._testIdsMap.set(t1, t2);
      return t2;
    }
    this._globalTestIdSet.add(t1);
    this._testIdsMap.set(t1, t1);
    return t1;
  }
}

class AttachmentPathPatcher {
  constructor(private _resourceDir: string) {
  }

  patchEvent(event: JsonEvent) {
    if (event.method !== 'onTestEnd')
      return;
    for (const attachment of (event.params.result as JsonTestResultEnd).attachments) {
      if (!attachment.path)
        continue;

      attachment.path = path.join(this._resourceDir, attachment.path);
    }
  }
}

class PathSeparatorPatcher {
  private _from: string;
  private _to: string;
  constructor(from?: string) {
    this._from = from ?? (path.sep === '/' ? '\\' : '/');
    this._to = path.sep;
  }

  patchEvent(jsonEvent: JsonEvent) {
    if (this._from === this._to)
      return;
    if (jsonEvent.method === 'onProject') {
      this._updateProject(jsonEvent.params.project as JsonProject);
      return;
    }
    if (jsonEvent.method === 'onTestEnd') {
      const testResult = jsonEvent.params.result as JsonTestResultEnd;
      testResult.errors.forEach(error => this._updateLocation(error.location));
      testResult.attachments.forEach(attachment => {
        if (attachment.path)
          attachment.path = this._updatePath(attachment.path);
      });
      return;
    }
    if (jsonEvent.method === 'onStepBegin') {
      const step = jsonEvent.params.step as JsonTestStepStart;
      this._updateLocation(step.location);
      return;
    }
  }

  private _updateProject(project: JsonProject) {
    project.outputDir = this._updatePath(project.outputDir);
    project.testDir = this._updatePath(project.testDir);
    project.snapshotDir = this._updatePath(project.snapshotDir);
    project.suites.forEach(suite => this._updateSuite(suite, true));
  }

  private _updateSuite(suite: JsonSuite, isFileSuite: boolean = false) {
    this._updateLocation(suite.location);
    if (isFileSuite)
      suite.title = this._updatePath(suite.title);
    for (const entry of suite.entries) {
      if ('testId' in entry)
        this._updateLocation(entry.location);
      else
        this._updateSuite(entry);
    }
  }

  private _updateLocation(location?: JsonLocation) {
    if (location)
      location.file = this._updatePath(location.file);
  }

  private _updatePath(text: string): string {
    return text.split(this._from).join(this._to);
  }
}

class GlobalErrorPatcher {
  private _prefix: string;

  constructor(botName: string) {
    this._prefix = `(${botName}) `;
  }

  patchEvent(event: JsonEvent) {
    if (event.method !== 'onError')
      return;
    const error = event.params.error as TestError;
    if (error.message !== undefined)
      error.message = this._prefix + error.message;
    if (error.stack !== undefined)
      error.stack = this._prefix + error.stack;
  }
}

interface JsonEventPatcher {
  patchEvent(event: JsonEvent): void;
}

class JsonEventPatchers {
  readonly patchers: JsonEventPatcher[] = [];

  patchEvents(events: JsonEvent[]) {
    for (const event of events) {
      for (const patcher of this.patchers)
        patcher.patchEvent(event);
    }
  }
}

class BlobModernizer {
  modernize(fromVersion: number, events: JsonEvent[]): JsonEvent[] {
    const result = [];
    for (const event of events)
      result.push(...this._modernize(fromVersion, event));
    return result;
  }

  private _modernize(fromVersion: number, event: JsonEvent): JsonEvent[] {
    let events = [event];
    for (let version = fromVersion; version < currentBlobReportVersion; ++version)
      events = (this as any)[`_modernize_${version}_to_${version + 1}`].call(this, events);
    return events;
  }

  _modernize_1_to_2(events: JsonEvent[]): JsonEvent[] {
    return events.map(event => {
      if (event.method === 'onProject') {
        const modernizeSuite = (suite: blobV1.JsonSuite): JsonSuite => {
          const newSuites = suite.suites.map(modernizeSuite);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { suites, tests, ...remainder } = suite;
          return { entries: [...newSuites, ...tests], ...remainder };
        };
        const project = event.params.project;
        project.suites = project.suites.map(modernizeSuite);
      }
      return event;
    });
  }
}

const modernizer = new BlobModernizer();
