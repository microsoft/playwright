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
import * as fs from 'fs';
import { helper } from './helper';
import { LoggerSink, LoggerSeverity } from './loggerSink';

export function logError(logger: Logger): (error: Error) => void {
  return error => logger.error(error);
}

export class Logger {
  private _loggerSink: LoggerSink;
  private _name: string;
  private _hints: { color?: string; };
  private _scopeName: string | undefined;
  private _recording: string[] | undefined;

  constructor(loggerSink: LoggerSink, name: string, hints: { color?: string }, scopeName?: string, record?: boolean) {
    this._loggerSink = loggerSink;
    this._name = name;
    this._hints = hints;
    this._scopeName = scopeName;
    if (record)
      this._recording = [];
  }

  isEnabled(severity?: LoggerSeverity): boolean {
    return this._loggerSink.isEnabled(this._name, severity || 'info');
  }

  verbose(message: string, ...args: any[]) {
    return this._innerLog('verbose', message, args);
  }

  info(message: string, ...args: any[]) {
    return this._innerLog('info', message, args);
  }

  warn(message: string, ...args: any[]) {
    return this._innerLog('warning', message, args);
  }

  error(message: string | Error, ...args: any[]) {
    return this._innerLog('error', message, args);
  }

  createScope(scopeName: string | undefined, record?: boolean): Logger {
    if (scopeName)
      this._loggerSink.log(this._name, 'info', `=> ${scopeName} started`, [], this._hints);
    return new Logger(this._loggerSink, this._name, this._hints, scopeName, record);
  }

  endScope(status: string) {
    if (this._scopeName)
      this._loggerSink.log(this._name, 'info', `<= ${this._scopeName} ${status}`, [], this._hints);
  }

  private _innerLog(severity: LoggerSeverity, message: string | Error, ...args: any[]) {
    if (this._recording)
      this._recording.push(`[${this._name}] ${message}`);
    this._loggerSink.log(this._name, severity, message, args, this._hints);
  }

  recording(): string[] {
    return this._recording ? this._recording.slice() : [];
  }
}

export class Loggers {
  readonly api: Logger;
  readonly browser: Logger;
  readonly protocol: Logger;

  constructor(userSink: LoggerSink | undefined) {
    const loggerSink = new MultiplexingLoggerSink();
    if (userSink)
      loggerSink.add('user', userSink);
    if (helper.isDebugMode())
      loggerSink.add('pwdebug', new PwDebugLoggerSink());
    loggerSink.add('debug', new DebugLoggerSink());

    this.api = new Logger(loggerSink, 'api', { color: 'cyan' });
    this.browser = new Logger(loggerSink, 'browser', {});
    this.protocol = new Logger(loggerSink, 'protocol', { color: 'green' });
  }
}

class MultiplexingLoggerSink implements LoggerSink {
  private _loggers = new Map<string, LoggerSink>();

  add(id: string, logger: LoggerSink) {
    this._loggers.set(id, logger);
  }

  get(id: string): LoggerSink | undefined {
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
    for (const logger of this._loggers.values()) {
      if (logger.isEnabled(name, severity))
        logger.log(name, severity, message, args, hints);
    }
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

export class DebugLoggerSink {
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

class PwDebugLoggerSink {
  isEnabled(name: string, severity: LoggerSeverity): boolean {
    return false;
  }

  log(name: string, severity: LoggerSeverity, message: string | Error, args: any[], hints: { color?: string }) {
  }
}
