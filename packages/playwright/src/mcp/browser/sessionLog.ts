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

import { Response } from './response';
import { logUnhandledError } from '../log';
import { outputFile  } from './config';

import type { FullConfig } from './config';
import type * as actions from './actions';
import type { Tab, TabSnapshot } from './tab';
import type * as mcpServer from '../sdk/server';

type LogEntry = {
  timestamp: number;
  toolCall?: {
    toolName: string;
    toolArgs: Record<string, any>;
    result: string;
    isError?: boolean;
  };
  userAction?: actions.Action;
  code: string;
  tabSnapshot?: TabSnapshot;
};

export class SessionLog {
  private _folder: string;
  private _ordinal = 0;
  private _entries: LogEntry[] = [];
  private _sessionFileQueue = Promise.resolve();
  private _flushEntriesTimeout: NodeJS.Timeout | undefined;
  private _mode: 'disk' | 'memory' | 'none';
  private _includeSnapshots: boolean;

  constructor(config: FullConfig, clientInfo: mcpServer.ClientInfo) {
    this._folder = outputFile(config, clientInfo, `session-${Date.now()}`, { origin: 'code', reason: 'Saving session' });
    this._mode = config.saveSession ? 'disk' : config.capabilities.includes('session') ? 'memory' : 'none';
    this._includeSnapshots = !!config.saveSession;
  }

  serializedLog(): string {
    const lines: string[] = [];
    for (const entry of this._entries)
      this._serializeEntry(entry, lines);
    return lines.join('\n');
  }

  async logResponse(response: Response) {
    if (this._mode === 'none')
      return;

    const entry: LogEntry = {
      timestamp: performance.now(),
      toolCall: {
        toolName: response.toolName,
        toolArgs: response.toolArgs,
        result: response.result(),
        isError: response.isError(),
      },
      code: response.code(),
      tabSnapshot: this._includeSnapshots ? response.tabSnapshot() : undefined,
    };
    this._entries.push(entry);
    await this._flushEntries();
  }

  logUserAction(action: actions.Action, tab: Tab, code: string, isUpdate: boolean) {
    if (this._mode === 'none')
      return;

    code = code.trim();
    if (isUpdate) {
      const lastEntry = this._entries[this._entries.length - 1];
      if (lastEntry?.userAction?.name === action.name) {
        lastEntry.userAction = action;
        lastEntry.code = code;
        return;
      }
    }
    if (action.name === 'navigate') {
      // Already logged at this location.
      const lastEntry = this._entries[this._entries.length - 1];
      if (lastEntry?.tabSnapshot?.url === action.url)
        return;
    }
    const entry: LogEntry = {
      timestamp: performance.now(),
      userAction: action,
      code,
      tabSnapshot: {
        url: tab.page.url(),
        title: '',
        ariaSnapshot: action.ariaSnapshot || '',
        modalStates: [],
        consoleMessages: [],
        downloads: [],
      },
    };
    this._entries.push(entry);
    this._scheduleFlushEntries();
  }

  private _scheduleFlushEntries() {
    if (this._flushEntriesTimeout)
      clearTimeout(this._flushEntriesTimeout);
    this._flushEntriesTimeout = setTimeout(() => this._flushEntries(), 1000);
  }

  private async _flushEntries() {
    if (this._mode === 'disk')
      await this._flushEntriesToDisk();
  }

  private async _flushEntriesToDisk() {
    await fs.promises.mkdir(this._folder, { recursive: true });
    clearTimeout(this._flushEntriesTimeout);
    const entries = this._entries;
    this._entries = [];
    const lines: string[] = [''];
    for (const entry of entries)
      this._serializeEntry(entry, lines);
    const file = path.join(this._folder, 'session.md');
    this._sessionFileQueue = this._sessionFileQueue.then(() => fs.promises.appendFile(file, lines.join('\n')));
  }

  private _serializeEntry(entry: LogEntry, lines: string[]) {
    const ordinal = (++this._ordinal).toString().padStart(3, '0');
    if (entry.toolCall) {
      lines.push(
          `#### Tool call: ${entry.toolCall.toolName}`,
          `- Args`,
          '```json',
          JSON.stringify(entry.toolCall.toolArgs, null, 2),
          '```',
      );
      if (entry.toolCall.result) {
        lines.push(
            entry.toolCall.isError ? `- Error` : `- Result`,
            '```',
            entry.toolCall.result,
            '```',
        );
      }
    }

    if (entry.userAction) {
      const actionData = { ...entry.userAction } as any;
      delete actionData.ariaSnapshot;
      delete actionData.selector;
      delete actionData.signals;

      lines.push(
          `#### User action: ${entry.userAction.name}`,
          `- Args`,
          '```json',
          JSON.stringify(actionData, null, 2),
          '```',
      );
    }

    if (entry.code) {
      lines.push(
          `- Code`,
          '```js',
          entry.code,
          '```');
    }

    if (entry.tabSnapshot) {
      const fileName = `${ordinal}.snapshot.yml`;
      fs.promises.writeFile(path.join(this._folder, fileName), entry.tabSnapshot.ariaSnapshot).catch(logUnhandledError);
      lines.push(`- Snapshot: ${fileName}`);
    }

    lines.push('', '');
  }
}
