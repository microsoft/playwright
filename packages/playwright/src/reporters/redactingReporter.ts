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

import { normalizeSecrets, redactSecretsInBuffer, redactSecretsInText } from '@isomorphic/secrets';

import type { ReportConfigureParams, ReportEndParams, ReporterPreprocessParams, ReporterV2 } from './reporterV2';
import type { FullConfig, FullResult, Suite, TestCase, TestError, TestResult, TestStep, WorkerInfo } from '../../types/testReporter';
import type { Secrets } from '@isomorphic/secrets';

export class SecretsRedactor {
  private _secrets: Secrets;
  private _views = new Map<object, any>();
  private _buffers = new Map<Buffer, Buffer>();
  private _handler: ProxyHandler<any>;

  constructor(secrets: Secrets) {
    this._secrets = normalizeSecrets(secrets);
    this._handler = {
      get: (target, property, receiver) => {
        const value = Reflect.get(target, property, receiver);
        // Methods run against the view, so everything they touch and return is redacted too.
        if (typeof value === 'function')
          return (...args: any[]) => this.redact(Reflect.apply(value, receiver, args));
        return this.redact(value);
      },
    };
  }

  redact<T>(value: T): T {
    if (typeof value === 'string')
      return redactSecretsInText(value, this._secrets) as T;
    if (typeof value !== 'object' || value === null)
      return value;
    if (Buffer.isBuffer(value)) {
      let redacted = this._buffers.get(value);
      if (!redacted) {
        redacted = redactSecretsInBuffer(value, this._secrets);
        this._buffers.set(value, redacted);
      }
      return redacted as T;
    }
    if (isOpaque(value))
      return value;
    let view = this._views.get(value);
    if (!view) {
      view = new Proxy(value, this._handler);
      this._views.set(value, view);
    }
    return view;
  }
}

// Built-in objects whose methods do not work through a proxy. None of them hold secrets.
// Iterators are created by methods that run against the view, so they already
// produce redacted values.
function isOpaque(value: object): boolean {
  if (value instanceof Date || value instanceof RegExp || value instanceof Promise ||
      value instanceof Map || value instanceof Set || value instanceof WeakMap || value instanceof WeakSet ||
      value instanceof ArrayBuffer || ArrayBuffer.isView(value))
    return true;
  const tag = Object.prototype.toString.call(value);
  return tag.endsWith(' Iterator]') || tag === '[object Generator]';
}

export class RedactingReporter implements ReporterV2 {
  private _reporter: ReporterV2;
  private _redactor: SecretsRedactor;

  constructor(reporter: ReporterV2, redactor: SecretsRedactor) {
    this._reporter = reporter;
    this._redactor = redactor;
  }

  version(): 'v2' {
    return 'v2';
  }

  onConfigure(config: FullConfig) {
    this._reporter.onConfigure?.(this._redactor.redact(config));
  }

  async preprocess(params: ReporterPreprocessParams) {
    await this._reporter.preprocess?.(this._redactor.redact(params));
  }

  onBegin(suite: Suite) {
    this._reporter.onBegin?.(this._redactor.redact(suite));
  }

  onTestBegin(test: TestCase, result: TestResult) {
    this._reporter.onTestBegin?.(this._redactor.redact(test), this._redactor.redact(result));
  }

  onStdOut(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    this._reporter.onStdOut?.(this._redactor.redact(chunk), this._redactor.redact(test), this._redactor.redact(result));
  }

  onStdErr(chunk: string | Buffer, test?: TestCase, result?: TestResult) {
    this._reporter.onStdErr?.(this._redactor.redact(chunk), this._redactor.redact(test), this._redactor.redact(result));
  }

  async onTestPaused(test: TestCase, result: TestResult) {
    await this._reporter.onTestPaused?.(this._redactor.redact(test), this._redactor.redact(result));
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this._reporter.onTestEnd?.(this._redactor.redact(test), this._redactor.redact(result));
  }

  onReportConfigure(params: ReportConfigureParams) {
    this._reporter.onReportConfigure?.(this._redactor.redact(params));
  }

  onReportEnd(params: ReportEndParams) {
    this._reporter.onReportEnd?.(this._redactor.redact(params));
  }

  async onEnd(result: FullResult) {
    return await this._reporter.onEnd?.(this._redactor.redact(result));
  }

  async onExit() {
    await this._reporter.onExit?.();
  }

  onError(error: TestError, workerInfo?: WorkerInfo) {
    this._reporter.onError?.(this._redactor.redact(error), this._redactor.redact(workerInfo));
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    this._reporter.onStepBegin?.(this._redactor.redact(test), this._redactor.redact(result), this._redactor.redact(step));
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    this._reporter.onStepEnd?.(this._redactor.redact(test), this._redactor.redact(result), this._redactor.redact(step));
  }

  printsToStdio(): boolean {
    return this._reporter.printsToStdio ? this._reporter.printsToStdio() : true;
  }
}
