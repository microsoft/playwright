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
import { createGuid } from 'playwright-core/lib/utils';
import type * as reporterTypes from '../../types/testReporter';
import type * as teleReceiver from '../isomorphic/teleReceiver';
import { serializeRegexPatterns } from '../isomorphic/teleReceiver';
import type { ReporterV2 } from './reporterV2';

export type TeleReporterEmitterOptions = {
  omitOutput?: boolean;
  omitBuffers?: boolean;
};

export class TeleReporterEmitter implements ReporterV2 {
  private _messageSink: (message: teleReceiver.JsonEvent) => void;
  private _rootDir!: string;
  private _emitterOptions: TeleReporterEmitterOptions;
  // In case there is blob reporter and UI mode, make sure one does override
  // the id assigned by the other.
  private readonly _idSymbol = Symbol('id');

  constructor(messageSink: (message: teleReceiver.JsonEvent) => void, options: TeleReporterEmitterOptions = {}) {
    this._messageSink = messageSink;
    this._emitterOptions = options;
  }

  version(): 'v2' {
    return 'v2';
  }

  onConfigure(config: reporterTypes.FullConfig) {
    this._rootDir = config.rootDir;
    this._messageSink({ method: 'onConfigure', params: { config: this._serializeConfig(config) } });
  }

  onBegin(suite: reporterTypes.Suite) {
    const projects = suite.suites.map(projectSuite => this._serializeProject(projectSuite));
    for (const project of projects)
      this._messageSink({ method: 'onProject', params: { project } });
    this._messageSink({ method: 'onBegin', params: undefined });
  }

  onTestBegin(test: reporterTypes.TestCase, result: reporterTypes.TestResult): void {
    (result as any)[this._idSymbol] = createGuid();
    this._messageSink({
      method: 'onTestBegin',
      params: {
        testId: test.id,
        result: this._serializeResultStart(result)
      }
    });
  }

  onTestEnd(test: reporterTypes.TestCase, result: reporterTypes.TestResult): void {
    const testEnd: teleReceiver.JsonTestEnd = {
      testId: test.id,
      expectedStatus: test.expectedStatus,
      annotations: test.annotations,
      timeout: test.timeout,
    };
    this._messageSink({
      method: 'onTestEnd',
      params: {
        test: testEnd,
        result: this._serializeResultEnd(result),
      }
    });
  }

  onStepBegin(test: reporterTypes.TestCase, result: reporterTypes.TestResult, step: reporterTypes.TestStep): void {
    (step as any)[this._idSymbol] = createGuid();
    this._messageSink({
      method: 'onStepBegin',
      params: {
        testId: test.id,
        resultId: (result as any)[this._idSymbol],
        step: this._serializeStepStart(step)
      }
    });
  }

  onStepEnd(test: reporterTypes.TestCase, result: reporterTypes.TestResult, step: reporterTypes.TestStep): void {
    this._messageSink({
      method: 'onStepEnd',
      params: {
        testId: test.id,
        resultId: (result as any)[this._idSymbol],
        step: this._serializeStepEnd(step)
      }
    });
  }

  onError(error: reporterTypes.TestError): void {
    this._messageSink({
      method: 'onError',
      params: { error }
    });
  }

  onStdOut(chunk: string | Buffer, test?: reporterTypes.TestCase, result?: reporterTypes.TestResult): void {
    this._onStdIO('stdout', chunk, test, result);
  }

  onStdErr(chunk: string | Buffer, test?: reporterTypes.TestCase, result?: reporterTypes.TestResult): void {
    this._onStdIO('stderr', chunk, test, result);
  }

  private _onStdIO(type: teleReceiver.JsonStdIOType, chunk: string | Buffer, test: void | reporterTypes.TestCase, result: void | reporterTypes.TestResult): void {
    if (this._emitterOptions.omitOutput)
      return;
    const isBase64 = typeof chunk !== 'string';
    const data = isBase64 ? chunk.toString('base64') : chunk;
    this._messageSink({
      method: 'onStdIO',
      params: { testId: test?.id, resultId: result ? (result as any)[this._idSymbol] : undefined, type, data, isBase64 }
    });
  }

  async onEnd(result: reporterTypes.FullResult) {
    const resultPayload: teleReceiver.JsonFullResult = {
      status: result.status,
      startTime: result.startTime.getTime(),
      duration: result.duration,
    };
    this._messageSink({
      method: 'onEnd',
      params: {
        result: resultPayload
      }
    });
  }

  printsToStdio() {
    return false;
  }

  private _serializeConfig(config: reporterTypes.FullConfig): teleReceiver.JsonConfig {
    return {
      configFile: this._relativePath(config.configFile),
      globalTimeout: config.globalTimeout,
      maxFailures: config.maxFailures,
      metadata: config.metadata,
      rootDir: config.rootDir,
      version: config.version,
      workers: config.workers,
    };
  }

  private _serializeProject(suite: reporterTypes.Suite): teleReceiver.JsonProject {
    const project = suite.project()!;
    const report: teleReceiver.JsonProject = {
      metadata: project.metadata,
      name: project.name,
      outputDir: this._relativePath(project.outputDir),
      repeatEach: project.repeatEach,
      retries: project.retries,
      testDir: this._relativePath(project.testDir),
      testIgnore: serializeRegexPatterns(project.testIgnore),
      testMatch: serializeRegexPatterns(project.testMatch),
      timeout: project.timeout,
      suites: suite.suites.map(fileSuite => {
        return this._serializeSuite(fileSuite);
      }),
      grep: serializeRegexPatterns(project.grep),
      grepInvert: serializeRegexPatterns(project.grepInvert || []),
      dependencies: project.dependencies,
      snapshotDir: this._relativePath(project.snapshotDir),
      teardown: project.teardown,
    };
    return report;
  }

  private _serializeSuite(suite: reporterTypes.Suite): teleReceiver.JsonSuite {
    const result = {
      title: suite.title,
      location: this._relativeLocation(suite.location),
      entries: suite.entries().map(e => {
        if (e.type === 'test')
          return this._serializeTest(e);
        return this._serializeSuite(e);
      })
    };
    return result;
  }

  private _serializeTest(test: reporterTypes.TestCase): teleReceiver.JsonTestCase {
    return {
      testId: test.id,
      title: test.title,
      location: this._relativeLocation(test.location),
      retries: test.retries,
      tags: test.tags,
      repeatEachIndex: test.repeatEachIndex,
      annotations: test.annotations,
    };
  }

  private _serializeResultStart(result: reporterTypes.TestResult): teleReceiver.JsonTestResultStart {
    return {
      id: (result as any)[this._idSymbol],
      retry: result.retry,
      workerIndex: result.workerIndex,
      parallelIndex: result.parallelIndex,
      startTime: +result.startTime,
    };
  }

  private _serializeResultEnd(result: reporterTypes.TestResult): teleReceiver.JsonTestResultEnd {
    return {
      id: (result as any)[this._idSymbol],
      duration: result.duration,
      status: result.status,
      errors: result.errors,
      attachments: this._serializeAttachments(result.attachments),
    };
  }

  _serializeAttachments(attachments: reporterTypes.TestResult['attachments']): teleReceiver.JsonAttachment[] {
    return attachments.map(a => {
      return {
        ...a,
        // There is no Buffer in the browser, so there is no point in sending the data there.
        base64: (a.body && !this._emitterOptions.omitBuffers) ? a.body.toString('base64') : undefined,
      };
    });
  }

  private _serializeStepStart(step: reporterTypes.TestStep): teleReceiver.JsonTestStepStart {
    return {
      id: (step as any)[this._idSymbol],
      parentStepId: (step.parent as any)?.[this._idSymbol],
      title: step.title,
      category: step.category,
      startTime: +step.startTime,
      location: this._relativeLocation(step.location),
    };
  }

  private _serializeStepEnd(step: reporterTypes.TestStep): teleReceiver.JsonTestStepEnd {
    return {
      id: (step as any)[this._idSymbol],
      duration: step.duration,
      error: step.error,
    };
  }

  private _relativeLocation(location: reporterTypes.Location): reporterTypes.Location;
  private _relativeLocation(location?: reporterTypes.Location): reporterTypes.Location | undefined;
  private _relativeLocation(location: reporterTypes.Location | undefined): reporterTypes.Location | undefined {
    if (!location)
      return location;
    return {
      ...location,
      file: this._relativePath(location.file),
    };
  }

  private _relativePath(absolutePath: string): string;
  private _relativePath(absolutePath?: string): string | undefined;
  private _relativePath(absolutePath?: string): string | undefined {
    if (!absolutePath)
      return absolutePath;
    return path.relative(this._rootDir, absolutePath);
  }
}
