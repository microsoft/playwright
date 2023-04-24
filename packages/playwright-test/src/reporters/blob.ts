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
import { ManualPromise, ZipFile, calculateSha1, removeFolders } from 'playwright-core/lib/utils';
import { mime } from 'playwright-core/lib/utilsBundle';
import { yazl } from 'playwright-core/lib/zipBundle';
import { Readable } from 'stream';
import type { FullConfig, FullResult, Reporter, TestResult } from '../../types/testReporter';
import type { BuiltInReporter, FullConfigInternal } from '../common/config';
import type { Suite } from '../common/test';
import { TeleReporterReceiver, type JsonEvent, type JsonProject, type JsonSuite, type JsonTestResultEnd } from '../isomorphic/teleReceiver';
import DotReporter from '../reporters/dot';
import EmptyReporter from '../reporters/empty';
import GitHubReporter from '../reporters/github';
import JSONReporter from '../reporters/json';
import JUnitReporter from '../reporters/junit';
import LineReporter from '../reporters/line';
import ListReporter from '../reporters/list';
import { loadReporter } from '../runner/loadUtils';
import HtmlReporter, { defaultReportFolder } from './html';
import { TeleReporterEmitter } from './teleEmitter';


type BlobReporterOptions = {
  configDir: string;
  outputDir?: string;
};

export class BlobReporter extends TeleReporterEmitter {
  private _messages: any[] = [];
  private _options: BlobReporterOptions;

  private readonly _zipFile = new yazl.ZipFile();
  private readonly _zipFinishPromise = new ManualPromise<undefined>();

  constructor(options: BlobReporterOptions) {
    super(message => this._messages.push(message));
    this._options = options;
  }

  override onBegin(config: FullConfig<{}, {}>, suite: Suite): void {
    super.onBegin(config, suite);
    this._initializeZipFile(config);
  }

  override async onEnd(result: FullResult): Promise<void> {
    await super.onEnd(result);
    const lines = this._messages.map(m => JSON.stringify(m) + '\n');
    const content = Readable.from(lines);
    this._zipFile.addReadStream(content, 'report.jsonl');
    this._zipFile.end();
    await this._zipFinishPromise;
  }

  override _serializeAttachments(attachments: TestResult['attachments']): TestResult['attachments'] {
    return attachments.map(attachment => {
      if (!attachment.path || !fs.statSync(attachment.path).isFile())
        return attachment;
      const sha1 = calculateSha1(attachment.path);
      const extension = mime.getExtension(attachment.contentType) || 'dat';
      const newPath = `resources/${sha1}.${extension}`;
      this._zipFile.addFile(attachment.path, newPath);
      return {
        ...attachment,
        path: newPath,
      };
    });
  }

  private _initializeZipFile(config: FullConfig) {
    (this._zipFile as any as EventEmitter).on('error', error => this._zipFinishPromise.reject(error));
    const zipFileName = this._computeOutputFileName(config);
    fs.mkdirSync(path.dirname(zipFileName), { recursive: true });
    this._zipFile.outputStream.pipe(fs.createWriteStream(zipFileName)).on('close', () => {
      this._zipFinishPromise.resolve(undefined);
    });
  }

  private _computeOutputFileName(config: FullConfig) {
    const outputDir = this._resolveOutputDir();
    let shardSuffix = '';
    if (config.shard) {
      const paddedNumber = `${config.shard.current}`.padStart(`${config.shard.total}`.length, '0');
      shardSuffix = `-${paddedNumber}-of-${config.shard.total}`;
    }
    return path.join(outputDir, `report${shardSuffix}.zip`);
  }

  private _resolveOutputDir(): string {
    const { outputDir } = this._options;
    if (outputDir)
      return path.resolve(this._options.configDir, outputDir);
    return defaultReportFolder(this._options.configDir);
  }
}

export async function createMergedReport(config: FullConfigInternal, dir: string, reporterName?: string) {
  const shardFiles = await sortedShardFiles(dir);
  const resourceDir = path.join(dir, 'temp');
  await fs.promises.mkdir(resourceDir, { recursive: true });
  try {
    const shardReports = await extractReports(dir, shardFiles, resourceDir);
    const events = mergeEvents(shardReports);
    patchAttachmentPaths(events, resourceDir);

    const defaultReporters: {[key in BuiltInReporter]: new(arg: any) => Reporter} = {
      dot: DotReporter,
      line: LineReporter,
      list: ListReporter,
      github: GitHubReporter,
      json: JSONReporter,
      junit: JUnitReporter,
      null: EmptyReporter,
      html: HtmlReporter,
      blob: BlobReporter,
    };
    reporterName ??= 'list';

    const arg = config.config.reporter.find(([reporter, arg]) => reporter === reporterName)?.[1];
    const options = {
      ...arg,
      configDir: process.cwd(),
      outputFolder: path.join(dir, 'merged-report')
    };

    let reporter: Reporter | undefined;
    if (reporterName in defaultReporters) {
      reporter = new defaultReporters[reporterName as keyof typeof defaultReporters](options);
    } else {
      const reporterConstructor = await loadReporter(config, reporterName);
      reporter = new reporterConstructor(options);
    }

    const receiver = new TeleReporterReceiver(path.sep, reporter);
    for (const event of events)
      await receiver.dispatch(event);
  } finally {
    await removeFolders([resourceDir]);
  }
  console.log(`Done.`);
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

function patchAttachmentPaths(events: JsonEvent[], rootDir: string) {
  for (const event of events) {
    if (event.method !== 'onTestEnd')
      continue;
    for (const attachment of (event.params.result as JsonTestResultEnd).attachments) {
      if (!attachment.path)
        continue;

      attachment.path = path.join(rootDir, attachment.path);
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
      // TODO: show remaining events?
      if (event.method === 'onError')
        throw new Error('Error in shard');
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
