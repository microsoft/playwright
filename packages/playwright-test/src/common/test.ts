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

import type { FixturePool } from './fixtures';
import type * as reporterTypes from '../../types/testReporter';
import type { SuitePrivate } from '../../types/reporterPrivate';
import type { TestTypeImpl } from './testType';
import { rootTestType } from './testType';
import type { Annotation, FixturesWithLocation, FullProjectInternal } from './config';
import type { FullProject } from '../../types/test';
import type { Location } from '../../types/testReporter';

class Base {
  title: string;
  _only = false;
  _requireFile: string = '';

  constructor(title: string) {
    this.title = title;
  }
}

export type Modifier = {
  type: 'slow' | 'fixme' | 'skip' | 'fail',
  fn: Function,
  location: Location,
  description: string | undefined
};

export class Suite extends Base implements SuitePrivate {
  location?: Location;
  parent?: Suite;
  _use: FixturesWithLocation[] = [];
  _entries: (Suite | TestCase)[] = [];
  _eachHooks: { type: 'beforeEach' | 'afterEach', fn: Function, location: Location }[] = [];
  _timeout: number | undefined;
  _retries: number | undefined;
  _staticAnnotations: Annotation[] = [];
  _modifiers: Modifier[] = [];
  _parallelMode: 'default' | 'serial' | 'parallel' = 'default';
  _fullProject: FullProjectInternal | undefined;
  _fileId: string | undefined;
  readonly _type: 'root' | 'project' | 'file' | 'describe';

  constructor(title: string, type: 'root' | 'project' | 'file' | 'describe') {
    super(title);
    this._type = type;
  }

  get suites(): Suite[] {
    return this._entries.filter(entry => entry instanceof Suite) as Suite[];
  }

  get tests(): TestCase[] {
    return this._entries.filter(entry => entry instanceof TestCase) as TestCase[];
  }

  _addTest(test: TestCase) {
    test.parent = this;
    this._entries.push(test);
  }

  _addSuite(suite: Suite) {
    suite.parent = this;
    this._entries.push(suite);
  }

  _prependSuite(suite: Suite) {
    suite.parent = this;
    this._entries.unshift(suite);
  }

  _sortHooksAndTests() {
    // Although one can declare hooks and tests in any order,
    // it is convenient to see them reported as: beforeAll, tests, afterAll.
    const beforeHooks: TestCase[] = [];
    const afterHooks: TestCase[] = [];
    const otherEntries: (TestCase | Suite)[] = [];
    for (const entry of this._entries) {
      if (entry instanceof Suite) {
        entry._sortHooksAndTests();
        otherEntries.push(entry);
        continue;
      }
      if (entry._kind === 'beforeAll')
        beforeHooks.push(entry);
      else if (entry._kind === 'afterAll')
        afterHooks.push(entry);
      else
        otherEntries.push(entry);
    }
    this._entries = [...beforeHooks, ...otherEntries, ...afterHooks];
  }

  allTests(): TestCase[] {
    const result: TestCase[] = [];
    const visit = (suite: Suite) => {
      for (const entry of suite._entries) {
        if (entry instanceof Suite)
          visit(entry);
        else
          result.push(entry);
      }
    };
    visit(this);
    return result;
  }

  titlePath(): string[] {
    const titlePath = this.parent ? this.parent.titlePath() : [];
    // Ignore anonymous describe blocks.
    if (this.title || this._type !== 'describe')
      titlePath.push(this.title);
    return titlePath;
  }

  _getOnlyItems(): (TestCase | Suite)[] {
    const items: (TestCase | Suite)[] = [];
    if (this._only)
      items.push(this);
    for (const suite of this.suites)
      items.push(...suite._getOnlyItems());
    items.push(...this.tests.filter(test => test._only));
    return items;
  }

  _deepClone(): Suite {
    const suite = this._clone();
    for (const entry of this._entries) {
      if (entry instanceof Suite)
        suite._addSuite(entry._deepClone());
      else
        suite._addTest(entry._clone());
    }
    return suite;
  }

  _deepSerialize(): any {
    const suite = this._serialize();
    suite.entries = [];
    for (const entry of this._entries) {
      if (entry instanceof Suite)
        suite.entries.push(entry._deepSerialize());
      else
        suite.entries.push(entry._serialize());
    }
    return suite;
  }

  static _deepParse(data: any): Suite {
    const suite = Suite._parse(data);
    for (const entry of data.entries) {
      if (entry.kind === 'suite')
        suite._addSuite(Suite._deepParse(entry));
      else
        suite._addTest(TestCase._parse(entry));
    }
    return suite;
  }

  _forEachTest(visitor: (test: TestCase, suite: Suite) => void) {
    for (const entry of this._entries) {
      if (entry instanceof Suite)
        entry._forEachTest(visitor);
      else
        visitor(entry, this);
    }
  }

  _serialize(): any {
    return {
      kind: 'suite',
      title: this.title,
      type: this._type,
      location: this.location,
      only: this._only,
      requireFile: this._requireFile,
      timeout: this._timeout,
      retries: this._retries,
      staticAnnotations: this._staticAnnotations.slice(),
      modifiers: this._modifiers.slice(),
      parallelMode: this._parallelMode,
      eachHooks: this._eachHooks.map(h => ({ type: h.type, location: h.location })),
    };
  }

  static _parse(data: any): Suite {
    const suite = new Suite(data.title, data.type);
    suite.location = data.location;
    suite._only = data.only;
    suite._requireFile = data.requireFile;
    suite._timeout = data.timeout;
    suite._retries = data.retries;
    suite._staticAnnotations = data.staticAnnotations;
    suite._modifiers = data.modifiers;
    suite._parallelMode = data.parallelMode;
    suite._eachHooks = data.eachHooks.map((h: any) => ({ type: h.type, location: h.location, fn: () => { } }));
    return suite;
  }

  _clone(): Suite {
    const data = this._serialize();
    const suite = Suite._parse(data);
    suite._use = this._use.slice();
    suite._eachHooks = this._eachHooks.slice();
    suite._modifiers = this._modifiers.slice();
    suite._fullProject = this._fullProject;
    return suite;
  }

  project(): FullProject | undefined {
    return this._fullProject?.project || this.parent?.project();
  }
}

type TestKind = 'test' | 'beforeAll' | 'afterAll';

export class TestCase extends Base implements reporterTypes.TestCase {
  fn: Function;
  results: reporterTypes.TestResult[] = [];
  location: Location;
  parent!: Suite;

  expectedStatus: reporterTypes.TestStatus = 'passed';
  timeout = 0;
  annotations: Annotation[] = [];
  retries = 0;
  repeatEachIndex = 0;

  _kind: TestKind;
  _testType: TestTypeImpl;
  id = '';
  _pool: FixturePool | undefined;
  _poolDigest = '';
  _workerHash = '';
  _projectId = '';
  // Annotations known statically before running the test, e.g. `test.skip()` or `test.describe.skip()`.
  _staticAnnotations: Annotation[] = [];

  constructor(kind: TestKind, title: string, fn: Function, testType: TestTypeImpl, location: Location) {
    super(title);
    this.fn = fn;
    this._testType = testType;
    this._kind = kind;
    this.location = location;
  }

  titlePath(): string[] {
    const titlePath = this.parent ? this.parent.titlePath() : [];
    titlePath.push(this.title);
    return titlePath;
  }

  outcome(): 'skipped' | 'expected' | 'unexpected' | 'flaky' {
    const nonSkipped = this.results.filter(result => result.status !== 'skipped' && result.status !== 'interrupted');
    if (!nonSkipped.length)
      return 'skipped';
    if (nonSkipped.every(result => result.status === this.expectedStatus))
      return 'expected';
    if (nonSkipped.some(result => result.status === this.expectedStatus))
      return 'flaky';
    return 'unexpected';
  }

  ok(): boolean {
    const status = this.outcome();
    return status === 'expected' || status === 'flaky' || status === 'skipped';
  }

  _serialize(): any {
    return {
      kind: this._kind,
      title: this.title,
      location: this.location,
      only: this._only,
      requireFile: this._requireFile,
      poolDigest: this._poolDigest,
      expectedStatus: this.expectedStatus,
      staticAnnotations: this._staticAnnotations.slice(),
    };
  }

  static _parse(data: any): TestCase {
    const test = new TestCase(data.kind, data.title, () => {}, rootTestType, data.location);
    test._only = data.only;
    test._requireFile = data.requireFile;
    test._poolDigest = data.poolDigest;
    test.expectedStatus = data.expectedStatus;
    test._staticAnnotations = data.staticAnnotations;
    return test;
  }

  _clone(): TestCase {
    const data = this._serialize();
    const test = TestCase._parse(data);
    test._testType = this._testType;
    test.fn = this.fn;
    return test;
  }

  _appendTestResult(): reporterTypes.TestResult {
    const result: reporterTypes.TestResult = {
      // Hooks are never retried on their own, but could be executed in multiple parallel workers.
      retry: this._kind === 'test' ? this.results.length : 0,
      parallelIndex: -1,
      workerIndex: -1,
      duration: 0,
      startTime: new Date(),
      stdout: [],
      stderr: [],
      attachments: [],
      status: 'skipped',
      steps: [],
      errors: [],
    };
    this.results.push(result);
    return result;
  }
}
