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
import { TeleReporterReceiver, type JsonEvent, type JsonProject, type JsonSuite, type JsonTestResultEnd, type JsonConfig } from '../isomorphic/teleReceiver';
import { createReporters } from '../runner/reporters';
import { Multiplexer } from './multiplexer';

export async function createMergedReport(config: FullConfigInternal, dir: string, reporterDescriptions: ReporterDescription[], resolvePaths: boolean) {
  const shardFiles = await sortedShardFiles(dir);
  const events = await mergeEvents(dir, shardFiles);
  if (resolvePaths)
    patchAttachmentPaths(events, dir);

  const reporters = await createReporters(config, 'merge', reporterDescriptions);
  const receiver = new TeleReporterReceiver(path.sep, new Multiplexer(reporters), config.config);

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

function parseEvents(reportJsonl: string): JsonEvent[] {
  return reportJsonl.toString().split('\n').filter(line => line.length).map(line => JSON.parse(line)) as JsonEvent[];
}

async function mergeEvents(dir: string, shardReportFiles: string[]) {
  const events: JsonEvent[] = [];
  const beginEvents: JsonEvent[] = [];
  const endEvents: JsonEvent[] = [];
  for (const reportFile of shardReportFiles) {
    const reportJsonl = await fs.promises.readFile(path.join(dir, reportFile), 'utf8');
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
  let config: JsonConfig = {
    configFile: undefined,
    globalTimeout: 0,
    maxFailures: 0,
    metadata: {},
    rootDir: '',
    version: '',
    workers: 0,
    listOnly: false
  };
  for (const event of beginEvents) {
    config = mergeConfigs(config, event.params.config);
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
      config,
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
  return files.filter(file => file.endsWith('.jsonl')).sort();
}
