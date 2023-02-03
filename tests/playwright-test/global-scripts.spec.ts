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
import { test, expect } from './playwright-test-fixtures';

type Timeline = { titlePath: string[], event: 'begin' | 'end' }[];

function formatTimeline(timeline: Timeline) {
  return timeline.map(e => `${e.titlePath.slice(1).join(' > ')} [${e.event}]`).join('\n');
}

function formatFileNames(timeline: Timeline) {
  return timeline.map(e => e.titlePath[2]).join('\n');
}

function fileNames(timeline: Timeline) {
  const fileNames = Array.from(new Set(timeline.map(({ titlePath }) => {
    const name = titlePath[2];
    const index = name.lastIndexOf(path.sep);
    if (index === -1)
      return name;
    return name.slice(index + 1);
  })).keys());
  fileNames.sort();
  return fileNames;
}

function expectFilesRunBefore(timeline: Timeline, before: string[], after: string[]) {
  const fileBegin = name => {
    const index = timeline.findIndex(({ titlePath }) => titlePath[2] === name);
    expect(index, `cannot find ${name} in\n${formatFileNames(timeline)}`).not.toBe(-1);
    return index;
  };
  const fileEnd = name => {
    // There is no Array.findLastIndex in Node < 18.
    let index = -1;
    for (index = timeline.length - 1; index >= 0; index--) {
      if (timeline[index].titlePath[2] === name)
        break;
    }
    expect(index, `cannot find ${name} in\n${formatFileNames(timeline)}`).not.toBe(-1);
    return index;
  };

  for (const b of before) {
    const bEnd = fileEnd(b);
    for (const a of after) {
      const aBegin = fileBegin(a);
      expect(bEnd < aBegin, `'${b}' expected to finish before ${a}, actual order:\n${formatTimeline(timeline)}`).toBeTruthy();
    }
  }
}

test('should work for one project', async ({ runGroups }, testInfo) => {
  const files = {
    'playwright.config.ts': `
      module.exports = {
        projects: [
          {
            name: 'setup',
            testMatch: /.*global.ts/,
          },
          {
            name: 'p1',
            testMatch: /.*.test.ts/,
            dependencies: ['setup'],
          },
        ]
      };`,
    'a.test.ts': `
      const { test } = pwt;
      test('test1', async () => { });
      test('test2', async () => { });
    `,
    'global.ts': `
      const { test } = pwt;
      test('setup1', async () => { });
      test('setup2', async () => { });
    `,
  };
  const { exitCode, passed, timeline } = await runGroups(files);
  expect(exitCode).toBe(0);
  expect(passed).toBe(4);
  expect(formatTimeline(timeline)).toEqual(`setup > global.ts > setup1 [begin]
setup > global.ts > setup1 [end]
setup > global.ts > setup2 [begin]
setup > global.ts > setup2 [end]
p1 > a.test.ts > test1 [begin]
p1 > a.test.ts > test1 [end]
p1 > a.test.ts > test2 [begin]
p1 > a.test.ts > test2 [end]`);
});

test('should work for several projects', async ({ runGroups }, testInfo) => {
  const files = {
    'playwright.config.ts': `
      module.exports = {
        projects: [
          {
            name: 'setup',
            testMatch: /.*global.ts/,
          },
          {
            name: 'p1',
            testMatch: /.*a.test.ts/,
            dependencies: ['setup'],
          },
          {
            name: 'p2',
            testMatch: /.*b.test.ts/,
            dependencies: ['setup'],
          },
        ]
      };`,
    'a.test.ts': `
      const { test } = pwt;
      test('test1', async () => { });
      test('test2', async () => { });
    `,
    'b.test.ts': `
      const { test } = pwt;
      test('test1', async () => { });
      test('test2', async () => { });
    `,
    'global.ts': `
      const { test } = pwt;
      test('setup1', async () => { });
      test('setup2', async () => { });
    `,
  };
  const { exitCode, passed, timeline } = await runGroups(files);
  expect(exitCode).toBe(0);
  expect(passed).toBe(6);
  expectFilesRunBefore(timeline, [`global.ts`], [`a.test.ts`, `b.test.ts`]);
});

test('should skip tests if global setup fails', async ({ runGroups }, testInfo) => {
  const files = {
    'playwright.config.ts': `
      module.exports = {
        projects: [
          {
            name: 'setup',
            testMatch: /.*global.ts/,
          },
          {
            name: 'p1',
            testMatch: /.*a.test.ts/,
            dependencies: ['setup'],
          },
          {
            name: 'p2',
            testMatch: /.*b.test.ts/,
            dependencies: ['setup'],
          },
        ]
      };`,
    'a.test.ts': `
      const { test } = pwt;
      test('test1', async () => { });
      test('test2', async () => { });
    `,
    'b.test.ts': `
      const { test } = pwt;
      test('test1', async () => { });
    `,
    'global.ts': `
      const { test, expect } = pwt;
      test('setup1', async () => { });
      test('setup2', async () => { expect(1).toBe(2) });
    `,
  };
  const { exitCode, passed, skipped } = await runGroups(files);
  expect(exitCode).toBe(1);
  expect(passed).toBe(1);
  expect(skipped).toBe(3);
});

test('should run setup in each project shard', async ({ runGroups }, testInfo) => {
  const files = {
    'playwright.config.ts': `
      module.exports = {
        projects: [
          {
            name: 'setup',
            testMatch: /.*global.ts/,
          },
          {
            name: 'p1',
            dependencies: ['setup'],
          },
        ]
      };`,
    'a.test.ts': `
      const { test } = pwt;
      test('test1', async () => { });
      test('test2', async () => { });
      test('test3', async () => { });
      test('test4', async () => { });
    `,
    'b.test.ts': `
      const { test } = pwt;
      test('test1', async () => { });
      test('test2', async () => { });
    `,
    'global.ts': `
      const { test, expect } = pwt;
      test('setup1', async () => { });
      test('setup2', async () => { });
    `,
  };

  { // Shard 1/2
    const { exitCode, passed, timeline, output } =  await runGroups(files, { shard: '1/2' });
    expect(output).toContain('Running 6 tests using 1 worker, shard 1 of 2');
    expect(fileNames(timeline)).toEqual(['a.test.ts', 'global.ts']);
    expectFilesRunBefore(timeline, [`global.ts`], [`a.test.ts`]);
    expect(exitCode).toBe(0);
    expect(passed).toBe(6);
  }
  { // Shard 2/2
    const { exitCode, passed, timeline, output } =  await runGroups(files, { shard: '2/2' });
    expect(output).toContain('Running 4 tests using 1 worker, shard 2 of 2');
    expect(fileNames(timeline)).toEqual(['b.test.ts', 'global.ts']);
    expectFilesRunBefore(timeline, [`global.ts`], [`b.test.ts`]);
    expect(exitCode).toBe(0);
    expect(passed).toBe(4);
  }
});

