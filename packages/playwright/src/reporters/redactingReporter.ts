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
import { unzipSync } from 'fflate';

import { isTextualMimeType } from '@isomorphic/mimeType';
import { truncateParam } from '@isomorphic/protocolFormatter';
import { escapeSecretsForJSON, normalizeSecrets, redactSecretsInBuffer, redactSecretsInText } from '@isomorphic/secrets';

import type { ReportConfigureParams, ReportEndParams, ReporterPreprocessParams, ReporterV2 } from './reporterV2';
import type { FullConfig, FullResult, Suite, TestCase, TestError, TestResult, TestStep, WorkerInfo } from '../../types/testReporter';
import type { Secrets } from '@isomorphic/secrets';

type Attachment = TestResult['attachments'][0];

export class SecretsRedactor {
  private _secrets: Secrets;
  private _escapedSecrets: Secrets;
  private _views = new Map<object, any>();
  private _buffers = new Map<Buffer, Buffer>();
  private _handler: ProxyHandler<any>;
  private _attachments = new Map<Attachment, Attachment>();

  constructor(secrets: Secrets) {
    this._secrets = normalizeSecrets(secrets);
    this._escapedSecrets = escapeSecretsForJSON(this._secrets);
    this._handler = {
      get: (target, property, receiver) => {
        const value = Reflect.get(target, property, receiver);
        const isResultOrStep = target.startTime instanceof Date && Array.isArray(target.steps);
        const isStep = isResultOrStep && typeof target.category === 'string';
        if (property === 'attachments' && this._secrets.length && isResultOrStep)
          return this.redact(value.map((attachment: Attachment) => this._redactAttachment(attachment)));
        // Keep the full values until secrets have been replaced.
        if (isStep && property === 'subtitle' && typeof value === 'string')
          return truncateParam(this.redact(value));
        if (isStep && property === 'params' && value)
          return Object.fromEntries(Object.entries(this.redact(value)).map(([key, value]) => [key, typeof value === 'string' ? truncateParam(value) : value]));
        // Methods run against the view, so everything they touch and return is redacted too.
        if (typeof value === 'function')
          return (...args: any[]) => this.redact(Reflect.apply(value, receiver, args));
        return this.redact(value);
      },
    };
  }

  private _redactAttachment(attachment: Attachment): Attachment {
    let redacted = this._attachments.get(attachment);
    if (redacted)
      return redacted;
    let body: Buffer | undefined;
    try {
      body = attachment.path ? fs.readFileSync(attachment.path) : attachment.body;
    } catch {
      redacted = { name: attachment.name, contentType: 'text/plain', body: Buffer.from('Attachment omitted because it could not be read.') };
      this._attachments.set(attachment, redacted);
      return redacted;
    }
    redacted = attachment;
    if (body) {
      if (isTextualMimeType(attachment.contentType)) {
        const redactedBody = redactSecretsInBuffer(body, this._secrets);
        if (redactedBody !== body || (attachment.path && this.redact(attachment.path) !== attachment.path))
          redacted = { name: attachment.name, contentType: attachment.contentType, body: redactedBody };
      } else {
        let reason: string | undefined;
        try {
          if (this._containsSecret(body, attachment.contentType === 'application/zip' || attachment.path?.endsWith('.zip')))
            reason = 'it contains a secret';
        } catch {
          reason = 'its contents could not be checked for secrets';
        }
        if (reason)
          redacted = { name: attachment.name, contentType: 'text/plain', body: Buffer.from(`Attachment omitted because ${reason}.`) };
        else if (attachment.path && this.redact(attachment.path) !== attachment.path)
          redacted = { name: attachment.name, contentType: attachment.contentType, body };
      }
    }
    this._attachments.set(attachment, redacted);
    return redacted;
  }

  private _containsSecret(body: Buffer | Uint8Array, isZip = false): boolean {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    if ([...this._secrets, ...this._escapedSecrets].some(({ value }) => buffer.includes(Buffer.from(value))))
      return true;
    if (isZip || (buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50)) {
      const names = new Set<string>();
      const entries = unzipSync(buffer, { filter: entry => {
        if (names.has(entry.name))
          throw new Error('Cannot check ZIP entries with duplicate names');
        names.add(entry.name);
        return true;
      } });
      return Object.entries(entries).some(([name, contents]) =>
        this.redact(name) !== name || this._containsSecret(contents));
    }
    return false;
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
      this._views.set(view, view);
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
