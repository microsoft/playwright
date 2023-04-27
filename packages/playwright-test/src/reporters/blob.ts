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
import { ManualPromise, calculateSha1 } from 'playwright-core/lib/utils';
import { mime } from 'playwright-core/lib/utilsBundle';
import { yazl } from 'playwright-core/lib/zipBundle';
import { Readable } from 'stream';
import type { FullConfig, FullResult, TestResult } from '../../types/testReporter';
import type { Suite } from '../common/test';
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
    const outputDir = path.resolve(this._options.configDir, this._options.outputDir || '');
    let shardSuffix = '';
    if (config.shard) {
      const paddedNumber = `${config.shard.current}`.padStart(`${config.shard.total}`.length, '0');
      shardSuffix = `-${paddedNumber}-of-${config.shard.total}`;
    }
    return path.join(outputDir, `report${shardSuffix}.zip`);
  }
}
