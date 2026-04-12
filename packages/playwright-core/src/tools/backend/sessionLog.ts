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

import { outputFile  } from './context';
import { parseResponse } from './response';

import type { ContextConfig } from './context';

export class SessionLog {
  private _folder: string;
  private _file: string;
  private _cwd: string;
  private _sessionFileQueue = Promise.resolve();

  constructor(sessionFolder: string, cwd: string) {
    this._folder = sessionFolder;
    this._file = path.join(this._folder, 'session.md');
    this._cwd = cwd;
  }

  static async create(config: ContextConfig, cwd: string): Promise<SessionLog> {
    const sessionFolder = await outputFile({ config, cwd }, `session-${Date.now()}`, { origin: 'code' });
    await fs.promises.mkdir(sessionFolder, { recursive: true });
    // eslint-disable-next-line no-console
    console.error(`Session: ${sessionFolder}`);
    return new SessionLog(sessionFolder, cwd);
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
    this._sessionFileQueue = this._sessionFileQueue.then(() => fs.promises.appendFile(this._file, lines.join('\n')));
  }
}
