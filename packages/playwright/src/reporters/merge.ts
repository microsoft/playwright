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

import { isPathInside } from '@utils/fileUtils';
import { ZipFile } from '@utils/zipFile';

import {  currentBlobReportVersion } from './blob';
import { Multiplexer } from './multiplexer';
import { JsonStringInternalizer, StringInternPool } from '../isomorphic/stringInternPool';
import { asFullConfig, asFullResult, TeleReporterReceiver } from '../isomorphic/teleReceiver';
import { createReporters } from '../runner/reporters';
import { relativeFilePath } from '../util';

import type { ReporterDescription, TestAnnotation } from '../../types/test';
import type { TestError } from '../../types/testReporter';
import type { FullConfigInternal } from '../common';
import type { BlobReportMetadata, JsonAttachment, JsonConfig, JsonEvent, JsonFullResult, JsonLocation, JsonOnConfigureEvent, JsonOnEndEvent, JsonOnProjectEvent, JsonProject, JsonSuite, JsonTestCase } from '../isomorphic/teleReceiver';
import type * as blobV1 from './versions/blobV1';

type StatusCallback = (message: string) => void;

type ReportData = {
  eventPatchers: JsonEventPatchers;
  reportFile: string;
  zipFile: string;
  metadata: BlobReportMetadata;
  config: JsonConfig;
  fullResult: JsonFullResult;
};

export type MergeResult = 'passed' | 'failed';

export type MergeStrategy = 'separate' | 'overwrite' | 'as-retry';

export async function createMergedReport(config: FullConfigInternal, dir: string, reporterDescriptions: ReporterDescription[], rootDirOverride: string | undefined, mergeStrategy: MergeStrategy = 'separate'): Promise<MergeResult> {
  const reporters = await createReporters(config, 'merge', reporterDescriptions);
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
  const eventData = await mergeEvents(dir, shardFiles, stringPool, printStatus, rootDirOverride, mergeStrategy);
  // If explicit config is provided, use platform path separator, otherwise use the one from the report (if any).
  const pathSeparator = rootDirOverride ? path.sep : (eventData.pathSeparatorFromMetadata ?? path.sep);
  const pathPackage = pathSeparator === '/' ? path.posix : path.win32;
  const receiver = new TeleReporterReceiver(multiplexer, {
    mergeProjects: false,
    mergeTestCases: false,
    // When merging on a different OS, an absolute path like `C:\foo\bar` from win may look like
    // a relative path on posix, and vice versa.
    // Therefore, we cannot use `path.resolve()` here - it will resolve relative-looking paths
    // against `process.cwd()`, while we just want to normalize ".." and "." segments.
    resolvePath: (rootDir, relativePath) => stringPool.internString(pathPackage.normalize(pathPackage.join(rootDir, relativePath))),
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
  let usedWorkers = 0;
  for (const { reportFile, zipFile, eventPatchers, metadata, config, fullResult } of eventData.reports) {
    multiplexer.onReportConfigure({
      reportPath: zipFile,
      config: asFullConfig(config),
    });
    const reportJsonl = await fs.promises.readFile(reportFile);
    const events = parseTestEvents(reportJsonl);
    new JsonStringInternalizer(stringPool).traverse(events);
    eventPatchers.patchers.push(new AttachmentPathPatcher(dir));
    if (metadata.name)
      eventPatchers.patchers.push(new GlobalErrorPatcher(metadata.name));
    if (config?.tags?.length)
      eventPatchers.patchers.push(new GlobalErrorPatcher(config.tags.join(' ')));
    const workerIndexPatcher = new WorkerIndexPatcher(usedWorkers);
    eventPatchers.patchers.push(workerIndexPatcher);
    eventPatchers.patchEvents(events);
    usedWorkers += workerIndexPatcher.usedWorkers();
    await dispatchEvents(events);
    multiplexer.onReportEnd({
      reportPath: zipFile,
      result: asFullResult(fullResult),
    });
  }
  await dispatchEvents(eventData.epilogue);
  // The merged report status is intentionally not surfaced as a failure - the
  // merge command only fails when a reporter itself errors.
  return multiplexer.hasReporterErrors() ? 'failed' : 'passed';
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
  const shardEvents: { zipFile: string, reportFile: string, metadata: BlobReportMetadata, parsedEvents: JsonEvent[] }[] = [];
  await fs.promises.mkdir(path.join(dir, 'resources'), { recursive: true });

  const reportNames = new UniqueFileNameGenerator();
  for (const file of shardFiles) {
    const absolutePath = path.join(dir, file);
    printStatus(`extracting: ${relativeFilePath(absolutePath)}`);
    const zipFile = new ZipFile(absolutePath);
    const entryNames = await zipFile.entries();
    for (const entryName of entryNames.sort()) {
      let reportFile = path.join(dir, entryName);
      const content = await zipFile.read(entryName);
      if (entryName.endsWith('.jsonl')) {
        reportFile = reportNames.makeUnique(reportFile);
        let parsedEvents = parseCommonEvents(content);
        // Passing reviver to JSON.parse doesn't work, as the original strings
        // keep being used. To work around that we traverse the parsed events
        // as a post-processing step.
        internalizer.traverse(parsedEvents);
        const metadata = findMetadata(parsedEvents, file);
        parsedEvents = modernizer.modernize(metadata.version, parsedEvents);
        shardEvents.push({
          zipFile: absolutePath,
          reportFile,
          metadata,
          parsedEvents
        });
      }
      await fs.promises.writeFile(reportFile, content);
    }
    zipFile.close();
  }
  return shardEvents;
}

function findMetadata(events: JsonEvent[], file: string): BlobReportMetadata {
  if (events[0]?.method !== 'onBlobReportMetadata')
    throw new Error(`No metadata event found in ${file}`);
  const metadata = events[0].params;
  if (metadata.version > currentBlobReportVersion)
    throw new Error(`Blob report ${file} was created with a newer version of Playwright.`);
  return metadata;
}

async function mergeEvents(dir: string, shardReportFiles: string[], stringPool: StringInternPool, printStatus: StatusCallback, rootDirOverride: string | undefined, mergeStrategy: MergeStrategy): Promise<{
  prologue: JsonEvent[];
  reports: ReportData[];
  epilogue: JsonEvent[];
  pathSeparatorFromMetadata?: string;
}> {
  const internalizer = new JsonStringInternalizer(stringPool);

  const configureEvents: JsonOnConfigureEvent[] = [];
  const projectEvents: JsonOnProjectEvent[] = [];
  const endEvents: { event: JsonOnEndEvent, metadata: BlobReportMetadata }[] = [];

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
    return a.zipFile.localeCompare(b.zipFile);
  });

  if (mergeStrategy !== 'separate') {
    // "overwrite"/"as-retry" need to know which colliding blob actually ran later, so
    // reconcile them by each blob's own recorded run time instead of by report name/file
    // name order (which may not reflect chronological order at all, e.g. shard/file naming).
    const startTimeByBlob = new Map<typeof blobs[number], number>();
    for (const blob of blobs) {
      const onEnd = blob.parsedEvents.find(event => event.method === 'onEnd') as JsonOnEndEvent | undefined;
      startTimeByBlob.set(blob, onEnd?.params.result.startTime ?? 0);
    }
    blobs.sort((a, b) => startTimeByBlob.get(a)! - startTimeByBlob.get(b)!);
  }

  printStatus(`merging events`);

  const reports: ReportData[] = [];
  const globalTestIdSet = new Set<string>();
  // Shared across all blobs so that "as-retry" keeps numbering retries
  // consecutively for a given test id, instead of each blob restarting at 0.
  const retryOffsets = new Map<string, number>();

  for (let i = 0; i < blobs.length; ++i) {
    // Generate unique salt for each blob.
    const { parsedEvents, metadata, reportFile, zipFile } = blobs[i];
    const eventPatchers = new JsonEventPatchers();
    eventPatchers.patchers.push(new IdsPatcher(
        stringPool,
        metadata.name,
        String(i),
        globalTestIdSet,
        mergeStrategy,
        retryOffsets,
    ));
    // Only patch path separators if we are merging reports with explicit config.
    if (rootDirOverride)
      eventPatchers.patchers.push(new PathSeparatorPatcher(metadata.pathSeparator));
    eventPatchers.patchEvents(parsedEvents);

    let config: JsonConfig | undefined;
    let fullResult: JsonFullResult | undefined;
    for (const event of parsedEvents) {
      if (event.method === 'onConfigure') {
        configureEvents.push(event);
        config = event.params.config;
      } else if (event.method === 'onProject') {
        projectEvents.push(event);
      } else if (event.method === 'onEnd') {
        fullResult = event.params.result;
        endEvents.push({ event, metadata });
      }
    }

    // Save information about the reports to stream their test events later.
    reports.push({
      eventPatchers,
      reportFile,
      zipFile,
      metadata,
      config: config!,
      fullResult: fullResult!,
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

function mergeConfigureEvents(configureEvents: JsonOnConfigureEvent[], rootDirOverride: string | undefined): JsonEvent {
  if (!configureEvents.length)
    throw new Error('No configure events found');
  let config: JsonConfig = {
    configFile: undefined,
    globalTimeout: 0,
    maxFailures: 0,
    metadata: {
    },
    shard: null,
    rootDir: '',
    version: '',
    workers: 0,
    globalSetup: null,
    globalTeardown: null,
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
    shard: null,
    workers: to.workers + from.workers,
  };
}

function mergeEndEvents(endEvents: { event: JsonOnEndEvent }[]): JsonEvent {
  let startTime = endEvents.length ? 10000000000000 : Date.now();
  let status: JsonFullResult['status'] = 'passed';
  let endTime: number = 0;

  for (const { event } of endEvents) {
    const shardResult = event.params.result;
    if (shardResult.status === 'failed')
      status = 'failed';
    else if (shardResult.status === 'timedout' && status !== 'failed')
      status = 'timedout';
    else if (shardResult.status === 'interrupted' && status !== 'failed' && status !== 'timedout')
      status = 'interrupted';
    startTime = Math.min(startTime, shardResult.startTime);
    endTime = Math.max(endTime, shardResult.startTime + shardResult.duration);
  }
  const result: JsonFullResult = {
    status,
    startTime,
    duration: endTime - startTime,
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
  // eslint-disable-next-line no-restricted-properties
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
  private _mergeStrategy: MergeStrategy;
  private _retryOffsets: Map<string, number>;
  // Test ids that collided with an earlier blob (populated while patching this blob's
  // "onProject" event, which always precedes its test-run events). Only these ids get the
  // "overwrite"/"as-retry" special-casing below -- a test that only exists in this blob must
  // pass through onTestBegin untouched, retries and all.
  private _collidingTestIds = new Set<string>();
  // Ensures a colliding test's previous results are discarded exactly once per blob (on its
  // first onTestBegin), not on every one of this blob's own retries of that same test.
  private _discardedResultsForTestIds = new Set<string>();
  // Caches the retry offset chosen for a colliding test id so every retry within this blob is
  // shifted by the same fixed amount, instead of re-reading (and further inflating) the shared
  // running offset on every onTestBegin.
  private _retryOffsetForTestId = new Map<string, number>();

  constructor(
    stringPool: StringInternPool,
    botName: string | undefined,
    salt: string,
    globalTestIdSet: Set<string>,
    mergeStrategy: MergeStrategy,
    retryOffsets: Map<string, number>,
  ) {
    this._stringPool = stringPool;
    this._botName = botName;
    this._salt = salt;
    this._testIdsMap = new Map();
    this._globalTestIdSet = globalTestIdSet;
    this._mergeStrategy = mergeStrategy;
    this._retryOffsets = retryOffsets;
  }

  patchEvent(event: JsonEvent) {
    const { method, params } = event;
    switch (method) {
      case 'onProject':
        this._onProject(params.project);
        return;
      case 'onTestBegin': {
        params.testId = this._mapTestId(params.testId);
        const isCollision = this._collidingTestIds.has(params.testId);
        if (isCollision && this._mergeStrategy === 'overwrite' && !this._discardedResultsForTestIds.has(params.testId)) {
          params.result.discardPreviousResults = true;
          this._discardedResultsForTestIds.add(params.testId);
        }
        if (this._mergeStrategy === 'as-retry') {
          if (isCollision)
            this._offsetRetry(params.testId, params.result);
          this._trackRetryIndex(params.testId, params.result.retry);
        }
        return;
      }
      case 'onAttach':
      case 'onStepBegin':
      case 'onStepEnd':
      case 'onStdIO':
        params.testId = params.testId ? this._mapTestId(params.testId) : undefined;
        return;
      case 'onTestEnd':
        params.test.testId = this._mapTestId(params.test.testId);
        return;
    }
  }

  // For "as-retry" merges, a colliding rerun's own retry numbering (0, 1, ...) would otherwise
  // collide with retry indices the original blob already used for the same test id.
  // Shift incoming retries to continue after the highest retry claimed so far, using one fixed
  // offset for all of this blob's own retries of that test.
  private _offsetRetry(testId: string, result: { retry: number }) {
    let offset = this._retryOffsetForTestId.get(testId);
    if (offset === undefined) {
      offset = this._retryOffsets.get(testId) ?? 0;
      this._retryOffsetForTestId.set(testId, offset);
    }
    result.retry += offset;
  }

  // Keeps the shared "highest retry index used so far" up to date for every test, colliding or
  // not, so that a later colliding blob knows where to continue from.
  private _trackRetryIndex(testId: string, retry: number) {
    const highest = this._retryOffsets.get(testId) ?? 0;
    this._retryOffsets.set(testId, Math.max(highest, retry + 1));
  }

  private _onProject(project: JsonProject) {
    project.metadata ??= {};
    project.suites.forEach(suite => this._updateTestIds(suite));
  }

  private _updateTestIds(suite: JsonSuite) {
    // In "overwrite"/"as-retry" mode, a colliding test reuses the id of the test case
    // already registered from an earlier blob (see _mapTestId below). The receiver would
    // otherwise create a second, unlinked test case for that same id (it only dedupes
    // suite entries by title, not by id), so we drop the incoming duplicate suite entry
    // here and let the test's later onTestBegin/onTestEnd events attach to the original
    // test case instead.
    suite.entries = suite.entries.filter(entry => {
      if ('testId' in entry)
        return this._updateTestId(entry);
      this._updateTestIds(entry);
      return true;
    });
  }

  private _updateTestId(test: JsonTestCase): boolean {
    const isDuplicate = this._mergeStrategy !== 'separate' && this._globalTestIdSet.has(this._stringPool.internString(test.testId));
    test.testId = this._mapTestId(test.testId);
    if (isDuplicate)
      this._collidingTestIds.add(test.testId);
    if (this._botName) {
      test.tags = test.tags || [];
      test.tags.unshift('@' + this._botName);
    }
    return !isDuplicate;
  }

  private _mapTestId(testId: string): string {
    const t1 = this._stringPool.internString(testId);
    if (this._testIdsMap.has(t1))
      // already mapped
      return this._testIdsMap.get(t1)!;
    if (this._globalTestIdSet.has(t1)) {
      if (this._mergeStrategy !== 'separate') {
        // "overwrite" and "as-retry" intentionally reuse the id from the earlier blob
        // instead of salting, so this test's results land on the same test case rather
        // than becoming a distinct entry.
        this._testIdsMap.set(t1, t1);
        return t1;
      }
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
    if (event.method === 'onAttach')
      this._patchAttachments(event.params.attachments);
    else if (event.method === 'onTestEnd')
      this._patchAttachments(event.params.result.attachments ?? []);
  }

  private _patchAttachments(attachments: JsonAttachment[]) {
    const resourceRoot = path.resolve(this._resourceDir);
    for (const attachment of attachments) {
      if (!attachment.path)
        continue;
      const joined = path.resolve(resourceRoot, attachment.path);
      if (!isPathInside(resourceRoot, joined)) {
        attachment.path = undefined;
        continue;
      }
      attachment.path = joined;
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
      this._updateProject(jsonEvent.params.project);
      return;
    }
    if (jsonEvent.method === 'onTestEnd') {
      const test = jsonEvent.params.test;
      test.annotations?.forEach(annotation => this._updateAnnotationLocation(annotation));
      const testResult = jsonEvent.params.result;
      testResult.annotations?.forEach(annotation => this._updateAnnotationLocation(annotation));
      testResult.errors.forEach(error => this._updateErrorLocations(error));
      (testResult.attachments ?? []).forEach(attachment => {
        if (attachment.path)
          attachment.path = this._updatePath(attachment.path);
      });
      return;
    }
    if (jsonEvent.method === 'onStepBegin') {
      const step = jsonEvent.params.step;
      this._updateLocation(step.location);
      return;
    }
    if (jsonEvent.method === 'onStepEnd') {
      const step = jsonEvent.params.step;
      this._updateErrorLocations(step.error);
      step.annotations?.forEach(annotation => this._updateAnnotationLocation(annotation));
      return;
    }
    if (jsonEvent.method === 'onAttach') {
      const attach = jsonEvent.params;
      attach.attachments.forEach(attachment => {
        if (attachment.path)
          attachment.path = this._updatePath(attachment.path);
      });
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
      if ('testId' in entry) {
        this._updateLocation(entry.location);
        entry.annotations?.forEach(annotation => this._updateAnnotationLocation(annotation));
      } else {
        this._updateSuite(entry);
      }
    }
  }

  private _updateErrorLocations(error: TestError | undefined) {
    while (error) {
      this._updateLocation(error.location);
      error = error.cause;
    }
  }

  private _updateAnnotationLocation(annotation: TestAnnotation) {
    this._updateLocation(annotation.location);
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
    const error = event.params.error;
    if (error.message !== undefined)
      error.message = this._prefix + error.message;
    if (error.stack !== undefined)
      error.stack = this._prefix + error.stack;
  }
}

class WorkerIndexPatcher {
  private _baseWorkerIndex: number;
  private _maxWorkerIndex = 0;

  constructor(baseWorkerIndex: number) {
    this._baseWorkerIndex = baseWorkerIndex;
  }

  patchEvent(event: JsonEvent) {
    if (event.method === 'onTestBegin') {
      this._maxWorkerIndex = Math.max(this._maxWorkerIndex, event.params.result.workerIndex);
      event.params.result.workerIndex += this._baseWorkerIndex;
    }
  }

  usedWorkers() {
    return this._maxWorkerIndex + 1;
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
        project.suites = (project.suites as unknown as blobV1.JsonSuite[]).map(modernizeSuite);
      }
      return event;
    });
  }
}

const modernizer = new BlobModernizer();
