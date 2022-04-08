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
import type { APIRequestContext } from '../fetch';
import { Artifact } from '../artifact';
import type { BrowserContext } from '../browserContext';
import type * as har from './har';
import { HarTracer } from './harTracer';

type HarOptions = {
  path: string;
  omitContent?: boolean;
};

export class HarRecorder {
  private _artifact: Artifact;
  private _isFlushed: boolean = false;
  private _options: HarOptions;
  private _tracer: HarTracer;
  private _entries: har.Entry[] = [];

  constructor(context: BrowserContext | APIRequestContext, options: HarOptions) {
    this._artifact = new Artifact(context, options.path);
    this._options = options;
    this._tracer = new HarTracer(context, this, {
      content: options.omitContent ? 'omit' : 'embedded',
      waitForContentOnStop: true,
      skipScripts: false,
    });
    this._tracer.start();
  }

  onEntryStarted(entry: har.Entry) {
    this._entries.push(entry);
  }

  onEntryFinished(entry: har.Entry) {
  }

  onContentBlob(sha1: string, buffer: Buffer) {
  }

  async flush() {
    if (this._isFlushed)
      return;
    this._isFlushed = true;
    await this._tracer.flush();
    const log = this._tracer.stop();
    log.entries = this._entries;
    await fs.promises.writeFile(this._options.path, JSON.stringify({ log }, undefined, 2));
  }

  async export(): Promise<Artifact> {
    await this.flush();
    this._artifact.reportFinished();
    return this._artifact;
  }
}
