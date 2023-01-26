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

import { filterSuiteWithOnlySemantics } from '../common/suiteUtils';
import type { Suite, TestCase } from '../common/test';

export type TestGroup = {
  workerHash: string;
  requireFile: string;
  repeatEachIndex: number;
  projectId: string;
  tests: TestCase[];
};

export function createTestGroups(projectSuites: Suite[], workers: number): TestGroup[] {
  // This function groups tests that can be run together.
  // Tests cannot be run together when:
  // - They belong to different projects - requires different workers.
  // - They have a different repeatEachIndex - requires different workers.
  // - They have a different set of worker fixtures in the pool - requires different workers.
  // - They have a different requireFile - reuses the worker, but runs each requireFile separately.
  // - They belong to a parallel suite.

  // Using the map "workerHash -> requireFile -> group" makes us preserve the natural order
  // of worker hashes and require files for the simple cases.
  const groups = new Map<string, Map<string, {
    // Tests that must be run in order are in the same group.
    general: TestGroup,

    // There are 3 kinds of parallel tests:
    // - Tests belonging to parallel suites, without beforeAll/afterAll hooks.
    //   These can be run independently, they are put into their own group, key === test.
    // - Tests belonging to parallel suites, with beforeAll/afterAll hooks.
    //   These should share the worker as much as possible, put into single parallelWithHooks group.
    //   We'll divide them into equally-sized groups later.
    // - Tests belonging to serial suites inside parallel suites.
    //   These should run as a serial group, each group is independent, key === serial suite.
    parallel: Map<Suite | TestCase, TestGroup>,
    parallelWithHooks: TestGroup,
  }>>();

  const createGroup = (test: TestCase): TestGroup => {
    return {
      workerHash: test._workerHash,
      requireFile: test._requireFile,
      repeatEachIndex: test.repeatEachIndex,
      projectId: test._projectId,
      tests: [],
    };
  };

  for (const projectSuite of projectSuites) {
    for (const test of projectSuite.allTests()) {
      let withWorkerHash = groups.get(test._workerHash);
      if (!withWorkerHash) {
        withWorkerHash = new Map();
        groups.set(test._workerHash, withWorkerHash);
      }
      let withRequireFile = withWorkerHash.get(test._requireFile);
      if (!withRequireFile) {
        withRequireFile = {
          general: createGroup(test),
          parallel: new Map(),
          parallelWithHooks: createGroup(test),
        };
        withWorkerHash.set(test._requireFile, withRequireFile);
      }

      // Note that a parallel suite cannot be inside a serial suite. This is enforced in TestType.
      let insideParallel = false;
      let outerMostSerialSuite: Suite | undefined;
      let hasAllHooks = false;
      for (let parent: Suite | undefined = test.parent; parent; parent = parent.parent) {
        if (parent._parallelMode === 'serial')
          outerMostSerialSuite = parent;
        insideParallel = insideParallel || parent._parallelMode === 'parallel';
        hasAllHooks = hasAllHooks || parent._hooks.some(hook => hook.type === 'beforeAll' || hook.type === 'afterAll');
      }

      if (insideParallel) {
        if (hasAllHooks && !outerMostSerialSuite) {
          withRequireFile.parallelWithHooks.tests.push(test);
        } else {
          const key = outerMostSerialSuite || test;
          let group = withRequireFile.parallel.get(key);
          if (!group) {
            group = createGroup(test);
            withRequireFile.parallel.set(key, group);
          }
          group.tests.push(test);
        }
      } else {
        withRequireFile.general.tests.push(test);
      }
    }
  }

  const result: TestGroup[] = [];
  for (const withWorkerHash of groups.values()) {
    for (const withRequireFile of withWorkerHash.values()) {
      // Tests without parallel mode should run serially as a single group.
      if (withRequireFile.general.tests.length)
        result.push(withRequireFile.general);

      // Parallel test groups without beforeAll/afterAll can be run independently.
      result.push(...withRequireFile.parallel.values());

      // Tests with beforeAll/afterAll should try to share workers as much as possible.
      const parallelWithHooksGroupSize = Math.ceil(withRequireFile.parallelWithHooks.tests.length / workers);
      let lastGroup: TestGroup | undefined;
      for (const test of withRequireFile.parallelWithHooks.tests) {
        if (!lastGroup || lastGroup.tests.length >= parallelWithHooksGroupSize) {
          lastGroup = createGroup(test);
          result.push(lastGroup);
        }
        lastGroup.tests.push(test);
      }
    }
  }
  return result;
}

export async function filterForShard(shard: { total: number, current: number }, rootSuite: Suite, testGroups: TestGroup[]) {
  // Each shard includes:
  // - its portion of the regular tests
  // - project setup tests for the projects that have regular tests in this shard
  let shardableTotal = 0;
  for (const group of testGroups)
    shardableTotal += group.tests.length;

  const shardTests = new Set<TestCase>();

  // Each shard gets some tests.
  const shardSize = Math.floor(shardableTotal / shard.total);
  // First few shards get one more test each.
  const extraOne = shardableTotal - shardSize * shard.total;

  const currentShard = shard.current - 1; // Make it zero-based for calculations.
  const from = shardSize * currentShard + Math.min(extraOne, currentShard);
  const to = from + shardSize + (currentShard < extraOne ? 1 : 0);
  let current = 0;
  const shardProjects = new Set<string>();
  const shardTestGroups = [];
  for (const group of testGroups) {
    // Any test group goes to the shard that contains the first test of this group.
    // So, this shard gets any group that starts at [from; to)
    if (current >= from && current < to) {
      shardProjects.add(group.projectId);
      shardTestGroups.push(group);
      for (const test of group.tests)
        shardTests.add(test);
    }
    current += group.tests.length;
  }
  testGroups.length = 0;
  testGroups.push(...shardTestGroups);

  if (!shardTests.size) {
    // Filtering with "only semantics" does not work when we have zero tests - it leaves all the tests.
    // We need an empty suite in this case.
    rootSuite._entries = [];
  } else {
    filterSuiteWithOnlySemantics(rootSuite, () => false, test => shardTests.has(test));
  }
}
