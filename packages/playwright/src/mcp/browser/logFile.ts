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

import fs from 'fs';
import path from 'path';

import { logUnhandledError } from '../log';

import type { Context } from './context';

export type LogChunk = {
  type: string;
  file: string;
  fromLine: number;
  toLine: number;
  entryCount: number;
};

export class LogFile {
  private _startTime: number;
  private _context: Context;
  private _filePrefix: string;
  private _title: string;

  private _file: string | undefined;
  private _stopped: boolean = false;

  private _line: number = 0;
  private _entries: number = 0;
  private _lastLine: number = 0;
  private _lastEntries: number = 0;

  private _writeChain: Promise<void> = Promise.resolve();

  constructor(context: Context, startTime: number, filePrefix: string, title: string) {
    this._context = context;
    this._startTime = startTime;
    this._filePrefix = filePrefix;
    this._title = title;
  }

  appendLine(wallTime: number, text: () => string | Promise<string>) {
    this._writeChain = this._writeChain.then(() => this._write(wallTime, text)).catch(logUnhandledError);
  }

  stop() {
    this._stopped = true;
  }

  async take(relativeTo?: string): Promise<string | undefined> {
    const logChunk = await this._take();
    if (!logChunk)
      return undefined;
    const logFilePath = relativeTo ? path.relative(relativeTo, logChunk.file) : logChunk.file;
    const lineRange = logChunk.fromLine === logChunk.toLine
      ? `#L${logChunk.fromLine}`
      : `#L${logChunk.fromLine}-L${logChunk.toLine}`;
    return `${logFilePath}${lineRange}`;
  }

  private async _take(): Promise<LogChunk | undefined> {
    await this._writeChain;
    if (!this._file || this._entries === this._lastEntries)
      return undefined;
    const chunk: LogChunk = {
      type: this._title.toLowerCase(),
      file: this._file,
      fromLine: this._lastLine + 1,
      toLine: this._line,
      entryCount: this._entries - this._lastEntries,
    };
    this._lastLine = this._line;
    this._lastEntries = this._entries;
    return chunk;
  }

  private async _write(wallTime: number, text: () => string | Promise<string>) {
    if (this._stopped)
      return;
    this._file ??= await this._context.outputFile({ prefix: this._filePrefix, ext: 'log', date: new Date(this._startTime) }, { origin: 'code' });
    const relativeTime = Math.round(wallTime - this._startTime);
    const renderedText = await text();
    const logLine = `[${String(relativeTime).padStart(8, ' ')}ms] ${renderedText}\n`;
    await fs.promises.appendFile(this._file, logLine);

    const lineCount = logLine.split('\n').length - 1;
    this._line += lineCount;
    this._entries++;
  }
}
