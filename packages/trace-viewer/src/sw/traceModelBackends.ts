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
import * as zipImport from '@zip.js/zip.js/lib/zip-no-worker-inflate.js';
import type { TraceModelBackend } from './traceModel';

const zipjs = zipImport as typeof zip;

type Progress = (done: number, total: number) => undefined;

export class ZipTraceModelBackend implements TraceModelBackend {
  private _zipReader: zip.ZipReader<unknown>;
  private _entriesPromise: Promise<Map<string, zip.Entry>>;
  private _traceURL: string;

  constructor(traceURL: string, progress: Progress) {
    this._traceURL = traceURL;
    this._zipReader = new zipjs.ZipReader(
        new zipjs.HttpReader(formatTraceFileUrl(traceURL), { mode: 'cors', preventHeadRequest: true } as any),
        { useWebWorkers: false });
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
    this._entriesPromise = fetch(formatTraceFileUrl(traceURL)).then(async response => {
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
    return response?.status === 200 ? await response?.blob() : undefined;
  }

  private async _readEntry(entryName: string): Promise<Response | undefined> {
    const entries = await this._entriesPromise;
    const fileName = entries.get(entryName);
    if (!fileName)
      return;

    return fetch(formatTraceFileUrl(fileName));
  }
}

const baseURL = new URL(self.location.href);
baseURL.port = baseURL.searchParams.get('testServerPort') ?? baseURL.port;

function formatTraceFileUrl(trace: string) {
  if (trace.startsWith('https://www.dropbox.com/'))
    return 'https://dl.dropboxusercontent.com/' + trace.substring('https://www.dropbox.com/'.length);

  if (trace.startsWith('http') || trace.startsWith('blob'))
    return trace;

  const url = new URL('/trace/file', baseURL);
  url.searchParams.set('path', trace);
  return url.toString();
}
