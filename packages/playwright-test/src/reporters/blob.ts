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

import type { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { ManualPromise, ZipFile } from 'playwright-core/lib/utils';
import { yazl } from 'playwright-core/lib/zipBundle';
import type { FullConfig, FullResult } from '../../types/testReporter';
import type { Suite } from '../common/test';
import type { FullConfigInternal } from '../common/types';
import { type JsonEvent, type JsonProject, type JsonSuite, TeleReporterReceiver } from '../isomorphic/teleReceiver';
import HtmlReporter, { defaultReportFolder } from './html';
import { TeleReporterEmitter } from './teleEmitter';


type BlobReporterOptions = {
  outputDir?: string;
};

export class BlobReporter extends TeleReporterEmitter {
  private _messages: any[] = [];
  private _options: BlobReporterOptions;
  private _outputFile: string | undefined;

  constructor(options: BlobReporterOptions = {}) {
    super(message => this._messages.push(message));
    this._options = options;
  }
  override onBegin(config: FullConfig<{}, {}>, suite: Suite): void {
    super.onBegin(config, suite);
    const outputDir = this._resolveOutputDir(config as FullConfigInternal);
    let shardSuffix = '';
    if (config.shard) {
      const paddedNumber = String(config.shard.current).padStart(String(config.shard.total).length, '0');
      shardSuffix = `-${paddedNumber}-of-${config.shard.total}`;
    }
    this._outputFile = path.join(outputDir, `report${shardSuffix}.zip`);
  }

  override async onEnd(result: FullResult): Promise<void> {
    await super.onEnd(result);
    if (!this._outputFile)
      return;

    const reportString = JSON.stringify(this._messages, undefined, 2);
    fs.mkdirSync(path.dirname(this._outputFile), { recursive: true });
    await zipReport(this._outputFile, reportString);
  }

  private _resolveOutputDir(config: FullConfigInternal): string {
    const { outputDir } = this._options;
    if (outputDir)
      return path.resolve(config._internal.configDir, outputDir);
    return defaultReportFolder(config._internal.configDir);
  }
}

export async function createMergedReport(config: FullConfigInternal, dir: string, reporterName?: string) {
  const shardFiles = await sortedShardFiles(dir);
  console.log(`Merging ${shardFiles}`);
  const events = await mergeEvents(dir, shardFiles);
  console.log(`Writing ${reporterName} report to ${dir}`);

  // TODO: use reporterName.
  const reporter = new HtmlReporter({ _internalResolvedOutputFolder: dir });
  const receiver = new TeleReporterReceiver(path.sep, reporter);
  // TODO: handle onError.
  for (const event of events)
    await receiver.dispatch(event);
  console.log(`Done.`);
}

async function mergeEvents(dir: string, shardFiles: string[]) {
  const events: JsonEvent[] = [];
  const beginEvents: JsonEvent[] = [];
  const endEvents: JsonEvent[] = [];
  for (const file of shardFiles) {
    const zipFile = new ZipFile(path.join(dir, file));
    const entryNames = await zipFile.entries();
    const reportEntryName = entryNames.find(e => e.endsWith('.json'));
    if (!reportEntryName)
      throw new Error(`Zip file ${file} does not contain a .json file`);
    const reportJson = await zipFile.read(reportEntryName);
    const parsedEvents = JSON.parse(reportJson.toString()) as JsonEvent[];
    for (const event of parsedEvents) {
      // TODO: show remaining events?
      if (event.method === 'onError')
        throw new Error('Error in shard: ' + file);
      if (event.method === 'onBegin')
        beginEvents.push(event);
      else if (event.method === 'onEnd')
        endEvents.push(event);
      else
        events.push(event);
    }

  }
  return [mergeBeginEvents(beginEvents), ...events, mergeEndEvents(endEvents)];
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
      config: beginEvents[0].params.config,
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

async function zipReport(zipFileName: string, content: string | Buffer) {
  const zipFile = new yazl.ZipFile();
  const result = new ManualPromise<undefined>();
  (zipFile as any as EventEmitter).on('error', error => result.reject(error));
  zipFile.addBuffer(Buffer.from(content), 'report.json');
  zipFile.end();
  zipFile.outputStream.pipe(fs.createWriteStream(zipFileName)).on('close', () => {
    result.resolve(undefined);
  });
  await result;
}