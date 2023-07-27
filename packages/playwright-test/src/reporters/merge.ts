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
import { createReporters } from '../runner/reporters';
import { Multiplexer } from './multiplexer';
import { ZipFile } from 'playwright-core/lib/utils';
import type { BlobReportMetadata } from './blob';

export async function createMergedReport(config: FullConfigInternal, dir: string, reporterDescriptions: ReporterDescription[]) {
  const shardFiles = await sortedShardFiles(dir);
  if (shardFiles.length === 0)
    throw new Error(`No report files found in ${dir}`);
  const events = await mergeEvents(dir, shardFiles);
  patchAttachmentPaths(events, dir);

  const reporters = await createReporters(config, 'merge', reporterDescriptions);
  const receiver = new TeleReporterReceiver(path.sep, new Multiplexer(reporters), false, config.config);

  for (const event of events)
    await receiver.dispatch(event);
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

async function extractReportFromZip(file: string): Promise<Buffer> {
  const zipFile = new ZipFile(file);
  const entryNames = await zipFile.entries();
  try {
    for (const entryName of entryNames) {
      if (entryName.endsWith('.jsonl'))
        return await zipFile.read(entryName);
    }
  } finally {
    zipFile.close();
  }
  throw new Error(`Cannot find *.jsonl file in ${file}`);
}

function findMetadata(events: JsonEvent[], file: string): BlobReportMetadata {
  if (events[0]?.method !== 'onBlobReportMetadata')
    throw new Error(`No metadata event found in ${file}`);
  return events[0].params;
}

async function mergeEvents(dir: string, shardReportFiles: string[]) {
  const events: JsonEvent[] = [];
  const configureEvents: JsonEvent[] = [];
  const beginEvents: JsonEvent[] = [];
  const endEvents: JsonEvent[] = [];
  const shardEvents: { metadata: BlobReportMetadata, parsedEvents: JsonEvent[] }[] = [];
  for (const reportFile of shardReportFiles) {
    const reportJsonl = await extractReportFromZip(path.join(dir, reportFile));
    const parsedEvents = parseEvents(reportJsonl);
    shardEvents.push({
      metadata: findMetadata(parsedEvents, reportFile),
      parsedEvents
    });
  }
  shardEvents.sort((a, b) => {
    const shardA = a.metadata.shard?.current ?? 0;
    const shardB = b.metadata.shard?.current ?? 0;
    return shardA - shardB;
  });
  const allTestIds = new Set<string>();
  for (const { parsedEvents } of shardEvents) {
    for (const event of parsedEvents) {
      if (event.method === 'onConfigure')
        configureEvents.push(event);
      else if (event.method === 'onBegin')
        beginEvents.push(event);
      else if (event.method === 'onEnd')
        endEvents.push(event);
      else if (event.method === 'onBlobReportMetadata')
        new ProjectNamePatcher(allTestIds, event.params.projectSuffix || '').patchEvents(parsedEvents);
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
  return files.filter(file => file.startsWith('report-') && file.endsWith('.zip')).sort();
}

class ProjectNamePatcher {
  private _testIds = new Set<string>();

  constructor(private _allTestIds: Set<string>, private _projectNameSuffix: string) {
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
    return testId;
  }
}
