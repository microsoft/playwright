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

import type { FullConfig, FullResult, Reporter, TestError, TestResult, TestStep, Location } from '../../types/testReporter';
import type { Suite, TestCase } from '../common/test';
import type { JsonConfig, JsonProject, JsonSuite, JsonTestCase, JsonTestEnd, JsonTestResultEnd, JsonTestResultStart, JsonTestStepEnd, JsonTestStepStart } from '../isomorphic/teleReceiver';
import type { SuitePrivate } from '../../types/reporterPrivate';
import { FullConfigInternal } from '../common/config';
import { createGuid } from 'playwright-core/lib/utils';
import { serializeRegexPatterns } from '../isomorphic/teleReceiver';
import path from 'path';
import type { FullProject } from '../../types/test';
import { uniqueProjectIds } from './base';

export class TeleReporterEmitter implements Reporter {
  private _messageSink: (message: any) => void;
  private _rootDir!: string;

  constructor(messageSink: (message: any) => void) {
    this._messageSink = messageSink;
  }

  onBegin(config: FullConfig, suite: Suite) {
    this._rootDir = config.rootDir;
    const projects: any[] = [];
    const projectIds = uniqueProjectIds(config.projects);
    for (const projectSuite of suite.suites) {
      const report = this._serializeProject(projectSuite, projectIds);
      projects.push(report);
    }
    this._messageSink({ method: 'onBegin', params: { config: this._serializeConfig(config), projects } });
  }

  onTestBegin(test: TestCase, result: TestResult): void {
    (result as any)[idSymbol] = createGuid();
    this._messageSink({
      method: 'onTestBegin',
      params: {
        testId: test.id,
        result: this._serializeResultStart(result)
      }
    });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const testEnd: JsonTestEnd = {
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

  onStepBegin(test: TestCase, result: TestResult, step: TestStep): void {
    (step as any)[idSymbol] = createGuid();
    this._messageSink({
      method: 'onStepBegin',
      params: {
        testId: test.id,
        resultId: (result as any)[idSymbol],
        step: this._serializeStepStart(step)
      }
    });
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep): void {
    this._messageSink({
      method: 'onStepEnd',
      params: {
        testId: test.id,
        resultId: (result as any)[idSymbol],
        step: this._serializeStepEnd(step)
      }
    });
  }

  onError(error: TestError): void {
    this._messageSink({
      method: 'onError',
      params: { error }
    });
  }

  onStdOut(chunk: string | Buffer, test: void | TestCase, result: void | TestResult): void {
    this._onStdIO('stdio', chunk, test, result);
  }

  onStdErr(chunk: string | Buffer, test: void | TestCase, result: void | TestResult): void {
    this._onStdIO('stderr', chunk, test, result);
  }

  private _onStdIO(type: 'stdio' | 'stderr', chunk: string | Buffer, test: void | TestCase, result: void | TestResult): void {
    const isBase64 = typeof chunk !== 'string';
    const data = isBase64 ? chunk.toString('base64') : chunk;
    this._messageSink({
      method: 'onStdIO',
      params: { testId: test?.id, resultId: result ? (result as any)[idSymbol] : undefined, type, data, isBase64 }
    });
  }

  async onEnd(result: FullResult) {
    this._messageSink({ method: 'onEnd', params: { result } });
  }

  private _serializeConfig(config: FullConfig): JsonConfig {
    return {
      rootDir: config.rootDir,
      configFile: this._relativePath(config.configFile),
      listOnly: FullConfigInternal.from(config)?.cliListOnly,
      workers: config.workers,
    };
  }

  private _serializeProject(suite: Suite, projectIds: Map<FullProject, string>): JsonProject {
    const project = suite.project()!;
    const report: JsonProject = {
      id: projectIds.get(project)!,
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

  private _serializeSuite(suite: Suite): JsonSuite {
    const result = {
      type: suite._type,
      title: suite.title,
      fileId: (suite as SuitePrivate)._fileId,
      parallelMode: (suite as SuitePrivate)._parallelMode,
      location: this._relativeLocation(suite.location),
      suites: suite.suites.map(s => this._serializeSuite(s)),
      tests: suite.tests.map(t => this._serializeTest(t)),
    };
    return result;
  }

  private _serializeTest(test: TestCase): JsonTestCase {
    return {
      testId: test.id,
      title: test.title,
      location: this._relativeLocation(test.location),
      retries: test.retries,
    };
  }

  private _serializeResultStart(result: TestResult): JsonTestResultStart {
    return {
      id: (result as any)[idSymbol],
      retry: result.retry,
      workerIndex: result.workerIndex,
      parallelIndex: result.parallelIndex,
      startTime: result.startTime.toISOString(),
    };
  }

  private _serializeResultEnd(result: TestResult): JsonTestResultEnd {
    return {
      id: (result as any)[idSymbol],
      duration: result.duration,
      status: result.status,
      errors: result.errors,
      attachments: this._serializeAttachments(result.attachments),
    };
  }

  _serializeAttachments(attachments: TestResult['attachments']): TestResult['attachments'] {
    return attachments;
  }

  private _serializeStepStart(step: TestStep): JsonTestStepStart {
    return {
      id: (step as any)[idSymbol],
      parentStepId: (step.parent as any)?.[idSymbol],
      title: step.title,
      category: step.category,
      startTime: step.startTime.toISOString(),
      location: this._relativeLocation(step.location),
    };
  }

  private _serializeStepEnd(step: TestStep): JsonTestStepEnd {
    return {
      id: (step as any)[idSymbol],
      duration: step.duration,
      error: step.error,
    };
  }

  private _relativeLocation(location: Location): Location;
  private _relativeLocation(location?: Location): Location | undefined;
  private _relativeLocation(location: Location | undefined): Location | undefined {
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

const idSymbol = Symbol('id');
