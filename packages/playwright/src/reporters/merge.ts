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
import type { JsonConfig, JsonEvent, JsonFullResult, JsonProject, JsonSuite, JsonTestResultEnd } from '../isomorphic/teleReceiver';
import { TeleReporterReceiver } from '../isomorphic/teleReceiver';
import { JsonStringInternalizer, StringInternPool } from '../isomorphic/stringInternPool';
import { createReporters } from '../runner/reporters';
import { Multiplexer } from './multiplexer';
import { ZipFile, calculateSha1 } from 'playwright-core/lib/utils';
import { currentBlobReportVersion, type BlobReportMetadata } from './blob';
import { relativeFilePath } from '../util';

type StatusCallback = (message: string) => void;

type ReportData = {
  idsPatcher: IdsPatcher;
  reportFile: string;
};

export async function createMergedReport(config: FullConfigInternal, dir: string, reporterDescriptions: ReporterDescription[], rootDirOverride: string | undefined) {
  const reporters = await createReporters(config, 'merge', reporterDescriptions);
  const multiplexer = new Multiplexer(reporters);
  const receiver = new TeleReporterReceiver(path.sep, multiplexer, false, config.config);
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
  for (const { reportFile, idsPatcher } of eventData.reports) {
    const reportJsonl = await fs.promises.readFile(reportFile);
    const events = parseTestEvents(reportJsonl);
    new JsonStringInternalizer(stringPool).traverse(events);
    idsPatcher.patchEvents(events);
    patchAttachmentPaths(events, dir);
    await dispatchEvents(events);
  }
  await dispatchEvents(eventData.epilogue);
}

function patchAttachmentPaths(events: JsonEvent[], resourceDir: string) {
  for (const event of events) {
    if (event.method !== 'onTestEnd')
      continue;
    for (const attachment of (event.params.result as JsonTestResultEnd).attachments) {
      if (!attachment.path)
        continue;

      attachment.path = path.join(resourceDir, attachment.path);
    }
  }
}

const commonEventNames = ['onBlobReportMetadata', 'onConfigure', 'onProject', 'onBegin', 'onEnd'];
const commonEvents = new Set(commonEventNames);
const commonEventRegex = new RegExp(`${commonEventNames.join('|')}`);

function parseCommonEvents(reportJsonl: Buffer): JsonEvent[] {
  return reportJsonl.toString().split('\n')
      .filter(line => commonEventRegex.test(line)) // quick filter
      .map(line => JSON.parse(line) as JsonEvent)
      .filter(event => commonEvents.has(event.method));
}

function parseTestEvents(reportJsonl: Buffer): JsonEvent[] {
  return reportJsonl.toString().split('\n')
      .filter(line => line.length)
      .map(line => JSON.parse(line) as JsonEvent)
      .filter(event => !commonEvents.has(event.method));
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
        const parsedEvents = parseCommonEvents(content);
        // Passing reviver to JSON.parse doesn't work, as the original strings
        // keep beeing used. To work around that we traverse the parsed events
        // as a post-processing step.
        internalizer.traverse(parsedEvents);
        shardEvents.push({
          file,
          localPath: fileName,
          metadata: findMetadata(parsedEvents, file),
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

  const saltSet = new Set<string>();

  printStatus(`merging events`);

  const reports: ReportData[] = [];

  for (const { file, parsedEvents, metadata, localPath } of blobs) {
    // Generate unique salt for each blob.
    const sha1 = calculateSha1(metadata.name || path.basename(file)).substring(0, 16);
    let salt = sha1;
    for (let i = 0; saltSet.has(salt); i++)
      salt = sha1 + '-' + i;
    saltSet.add(salt);

    const idsPatcher = new IdsPatcher(stringPool, metadata.name, salt);
    idsPatcher.patchEvents(parsedEvents);

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
      idsPatcher,
      reportFile: localPath,
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
    ]
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
    listOnly: false
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
  return files.filter(file => file.startsWith('report') && file.endsWith('.zip')).sort();
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
  constructor(private _stringPool: StringInternPool, private _reportName: string | undefined, private _salt: string) {
  }

  patchEvents(events: JsonEvent[]) {
    for (const event of events) {
      const { method, params } = event;
      switch (method) {
        case 'onProject':
          this._onProject(params.project);
          continue;
        case 'onTestBegin':
        case 'onStepBegin':
        case 'onStepEnd':
        case 'onStdIO':
          params.testId = this._mapTestId(params.testId);
          continue;
        case 'onTestEnd':
          params.test.testId = this._mapTestId(params.test.testId);
          continue;
      }
    }
  }

  private _onProject(project: JsonProject) {
    project.metadata = project.metadata ?? {};
    project.metadata.reportName = this._reportName;
    project.id = this._stringPool.internString(project.id + this._salt);
    project.suites.forEach(suite => this._updateTestIds(suite));
  }

  private _updateTestIds(suite: JsonSuite) {
    suite.tests.forEach(test => test.testId = this._mapTestId(test.testId));
    suite.suites.forEach(suite => this._updateTestIds(suite));
  }

  private _mapTestId(testId: string): string {
    return this._stringPool.internString(testId + this._salt);
  }
}
