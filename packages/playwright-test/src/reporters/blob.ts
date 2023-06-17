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
import { ManualPromise, calculateSha1, createGuid } from 'playwright-core/lib/utils';
import { mime } from 'playwright-core/lib/utilsBundle';
import { Readable } from 'stream';
import type { EventEmitter } from 'events';
import type { FullConfig, FullResult, TestResult } from '../../types/testReporter';
import type { Suite } from '../common/test';
import type { JsonAttachment, JsonEvent } from '../isomorphic/teleReceiver';
import { TeleReporterEmitter } from './teleEmitter';
import { yazl } from 'playwright-core/lib/zipBundle';

type BlobReporterOptions = {
  configDir: string;
  outputDir?: string;
};

export type BlobReportMetadata = {
  projectSuffix?: string;
};

export class BlobReporter extends TeleReporterEmitter {
  private _messages: JsonEvent[] = [];
  private _options: BlobReporterOptions;
  private _salt: string;
  private _copyFilePromises = new Set<Promise<void>>();

  private _outputDir!: string;
  private _reportName!: string;

  constructor(options: BlobReporterOptions) {
    super(message => this._messages.push(message), false);
    this._options = options;
    this._salt = createGuid();

    this._messages.push({
      method: 'onBlobReportMetadata',
      params: {
        projectSuffix: process.env.PWTEST_BLOB_SUFFIX,
      }
    });
  }

  printsToStdio() {
    return false;
  }

  override onBegin(config: FullConfig<{}, {}>, suite: Suite): void {
    this._outputDir = path.resolve(this._options.configDir, this._options.outputDir || 'blob-report');
    fs.mkdirSync(path.join(this._outputDir, 'resources'), { recursive: true });
    this._reportName = this._computeReportName(config);
    super.onBegin(config, suite);
  }

  override async onEnd(result: FullResult): Promise<void> {
    await super.onEnd(result);
    const lines = this._messages.map(m => JSON.stringify(m) + '\n');
    const content = Readable.from(lines);

    const zipFile = new yazl.ZipFile();
    const zipFinishPromise = new ManualPromise<undefined>();
    (zipFile as any as EventEmitter).on('error', error => zipFinishPromise.reject(error));
    const zipFileName = path.join(this._outputDir, this._reportName + '.zip');
    zipFile.outputStream.pipe(fs.createWriteStream(zipFileName)).on('close', () => {
      zipFinishPromise.resolve(undefined);
    });
    zipFile.addReadStream(content, this._reportName + '.jsonl');
    zipFile.end();

    await Promise.all([
      ...this._copyFilePromises,
      // Requires Node v14.18.0+
      zipFinishPromise.catch(e => console.error(`Failed to write report ${zipFileName}: ${e}`))
    ]);
  }

  override _serializeAttachments(attachments: TestResult['attachments']): JsonAttachment[] {
    return super._serializeAttachments(attachments).map(attachment => {
      if (!attachment.path || !fs.statSync(attachment.path, { throwIfNoEntry: false })?.isFile())
        return attachment;
      // Add run guid to avoid clashes between shards.
      const sha1 = calculateSha1(attachment.path + this._salt);
      const extension = mime.getExtension(attachment.contentType) || 'dat';
      const newPath = `resources/${sha1}.${extension}`;
      this._startCopyingFile(attachment.path, path.join(this._outputDir, newPath));
      return {
        ...attachment,
        path: newPath,
      };
    });
  }

  private _computeReportName(config: FullConfig) {
    let shardSuffix = '';
    if (config.shard) {
      const paddedNumber = `${config.shard.current}`.padStart(`${config.shard.total}`.length, '0');
      shardSuffix = `${paddedNumber}-of-${config.shard.total}-`;
    }
    return `report-${shardSuffix}${createGuid()}`;
  }

  private _startCopyingFile(from: string, to: string) {
    const copyPromise: Promise<void> = fs.promises.copyFile(from, to)
        .catch(e => { console.error(`Failed to copy file from "${from}" to "${to}": ${e}`); })
        .then(() => { this._copyFilePromises.delete(copyPromise); });
    this._copyFilePromises.add(copyPromise);
  }
}
