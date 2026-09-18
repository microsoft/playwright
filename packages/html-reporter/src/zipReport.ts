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

// @ts-ignore
import * as zipImport from '@zip.js/zip.js/lib/zip-no-worker-inflate.js';

import type * as zip from '@zip.js/zip.js';
import type { LoadedReport } from './loadedReport';
// @ts-ignore
const zipjs = zipImport as typeof zip;

// Reads the report data from the base64 zip embedded into the page.
export class ZipReport<T> implements LoadedReport<T> {
  private _entries = new Map<string, zip.Entry>();
  private _json!: T;
  private _templateId: string;
  private _jsonName: string;

  constructor(templateId: string, jsonName: string) {
    this._templateId = templateId;
    this._jsonName = jsonName;
  }

  async load() {
    const template = document.getElementById(this._templateId) as HTMLTemplateElement;
    const zipReader = new zipjs.ZipReader(new zipjs.Data64URIReader(template.content.textContent), { useWebWorkers: false });
    for (const entry of await zipReader.getEntries())
      this._entries.set(entry.filename, entry);
    this._json = await this.entry(this._jsonName) as T;
    // Drop node after consumption
    template.remove();
  }

  json(): T {
    return this._json;
  }

  async entry(name: string): Promise<Object> {
    const reportEntry = this._entries.get(name);
    const writer = new zipjs.TextWriter() as zip.TextWriter;
    await reportEntry!.getData!(writer);
    return JSON.parse(await writer.getData());
  }
}
