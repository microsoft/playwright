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

import { debug } from '../../utilsBundle';

const debugLoggerColorMap = {
  'api': 45, // cyan
  'protocol': 34, // green
  'install': 34, // green
  'download': 34, // green
  'browser': 0, // reset
  'socks': 92, // purple
  'client-certificates': 92, // purple
  'error': 160, // red,
  'channel': 33, // blue
  'server': 45, // cyan
  'server:channel': 34, // green
  'server:metadata': 33, // blue,
  'recorder': 45, // cyan
};
export type LogName = keyof typeof debugLoggerColorMap;

class DebugLogger {
  private _debuggers = new Map<string, debug.IDebugger>();

  constructor() {
    if (process.env.DEBUG_FILE) {
      const ansiRegex = new RegExp([
        '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
        '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
      ].join('|'), 'g');
      const stream = fs.createWriteStream(process.env.DEBUG_FILE);
      (debug as any).log = (data: string) => {
        stream.write(data.replace(ansiRegex, ''));
        stream.write('\n');
      };
    }
  }

  log(name: LogName, message: string | Error | object) {
    let cachedDebugger = this._debuggers.get(name);
    if (!cachedDebugger) {
      cachedDebugger = debug(`pw:${name}`);
      this._debuggers.set(name, cachedDebugger);
      (cachedDebugger as any).color = debugLoggerColorMap[name] || 0;
    }
    cachedDebugger(message);
  }

  isEnabled(name: LogName) {
    return debug.enabled(`pw:${name}`);
  }
}

export const debugLogger = new DebugLogger();

const kLogCount = 150;
export class RecentLogsCollector {
  private _logs: string[] = [];
  private _listeners: ((log: string) => void)[] = [];

  log(message: string) {
    this._logs.push(message);
    if (this._logs.length === kLogCount * 2)
      this._logs.splice(0, kLogCount);
    for (const listener of this._listeners)
      listener(message);
  }

  recentLogs(): string[] {
    if (this._logs.length > kLogCount)
      return this._logs.slice(-kLogCount);
    return this._logs;
  }

  onMessage(listener: (message: string) => void) {
    for (const message of this._logs)
      listener(message);
    this._listeners.push(listener);
  }
}
