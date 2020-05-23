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

export interface InnerLogger {
  _isLogEnabled(log: Log): boolean;
  _log(log: Log, message: string | Error, ...args: any[]): void;
}

export const errorLog: Log = { name: 'generic', severity: 'error' };

export function logError(logger: InnerLogger): (error: Error) => void {
  return error => logger._log(errorLog, error, []);
}

export class RootLogger implements InnerLogger {
  private _logger = new MultiplexingLogger();

  constructor(userSink: Logger | undefined) {
    if (userSink)
      this._logger.add('user', userSink);
    this._logger.add('debug', new DebugLogger());
  }

  _isLogEnabled(log: Log): boolean {
    return this._logger.isEnabled(log.name, log.severity || 'info');
  }

  _log(log: Log, message: string | Error, ...args: any[]) {
    if (this._logger.isEnabled(log.name, log.severity || 'info'))
      this._logger.log(log.name, log.severity || 'info', message, args, log.color ? { color: log.color } : {});
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

class MultiplexingLogger implements Logger {
  private _loggers = new Map<string, Logger>();

  add(id: string, logger: Logger) {
    this._loggers.set(id, logger);
  }

  get(id: string): Logger | undefined {
    return this._loggers.get(id);
  }

  remove(id: string) {
    this._loggers.delete(id);
  }

  isEnabled(name: string, severity: LoggerSeverity): boolean {
    for (const logger of this._loggers.values()) {
      if (logger.isEnabled(name, severity))
        return true;
    }
    return false;
  }

  log(name: string, severity: LoggerSeverity, message: string | Error, args: any[], hints: { color?: string }) {
    for (const logger of this._loggers.values())
      logger.log(name, severity, message, args, hints);
  }
}

class DebugLogger implements Logger {
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
