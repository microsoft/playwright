/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import * as debug from 'debug';

export type LoggerSeverity = 'verbose' | 'info' | 'warning' | 'error';

export type Log = {
  name: string;
  severity?: LoggerSeverity;
  color?: string | undefined;
};

export interface Logger {
  isEnabled(name: string, severity: LoggerSeverity): boolean;
  log(name: string, severity: LoggerSeverity, message: string | Error, args: any[], hints: { color?: string }): void;
}

export const errorLog: Log = { name: 'generic', severity: 'error' };
export const apiLog: Log = { name: 'api', color: 'cyan' };

export function logError(logger: InnerLogger): (error: Error) => void {
  return error => logger.log(errorLog, error, []);
}

export class InnerLogger {
  private _userSink: Logger | undefined;
  private _debugSink: DebugLogger;

  constructor(userSink: Logger | undefined) {
    this._userSink = userSink;
    this._debugSink = new DebugLogger();
  }

  isLogEnabled(log: Log): boolean {
    const severity = log.severity || 'info';
    if (this._userSink && this._userSink.isEnabled(log.name, severity))
      return true;
    return this._debugSink.isEnabled(log.name, severity);
  }

  log(log: Log, message: string | Error, ...args: any[]) {
    const severity = log.severity || 'info';
    const hints = log.color ? { color: log.color } : {};
    if (this._userSink && this._userSink.isEnabled(log.name, severity))
      this._userSink.log(log.name, severity, message, args, hints);
    this._debugSink.log(log.name, severity, message, args, hints);
  }
}

const colorMap = new Map<string, number>([
  ['red', 160],
  ['green', 34],
  ['yellow', 172],
  ['blue', 33],
  ['magenta', 207],
  ['cyan', 45],
  ['reset', 0],
]);

class DebugLogger {
  private _debuggers = new Map<string, debug.IDebugger>();

  isEnabled(name: string, severity: LoggerSeverity): boolean {
    return debug.enabled(`pw:${name}`);
  }

  log(name: string, severity: LoggerSeverity, message: string | Error, args: any[], hints: { color?: string }) {
    let cachedDebugger = this._debuggers.get(name);
    if (!cachedDebugger) {
      cachedDebugger = debug(`pw:${name}`);
      this._debuggers.set(name, cachedDebugger);

      let color = hints.color || 'reset';
      switch (severity) {
        case 'error': color = 'red'; break;
        case 'warning': color = 'yellow'; break;
      }
      const escaped = colorMap.get(color) || 0;
      if (escaped)
        (cachedDebugger as any).color = String(escaped);
    }
    cachedDebugger(message, ...args);
  }
}
