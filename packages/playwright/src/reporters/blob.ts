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
import { ManualPromise, calculateSha1, createGuid, getUserAgent, removeFolders, sanitizeForFilePath } from 'playwright-core/lib/utils';
import { mime } from 'playwright-core/lib/utilsBundle';
import { Readable } from 'stream';
import type { EventEmitter } from 'events';
import type { FullConfig, FullResult, TestResult } from '../../types/testReporter';
import type { JsonAttachment, JsonEvent } from '../isomorphic/teleReceiver';
import { TeleReporterEmitter } from './teleEmitter';
import { yazl } from 'playwright-core/lib/zipBundle';
import { resolveOutputFile } from './base';

type BlobReporterOptions = {
  configDir: string;
  outputDir?: string;
  fileName?: string;
  outputFile?: string;
  _commandHash: string;
};

export const currentBlobReportVersion = 2;

export type BlobReportMetadata = {
  version: number;
  userAgent: string;
  name?: string;
  shard?: { total: number, current: number };
  pathSeparator?: string;
};

export class BlobReporter extends TeleReporterEmitter {
  private readonly _messages: JsonEvent[] = [];
  private readonly _attachments: { originalPath: string, zipEntryPath: string }[] = [];
  private readonly _options: BlobReporterOptions;
  private readonly _salt: string;
  private _config!: FullConfig;

  constructor(options: BlobReporterOptions) {
    super(message => this._messages.push(message));
    this._options = options;
    if (this._options.fileName && !this._options.fileName.endsWith('.zip'))
      throw new Error(`Blob report file name must end with .zip extension: ${this._options.fileName}`);
    this._salt = createGuid();
  }

  override onConfigure(config: FullConfig) {
    const metadata: BlobReportMetadata = {
      version: currentBlobReportVersion,
      userAgent: getUserAgent(),
      name: process.env.PWTEST_BOT_NAME,
      shard: config.shard ?? undefined,
      pathSeparator: path.sep,
    };
    this._messages.push({
      method: 'onBlobReportMetadata',
      params: metadata
    });

    this._config = config;
    super.onConfigure(config);
  }

  override async onEnd(result: FullResult): Promise<void> {
    await super.onEnd(result);

    const zipFileName = await this._prepareOutputFile();

    const zipFile = new yazl.ZipFile();
    const zipFinishPromise = new ManualPromise<undefined>();
    const finishPromise = zipFinishPromise.catch(e => {
      throw new Error(`Failed to write report ${zipFileName}: ` + e.message);
    });

    (zipFile as any as EventEmitter).on('error', error => zipFinishPromise.reject(error));
    zipFile.outputStream.pipe(fs.createWriteStream(zipFileName)).on('close', () => {
      zipFinishPromise.resolve(undefined);
    }).on('error', error => zipFinishPromise.reject(error));

    for (const { originalPath, zipEntryPath } of this._attachments) {
      if (!fs.statSync(originalPath, { throwIfNoEntry: false })?.isFile())
        continue;
      zipFile.addFile(originalPath, zipEntryPath);
    }

    const lines = this._messages.map(m => JSON.stringify(m) + '\n');
    const content = Readable.from(lines);
    zipFile.addReadStream(content, 'report.jsonl');
    zipFile.end();

    await finishPromise;
  }

  private async _prepareOutputFile() {
    const { outputFile, outputDir } = resolveOutputFile('BLOB', {
      ...this._options,
      default: {
        fileName: this._defaultReportName(this._config),
        outputDir: 'blob-report',
      }
    })!;
    if (!process.env.PWTEST_BLOB_DO_NOT_REMOVE)
      await removeFolders([outputDir!]);
    await fs.promises.mkdir(path.dirname(outputFile), { recursive: true });
    return outputFile;
  }

  private _defaultReportName(config: FullConfig) {
    let reportName = 'report';
    if (this._options._commandHash)
      reportName += '-' + sanitizeForFilePath(this._options._commandHash);
    if (config.shard) {
      const paddedNumber = `${config.shard.current}`.padStart(`${config.shard.total}`.length, '0');
      reportName = `${reportName}-${paddedNumber}`;
    }
    return `${reportName}.zip`;
  }

  override _serializeAttachments(attachments: TestResult['attachments']): JsonAttachment[] {
    return super._serializeAttachments(attachments).map(attachment => {
      if (!attachment.path)
        return attachment;
      // Add run guid to avoid clashes between shards.
      const sha1 = calculateSha1(attachment.path + this._salt);
      const extension = mime.getExtension(attachment.contentType) || 'dat';
      const newPath = `resources/${sha1}.${extension}`;
      this._attachments.push({ originalPath: attachment.path, zipEntryPath: newPath });
      return {
        ...attachment,
        path: newPath,
      };
    });
  }
}
