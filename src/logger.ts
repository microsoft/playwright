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

import * as util from 'util';

export type LoggerSeverity = 'verbose' | 'info' | 'warning' | 'error';

export type Log = {
  name: string;
  severity?: LoggerSeverity;
  color?: string | undefined;
};

export interface Logger {
  _isLogEnabled(log: Log): boolean;
  _log(log: Log, message: string | Error, ...args: any[]): void;
}

export interface LoggerSink {
  isEnabled(name: string, severity: LoggerSeverity): boolean;
  log(name: string, severity: LoggerSeverity, message: string | Error, args: any[], hints: { color?: string }): void;
}

export const errorLog: Log = { name: 'generic', severity: 'error' };

export function logError(logger: Logger): (error: Error) => void {
  return error => logger._log(errorLog, error, []);
}

const colorMap = new Map<string, number>([
  ['black', 30],
  ['red', 31],
  ['green', 32],
  ['yellow', 33],
  ['blue', 34],
  ['magenta', 35],
  ['cyan', 36],
  ['white', 37],
  ['reset', 0],
]);

export class RootLogger implements Logger {
  private _userSink: LoggerSink | undefined;
  private _consoleSink: ConsoleLoggerSink;

  constructor(userSink: LoggerSink | undefined) {
    this._userSink = userSink;
    this._consoleSink = new ConsoleLoggerSink();
  }

  _isLogEnabled(log: Log): boolean {
    return (this._userSink && this._userSink.isEnabled(log.name, log.severity || 'info')) ||
        this._consoleSink.isEnabled(log.name, log.severity || 'info');
  }

  _log(log: Log, message: string | Error, ...args: any[]) {
    if (this._userSink && this._userSink.isEnabled(log.name, log.severity || 'info'))
      this._userSink.log(log.name, log.severity || 'info', message, args, log.color ? { color: log.color } : {});
    if (this._consoleSink.isEnabled(log.name, log.severity || 'info'))
      this._consoleSink.log(log.name, log.severity || 'info', message, args, log.color ? { color: log.color } : {});
  }
}

class ConsoleLoggerSink implements LoggerSink {
  private _enabled: string[];
  private _enabledCache = new Map<string, boolean>();

  constructor() {
    this._enabled = process.env.PWDEBUG ? process.env.PWDEBUG.split(',') : [];
  }

  isEnabled(name: string, severity: LoggerSeverity): boolean {
    const result = this._enabledCache.get(name);
    if (typeof result === 'boolean')
      return result;

    for (const logger of this._enabled) {
      if (name.includes(logger)) {
        this._enabledCache.set(name, true);
        return true;
      }
    }
    this._enabledCache.set(name, false);
    return false;
  }

  log(name: string, severity: LoggerSeverity, message: string | Error, args: any[], hints: { color?: string }) {
    let color = hints.color || 'reset';
    switch (severity) {
      case 'error': color = 'red'; break;
      case 'warning': color = 'yellow'; break;
    }
    const escape = colorMap.get(color) || 0;
    console.log(`[${new Date().toISOString()}:\u001b[${escape}m${name}\u001b[0m] ${util.format(message, ...args)}`);  // eslint-disable-line no-console
  }
}
