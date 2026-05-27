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

import path from 'path';

import { parseResponse } from './response';

import type { Context } from './context';
import type { OutputFile } from './outputDir';

export class SessionLog {
  private _file: OutputFile;
  private _cwd: string;
  private _sessionFileQueue = Promise.resolve();

  private constructor(file: OutputFile, cwd: string) {
    this._file = file;
    this._cwd = cwd;
  }

  static async create(context: Context, cwd: string): Promise<SessionLog> {
    const file = await context.outputFile({
      prefix: '',
      ext: '',
      suggestedFilename: path.join(`session-${Date.now()}`, 'session.md'),
    }, { origin: 'code', evictable: false });
    // eslint-disable-next-line no-console
    console.error(`Session: ${path.dirname(file.path)}`);
    return new SessionLog(file, cwd);
  }

  logResponse(toolName: string, toolArgs: Record<string, any>, responseObject: any) {
    const parsed = { ...parseResponse(responseObject, this._cwd), text: undefined };
    const lines: string[] = [''];
    lines.push(
        `### Tool call: ${toolName}`,
        `- Args`,
        '```json',
        JSON.stringify(toolArgs, null, 2),
        '```',
    );
    if (parsed) {
      lines.push(`- Result`);
      lines.push('```json');
      lines.push(JSON.stringify(parsed, null, 2));
      lines.push('```');
    }

    lines.push('');
    this._sessionFileQueue = this._sessionFileQueue.then(() => this._file.append(lines.join('\n')));
  }
}
