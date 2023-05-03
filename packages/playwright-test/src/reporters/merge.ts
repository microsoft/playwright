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
import os from 'os';
import path from 'path';
import { ZipFile, removeFolders } from 'playwright-core/lib/utils';
import type { ReporterDescription } from '../../types/test';
import type { FullResult } from '../../types/testReporter';
import type { FullConfigInternal } from '../common/config';
import { TeleReporterReceiver, type JsonEvent, type JsonProject, type JsonSuite, type JsonTestResultEnd } from '../isomorphic/teleReceiver';
import { createReporters } from '../runner/reporters';
import { Multiplexer } from './multiplexer';

export async function createMergedReport(config: FullConfigInternal, dir: string, reporterDescriptions: ReporterDescription[]) {
  const shardFiles = await sortedShardFiles(dir);
  const resourceDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-report-'));
  await fs.promises.mkdir(resourceDir, { recursive: true });
  try {
    const shardReports = await extractReports(dir, shardFiles, resourceDir);
    const events = mergeEvents(shardReports);
    patchAttachmentPaths(events, resourceDir);

    const reporters = await createReporters(config, 'merge', reporterDescriptions);
    const receiver = new TeleReporterReceiver(path.sep, new Multiplexer(reporters));
    for (const event of events)
      await receiver.dispatch(event);
  } finally {
    await removeFolders([resourceDir]);
  }
}

async function extractReports(dir: string, shardFiles: string[], resourceDir: string): Promise<string[]> {
  const reports = [];
  for (const file of shardFiles) {
    const zipFile = new ZipFile(path.join(dir, file));
    const entryNames = await zipFile.entries();
    for (const entryName of entryNames) {
      const content = await zipFile.read(entryName);
      if (entryName.endsWith('report.jsonl')) {
        reports.push(content.toString());
      } else {
        const fileName = path.join(resourceDir, entryName);
        await fs.promises.mkdir(path.dirname(fileName), { recursive: true });
        await fs.promises.writeFile(fileName, content);
      }
    }
  }
  return reports;
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

function parseEvents(reportJsonl: string): JsonEvent[] {
  return reportJsonl.toString().split('\n').filter(line => line.length).map(line => JSON.parse(line)) as JsonEvent[];
}

function mergeEvents(shardReports: string[]) {
  const events: JsonEvent[] = [];
  const beginEvents: JsonEvent[] = [];
  const endEvents: JsonEvent[] = [];
  for (const reportJsonl of shardReports) {
    const parsedEvents = parseEvents(reportJsonl);
    for (const event of parsedEvents) {
      if (event.method === 'onBegin')
        beginEvents.push(event);
      else if (event.method === 'onEnd')
        endEvents.push(event);
      else
        events.push(event);
    }
  }
  return [mergeBeginEvents(beginEvents), ...events, mergeEndEvents(endEvents), { method: 'onExit', params: undefined }];
}

function mergeBeginEvents(beginEvents: JsonEvent[]): JsonEvent {
  if (!beginEvents.length)
    throw new Error('No begin events found');
  const projects: JsonProject[] = [];
  let totalWorkers = 0;
  for (const event of beginEvents) {
    totalWorkers += event.params.config.workers;
    const shardProjects: JsonProject[] = event.params.projects;
    for (const shardProject of shardProjects) {
      const mergedProject = projects.find(p => p.id === shardProject.id);
      if (!mergedProject)
        projects.push(shardProject);
      else
        mergeJsonSuites(shardProject.suites, mergedProject);
    }
  }
  const config = {
    ...beginEvents[0].params.config,
    workers: totalWorkers,
    shard: undefined
  };
  return {
    method: 'onBegin',
    params: {
      config,
      projects,
    }
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
  return files.filter(file => file.endsWith('.zip')).sort();
}
