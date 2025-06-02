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
import { HarTracer } from './harTracer';
import { createGuid } from '../utils/crypto';
import { ManualPromise } from '../../utils/isomorphic/manualPromise';
import { yazl } from '../../zipBundle';

import type { BrowserContext } from '../browserContext';
import type { HarTracerDelegate } from './harTracer';
import type { ZipFile } from '../../zipBundle';
import type { Page } from '../page';
import type * as channels from '@protocol/channels';
import type * as har from '@trace/har';
import type EventEmitter from 'events';

export class HarRecorder implements HarTracerDelegate {
  private _artifact: Artifact;
  private _isFlushed: boolean = false;
  private _tracer: HarTracer;
  private _entries: har.Entry[] = [];
  private _zipFile: ZipFile | null = null;
  private _writtenZipEntries = new Set<string>();

  constructor(context: BrowserContext, page: Page | null, options: channels.RecordHarOptions) {
    this._artifact = new Artifact(context, path.join(context._browser.options.artifactsDir, `${createGuid()}.har`));
    const urlFilterRe = options.urlRegexSource !== undefined && options.urlRegexFlags !== undefined ? new RegExp(options.urlRegexSource, options.urlRegexFlags) : undefined;
    const expectsZip = !!options.zip;
    const content = options.content || (expectsZip ? 'attach' : 'embed');
    this._tracer = new HarTracer(context, page, this, {
      content,
      slimMode: options.mode === 'minimal',
      includeTraceInfo: false,
      recordRequestOverrides: true,
      waitForContentOnStop: true,
      urlFilter: urlFilterRe ?? options.urlGlob,
    });
    this._zipFile = content === 'attach' || expectsZip ? new yazl.ZipFile() : null;
    this._tracer.start({ omitScripts: false });
  }

  onEntryStarted(entry: har.Entry) {
    this._entries.push(entry);
  }

  onEntryFinished(entry: har.Entry) {
  }

  onContentBlob(sha1: string, buffer: Buffer) {
    if (!this._zipFile || this._writtenZipEntries.has(sha1))
      return;
    this._writtenZipEntries.add(sha1);
    this._zipFile!.addBuffer(buffer, sha1);
  }

  async flush() {
    if (this._isFlushed)
      return;
    this._isFlushed = true;
    await this._tracer.flush();

    const log = this._tracer.stop();
    log.entries = this._entries;

    const harFileContent = jsonStringify({ log });

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

function jsonStringify(object: any): string {
  const tokens: string[] = [];
  innerJsonStringify(object, tokens, '', false, undefined);
  return tokens.join('');
}

function innerJsonStringify(object: any, tokens: string[], indent: string, flat: boolean, parentKey: string | undefined) {
  if (typeof object !== 'object' || object === null) {
    tokens.push(JSON.stringify(object));
    return;
  }

  const isArray = Array.isArray(object);
  if (!isArray && object.constructor.name !== 'Object') {
    tokens.push(JSON.stringify(object));
    return;
  }

  const entries = isArray ? object : Object.entries(object).filter(e => e[1] !== undefined);
  if (!entries.length) {
    tokens.push(isArray ? `[]` : `{}`);
    return;
  }

  const childIndent = `${indent}  `;
  let brackets: { open: string, close: string };
  if (isArray)
    brackets = flat ? { open: '[', close: ']' } : { open: `[\n${childIndent}`, close: `\n${indent}]` };
  else
    brackets = flat ? { open: '{ ', close: ' }' } : { open: `{\n${childIndent}`, close: `\n${indent}}` };

  tokens.push(brackets.open);

  for (let i = 0; i < entries.length; ++i) {
    const entry = entries[i];
    if (i)
      tokens.push(flat ? `, ` : `,\n${childIndent}`);
    if (!isArray)
      tokens.push(`${JSON.stringify(entry[0])}: `);
    const key = isArray ? undefined : entry[0];
    const flatten = flat || key === 'timings' || parentKey === 'headers';
    innerJsonStringify(isArray ? entry : entry[1], tokens, childIndent, flatten, key);
  }

  tokens.push(brackets.close);
}
