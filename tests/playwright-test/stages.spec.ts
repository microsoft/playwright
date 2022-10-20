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
import type { PlaywrightTestConfig, TestInfo, PlaywrightTestProject } from '@playwright/test';
import path from 'path';
import { test, expect } from './playwright-test-fixtures';

function createConfigWithProjects(names: string[], testInfo: TestInfo, projectTemplates?: { [name: string]: PlaywrightTestProject }): Record<string, string> {
  const config: PlaywrightTestConfig = {
    projects: names.map(name => ({ ...projectTemplates?.[name], name, testDir: testInfo.outputPath(name) })),
  };
  const files = {};
  for (const name of names) {
    files[`${name}/${name}.spec.ts`] = `
      const { test } = pwt;
      test('${name} test', async () => {
        await new Promise(f => setTimeout(f, 100));
      });`;
  }
  function replacer(key, value) {
    if (value instanceof RegExp)
      return `RegExp(${value.toString()})`;
    else
      return value;
  }
  files['playwright.config.ts'] = `
    import * as path from 'path';
    module.exports = ${JSON.stringify(config, replacer, 2)};
    `.replace(/"RegExp\((.*)\)"/g, '$1');
  return files;
}

type Timeline = { titlePath: string[], event: 'begin' | 'end' }[];

function formatTimeline(timeline: Timeline) {
  return timeline.map(e => `${e.titlePath.slice(1).join(' > ')} [${e.event}]`).join('\n');
}

function projectNames(timeline: Timeline) {
  const projectNames = Array.from(new Set(timeline.map(({ titlePath }) => titlePath[1])).keys());
  projectNames.sort();
  return projectNames;
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

test('should work for two projects', async ({ runGroups }, testInfo) => {
  await test.step(`order a then b`, async () => {
    const projectTemplates = {
      'a': {
        stage: 10
      },
      'b': {
        stage: 20
      },
    };
    const configWithFiles = createConfigWithProjects(['a', 'b'], testInfo, projectTemplates);
    const { exitCode, passed, timeline } = await runGroups(configWithFiles);
    expect(exitCode).toBe(0);
    expect(passed).toBe(2);
    expect(formatTimeline(timeline)).toEqual(`a > a${path.sep}a.spec.ts > a test [begin]
a > a${path.sep}a.spec.ts > a test [end]
b > b${path.sep}b.spec.ts > b test [begin]
b > b${path.sep}b.spec.ts > b test [end]`);
  });
  await test.step(`order b then a`, async () => {
    const projectTemplates = {
      'a': {
        stage: 20
      },
      'b': {
        stage: 10
      },
    };
    const configWithFiles = createConfigWithProjects(['a', 'b'], testInfo, projectTemplates);
    const { exitCode, passed, timeline } = await runGroups(configWithFiles);
    expect(exitCode).toBe(0);
    expect(passed).toBe(2);
    expect(formatTimeline(timeline)).toEqual(`b > b${path.sep}b.spec.ts > b test [begin]
b > b${path.sep}b.spec.ts > b test [end]
a > a${path.sep}a.spec.ts > a test [begin]
a > a${path.sep}a.spec.ts > a test [end]`);
  });
});


test('should order 1-3-1 projects', async ({ runGroups }, testInfo) => {
  const projectTemplates = {
    'e': {
      stage: -100
    },
    'a': {
      stage: 100
    },
  };
  const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e'], testInfo, projectTemplates);
  const { exitCode, passed, timeline } =  await runGroups(configWithFiles);
  expect(exitCode).toBe(0);
  expectRunBefore(timeline, ['e'], ['d', 'c', 'b']);
  expectRunBefore(timeline, ['d', 'c', 'b'], ['a']);
  expect(passed).toBe(5);
});

test('should order 2-2-2 projects', async ({ runGroups }, testInfo) => {
  const projectTemplates = {
    'a': {
      stage: -30
    },
    'b': {
      stage: -30
    },
    'e': {
      stage: 40
    },
    'f': {
      stage: 40
    },
  };
  const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e', 'f'], testInfo, projectTemplates);
  const { exitCode, passed, timeline } =  await runGroups(configWithFiles);
  expect(exitCode).toBe(0);
  expectRunBefore(timeline, ['a', 'b'], ['c', 'd']);
  expectRunBefore(timeline, ['c', 'd'], ['e', 'f']);
  expect(passed).toBe(6);
});

test('should order project according to stage 1-1-2-2', async ({ runGroups }, testInfo) => {
  const projectTemplates = {
    'a': {
      stage: 10
    },
    'b': {
      stage: 10
    },
    'd': {
      stage: -10
    },
    'e': {
      stage: -20
    },
  };
  const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e', 'f'], testInfo, projectTemplates);
  const { exitCode, passed, timeline } =  await runGroups(configWithFiles);
  expect(exitCode).toBe(0);
  expect(passed).toBe(6);
  expect(projectNames(timeline)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  expectRunBefore(timeline, ['e'], ['a', 'b', 'c', 'd', 'f']); // -20
  expectRunBefore(timeline, ['d'], ['a', 'b', 'c', 'f']); // -10
  expectRunBefore(timeline, ['c', 'f'], ['a', 'b']); // 0
  expect(passed).toBe(6);
});

test('should work with project filter', async ({ runGroups }, testInfo) => {
  const projectTemplates = {
    'a': {
      stage: 10
    },
    'b': {
      stage: 10
    },
    'e': {
      stage: -10
    },
    'f': {
      stage: -10
    },
  };
  const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e', 'f'], testInfo, projectTemplates);
  const { exitCode, passed, timeline } =  await runGroups(configWithFiles, { project: ['b', 'c', 'e'] });
  expect(exitCode).toBe(0);
  expect(passed).toBe(3);
  expect(projectNames(timeline)).toEqual(['b', 'c', 'e']);
  expectRunBefore(timeline, ['e'], ['b', 'c']); // -10 < 0
  expectRunBefore(timeline, ['c'], ['b']); // 0 < 10
  expect(passed).toBe(3);
});

test('should skip after failire by default', async ({ runGroups }, testInfo) => {
  const projectTemplates = {
    'a': {
      stage: 1
    },
    'b': {
      stage: 2,
      run: 'default'
    },
    'c': {
      stage: 2
    },
    'd': {
      stage: 4,
      run: 'default' // this is not important as the test is skipped
    },
    'e': {
      stage: 4
    },
  };
  const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e'], testInfo, projectTemplates);
  configWithFiles[`b/b.spec.ts`] = `
    const { test } = pwt;
    test('b test', async () => {
      expect(1).toBe(2);
    });`;
  configWithFiles[`d/d.spec.ts`] = `
    const { test } = pwt;
    test('d test', async () => {
      expect(1).toBe(2);
    });`;
  const { exitCode, passed, failed, skipped, timeline } =  await runGroups(configWithFiles);
  expect(exitCode).toBe(1);
  expect(failed).toBe(1);
  expect(passed).toBe(2); // 'c' may either pass or be skipped.
  expect(skipped).toBe(2);
  expect(projectNames(timeline)).toEqual(['a', 'b', 'c', 'd', 'e']);
  expectRunBefore(timeline, ['a'], ['b', 'c']); // 1 < 2
  expectRunBefore(timeline, ['b', 'c'], ['d', 'e']); // 2 < 4
});

test('should run after failire if run:always', async ({ runGroups }, testInfo) => {
  const projectTemplates = {
    'a': {
      stage: 1
    },
    'b': {
      stage: 2,
      run: 'default'
    },
    'c': {
      stage: 2
    },
    'd': {
      stage: 4,
      run: 'always'
    },
    'e': {
      stage: 4
    },
    'f': {
      stage: 10,
      run: 'always'
    },
  };
  const configWithFiles = createConfigWithProjects(['a', 'b', 'c', 'd', 'e', 'f'], testInfo, projectTemplates);
  configWithFiles[`b/b.spec.ts`] = `
    const { test } = pwt;
    test('b test', async () => {
      expect(1).toBe(2);
    });`;
  const { exitCode, passed, failed, skipped, timeline } =  await runGroups(configWithFiles);
  expect(exitCode).toBe(1);
  expect(passed).toBe(4);
  expect(failed).toBe(1);
  expect(skipped).toBe(1);
  expect(projectNames(timeline)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  expectRunBefore(timeline, ['a'], ['b', 'c']); // 1 < 2
  expectRunBefore(timeline, ['b', 'c'], ['d', 'e']); // 2 < 4
  expectRunBefore(timeline, ['d', 'e'], ['f']); // 4 < 10
});

test('should split project if no run: always', async ({ runGroups }, testInfo) => {
  const files = {
    'playwright.config.ts': `
      module.exports = {
        projects: [
          {
            stage: 10,
            name: 'proj-1',
            testMatch: /.*(a|b).test.ts/,
          },
          {
            stage: 20,
            name: 'proj-2',
            testMatch: /.*c.test.ts/,
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
    'c.test.ts': `
      const { test } = pwt;
      test('test1', async () => { });
      test('test2', async () => { });
    `,
  };

  { // Shard 1/2
    const { exitCode, passed, output } =  await runGroups(files, { shard: '1/2' });
    expect(output).toContain('Running 4 tests using 1 worker, shard 1 of 2');
    expect(output).toContain('[proj-1] › a.test.ts:6:7 › test1');
    expect(output).toContain('[proj-1] › a.test.ts:7:7 › test2');
    expect(output).toContain('[proj-1] › a.test.ts:8:7 › test3');
    expect(output).toContain('[proj-1] › a.test.ts:9:7 › test4');
    expect(output).not.toContain('[proj-2]');
    expect(output).not.toContain('b.test.ts');
    expect(output).not.toContain('c.test.ts');
    expect(exitCode).toBe(0);
    expect(passed).toBe(4);
  }
  { // Shard 2/2
    const { exitCode, passed, output } =  await runGroups(files, { shard: '2/2' });
    expect(output).toContain('Running 4 tests using 1 worker, shard 2 of 2');
    expect(output).toContain('[proj-1] › b.test.ts:6:7 › test1');
    expect(output).toContain('[proj-1] › b.test.ts:7:7 › test2');
    expect(output).toContain('[proj-2] › c.test.ts:6:7 › test1');
    expect(output).toContain('[proj-2] › c.test.ts:7:7 › test2');
    expect(output).not.toContain('a.test.ts');
    expect(exitCode).toBe(0);
    expect(passed).toBe(4);
  }
});

test('should not split project with run: awlays', async ({ runGroups }, testInfo) => {
  const files = {
    'playwright.config.ts': `
      module.exports = {
        projects: [
          {
            stage: 10,
            name: 'proj-1',
            testMatch: /.*(a|b).test.ts/,
            run: 'always',
          },
          {
            stage: 20,
            name: 'proj-2',
            testMatch: /.*(c|d).test.ts/,
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
      test('test2', async () => { });
    `,
    'c.test.ts': `
      const { test } = pwt;
      test('test1', async () => { });
      test('test2', async () => { });
      test('test3', async () => { });
    `,
    'd.test.ts': `
      const { test } = pwt;
      test('test1', async () => { });
      test('test2', async () => { });
    `,
  };

  { // Shard 1/2
    const { exitCode, passed, output } =  await runGroups(files, { shard: '1/2' });
    expect(output).toContain('Running 6 tests using 2 workers, shard 1 of 2');
    //  proj-1 is non shardable => a.test.ts and b.test.ts should run in both shards.
    expect(output).toContain('[proj-1] › b.test.ts:6:7 › test2');
    expect(output).toContain('[proj-1] › a.test.ts:6:7 › test1');
    expect(output).toContain('[proj-1] › a.test.ts:7:7 › test2');
    expect(output).toContain('[proj-2] › c.test.ts:6:7 › test1');
    expect(output).toContain('[proj-2] › c.test.ts:7:7 › test2');
    expect(output).not.toContain('d.test.ts');
    expect(exitCode).toBe(0);
    expect(passed).toBe(6);
  }
  { // Shard 1/2
    const { exitCode, passed, output } =  await runGroups(files, { shard: '2/2' });
    expect(output).toContain('Running 5 tests using 2 workers, shard 2 of 2');
    // proj-1 is non shardable => a.test.ts and b.test.ts should run in both shards.
    expect(output).toContain('[proj-1] › b.test.ts:6:7 › test2');
    expect(output).toContain('[proj-1] › a.test.ts:6:7 › test1');
    expect(output).toContain('[proj-1] › a.test.ts:7:7 › test2');
    expect(output).toContain('[proj-2] › d.test.ts:6:7 › test1');
    expect(output).toContain('[proj-2] › d.test.ts:7:7 › test2');
    expect(output).not.toContain('c.test.ts');
    expect(exitCode).toBe(0);
    expect(passed).toBe(5);
  }
});

