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
import { calculateSha1, createGuid } from 'playwright-core/lib/utils';
import { mime } from 'playwright-core/lib/utilsBundle';
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
  private _salt: string;
  private _copyFilePromises = new Set<Promise<void>>();

  private _outputDir!: string;
  private _reportFile!: string;

  constructor(options: BlobReporterOptions) {
    super(message => this._messages.push(message));
    this._options = options;
    this._salt = createGuid();
  }

  printsToStdio() {
    return false;
  }

  override onBegin(config: FullConfig<{}, {}>, suite: Suite): void {
    this._outputDir = path.resolve(this._options.configDir, this._options.outputDir || 'blob-report');
    fs.mkdirSync(path.join(this._outputDir, 'resources'), { recursive: true });
    this._reportFile = this._computeOutputFileName(config);
    super.onBegin(config, suite);
  }

  override async onEnd(result: FullResult): Promise<void> {
    await super.onEnd(result);
    const lines = this._messages.map(m => JSON.stringify(m) + '\n');
    const content = Readable.from(lines);
    await Promise.all([
      ...this._copyFilePromises,
      // Requires Node v14.18.0+
      fs.promises.writeFile(this._reportFile, content as any).catch(e => console.error(`Failed to write report ${this._reportFile}: ${e}`))
    ]);
  }

  override _serializeAttachments(attachments: TestResult['attachments']): TestResult['attachments'] {
    return attachments.map(attachment => {
      if (!attachment.path || !fs.statSync(attachment.path).isFile())
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

  private _computeOutputFileName(config: FullConfig) {
    let shardSuffix = '';
    if (config.shard) {
      const paddedNumber = `${config.shard.current}`.padStart(`${config.shard.total}`.length, '0');
      shardSuffix = `${paddedNumber}-of-${config.shard.total}-`;
    }
    return path.join(this._outputDir, `report-${shardSuffix}${createGuid()}.jsonl`);
  }

  private _startCopyingFile(from: string, to: string) {
    const copyPromise: Promise<void> = fs.promises.copyFile(from, to)
        .catch(e => { console.error(`Failed to copy file from "${from}" to "${to}": ${e}`); })
        .then(() => { this._copyFilePromises.delete(copyPromise); });
    this._copyFilePromises.add(copyPromise);
  }
}
