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

import type { Suite, TestCase } from '../common/test';

export type TestGroup = {
  workerHash: string;
  requireFile: string;
  repeatEachIndex: number;
  projectId: string;
  tests: TestCase[];
};

export function createTestGroups(projectSuite: Suite, workers: number): TestGroup[] {
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
    let outerMostSequentialSuite: Suite | undefined;
    let hasAllHooks = false;
    for (let parent: Suite | undefined = test.parent; parent; parent = parent.parent) {
      if (parent._parallelMode === 'serial' || parent._parallelMode === 'default')
        outerMostSequentialSuite = parent;
      insideParallel = insideParallel || parent._parallelMode === 'parallel';
      hasAllHooks = hasAllHooks || parent._hooks.some(hook => hook.type === 'beforeAll' || hook.type === 'afterAll');
    }

    if (insideParallel) {
      if (hasAllHooks && !outerMostSequentialSuite) {
        withRequireFile.parallelWithHooks.tests.push(test);
      } else {
        const key = outerMostSequentialSuite || test;
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

export function filterForShard(shard: { total: number, current: number }, testGroups: TestGroup[]): Set<TestGroup> {
  // Note that sharding works based on test groups.
  // This means parallel files will be sharded by single tests,
  // while non-parallel files will be sharded by the whole file.
  //
  // Shards are still balanced by the number of tests, not files,
  // even in the case of non-paralleled files.

  const lengths = new Array(shard.total).fill(0);
  const shardSet = new Array(shard.total).fill(0).map(() => new Set<TestGroup>());

  // We sort the test groups by the number of tests in descending order.
  const sortedTestGroups = testGroups.slice().sort((a, b) => b.tests.length - a.tests.length);

  // Then we add each group to the shard with the smallest number of tests.
  for (const group of sortedTestGroups) {
    const index = lengths.reduce((minIndex, currentLength, currentIndex) => currentLength < lengths[minIndex] ? currentIndex : minIndex, 0);
    lengths[index] += group.tests.length;
    shardSet[index].add(group);
  }

  return shardSet[shard.current - 1];
}
