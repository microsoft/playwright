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
import type { FullResult } from '../../types/testReporter';
import type { FullConfigInternal } from '../common/config';
import type { JsonConfig, JsonEvent, JsonProject, JsonSuite, JsonTestResultEnd } from '../isomorphic/teleReceiver';
import { TeleReporterReceiver } from '../isomorphic/teleReceiver';
import { JsonStringInternalizer, StringInternPool } from '../isomorphic/stringInternPool';
import { createReporters } from '../runner/reporters';
import { Multiplexer } from './multiplexer';
import { ZipFile } from 'playwright-core/lib/utils';
import { currentBlobReportVersion, type BlobReportMetadata } from './blob';
import { relativeFilePath } from '../util';

type StatusCallback = (message: string) => void;

export async function createMergedReport(config: FullConfigInternal, dir: string, reporterDescriptions: ReporterDescription[]) {
  const reporters = await createReporters(config, 'merge', reporterDescriptions);
  const multiplexer = new Multiplexer(reporters);
  const receiver = new TeleReporterReceiver(path.sep, multiplexer, false, config.config);

  let printStatus: StatusCallback = () => {};
  if (!multiplexer.printsToStdio()) {
    printStatus = printStatusToStdout;
    printStatus(`merging reports from ${dir}`);
  }

  const shardFiles = await sortedShardFiles(dir);
  if (shardFiles.length === 0)
    throw new Error(`No report files found in ${dir}`);
  const events = await mergeEvents(dir, shardFiles, printStatus);
  patchAttachmentPaths(events, dir);

  printStatus(`processing ${events.length} test events`);
  for (const event of events) {
    if (event.method === 'onEnd')
      printStatus(`building final report`);
    await receiver.dispatch(event);
    if (event.method === 'onEnd')
      printStatus(`finished building report`);
  }
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

function parseEvents(reportJsonl: Buffer): JsonEvent[] {
  return reportJsonl.toString().split('\n').filter(line => line.length).map(line => JSON.parse(line)) as JsonEvent[];
}

async function extractAndParseReports(dir: string, shardFiles: string[], stringPool: StringInternPool, printStatus: StatusCallback): Promise<{ metadata: BlobReportMetadata, parsedEvents: JsonEvent[] }[]> {
  const shardEvents = [];
  await fs.promises.mkdir(path.join(dir, 'resources'), { recursive: true });

  const internalizer = new JsonStringInternalizer(stringPool);

  for (const file of shardFiles) {
    const absolutePath = path.join(dir, file);
    printStatus(`extracting: ${relativeFilePath(absolutePath)}`);
    const zipFile = new ZipFile(absolutePath);
    const entryNames = await zipFile.entries();
    for (const entryName of entryNames) {
      const content = await zipFile.read(entryName);
      if (entryName.endsWith('.jsonl')) {
        const parsedEvents = parseEvents(content);
        // Passing reviver to JSON.parse doesn't work, as the original strings
        // keep beeing used. To work around that we traverse the parsed events
        // as a post-processing step.
        internalizer.traverse(parsedEvents);
        shardEvents.push({
          metadata: findMetadata(parsedEvents, file),
          parsedEvents
        });
      } else {
        const fileName = path.join(dir, entryName);
        await fs.promises.writeFile(fileName, content);
      }
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

async function mergeEvents(dir: string, shardReportFiles: string[], printStatus: StatusCallback) {
  const events: JsonEvent[] = [];
  const configureEvents: JsonEvent[] = [];
  const beginEvents: JsonEvent[] = [];
  const endEvents: JsonEvent[] = [];
  const stringPool = new StringInternPool();
  const shardEvents = await extractAndParseReports(dir, shardReportFiles, stringPool, printStatus);
  shardEvents.sort((a, b) => {
    const shardA = a.metadata.shard?.current ?? 0;
    const shardB = b.metadata.shard?.current ?? 0;
    return shardA - shardB;
  });
  const allTestIds = new Set<string>();
  printStatus(`merging events`);
  for (const { parsedEvents } of shardEvents) {
    for (const event of parsedEvents) {
      if (event.method === 'onConfigure')
        configureEvents.push(event);
      else if (event.method === 'onBegin')
        beginEvents.push(event);
      else if (event.method === 'onEnd')
        endEvents.push(event);
      else if (event.method === 'onBlobReportMetadata')
        new ProjectNamePatcher(allTestIds, stringPool, event.params.projectSuffix || '').patchEvents(parsedEvents);
      else
        events.push(event);
    }
  }
  return [mergeConfigureEvents(configureEvents), mergeBeginEvents(beginEvents), ...events, mergeEndEvents(endEvents), { method: 'onExit', params: undefined }];
}

function mergeConfigureEvents(configureEvents: JsonEvent[]): JsonEvent {
  if (!configureEvents.length)
    throw new Error('No configure events found');
  let config: JsonConfig = {
    configFile: undefined,
    globalTimeout: 0,
    maxFailures: 0,
    metadata: {
      totalTime: 0,
    },
    rootDir: '',
    version: '',
    workers: 0,
    listOnly: false
  };
  for (const event of configureEvents)
    config = mergeConfigs(config, event.params.config);
  return {
    method: 'onConfigure',
    params: {
      config,
    }
  };
}

function mergeBeginEvents(beginEvents: JsonEvent[]): JsonEvent {
  if (!beginEvents.length)
    throw new Error('No begin events found');
  const projects: JsonProject[] = [];
  for (const event of beginEvents) {
    const shardProjects: JsonProject[] = event.params.projects;
    for (const shardProject of shardProjects) {
      const mergedProject = projects.find(p => p.id === shardProject.id);
      if (!mergedProject)
        projects.push(shardProject);
      else
        mergeJsonSuites(shardProject.suites, mergedProject);
    }
  }
  return {
    method: 'onBegin',
    params: {
      projects,
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
      totalTime: to.metadata.totalTime + from.metadata.totalTime,
      actualWorkers: (to.metadata.actualWorkers || 0) + (from.metadata.actualWorkers || 0),
    },
    workers: to.workers + from.workers,
  };
}

function mergeJsonSuites(jsonSuites: JsonSuite[], parent: JsonSuite | JsonProject) {
  for (const jsonSuite of jsonSuites) {
    const existingSuite = parent.suites.find(s => s.title === jsonSuite.title);
    if (!existingSuite) {
      parent.suites.push(jsonSuite);
    } else {
      mergeJsonSuites(jsonSuite.suites, existingSuite);
      existingSuite.tests.push(...jsonSuite.tests);
    }
  }
}

function mergeEndEvents(endEvents: JsonEvent[]): JsonEvent {
  const result: FullResult = { status: 'passed' };
  for (const event of endEvents) {
    const shardResult: FullResult = event.params.result;
    if (shardResult.status === 'failed')
      result.status = 'failed';
    else if (shardResult.status === 'timedout' && result.status !== 'failed')
      result.status = 'timedout';
    else if (shardResult.status === 'interrupted' && result.status !== 'failed' && result.status !== 'timedout')
      result.status = 'interrupted';
  }
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

class ProjectNamePatcher {
  private _testIds = new Set<string>();

  constructor(
    private _allTestIds: Set<string>,
    private _stringPool: StringInternPool,
    private _projectNameSuffix: string) {
  }

  patchEvents(events: JsonEvent[]) {
    for (const event of events) {
      const { method, params } = event;
      switch (method) {
        case 'onBegin':
          this._onBegin(params.config, params.projects);
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
    for (const testId of this._testIds)
      this._allTestIds.add(testId);
  }

  private _onBegin(config: JsonConfig, projects: JsonProject[]) {
    for (const project of projects)
      project.name += this._projectNameSuffix;
    this._updateProjectIds(projects);
    for (const project of projects)
      project.suites.forEach(suite => this._updateTestIds(suite));
  }

  private _updateProjectIds(projects: JsonProject[]) {
    const usedNames = new Set<string>();
    for (const p of projects) {
      for (let i = 0; i < projects.length; ++i) {
        const candidate = p.name + (i ? i : '');
        if (usedNames.has(candidate))
          continue;
        p.id = candidate;
        usedNames.add(candidate);
        break;
      }
    }
  }

  private _updateTestIds(suite: JsonSuite) {
    suite.tests.forEach(test => {
      test.testId = this._mapTestId(test.testId);
      this._testIds.add(test.testId);
    });
    suite.suites.forEach(suite => this._updateTestIds(suite));
  }

  private _mapTestId(testId: string): string {
    testId = testId + this._projectNameSuffix;
    // Consider a setup project running on each shard. In this case we'll have
    // the same testId (from setup project) in multiple blob reports.
    // To avoid reporters being confused by clashing test ids, we automatically
    // make them unique and produce a separate test from each blob.
    while (this._allTestIds.has(testId))
      testId = testId + '1';
    return this._stringPool.internString(testId);
  }
}
