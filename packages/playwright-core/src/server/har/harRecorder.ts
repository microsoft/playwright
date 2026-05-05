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

import path from 'path';

import { SerializedFS } from '@utils/serializedFS';
import { Artifact } from '../artifact';
import { HarTracer } from './harTracer';

import type { APIRequestContext } from '../fetch';
import type { BrowserContext } from '../browserContext';
import type { HarTracerDelegate } from './harTracer';
import type { Page } from '../page';
import type { NameValue } from '@isomorphic/types';
import type * as channels from '@protocol/channels';
import type * as har from '@trace/har';

export class HarRecorder implements HarTracerDelegate {
  private _context: BrowserContext | APIRequestContext;
  private _fs = new SerializedFS();
  private _harFilePath: string;
  private _resourcesDir: string;
  private _isFlushed: boolean = false;
  private _tracer: HarTracer;
  private _entries: har.Entry[] = [];
  private _writtenContentEntries = new Set<string>();

  constructor(context: BrowserContext | APIRequestContext, fallbackDir: string, harId: string, page: Page | null, options: channels.RecordHarOptions) {
    this._context = context;
    const isServer = !!context.attribution.playwright.options.isServer;
    this._harFilePath = !isServer && options.harPath ? options.harPath : path.join(fallbackDir, `${harId}.har`);
    if (!isServer && options.resourcesDir)
      this._resourcesDir = options.resourcesDir;
    else if (!isServer && options.harPath)
      this._resourcesDir = path.dirname(options.harPath);
    else
      this._resourcesDir = path.join(fallbackDir, `${harId}-resources`);
    const urlFilterRe = options.urlRegexSource !== undefined && options.urlRegexFlags !== undefined ? new RegExp(options.urlRegexSource, options.urlRegexFlags) : undefined;
    const content = options.content || 'embed';
    this._tracer = new HarTracer(context, page, this, {
      content,
      slimMode: options.mode === 'minimal',
      includeTraceInfo: false,
      recordRequestOverrides: true,
      waitForContentOnStop: true,
      urlFilter: urlFilterRe ?? options.urlGlob,
    });
    this._tracer.start({ omitScripts: false });
  }

  onEntryStarted(entry: har.Entry) {
    this._entries.push(entry);
  }

  onEntryFinished(entry: har.Entry) {
  }

  onContentBlob(sha1: string, buffer: Buffer) {
    if (this._writtenContentEntries.has(sha1))
      return;
    if (!this._writtenContentEntries.size)
      this._fs.mkdir(this._resourcesDir);
    this._writtenContentEntries.add(sha1);
    this._fs.writeFile(path.join(this._resourcesDir, sha1), buffer, true /* skipIfExists */);
  }

  private async _flush() {
    if (this._isFlushed)
      return;
    this._isFlushed = true;
    await this._tracer.flush();

    const log = this._tracer.stop();
    log.entries = this._entries;

    this._fs.mkdir(path.dirname(this._harFilePath));
    // Stream the HAR field-by-field and entry-by-entry so the document is
    // never held in memory in one piece - it can exceed V8's ~512MB string
    // length limit.
    const file = this._harFilePath;
    this._fs.writeFile(file, '');
    this._fs.appendFile(file, '{"log":{"version":' + JSON.stringify(log.version));
    this._fs.appendFile(file, ',"creator":' + JSON.stringify(log.creator));
    if (log.browser)
      this._fs.appendFile(file, ',"browser":' + JSON.stringify(log.browser));
    if (log.pages) {
      this._fs.appendFile(file, ',"pages":[');
      for (let i = 0; i < log.pages.length; i++) {
        if (i)
          this._fs.appendFile(file, ',');
        this._fs.appendFile(file, JSON.stringify(log.pages[i]));
      }
      this._fs.appendFile(file, ']');
    }
    this._fs.appendFile(file, ',"entries":[');
    for (let i = 0; i < log.entries.length; i++) {
      if (i)
        this._fs.appendFile(file, ',');
      this._fs.appendFile(file, JSON.stringify(log.entries[i]));
    }
    this._fs.appendFile(file, ']');
    if (log.comment !== undefined)
      this._fs.appendFile(file, ',"comment":' + JSON.stringify(log.comment));
    this._fs.appendFile(file, '}}', true /* flush */);
  }

  async flush() {
    await this._flush();
    const error = await this._fs.syncAndGetError();
    if (error)
      throw error;
  }

  async export(mode: 'archive' | 'entries'): Promise<{ entries?: NameValue[], artifact?: Artifact }> {
    await this._flush();
    const entries: NameValue[] = [{ name: 'har.har', value: this._harFilePath }];
    for (const sha1 of this._writtenContentEntries)
      entries.push({ name: sha1, value: path.join(this._resourcesDir, sha1) });
    const zipPath = this._harFilePath + '.zip';
    if (mode === 'archive')
      this._fs.zip(entries, zipPath);
    const error = await this._fs.syncAndGetError();
    if (error)
      throw error;
    if (mode === 'entries')
      return { entries };
    const artifact = new Artifact(this._context, zipPath);
    artifact.reportFinished();
    return { artifact };
  }
}
