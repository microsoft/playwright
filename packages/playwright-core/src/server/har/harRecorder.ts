/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import path from 'path';
import { Artifact } from '../artifact';
import type { BrowserContext } from '../browserContext';
import type * as har from './har';
import { HarTracer } from './harTracer';
import type * as channels from '../../protocol/channels';
import { yazl } from '../../zipBundle';
import type { ZipFile } from '../../zipBundle';
import { ManualPromise } from '../../utils/manualPromise';
import type EventEmitter from 'events';
import { createGuid } from '../../utils';

export class HarRecorder {
  private _artifact: Artifact;
  private _isFlushed: boolean = false;
  private _tracer: HarTracer;
  private _entries: har.Entry[] = [];
  private _zipFile: ZipFile | null = null;

  constructor(context: BrowserContext, options: channels.RecordHarOptions) {
    this._artifact = new Artifact(context, path.join(context._browser.options.artifactsDir, `${createGuid()}.har`));
    const urlFilterRe = options.urlRegexSource !== undefined && options.urlRegexFlags !== undefined ? new RegExp(options.urlRegexSource, options.urlRegexFlags) : undefined;
    const expectsZip = options.path.endsWith('.zip');
    const content = options.content || (expectsZip ? 'attach' : 'embed');
    this._tracer = new HarTracer(context, this, {
      content,
      waitForContentOnStop: true,
      skipScripts: false,
      urlFilter: urlFilterRe ?? options.urlGlob,
    });
    this._zipFile = content === 'attach' || expectsZip ? new yazl.ZipFile() : null;
    this._tracer.start();
  }

  onEntryStarted(entry: har.Entry) {
    this._entries.push(entry);
  }

  onEntryFinished(entry: har.Entry) {
  }

  onContentBlob(sha1: string, buffer: Buffer) {
    if (this._zipFile)
      this._zipFile!.addBuffer(buffer, sha1);
  }

  async flush() {
    if (this._isFlushed)
      return;
    this._isFlushed = true;
    await this._tracer.flush();

    const log = this._tracer.stop();
    log.entries = this._entries;

    const harFileContent = JSON.stringify({ log }, undefined, 2);

    if (this._zipFile) {
      const result = new ManualPromise<void>();
      (this._zipFile as unknown as EventEmitter).on('error', error => result.reject(error));
      this._zipFile.addBuffer(Buffer.from(harFileContent, 'utf-8'), 'har.har');
      this._zipFile.end();
      this._zipFile.outputStream.pipe(fs.createWriteStream(this._artifact.localPath())).on('close', () => {
        result.resolve();
      });
      await result;
    } else {
      await fs.promises.writeFile(this._artifact.localPath(), harFileContent);
    }
  }

  async export(): Promise<Artifact> {
    await this.flush();
    this._artifact.reportFinished();
    return this._artifact;
  }
}
