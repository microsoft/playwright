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
import { BrowserContext } from '../../browserContext';
import * as har from './har';
import { HarTracer } from './harTracer';

type HarOptions = {
  path: string;
  omitContent?: boolean;
};

export class HarRecorder {
  private _options: HarOptions;
  private _tracer: HarTracer;
  private _pages: har.Page[] = [];
  private _entries: har.Entry[] = [];
  private _context: BrowserContext;

  constructor(context: BrowserContext, options: HarOptions) {
    this._options = options;
    this._context = context;
    this._tracer = new HarTracer(context, this, {
      content: options.omitContent ? 'omit' : 'embedded',
      waitOnFlush: true,
    });
  }

  onPageEntry(entry: har.Page) {
    this._pages.push(entry);
  }

  onEntryStarted(entry: har.Entry) {
    this._entries.push(entry);
  }

  onEntryFinished(entry: har.Entry) {
  }

  onBlob(sha1: string, buffer: Buffer) {
  }

  async flush() {
    await this._tracer.flush();

    const log: har.Log = {
      version: '1.2',
      creator: {
        name: 'Playwright',
        version: require('../../../../package.json')['version'],
      },
      browser: {
        name: this._context._browser.options.name,
        version: this._context._browser.version()
      },
      pages: this._pages,
      entries: this._entries,
    };
    log.pages.forEach(pageEntry => this._tracer.fixupPageEntry(pageEntry));
    await fs.promises.writeFile(this._options.path, JSON.stringify({ log }, undefined, 2));
  }
}
