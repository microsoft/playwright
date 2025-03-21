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
// @ts-ignore
import * as zipImport from '@zip.js/zip.js/lib/zip-no-worker-inflate.js';

import type * as zip from '@zip.js/zip.js';
import type { TraceModelBackend } from './traceModel';

const zipjs = zipImport as typeof zip;

type Progress = (done: number, total: number) => undefined;

export class ZipTraceModelBackend implements TraceModelBackend {
  private _zipReader: zip.ZipReader<unknown>;
  private _entriesPromise: Promise<Map<string, zip.Entry>>;
  private _traceURL: string;

  constructor(traceURL: string, server: TraceViewerServer, progress: Progress) {
    this._traceURL = traceURL;
    zipjs.configure({ baseURL: self.location.href } as any);
    this._zipReader = new zipjs.ZipReader(
        new zipjs.HttpReader(formatUrl(traceURL, server), { mode: 'cors', preventHeadRequest: true } as any),
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
  private _path: string;
  private _server: TraceViewerServer;

  constructor(path: string, server: TraceViewerServer) {
    this._path  = path;
    this._server = server;
    this._entriesPromise = server.readFile(path).then(async response => {
      if (!response)
        throw new Error('File not found');
      const json = await response.json();
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
    return this._path;
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
    return this._server.readFile(fileName);
  }
}

function formatUrl(trace: string, server: TraceViewerServer) {
  let url = trace.startsWith('http') || trace.startsWith('blob') ? trace : server.getFileURL(trace).toString();
  // Dropbox does not support cors.
  if (url.startsWith('https://www.dropbox.com/'))
    url = 'https://dl.dropboxusercontent.com/' + url.substring('https://www.dropbox.com/'.length);
  return url;
}

export class TraceViewerServer {
  constructor(private readonly baseUrl: URL) {}

  getFileURL(path: string): URL {
    const url = new URL('trace/file', this.baseUrl);
    url.searchParams.set('path', path);
    return url;
  }

  async readFile(path: string): Promise<Response | undefined> {
    const response = await fetch(this.getFileURL(path));
    if (response.status === 404)
      return;
    return response;
  }
}
