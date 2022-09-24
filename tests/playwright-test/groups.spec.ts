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
import type { PlaywrightTestConfig, TestInfo } from '@playwright/test';
import path from 'path';
import { test, expect } from './playwright-test-fixtures';

function createConfigWithProjects(names: string[], testInfo: TestInfo, groups: PlaywrightTestConfig['groups']): Record<string, string> {
  const config: PlaywrightTestConfig = {
    projects: names.map(name => ({ name, testDir: testInfo.outputPath(name) })),
    groups
  };
  const files = {};
  for (const name of names) {
    files[`${name}/${name}.spec.ts`] = `
      const { test } = pwt;
      test('${name} test', async () => {
        await new Promise(f => setTimeout(f, 100));
      });`;
  }
  files['playwright.config.ts'] = `
    import * as path from 'path';
    module.exports = ${JSON.stringify(config)};
    `;
  return files;
}

type Timeline = { titlePath: string[], event: 'begin' | 'end' }[];

function formatTimeline(timeline: Timeline) {
  return timeline.map(e => `${e.titlePath.slice(1).join(' > ')} [${e.event}]`).join('\n');
}

function expectRunBefore(timeline: Timeline, before: string[], after: string[]) {
  const begin = new Map<string, number>();
  const end = new Map<string, number>();
  for (let i = 0; i < timeline.length; i++) {
    const projectName = timeline[i].titlePath[1];
    const map = timeline[i].event === 'begin' ? begin : end;
    const oldIndex = map.get(projectName) ?? i;
    const newIndex = (timeline[i].event === 'begin') ? Math.min(i, oldIndex) : Math.max(i, oldIndex);
    map.set(projectName, newIndex);
  }
  for (const b of before) {
    for (const a of after) {
      const bEnd = end.get(b) as number;
      expect(bEnd === undefined, `Unknown project ${b}`).toBeFalsy();
      const aBegin = begin.get(a) as number;
      expect(aBegin === undefined, `Unknown project ${a}`).toBeFalsy();
      if (bEnd < aBegin)
        continue;
      throw new Error(`Project '${b}' expected to finish before '${a}'\nTest run order was:\n${formatTimeline(timeline)}`);
    }
  }
}

test('should work', async ({ runGroups }, testInfo) => {
  const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e', 'f'], testInfo, {
    default: ['a']
  });
  const { exitCode, passed, timeline } =  await runGroups(configWithFiles);
  expect(exitCode).toBe(0);
  expect(passed).toBe(1);
  expect(formatTimeline(timeline)).toEqual(`a > a${path.sep}a.spec.ts > a test [begin]
a > a${path.sep}a.spec.ts > a test [end]`);
});

test('should order two projects', async ({ runGroups }, testInfo) => {
  await test.step(`order a then b`, async () => {
    const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e', 'f'], testInfo, {
      default: [
        'a',
        'b'
      ]
    });
    const { exitCode, passed, timeline } =  await runGroups(configWithFiles);
    expect(exitCode).toBe(0);
    expect(passed).toBe(2);
    expect(formatTimeline(timeline)).toEqual(`a > a${path.sep}a.spec.ts > a test [begin]
a > a${path.sep}a.spec.ts > a test [end]
b > b${path.sep}b.spec.ts > b test [begin]
b > b${path.sep}b.spec.ts > b test [end]`);
  });
  await test.step(`order b then a`, async () => {
    const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e', 'f'], testInfo, {
      default: [
        'b',
        'a'
      ]
    });
    const { exitCode, passed, timeline } =  await runGroups(configWithFiles);
    expect(exitCode).toBe(0);
    expect(passed).toBe(2);
    expect(formatTimeline(timeline)).toEqual(`b > b${path.sep}b.spec.ts > b test [begin]
b > b${path.sep}b.spec.ts > b test [end]
a > a${path.sep}a.spec.ts > a test [begin]
a > a${path.sep}a.spec.ts > a test [end]`);
  });
});

test('should order 1-3-1 projects', async ({ runGroups }, testInfo) => {
  const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e', 'f'], testInfo, {
    default: [
      'e',
      ['d', 'c', 'b'],
      'a',
    ]
  });
  const { exitCode, passed, timeline } =  await runGroups(configWithFiles);
  expect(exitCode).toBe(0);
  expectRunBefore(timeline, ['e'], ['d', 'c', 'b']);
  expectRunBefore(timeline, ['d', 'c', 'b'], ['a']);
  expect(passed).toBe(5);
});

test('should order 2-2-2 projects', async ({ runGroups }, testInfo) => {
  const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e', 'f'], testInfo, {
    default: [
      ['a', 'b'],
      ['d', 'c'],
      ['e', 'f'],
    ]
  });
  const { exitCode, passed, timeline } =  await runGroups(configWithFiles);
  expect(exitCode).toBe(0);
  expectRunBefore(timeline, ['a', 'b'], ['c', 'd']);
  expectRunBefore(timeline, ['c', 'd'], ['e', 'f']);
  expect(passed).toBe(6);
});

test('should run parallel groups sequentially without overlaps', async ({ runGroups }, testInfo) => {
  const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e', 'f'], testInfo, {
    default: [
      ['a', 'b', 'c', 'd'],
      ['a', 'b', 'c', 'd'],
      ['a', 'b', 'c', 'd'],
    ]
  });
  const { exitCode, passed, timeline } =  await runGroups(configWithFiles);
  expect(exitCode).toBe(0);

  const expectedEndOfFirstPhase = events => {
    const firstProjectEndIndex = project => events.findIndex(e => e.event === 'end' && e.titlePath[1] === project);
    return Math.max(...['a', 'b', 'c', 'd'].map(firstProjectEndIndex));
  };
  const formatPhaseEvents = events => events.map(e => e.titlePath[1] + ':' + e.event);

  let remainingTimeline = timeline;
  for (let i = 0; i < 3; i++) {
    const phaseEndIndex = expectedEndOfFirstPhase(remainingTimeline);
    const firstPhase = formatPhaseEvents(remainingTimeline.slice(0, phaseEndIndex + 1));
    firstPhase.sort();
    expect(firstPhase, `check phase ${i}`).toEqual(['a:begin', 'a:end', 'b:begin', 'b:end', 'c:begin', 'c:end', 'd:begin', 'd:end']);
    remainingTimeline = remainingTimeline.slice(phaseEndIndex + 1);
  }
  expect(remainingTimeline.length).toBe(0);

  expect(passed).toBe(12);
});

test('should support phase with multiple project names', async ({ runGroups }, testInfo) => {
  const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e', 'f'], testInfo, {
    default: [
      [
        { project: ['a', 'b', 'c'] }
      ],
      [
        { project: ['d'] },
        { project: ['e', 'f'] }
      ],
    ]
  });

  const { exitCode, passed } =  await runGroups(configWithFiles);
  expect(exitCode).toBe(0);
  expect(passed).toBe(6);
});

test('should support varios syntax', async ({ runGroups }, testInfo) => {
  const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e', 'f'], testInfo, {
    default: [
      'a',
      ['a', 'b'],
      [
        { project: ['a', 'b'] }
      ],
      [
        { project: ['a', 'b'] },
        'c',
        { project: 'd' },
      ],
      [{ project: 'e' }],
      'f'
    ]
  });
  const { exitCode, passed } =  await runGroups(configWithFiles);
  expect(exitCode).toBe(0);
  expect(passed).toBe(11);
});

test('should support --group option', async ({ runGroups }, testInfo) => {
  const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e', 'f'], testInfo, {
    default: [
      'a', 'b'
    ],
    foo: [
      ['b', 'c']
    ],
    bar: [
      'd', 'e'
    ]
  });
  const formatPhaseEvents = events => events.map(e => e.titlePath[1] + ':' + e.event);
  {
    const { exitCode, passed, timeline } =  await runGroups(configWithFiles, { group: 'default' });
    expect(exitCode).toBe(0);
    expect(passed).toBe(2);
    expect(formatPhaseEvents(timeline)).toEqual(['a:begin', 'a:end', 'b:begin', 'b:end']);
  }
  {
    const { exitCode, passed, timeline } =  await runGroups(configWithFiles, { group: 'foo' });
    expect(exitCode).toBe(0);
    expect(passed).toBe(2);
    const formatted = formatPhaseEvents(timeline);
    formatted.sort();
    expect(formatted).toEqual(['b:begin', 'b:end', 'c:begin', 'c:end']);
  }
  {
    const { exitCode, passed, timeline } =  await runGroups(configWithFiles, { group: 'bar' });
    expect(exitCode).toBe(0);
    expect(passed).toBe(2);
    expect(formatPhaseEvents(timeline)).toEqual(['d:begin', 'd:end', 'e:begin', 'e:end']);
  }
});

test('should throw when unknown --group is passed', async ({ runGroups }, testInfo) => {
  const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e', 'f'], testInfo, {
    default: [
      'a', 'b'
    ],
    foo: [
      ['b', 'c']
    ]
  });
  const { exitCode, output } =  await runGroups(configWithFiles, { group: 'bar' });
  expect(exitCode).toBe(1);
  expect(output).toContain(`Cannot find project group 'bar' in the config`);
});
