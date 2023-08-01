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
import { ManualPromise, calculateSha1, createGuid, removeFolders } from 'playwright-core/lib/utils';
import { mime } from 'playwright-core/lib/utilsBundle';
import { Readable } from 'stream';
import type { EventEmitter } from 'events';
import type { FullConfig, FullResult, TestCase, TestResult } from '../../types/testReporter';
import type { JsonAttachment, JsonEvent } from '../isomorphic/teleReceiver';
import { TeleReporterEmitter } from './teleEmitter';
import { yazl } from 'playwright-core/lib/zipBundle';
import { resolveReporterOutputPath } from '../util';

type BlobReporterOptions = {
  configDir: string;
  outputDir?: string;
};

export type BlobReportMetadata = {
  projectSuffix?: string;
  shard?: { total: number, current: number };
};

export class BlobReporter extends TeleReporterEmitter {
  private readonly _messages: JsonEvent[] = [];
  private readonly _options: BlobReporterOptions;
  private readonly _salt: string;

  private readonly _reportName: string;
  private readonly _zipFile = new yazl.ZipFile();
  private readonly _zipFinishPromise = new ManualPromise<undefined>();
  private _preserveOutput!: FullConfig['preserveOutput'];

  constructor(options: BlobReporterOptions) {
    super(message => this._messages.push(message), false);
    this._options = options;
    this._salt = createGuid();
    this._reportName = `report-${createGuid()}`;
  }

  override onConfigure(config: FullConfig) {
    const metadata: BlobReportMetadata = {
      projectSuffix: process.env.PWTEST_BLOB_SUFFIX,
      shard: config.shard ? config.shard : undefined,
    };
    this._messages.push({
      method: 'onBlobReportMetadata',
      params: metadata
    });

    (this._zipFile as any as EventEmitter).on('error', error => this._zipFinishPromise.reject(error));
    const outputDir = resolveReporterOutputPath('blob-report', this._options.configDir, this._options.outputDir);
    const removePromise = process.env.PWTEST_BLOB_DO_NOT_REMOVE ? Promise.resolve() : removeFolders([outputDir]);
    removePromise.then(() => fs.promises.mkdir(outputDir, { recursive: true })).then(() => {
      const zipFileName = path.join(outputDir, this._reportName + '.zip');
      // pipe() can be called at any time on the stream, so it's ok to do it asynchronously
      // when some entries may have already been added.
      this._zipFile.outputStream.pipe(fs.createWriteStream(zipFileName)).on('close', () => {
        this._zipFinishPromise.resolve(undefined);
      }).on('error', error => this._zipFinishPromise.reject(error));
    }).catch(error => this._zipFinishPromise.reject(error));

    this._preserveOutput = config.preserveOutput;

    super.onConfigure(config);
  }

  override async onEnd(result: FullResult): Promise<void> {
    await super.onEnd(result);
    const lines = this._messages.map(m => JSON.stringify(m) + '\n');
    const content = Readable.from(lines);

    this._zipFile.addReadStream(content, this._reportName + '.jsonl');
    this._zipFile.end();

    await this._zipFinishPromise.catch(e => {
      throw new Error(`Failed to write report ${this._reportName + '.zip'}: ` + e.message);
    });
  }

  override _serializeAttachments(test: TestCase, result: TestResult): JsonAttachment[] {
    const isFailure = result.status !== 'skipped' && result.status !== test.expectedStatus;
    // Do not add attachments to zip if output is not preserved as they may be deleted
    // before the zip is written.
    const preserveOutput = this._preserveOutput === 'always' || (this._preserveOutput === 'failures-only' && isFailure);
    return super._serializeAttachments(test, result).map(attachment => {
      // Do not add attachments to zip if output is not preserved, they may be deleted
      // before the zip is written.
      if (!preserveOutput)
        return attachment;
      if (!attachment.path || !fs.statSync(attachment.path, { throwIfNoEntry: false })?.isFile())
        return attachment;
      // Add run guid to avoid clashes between shards.
      const sha1 = calculateSha1(attachment.path + this._salt);
      const extension = mime.getExtension(attachment.contentType) || 'dat';
      const newPath = `resources/${sha1}.${extension}`;
      this._zipFile.addFile(attachment.path, newPath);
      return {
        ...attachment,
        path: newPath,
      };
    });
  }
}
