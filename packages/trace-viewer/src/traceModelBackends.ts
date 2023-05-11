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

import type zip from '@zip.js/zip.js';
// @ts-ignore
import zipImport from '@zip.js/zip.js/dist/zip-no-worker-inflate.min.js';
import type { TraceModelBackend } from './traceModel';

const zipjs = zipImport as typeof zip;

type Progress = (done: number, total: number) => void;

export class ZipTraceModelBackend implements TraceModelBackend {
  private _zipReader: zip.ZipReader;
  private _entriesPromise: Promise<Map<string, zip.Entry>>;
  private _traceURL: string;

  constructor(traceURL: string, progress: Progress) {
    this._traceURL = traceURL;
    this._zipReader = new zipjs.ZipReader(
        new zipjs.HttpReader(formatUrl(traceURL), { mode: 'cors', preventHeadRequest: true } as any),
        { useWebWorkers: false }) as zip.ZipReader;
    this._entriesPromise = this._zipReader.getEntries({ onprogress: progress }).then(entries => {
      const map = new Map<string, zip.Entry>();
      for (const entry of entries)
        map.set(entry.filename, entry);
      return map;
    });
  }

  isLive() {
    return false;
  }

  traceURL() {
    return this._traceURL;
  }

  async entryNames(): Promise<string[]> {
    const entries = await this._entriesPromise;
    return [...entries.keys()];
  }

  async hasEntry(entryName: string): Promise<boolean> {
    const entries = await this._entriesPromise;
    return entries.has(entryName);
  }

  async readText(entryName: string): Promise<string | undefined> {
    const entries = await this._entriesPromise;
    const entry = entries.get(entryName);
    if (!entry)
      return;
    const writer = new zipjs.TextWriter();
    await entry.getData?.(writer);
    return writer.getData();
  }

  async readBlob(entryName: string): Promise<Blob | undefined> {
    const entries = await this._entriesPromise;
    const entry = entries.get(entryName);
    if (!entry)
      return;
    const writer = new zipjs.BlobWriter() as zip.BlobWriter;
    await entry.getData!(writer);
    return writer.getData();
  }
}

export class FetchTraceModelBackend implements TraceModelBackend {
  private _entriesPromise: Promise<Map<string, string>>;
  private _traceURL: string;

  constructor(traceURL: string) {
    this._traceURL = traceURL;
    this._entriesPromise = fetch('/trace/file?path=' + encodeURI(traceURL)).then(async response => {
      const json = JSON.parse(await response.text());
      const entries = new Map<string, string>();
      for (const entry of json.entries)
        entries.set(entry.name, entry.path);
      return entries;
    });
  }

  isLive() {
    return true;
  }

  traceURL(): string {
    return this._traceURL;
  }

  async entryNames(): Promise<string[]> {
    const entries = await this._entriesPromise;
    return [...entries.keys()];
  }

  async hasEntry(entryName: string): Promise<boolean> {
    const entries = await this._entriesPromise;
    return entries.has(entryName);
  }

  async readText(entryName: string): Promise<string | undefined> {
    const response = await this._readEntry(entryName);
    return response?.text();
  }

  async readBlob(entryName: string): Promise<Blob | undefined> {
    const response = await this._readEntry(entryName);
    return response?.blob();
  }

  private async _readEntry(entryName: string): Promise<Response | undefined> {
    const entries = await this._entriesPromise;
    const fileName = entries.get(entryName);
    if (!fileName)
      return;
    return fetch('/trace/file?path=' + encodeURI(fileName));
  }
}

function formatUrl(trace: string) {
  let url = trace.startsWith('http') || trace.startsWith('blob') ? trace : `file?path=${trace}`;
  // Dropbox does not support cors.
  if (url.startsWith('https://www.dropbox.com/'))
    url = 'https://dl.dropboxusercontent.com/' + url.substring('https://www.dropbox.com/'.length);
  return url;
}
