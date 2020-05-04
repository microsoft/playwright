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

import * as path from 'path';
import * as util from 'util';
import * as fs from 'fs';
import { helper, getFromENV } from '../helper';
import { BrowserBase } from '../browser';
import { BrowserContextBase } from '../browserContext';
import { Progress } from '../progress';
import { Page } from '../page';
import { BrowserTracer } from './browserTracer';
import { BrowserContextTracer } from './browserContextTracer';

const fsUnlinkAsync = util.promisify(fs.unlink.bind(fs));
const fsWriteFileAsync = util.promisify(fs.writeFile.bind(fs));
const fsAppendFileAsync = util.promisify(fs.appendFile.bind(fs));
const fsMkdirAsync = util.promisify(fs.mkdir.bind(fs));
const fsAccessAsync = util.promisify(fs.access.bind(fs));

export const kTraceFileName = 'playwright.trace';

const envTracePath = getFromENV('PWTRACE');
let traceControllerInstance: TraceController | undefined;

export class TraceController {
  private _browserTracers = new Map<BrowserBase, BrowserTracer>();
  private _browserContextTracers = new Map<BrowserContextBase, BrowserContextTracer>();

  private _tracePath: string;
  private _traceDirectoryPromise?: Promise<string>;
  private _traceFilePromise?: Promise<string>;
  private _appendEventChain?: Promise<string>;

  // TODO: where to log?
  logError = (e: any, s: string) => {
    // console.log(s + ':' + e.toString());
  };

  static instance(): TraceController | undefined {
    if (!envTracePath)
      return;
    if (!traceControllerInstance)
      traceControllerInstance = new TraceController(path.resolve(envTracePath));
    return traceControllerInstance;
  }

  constructor(tracePath: string) {
    this._tracePath = tracePath;
  }

  browserCreated(browser: BrowserBase) {
    this._browserTracers.set(browser, new BrowserTracer(this, browser));
  }

  browserDestroyed(browser: BrowserBase) {
    const tracer = this._browserTracers.get(browser)!;
    this._browserTracers.delete(browser);
    tracer.dispose().catch(e => this.logError(e, `disposing context tracer`));;
  }

  contextCreated(context: BrowserContextBase) {
    const browserTracer = this._browserTracers.get(context._browserBase)!;
    this._browserContextTracers.set(context, new BrowserContextTracer(this, browserTracer.browserId, context));
  }

  contextDestroyed(context: BrowserContextBase) {
    const tracer = this._browserContextTracers.get(context)!;
    this._browserContextTracers.delete(context);
    tracer.dispose().catch(e => this.logError(e, `disposing context tracer`));
  }

  async captureSnapshot(progress: Progress, page: Page, label: string): Promise<void> {
    const tracer = this._browserContextTracers.get(page.context() as BrowserContextBase);
    if (tracer)
      await tracer.captureSnapshot(progress, page, label);
  }

  private async ensureTraceDirectory(): Promise<string> {
    if (!this._traceDirectoryPromise)
      this._traceDirectoryPromise = fsMkdirAsync(this._tracePath, { recursive: true }).then(() => this._tracePath);
    return this._traceDirectoryPromise;
  }

  async writeArtifact(sha1: string, buffer: Buffer): Promise<void> {
    const traceDirectory = await this.ensureTraceDirectory();
    const filePath = path.join(traceDirectory, sha1);
    try {
      await fsAccessAsync(filePath);
    } catch (e) {
      await fsWriteFileAsync(filePath, buffer);
    }
  }

  async ensureTraceFile(): Promise<string> {
    if (!this._traceFilePromise) {
      this._traceFilePromise = this.ensureTraceDirectory().then(async traceDirectory => {
        const traceFile = path.join(traceDirectory, kTraceFileName);
        await fsUnlinkAsync(traceFile).catch(e => {});
        return traceFile;
      });
    }
    return this._traceFilePromise;
  }

  async appendTraceEvent(event: any) {
    if (!this._appendEventChain)
      this._appendEventChain = this.ensureTraceFile();
    // Serialize writes to the trace file.
    this._appendEventChain = this._appendEventChain.then(async traceFile => {
      const timestamp = helper.monotonicTime();
      await fsAppendFileAsync(traceFile, JSON.stringify({...event, timestamp}) + '\n');
      return traceFile;
    });
  }
}
