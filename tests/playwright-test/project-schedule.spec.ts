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
import { test, expect } from './playwright-test-fixtures';

test('should work', async ({ runProjects }) => {
  const { exitCode, passed, getTimeline } =  await runProjects({
    config: {
      projects: [
        { name: 'a' },
      ],
      projectSchedule: [['a']],
    },
    files: {
      'a.spec.ts': `
          const { test } = pwt;
          test('a test', () => {});
        `,
    }
  });
  expect(exitCode).toBe(0);
  expect(passed).toBe(1);
  expect(await getTimeline()).toEqual([
    'begin::a::a test',
    'end::a::a test',
  ]);
});

test('should order two projects', async ({ runProjects }, testInfo) => {
  for (const order of [['a', 'b'], ['b', 'a']]) {
    await test.step(`order ${order[0]} then ${order[1]}`, async () => {
      const { exitCode, passed, getTimeline } =  await runProjects({
        config: {
          projects: [
            { name: 'a', testDir: testInfo.outputPath('a') },
            { name: 'b', testDir: testInfo.outputPath('b') },
          ],
          projectSchedule: [[order[0]], [order[1]]],
        },
        files: {
          'a/a.spec.ts': `
              const { test } = pwt;
              test('a test', async () => {
                await new Promise(f => setTimeout(f, 750));
              });
            `,
          'b/b.spec.ts': `
            const { test } = pwt;
            test('b test', async () => {
              await new Promise(f => setTimeout(f, 750));
            });
          `,
        }
      });
      expect(exitCode).toBe(0);
      expect(passed).toBe(2);
      expect(await getTimeline()).toEqual(order.map(name => [`begin::${name}::${name} test`, `end::${name}::${name} test`]).flat());
    });
  }
});

test('should do setup, run two projects, then do teardown', async ({ runProjects }, testInfo) => {
  const { exitCode, passed, getTimeline } =  await runProjects({
    config: {
      projects: [
        { name: 'setup', testDir: testInfo.outputPath('setup') },
        { name: 'a', testDir: testInfo.outputPath('a') },
        { name: 'b', testDir: testInfo.outputPath('b') },
        { name: 'teardown', testDir: testInfo.outputPath('teardown') },
      ],
      projectSchedule: [
        ['setup'],
        ['b', 'a'],
        ['teardown']
      ],
    },
    files: {
      'a/a.spec.ts': `
              const { test } = pwt;
              test('a test', async () => {
                await new Promise(f => setTimeout(f, 750));
              });
            `,
      'b/b.spec.ts': `
            const { test } = pwt;
            test('b test', async () => {
              await new Promise(f => setTimeout(f, 750));
            });
          `,
      'setup/setup.spec.ts': `
              const { test } = pwt;
              test('setup test', async () => {
                await new Promise(f => setTimeout(f, 750));
              });
            `,
      'teardown/teardown.spec.ts': `
            const { test } = pwt;
            test('teardown test', async () => {
              await new Promise(f => setTimeout(f, 750));
            });
          `,
    }
  });
  expect(exitCode).toBe(0);
  expect(passed).toBe(4);
  const timeline = await getTimeline();
  expect(timeline).toHaveLength(8);
  expect(await getTimeline()).toEqual(expect.arrayContaining([
    'begin::setup::setup test',
    'end::setup::setup test',
    expect.anything(),
    expect.anything(),
    expect.anything(),
    expect.anything(),
    'begin::teardown::teardown test',
    'end::teardown::teardown test',
  ]));
  const aStart = timeline.indexOf('begin::a::a test');
  const aEnd = timeline.indexOf('end::a::a test');
  const bStart = timeline.indexOf('begin::b::b test');
  const bEnd = timeline.indexOf('end::b::b test');
  const interleaved = aStart < bEnd && bStart < aEnd;
  expect(interleaved).toBe(true);
});

// TODO(rwoll): Additional tests to add
// - retries
// - repeat-each
// - behavior with fullyParallel flag
// - what happens when tests fail?
// - config validation (if projectSchedule present):
//   - no cycles
//   - all projects present in schedule
//   - project name appears exactly once in schedule
//   - all projects in schedule refer to actual projects
//   - no duplicate project names in project array
//   - throws error if projectSchedule is combined with shard option

