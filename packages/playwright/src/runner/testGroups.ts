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

import fs from 'fs';
import path from 'path';

import type { test } from '../common';

export type TestGroup = {
  workerHash: string;
  requireFile: string;
  repeatEachIndex: number;
  projectId: string;
  tests: test.TestCase[];
};

export type ShardingMode =
  | 'partition'
  | 'round-robin'
  | 'timings'
  | { sequencer: string };

export type ShardingOptions = {
  mode?: ShardingMode;
  weights?: number[];
  timingsFile?: string;
  configDir?: string;
};

export type CustomSequencer = (
  groups: TestGroup[],
  shard: { current: number, total: number },
) => Set<TestGroup> | TestGroup[];

export function createTestGroups(projectSuite: test.Suite, expectedParallelism: number): TestGroup[] {
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
    parallel: Map<test.Suite | test.TestCase, TestGroup>,
    parallelWithHooks: TestGroup,
  }>>();

  const createGroup = (test: test.TestCase): TestGroup => {
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
    let outerMostSequentialSuite: test.Suite | undefined;
    let hasAllHooks = false;
    for (let parent: test.Suite | undefined = test.parent; parent; parent = parent.parent) {
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
      const parallelWithHooksGroupSize = Math.ceil(withRequireFile.parallelWithHooks.tests.length / expectedParallelism);
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

export function filterForShard(
  shard: { total: number, current: number },
  weights: number[] | undefined,
  testGroups: TestGroup[],
  options: ShardingOptions = {},
): Set<TestGroup> {
  const mode = options.mode ?? 'partition';

  if (mode === 'round-robin')
    return filterForShardRoundRobin(shard, testGroups);

  if (mode === 'timings')
    return filterForShardTimings(shard, testGroups, options.timingsFile, options.configDir);

  if (typeof mode === 'object' && mode !== null && 'sequencer' in mode)
    return filterForShardCustom(shard, testGroups, mode.sequencer, options.configDir);

  // Default: partition (contiguous range).
  return filterForShardPartition(shard, weights, testGroups);
}

export function filterForShardPartition(shard: { total: number, current: number }, weights: number[] | undefined, testGroups: TestGroup[]): Set<TestGroup> {
  weights ??= Array.from({ length: shard.total }, () => 1);
  if (weights.length !== shard.total)
    throw new Error(`PWTEST_SHARD_WEIGHTS number of weights must match the shard total of ${shard.total}`);

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  // Note that sharding works based on test groups.
  // This means parallel files will be sharded by single tests,
  // while non-parallel files will be sharded by the whole file.
  //
  // Shards are still balanced by the number of tests, not files,
  // even in the case of non-paralleled files.

  let shardableTotal = 0;
  for (const group of testGroups)
    shardableTotal += group.tests.length;

  // Each shard gets some tests.
  const shardSizes = weights.map(w => Math.floor(w * shardableTotal / totalWeight));
  const remainder = shardableTotal - shardSizes.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remainder; i++) {
    // First few shards get one more test each.
    shardSizes[i % shardSizes.length]++;
  }

  let from = 0;
  for (let i = 0; i < shard.current - 1; i++)
    from += shardSizes[i];
  const to = from + shardSizes[shard.current - 1];

  let current = 0;
  const result = new Set<TestGroup>();
  for (const group of testGroups) {
    // Any test group goes to the shard that contains the first test of this group.
    // So, this shard gets any group that starts at [from; to)
    if (current >= from && current < to)
      result.add(group);
    current += group.tests.length;
  }
  return result;
}

export function filterForShardRoundRobin(shard: { total: number, current: number }, testGroups: TestGroup[]): Set<TestGroup> {
  // Each group is assigned to a shard by its index modulo the shard total.
  // Better balance than partition when test durations are uneven across the input order.
  const result = new Set<TestGroup>();
  for (let i = 0; i < testGroups.length; i++) {
    if ((i % shard.total) === (shard.current - 1))
      result.add(testGroups[i]);
  }
  return result;
}

export function filterForShardTimings(
  shard: { total: number, current: number },
  testGroups: TestGroup[],
  timingsFile: string | undefined,
  configDir: string | undefined,
): Set<TestGroup> {
  // Bin-pack groups into shards using LPT (Longest Processing Time first).
  // Falls back to partition if the timings file is missing/empty.
  const timings = loadTimingsFile(timingsFile, configDir);
  if (!timings)
    return filterForShardPartition(shard, undefined, testGroups);

  const base = configDir ?? process.cwd();
  const lookupFileTiming = (requireFile: string): number | undefined => {
    return timings.get(requireFile)
      ?? timings.get(path.basename(requireFile))
      ?? timings.get(path.relative(base, requireFile));
  };
  const groupDuration = (group: TestGroup): number => {
    // Sum known per-test durations; missing tests contribute 0 (we warn once below).
    let total = 0;
    const fileTiming = lookupFileTiming(group.requireFile);
    for (const test of group.tests) {
      const byId = timings.get(test.id);
      total += byId ?? (fileTiming !== undefined ? fileTiming / Math.max(group.tests.length, 1) : 0);
    }
    return total;
  };

  const decorated = testGroups.map(group => ({ group, duration: groupDuration(group) }));
  decorated.sort((a, b) => b.duration - a.duration);

  // Greedy LPT bin packing.
  const bins: { groups: TestGroup[], load: number }[] = Array.from({ length: shard.total }, () => ({ groups: [], load: 0 }));
  for (const { group, duration } of decorated) {
    let bestIndex = 0;
    for (let i = 1; i < bins.length; i++) {
      if (bins[i].load < bins[bestIndex].load)
        bestIndex = i;
    }
    bins[bestIndex].groups.push(group);
    bins[bestIndex].load += duration;
  }

  return new Set(bins[shard.current - 1].groups);
}

function loadTimingsFile(timingsFile: string | undefined, configDir: string | undefined): Map<string, number> | undefined {
  if (!timingsFile)
    return undefined;
  const resolved = path.isAbsolute(timingsFile) ? timingsFile : path.resolve(configDir ?? process.cwd(), timingsFile);
  if (!fs.existsSync(resolved)) {
    // eslint-disable-next-line no-restricted-properties
    process.stderr.write(`[playwright] shardingMode: 'timings' — timings file not found at ${resolved}, falling back to partition.\n`);
    return undefined;
  }
  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (e) {
    // eslint-disable-next-line no-restricted-properties
    process.stderr.write(`[playwright] shardingMode: 'timings' — failed to parse ${resolved}: ${(e as Error).message}. Falling back to partition.\n`);
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object')
    return undefined;
  const map = new Map<string, number>();
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'number' && value >= 0)
      map.set(key, value);
  }
  return map.size ? map : undefined;
}

export function filterForShardCustom(
  shard: { total: number, current: number },
  testGroups: TestGroup[],
  sequencerPath: string,
  configDir: string | undefined,
): Set<TestGroup> {
  const resolved = path.isAbsolute(sequencerPath) ? sequencerPath : path.resolve(configDir ?? process.cwd(), sequencerPath);
  const mod = require(resolved);
  const fn: CustomSequencer = mod && mod.default ? mod.default : mod;
  if (typeof fn !== 'function')
    throw new Error(`[playwright] shardingMode sequencer at ${resolved} must export a function (default export or module.exports).`);
  const result = fn(testGroups, shard);
  return result instanceof Set ? result : new Set(result);
}
