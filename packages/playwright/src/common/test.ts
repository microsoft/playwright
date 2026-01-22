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

import { rootTestType } from './testType';
import { computeTestCaseOutcome } from '../isomorphic/teleReceiver';

import type { FixturesWithLocation, FullProjectInternal } from './config';
import type { FixturePool } from './fixtures';
import type { TestTypeImpl } from './testType';
import type { TestAnnotation } from '../../types/test';
import type * as reporterTypes from '../../types/testReporter';
import type { FullProject, Location } from '../../types/testReporter';


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

export class Suite extends Base {
  location?: Location;
  parent?: Suite;
  _use: FixturesWithLocation[] = [];
  _entries: (Suite | TestCase)[] = [];
  _hooks: { type: 'beforeEach' | 'afterEach' | 'beforeAll' | 'afterAll', fn: Function, title: string, location: Location }[] = [];
  _timeout: number | undefined;
  _retries: number | undefined;
  // Annotations known statically before running the test, e.g. `test.describe.skip()` or `test.describe({ annotation }, body)`.
  _staticAnnotations: TestAnnotation[] = [];
  // Explicitly declared tags that are not a part of the title.
  _tags: string[] = [];
  _modifiers: Modifier[] = [];
  _parallelMode: 'none' | 'default' | 'serial' | 'parallel' = 'none';
  _fullProject: FullProjectInternal | undefined;
  _fileId: string | undefined;
  readonly _type: 'root' | 'project' | 'file' | 'describe';

  constructor(title: string, type: 'root' | 'project' | 'file' | 'describe') {
    super(title);
    this._type = type;
  }

  get type(): 'root' | 'project' | 'file' | 'describe' {
    return this._type;
  }

  entries() {
    return this._entries;
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

  _hasTests(): boolean {
    let result = false;
    const visit = (suite: Suite) => {
      for (const entry of suite._entries) {
        if (result)
          return;
        if (entry instanceof Suite)
          visit(entry);
        else
          result = true;
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

  _collectGrepTitlePath(path: string[]) {
    if (this.parent)
      this.parent._collectGrepTitlePath(path);
    if (this.title || this._type !== 'describe')
      path.push(this.title);
    path.push(...this._tags);
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

  forEachTest(visitor: (test: TestCase, suite: Suite) => void) {
    for (const entry of this._entries) {
      if (entry instanceof Suite)
        entry.forEachTest(visitor);
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
      tags: this._tags.slice(),
      modifiers: this._modifiers.slice(),
      parallelMode: this._parallelMode,
      hooks: this._hooks.map(h => ({ type: h.type, location: h.location, title: h.title })),
      fileId: this._fileId,
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
    suite._tags = data.tags;
    suite._modifiers = data.modifiers;
    suite._parallelMode = data.parallelMode;
    suite._hooks = data.hooks.map((h: any) => ({ type: h.type, location: h.location, title: h.title, fn: () => { } }));
    suite._fileId = data.fileId;
    return suite;
  }

  _clone(): Suite {
    const data = this._serialize();
    const suite = Suite._parse(data);
    suite._use = this._use.slice();
    suite._hooks = this._hooks.slice();
    suite._fullProject = this._fullProject;
    return suite;
  }

  project(): FullProject | undefined {
    return this._fullProject?.project || this.parent?.project();
  }
}

export class TestCase extends Base implements reporterTypes.TestCase {
  fn: Function;
  results: reporterTypes.TestResult[] = [];
  location: Location;
  parent!: Suite;
  type: 'test' = 'test';

  expectedStatus: reporterTypes.TestStatus = 'passed';
  timeout = 0;
  annotations: TestAnnotation[] = [];
  retries = 0;
  repeatEachIndex = 0;

  _testType: TestTypeImpl;
  id = '';
  _pool: FixturePool | undefined;
  _poolDigest = '';
  _workerHash = '';
  _projectId = '';
  // Explicitly declared tags that are not a part of the title.
  _tags: string[] = [];

  constructor(title: string, fn: Function, testType: TestTypeImpl, location: Location) {
    super(title);
    this.fn = fn;
    this._testType = testType;
    this.location = location;
  }

  titlePath(): string[] {
    const titlePath = this.parent ? this.parent.titlePath() : [];
    titlePath.push(this.title);
    return titlePath;
  }

  outcome(): 'skipped' | 'expected' | 'unexpected' | 'flaky' {
    return computeTestCaseOutcome(this);
  }

  ok(): boolean {
    const status = this.outcome();
    return status === 'expected' || status === 'flaky' || status === 'skipped';
  }

  get tags(): string[] {
    const titleTags = this._grepBaseTitlePath().join(' ').match(/@[\S]+/g) || [];

    return [
      ...titleTags,
      ...this._tags,
    ];
  }

  _serialize(): any {
    return {
      kind: 'test',
      id: this.id,
      title: this.title,
      retries: this.retries,
      timeout: this.timeout,
      expectedStatus: this.expectedStatus,
      location: this.location,
      only: this._only,
      requireFile: this._requireFile,
      poolDigest: this._poolDigest,
      workerHash: this._workerHash,
      annotations: this.annotations.slice(),
      tags: this._tags.slice(),
      projectId: this._projectId,
    };
  }

  static _parse(data: any): TestCase {
    const test = new TestCase(data.title, () => {}, rootTestType, data.location);
    test.id = data.id;
    test.retries = data.retries;
    test.timeout = data.timeout;
    test.expectedStatus = data.expectedStatus;
    test._only = data.only;
    test._requireFile = data.requireFile;
    test._poolDigest = data.poolDigest;
    test._workerHash = data.workerHash;
    test.annotations = data.annotations;
    test._tags = data.tags;
    test._projectId = data.projectId;
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
      retry: this.results.length,
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
      annotations: [],
    };
    this.results.push(result);
    return result;
  }

  _grepBaseTitlePath(): string[] {
    const path: string[] = [];
    this.parent._collectGrepTitlePath(path);
    path.push(this.title);
    return path;
  }

  _grepTitleWithTags(): string {
    const path = this._grepBaseTitlePath();
    path.push(...this._tags);
    return path.join(' ');
  }
}
