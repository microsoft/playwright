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

import colors from 'colors/safe';
import * as fs from 'fs';
import * as path from 'path';
import { test, expect, createWhiteImage, paintBlackPixels } from './playwright-test-fixtures';

const files = {
  'helper.ts': `
    import { test as base } from '@playwright/test';
    export { expect } from '@playwright/test';
    export const test = base.extend({
      auto: [ async ({}, run, testInfo) => {
        testInfo.snapshotSuffix = '';
        await run();
      }, { auto: true } ]
    });
  `
};

test('should support golden', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.txt': `Hello world`,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('snapshot.txt');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should work with non-txt extensions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.csv': `1,2,3`,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('1,2,4').toMatchSnapshot('snapshot.csv');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`1,2,34`);
});


test('should generate default name', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', async ({ page }) => {
        expect.soft('foo').toMatchSnapshot();
        expect.soft('bar').toMatchSnapshot();
        expect.soft(await page.screenshot({type: 'png'})).toMatchSnapshot();
        expect.soft(await page.screenshot({type: 'jpeg'})).toMatchSnapshot();
        expect.soft(Buffer.from([1,2,3,4])).toMatchSnapshot();

      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-actual.txt'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-2-actual.txt'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-3-actual.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-4-actual.jpg'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-5-actual.dat'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', 'is-a-test-1.txt'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', 'is-a-test-2.txt'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', 'is-a-test-3.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', 'is-a-test-4.jpg'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', 'is-a-test-5.dat'))).toBe(true);
});

test('should generate separate actual results for repeating names', async ({ runInlineTest }, testInfo) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29719' });
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/foo.txt': `b`,
    'a.spec.js-snapshots/bar/baz.txt': `c`,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test.afterEach(async ({}, testInfo) => {
        console.log('## ' + JSON.stringify(testInfo.attachments));
      });
      test('is a test', ({}) => {
        expect.soft('a').toMatchSnapshot('foo.txt');
        expect.soft('a').toMatchSnapshot('foo.txt');
        expect.soft('b').toMatchSnapshot(['bar', 'baz.txt']);
        expect.soft('b').toMatchSnapshot(['bar', 'baz.txt']);
      });
    `
  });

  const outputText = result.output;
  const attachments = outputText.split('\n').filter(l => l.startsWith('## ')).map(l => l.substring(3)).map(l => JSON.parse(l))[0];
  for (const attachment of attachments) {
    attachment.path = attachment.path.replace(testInfo.outputDir, '').substring(1).replace(/\\/g, '/');
    attachment.name = attachment.name.replace(/\\/g, '/');
  }
  expect(attachments).toEqual([
    {
      'name': 'foo-expected.txt',
      'contentType': 'text/plain',
      'path': 'a.spec.js-snapshots/foo.txt'
    },
    {
      'name': 'foo-actual.txt',
      'contentType': 'text/plain',
      'path': 'test-results/a-is-a-test/foo-actual.txt'
    },
    {
      'name': 'foo-1-expected.txt',
      'contentType': 'text/plain',
      'path': 'a.spec.js-snapshots/foo.txt'
    },
    {
      'name': 'foo-1-actual.txt',
      'contentType': 'text/plain',
      'path': 'test-results/a-is-a-test/foo-1-actual.txt'
    },
    {
      'name': 'bar/baz-expected.txt',
      'contentType': 'text/plain',
      'path': 'a.spec.js-snapshots/bar/baz.txt'
    },
    {
      'name': 'bar/baz-actual.txt',
      'contentType': 'text/plain',
      'path': 'test-results/a-is-a-test/bar/baz-actual.txt'
    },
    {
      'name': 'bar/baz-1-expected.txt',
      'contentType': 'text/plain',
      'path': 'a.spec.js-snapshots/bar/baz.txt'
    },
    {
      'name': 'bar/baz-1-actual.txt',
      'contentType': 'text/plain',
      'path': 'test-results/a-is-a-test/bar/baz-1-actual.txt'
    }
  ]);
});

test('should compile with different option combinations', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('is a test', async ({ page }) => {
        expect('foo').toMatchSnapshot();
        expect('foo').toMatchSnapshot({ threshold: 0.2 });
        expect('foo').toMatchSnapshot({ maxDiffPixelRatio: 0.2 });
        expect('foo').toMatchSnapshot({ maxDiffPixels: 0.2 });
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should fail on wrong golden', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.txt': `Line1
Line2
Line3
Hello world line1
Line5
Line6
Line7`,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        const data = [];
        data.push('Line1');
        data.push('Line22');
        data.push('Line3');
        data.push('Hi world line2');
        data.push('Line5');
        data.push('Line6');
        data.push('Line7');
        expect(data.join('\\n')).toMatchSnapshot('snapshot.txt');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Line1');
  expect(result.rawOutput).toContain('Line2' + colors.green('2'));
  expect(result.rawOutput).toContain('line' + colors.reset(colors.strikethrough(colors.red('1'))) + colors.green('2'));
  expect(result.output).toContain('Line3');
  expect(result.output).toContain('Line5');
  expect(result.output).toContain('Line7');
});

test('should write detailed failure result to an output folder', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.txt': `Hello world`,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world updated').toMatchSnapshot('snapshot.txt');
      });
    `
  });

  expect(result.exitCode).toBe(1);
  const outputText = result.output;
  expect(outputText).toContain('Snapshot comparison failed:');
  const expectedSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-expected.txt');
  const actualSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-actual.txt');
  expect(outputText).toMatch(/Expected:.*a\.spec\.js-snapshots.snapshot\.txt/);
  expect(outputText).toContain(`Received: ${actualSnapshotArtifactPath}`);
  expect(fs.existsSync(expectedSnapshotArtifactPath)).toBe(true);
  expect(fs.existsSync(actualSnapshotArtifactPath)).toBe(true);
});

test("doesn\'t create comparison artifacts in an output folder for passed negated snapshot matcher", async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.txt': `Hello world`,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world updated').not.toMatchSnapshot('snapshot.txt');
      });
    `
  });

  expect(result.exitCode).toBe(0);
  const outputText = result.output;
  const expectedSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-expected.txt');
  const actualSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-actual.txt');
  expect(outputText).not.toContain(`Expected: ${expectedSnapshotArtifactPath}`);
  expect(outputText).not.toContain(`Received: ${actualSnapshotArtifactPath}`);
  expect(fs.existsSync(expectedSnapshotArtifactPath)).toBe(false);
  expect(fs.existsSync(actualSnapshotArtifactPath)).toBe(false);
});

test('should fail on same snapshots with negate matcher', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.txt': `Hello world`,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world').not.toMatchSnapshot('snapshot.txt');
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Snapshot comparison failed:');
  expect(result.output).toContain('Expected result should be different from the actual one.');
});

test('should write missing expectations locally twice and continue', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('snapshot.txt');
        expect('Hello world2').toMatchSnapshot('snapshot2.txt');
        console.log('Here we are!');
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  const snapshot1OutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.txt');
  expect(result.output).toContain(`Error: A snapshot doesn't exist at ${snapshot1OutputPath}, writing actual`);
  expect(fs.readFileSync(snapshot1OutputPath, 'utf-8')).toBe('Hello world');

  const snapshot2OutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot2.txt');
  expect(result.output).toContain(`Error: A snapshot doesn't exist at ${snapshot2OutputPath}, writing actual`);
  expect(fs.readFileSync(snapshot2OutputPath, 'utf-8')).toBe('Hello world2');

  expect(result.output).toContain('Here we are!');

  const stackLines = result.output.split('\n').filter(line => line.includes('    at ')).filter(line => !line.includes('a.spec.js'));
  expect(result.output).toContain('a.spec.js:4');
  expect(stackLines.length).toBe(0);
});

test('should not write missing expectations for negated matcher', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world').not.toMatchSnapshot('snapshot.txt');
      });
    `
  });

  expect(result.exitCode).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.txt');
  expect(result.output).toContain(`A snapshot doesn't exist at ${snapshotOutputPath}, matchers using ".not" won\'t write them automatically.`);
  expect(fs.existsSync(snapshotOutputPath)).toBe(false);
});

test('should update snapshot with the update-snapshots flag', async ({ runInlineTest }, testInfo) => {
  const EXPECTED_SNAPSHOT = 'Hello world';
  const ACTUAL_SNAPSHOT = 'Hello world updated';
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.txt': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('${ACTUAL_SNAPSHOT}').toMatchSnapshot('snapshot.txt');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.txt');
  expect(result.output).toContain(`${snapshotOutputPath} does not match, writing actual.`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(data.toString()).toBe(ACTUAL_SNAPSHOT);
});

test('should ignore text snapshot with the ignore-snapshots flag', async ({ runInlineTest }, testInfo) => {
  const EXPECTED_SNAPSHOT = 'Hello world';
  const ACTUAL_SNAPSHOT = 'Hello world updated';
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.txt': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('${ACTUAL_SNAPSHOT}').toMatchSnapshot('snapshot.txt');
      });
    `
  }, { 'ignore-snapshots': true });

  expect(result.exitCode).toBe(0);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.txt');
  expect(result.output).toContain(``);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(data.toString()).toBe(EXPECTED_SNAPSHOT);
});

test('shouldn\'t update snapshot with the update-snapshots flag for negated matcher', async ({ runInlineTest }, testInfo) => {
  const EXPECTED_SNAPSHOT = 'Hello world';
  const ACTUAL_SNAPSHOT = 'Hello world updated';
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.txt': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('${ACTUAL_SNAPSHOT}').not.toMatchSnapshot('snapshot.txt');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.txt');
  const data = fs.readFileSync(snapshotOutputPath);
  expect(data.toString()).toBe(EXPECTED_SNAPSHOT);
});

test('should silently write missing expectations locally with the update-snapshots flag', async ({ runInlineTest }, testInfo) => {
  const ACTUAL_SNAPSHOT = 'Hello world new';
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('${ACTUAL_SNAPSHOT}').toMatchSnapshot('snapshot.txt');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.txt');
  expect(result.output).toContain(`A snapshot doesn't exist at ${snapshotOutputPath}, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(data.toString()).toBe(ACTUAL_SNAPSHOT);
});

test('should silently write missing expectations locally with the update-snapshots flag for negated matcher', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world').not.toMatchSnapshot('snapshot.txt');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.txt');
  expect(result.output).toContain(`A snapshot doesn't exist at ${snapshotOutputPath}, matchers using ".not" won\'t write them automatically.`);
  expect(fs.existsSync(snapshotOutputPath)).toBe(false);
});

test('should match multiple snapshots', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot1.txt': `Snapshot1`,
    'a.spec.js-snapshots/snapshot2.txt': `Snapshot2`,
    'a.spec.js-snapshots/snapshot3.txt': `Snapshot3`,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Snapshot1').toMatchSnapshot('snapshot1.txt');
        expect('Snapshot2').toMatchSnapshot('snapshot2.txt');
        expect('Snapshot3').toMatchSnapshot('snapshot3.txt');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should match snapshots from multiple projects', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = { projects: [
        { testDir: path.join(__dirname, 'p1') },
        { testDir: path.join(__dirname, 'p2') },
      ]};
    `,
    'p1/a.spec.js': `
      const { test, expect } = require('../helper');
      test('is a test', ({}) => {
        expect('Snapshot1').toMatchSnapshot('snapshot.txt');
      });
    `,
    'p1/a.spec.js-snapshots/snapshot.txt': `Snapshot1`,
    'p2/a.spec.js': `
      const { test, expect } = require('../helper');
      test('is a test', ({}) => {
        expect('Snapshot2').toMatchSnapshot('snapshot.txt');
      });
    `,
    'p2/a.spec.js-snapshots/snapshot.txt': `Snapshot2`,
  });
  expect(result.exitCode).toBe(0);
});

test('should use provided name', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/provided.txt': `Hello world`,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('provided.txt');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should use provided name via options', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/provided.txt': `Hello world`,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot({ name: 'provided.txt' });
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should compare binary', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.dat': Buffer.from([1, 2, 3, 4]),
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect(Buffer.from([1,2,3,4])).toMatchSnapshot('snapshot.dat');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should respect maxDiffPixels option', async ({ runInlineTest }) => {
  const width = 20, height = 20;
  const BAD_PIXELS = 120;
  const image1 = createWhiteImage(width, height);
  const image2 = paintBlackPixels(image1, BAD_PIXELS);

  await test.step('make sure default comparison fails', async () => {
    const result = await runInlineTest({
      ...files,
      'a.spec.js-snapshots/snapshot.png': image1,
      'a.spec.js': `
        const { test, expect } = require('./helper');
        test('is a test', ({}) => {
          expect(Buffer.from('${image2.toString('base64')}', 'base64')).toMatchSnapshot('snapshot.png');
        });
      `
    });
    expect(result.output).toContain('120 pixels');
    expect(result.output).toContain('ratio 0.30');
    expect(result.exitCode).toBe(1);
  });

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': image1,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect(Buffer.from('${image2.toString('base64')}', 'base64')).toMatchSnapshot('snapshot.png', {
          maxDiffPixels: ${BAD_PIXELS}
        });
      });
    `
  })).exitCode, 'make sure maxDiffPixels option is respected').toBe(0);

  expect((await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = { projects: [
        { expect: { toMatchSnapshot: { maxDiffPixels: ${BAD_PIXELS} } } },
      ]};
    `,
    'a.spec.js-snapshots/snapshot.png': image1,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect(Buffer.from('${image2.toString('base64')}', 'base64')).toMatchSnapshot('snapshot.png');
      });
    `
  })).exitCode, 'make sure maxDiffPixels option in project config is respected').toBe(0);
});

test('should respect maxDiffPixelRatio option', async ({ runInlineTest }) => {
  const width = 20, height = 20;
  const BAD_RATIO = 0.25;
  const BAD_PIXELS = Math.floor(width * height * BAD_RATIO);
  const image1 = createWhiteImage(width, height);
  const image2 = paintBlackPixels(image1, BAD_PIXELS);

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': image1,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect(Buffer.from('${image2.toString('base64')}', 'base64')).toMatchSnapshot('snapshot.png');
      });
    `
  })).exitCode, 'make sure default comparison fails').toBe(1);

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': image1,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect(Buffer.from('${image2.toString('base64')}', 'base64')).toMatchSnapshot('snapshot.png', {
          maxDiffPixelRatio: ${BAD_RATIO}
        });
      });
    `
  })).exitCode, 'make sure maxDiffPixelRatio option is respected').toBe(0);

  expect((await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = { projects: [
        { expect: { toMatchSnapshot: { maxDiffPixelRatio: ${BAD_RATIO} } } },
      ]};
    `,
    'a.spec.js-snapshots/snapshot.png': image1,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect(Buffer.from('${image2.toString('base64')}', 'base64')).toMatchSnapshot('snapshot.png');
      });
    `
  })).exitCode, 'make sure maxDiffPixels option in project config is respected').toBe(0);
});

test('should compare PNG images', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png':
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==', 'base64'),
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==', 'base64')).toMatchSnapshot('snapshot.png');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should compare different PNG images', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png':
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==', 'base64'),
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII==', 'base64')).toMatchSnapshot('snapshot.png');
      });
    `
  });

  const outputText = result.output;
  expect(result.exitCode).toBe(1);
  expect(outputText).toContain('Screenshot comparison failed:');
  const expectedSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-expected.png');
  const actualSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-actual.png');
  const diffSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-diff.png');
  expect(outputText).toMatch(/Expected:.*a\.spec\.js-snapshots.snapshot\.png/);
  expect(outputText).toContain(`Received: ${actualSnapshotArtifactPath}`);
  expect(outputText).toContain(`Diff: ${diffSnapshotArtifactPath}`);
  expect(fs.existsSync(expectedSnapshotArtifactPath)).toBe(true);
  expect(fs.existsSync(actualSnapshotArtifactPath)).toBe(true);
  expect(fs.existsSync(diffSnapshotArtifactPath)).toBe(true);
});

test('should correctly handle different JPEG image signatures', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('test1', ({}) => {
        expect(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0xbc, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x49])).toMatchSnapshot();
      });
      test('test2', ({}) => {
        expect(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==', 'base64')).toMatchSnapshot();
      });
      test('test3', ({}) => {
        expect(Buffer.from('/9j/4AAQSkZJRgABJD+3EOqoh+DYbgljkJTDA0AfvKeYZU/uxcluvipXU7hAGOoguGFv/Tq3/azTyFRJjgsQRp4mu0elkP9IxBh6uj5gpJVpNk9XJdE+51Nk7kUSQSZtPiXYUR2zd7JxzAVMvGFsjQ==', 'base64')).toMatchSnapshot();
      });
    `,
  }, { 'update-snapshots': true });
  const expectedTest1ArtifactPath = testInfo.outputPath('a.spec.js-snapshots', 'test1-1.jpg');
  const expectedTest2ArtifactPath = testInfo.outputPath('a.spec.js-snapshots', 'test2-1.png');
  const expectedTest3ArtifactPath = testInfo.outputPath('a.spec.js-snapshots', 'test3-1.jpg');
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain(`A snapshot doesn't exist at ${expectedTest1ArtifactPath}, writing actual`);
  expect(result.output).toContain(`A snapshot doesn't exist at ${expectedTest2ArtifactPath}, writing actual`);
  expect(result.output).toContain(`A snapshot doesn't exist at ${expectedTest3ArtifactPath}, writing actual`);
});

test('should respect threshold', async ({ runInlineTest }) => {
  const expected = fs.readFileSync(path.join(__dirname, 'assets/screenshot-canvas-expected.png'));
  const actual = fs.readFileSync(path.join(__dirname, 'assets/screenshot-canvas-actual.png'));
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': expected,
    'a.spec.js-snapshots/snapshot2.png': expected,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect(Buffer.from('${actual.toString('base64')}', 'base64')).toMatchSnapshot('snapshot.png', { threshold: 0.3 });
        expect(Buffer.from('${actual.toString('base64')}', 'base64')).not.toMatchSnapshot('snapshot.png', { threshold: 0.2 });
        expect(Buffer.from('${actual.toString('base64')}', 'base64')).toMatchSnapshot('snapshot2.png', { threshold: 0.3 });
        expect(Buffer.from('${actual.toString('base64')}', 'base64')).toMatchSnapshot({ name: 'snapshot2.png', threshold: 0.3 });
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should respect project threshold', async ({ runInlineTest }) => {
  const expected = fs.readFileSync(path.join(__dirname, 'assets/screenshot-canvas-expected.png'));
  const actual = fs.readFileSync(path.join(__dirname, 'assets/screenshot-canvas-actual.png'));
  const result = await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = { projects: [
        { expect: { toMatchSnapshot: { threshold: 0.2 } } },
      ]};
    `,
    'a.spec.js-snapshots/snapshot.png': expected,
    'a.spec.js-snapshots/snapshot2.png': expected,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect(Buffer.from('${actual.toString('base64')}', 'base64')).toMatchSnapshot('snapshot.png', { threshold: 0.3 });
        expect(Buffer.from('${actual.toString('base64')}', 'base64')).not.toMatchSnapshot('snapshot.png');
        expect(Buffer.from('${actual.toString('base64')}', 'base64')).toMatchSnapshot('snapshot2.png', { threshold: 0.3 });
        expect(Buffer.from('${actual.toString('base64')}', 'base64')).toMatchSnapshot({ name: 'snapshot2.png', threshold: 0.3 });
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should respect comparator name', async ({ runInlineTest }) => {
  const expected = fs.readFileSync(path.join(__dirname, '../image_tools/fixtures/should-match/tiny-antialiasing-sample/tiny-expected.png'));
  const actual = fs.readFileSync(path.join(__dirname, '../image_tools/fixtures/should-match/tiny-antialiasing-sample/tiny-actual.png'));
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': expected,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('should pass', ({}) => {
        expect(Buffer.from('${actual.toString('base64')}', 'base64')).toMatchSnapshot('snapshot.png', {
          threshold: 0,
          _comparator: 'ssim-cie94',
        });
      });
      test('should fail', ({}) => {
        expect(Buffer.from('${actual.toString('base64')}', 'base64')).toMatchSnapshot('snapshot.png', {
          threshold: 0,
          _comparator: 'pixelmatch',
        });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.report.suites[0].specs[0].title).toBe('should pass');
  expect(result.report.suites[0].specs[0].ok).toBe(true);
  expect(result.report.suites[0].specs[1].title).toBe('should fail');
  expect(result.report.suites[0].specs[1].ok).toBe(false);
});

test('should respect comparator in config', async ({ runInlineTest }) => {
  const expected = fs.readFileSync(path.join(__dirname, '../image_tools/fixtures/should-match/tiny-antialiasing-sample/tiny-expected.png'));
  const actual = fs.readFileSync(path.join(__dirname, '../image_tools/fixtures/should-match/tiny-antialiasing-sample/tiny-actual.png'));
  const result = await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = {
        snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
        projects: [
          {
            name: 'should-pass',
            expect: {
              toMatchSnapshot: {
                _comparator: 'ssim-cie94',
              }
            },
          },
          {
            name: 'should-fail',
            expect: {
              toMatchSnapshot: {
                _comparator: 'pixelmatch',
              }
            },
          },
        ],
      };
    `,
    '__screenshots__/a.spec.js/snapshot.png': expected,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('test', ({}) => {
        expect(Buffer.from('${actual.toString('base64')}', 'base64')).toMatchSnapshot('snapshot.png', {
          threshold: 0,
        });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].projectName).toBe('should-pass');
  expect(result.report.suites[0].specs[0].tests[0].status).toBe('expected');
  expect(result.report.suites[0].specs[0].tests[1].projectName).toBe('should-fail');
  expect(result.report.suites[0].specs[0].tests[1].status).toBe('unexpected');
});

test('should sanitize snapshot name when passed as string', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/-snapshot-.txt': `Hello world`,
    'a.spec.js': `
      const { test, expect } = require('./helper');;
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('../../snapshot!.txt');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should write missing expectations with sanitized snapshot name', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test, expect } = require('./helper');;
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('../../snapshot!.txt');
      });
    `
  });

  expect(result.exitCode).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/-snapshot-.txt');
  expect(result.output).toContain(`A snapshot doesn't exist at ${snapshotOutputPath}, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(data.toString()).toBe('Hello world');
});

test('should join array of snapshot path segments without sanitizing', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/test/path/snapshot.txt': `Hello world`,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot(['test', 'path', 'snapshot.txt']);
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should use snapshotDir as snapshot base directory', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = {
        snapshotDir: 'snaps',
      };
    `,
    'snaps/a.spec.js-snapshots/snapshot.txt': `Hello world`,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('snapshot.txt');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should use snapshotDir with path segments as snapshot directory', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = {
        snapshotDir: 'snaps',
      };
    `,
    'snaps/tests/a.spec.js-snapshots/test/path/snapshot.txt': `Hello world`,
    'tests/a.spec.js': `
      const { test, expect } = require('../helper');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot(['test', 'path', 'snapshot.txt']);
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should use snapshotDir with nested test suite and path segments', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = {
        snapshotDir: 'snaps',
      };
    `,
    'snaps/path/to/tests/a.spec.js-snapshots/path/to/snapshot.txt': `Hello world`,
    'path/to/tests/a.spec.js': `
      const { test, expect } = require('../../../helper');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot(['path', 'to', 'snapshot.txt']);
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should use project snapshotDir over base snapshotDir', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base } from '@playwright/test';
      export { expect } from '@playwright/test';
      export const test = base.extend({
        auto: [ async ({}, run, testInfo) => {
          testInfo.snapshotSuffix = 'suffix';
          await run();
        }, { auto: true } ]
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        projects: [
          {
            name: 'foo',
            snapshotDir: 'project_snaps',
           },
        ],
        snapshotDir: 'snaps',
      };
    `,
    'project_snaps/a.spec.js-snapshots/test/path/snapshot-foo-suffix.txt': `Hello world`,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot(['test', 'path', 'snapshot.txt']);
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should update snapshot with array of path segments', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot(['test', 'path', 'snapshot.txt']);
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/test/path/snapshot.txt');
  expect(result.output).toContain(`A snapshot doesn't exist at ${snapshotOutputPath}, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(data.toString()).toBe('Hello world');
});

test('should attach expected/actual/diff with snapshot path', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/test/path/snapshot.png':
        Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==', 'base64'),
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test.afterEach(async ({}, testInfo) => {
        console.log('## ' + JSON.stringify(testInfo.attachments));
      });
      test('is a test', ({}) => {
        expect(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII==', 'base64')).toMatchSnapshot(['test', 'path', 'snapshot.png']);
      });
    `
  });

  const outputText = result.output;
  const attachments = outputText.split('\n').filter(l => l.startsWith('## ')).map(l => l.substring(3)).map(l => JSON.parse(l))[0];
  for (const attachment of attachments) {
    attachment.path = attachment.path.replace(/\\/g, '/').replace(/.*test-results\//, '');
    attachment.name = attachment.name.replace(/\\/g, '/');
  }
  expect(attachments).toEqual([
    {
      name: 'test/path/snapshot-expected.png',
      contentType: 'image/png',
      path: 'golden-should-attach-expected-actual-diff-with-snapshot-path-playwright-test/a.spec.js-snapshots/test/path/snapshot.png'
    },
    {
      name: 'test/path/snapshot-actual.png',
      contentType: 'image/png',
      path: 'a-is-a-test/test/path/snapshot-actual.png'
    },
    {
      name: 'test/path/snapshot-diff.png',
      contentType: 'image/png',
      path: 'a-is-a-test/test/path/snapshot-diff.png'
    }
  ]);
});

test('should attach expected/actual/diff', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png':
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==', 'base64'),
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test.afterEach(async ({}, testInfo) => {
        console.log('## ' + JSON.stringify(testInfo.attachments));
      });
      test('is a test', ({}) => {
        expect(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII==', 'base64')).toMatchSnapshot('snapshot.png');
      });
    `
  });

  const outputText = result.output;
  const attachments = outputText.split('\n').filter(l => l.startsWith('## ')).map(l => l.substring(3)).map(l => JSON.parse(l))[0];
  for (const attachment of attachments)
    attachment.path = attachment.path.replace(/\\/g, '/').replace(/.*test-results\//, '');
  expect(attachments).toEqual([
    {
      name: 'snapshot-expected.png',
      contentType: 'image/png',
      path: 'golden-should-attach-expected-actual-diff-playwright-test/a.spec.js-snapshots/snapshot.png'
    },
    {
      name: 'snapshot-actual.png',
      contentType: 'image/png',
      path: 'a-is-a-test/snapshot-actual.png'
    },
    {
      name: 'snapshot-diff.png',
      contentType: 'image/png',
      path: 'a-is-a-test/snapshot-diff.png'
    }
  ]);
});

test('should attach expected/actual/diff for different sizes', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png':
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8AARAwMjDAGACwBA/9IB8FMAAAAAElFTkSuQmCC', 'base64'),
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test.afterEach(async ({}, testInfo) => {
        console.log('## ' + JSON.stringify(testInfo.attachments));
      });
      test('is a test', ({}) => {
        expect(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII==', 'base64')).toMatchSnapshot('snapshot.png');
      });
    `
  });

  const outputText = result.output;
  expect(outputText).toContain('Expected an image 2px by 2px, received 1px by 1px.');
  expect(outputText).toContain('4 pixels (ratio 1.00 of all image pixels) are different.');
  const attachments = outputText.split('\n').filter(l => l.startsWith('## ')).map(l => l.substring(3)).map(l => JSON.parse(l))[0];
  for (const attachment of attachments)
    attachment.path = attachment.path.replace(testInfo.outputDir, '').substring(1).replace(/\\/g, '/');
  expect(attachments).toEqual([
    {
      name: 'snapshot-expected.png',
      contentType: 'image/png',
      path: 'a.spec.js-snapshots/snapshot.png'
    },
    {
      name: 'snapshot-actual.png',
      contentType: 'image/png',
      path: 'test-results/a-is-a-test/snapshot-actual.png'
    },
    {
      name: 'snapshot-diff.png',
      contentType: 'image/png',
      path: 'test-results/a-is-a-test/snapshot-diff.png'
    },
  ]);
});

test('should fail with missing expectations and retries', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = { retries: 1 };
    `,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('snapshot.txt');
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.txt');
  expect(result.output).toContain(`A snapshot doesn't exist at ${snapshotOutputPath}, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(data.toString()).toBe('Hello world');
});

test('should update expectations with retries', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = { retries: 1 };
    `,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('snapshot.txt');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.txt');
  expect(result.output).toContain(`A snapshot doesn't exist at ${snapshotOutputPath}, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(data.toString()).toBe('Hello world');
});

test('should allow comparing text with text without file extension', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot-no-extension': `Hello world`,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('snapshot-no-extension');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should throw if a Promise was passed to toMatchSnapshot', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test, expect } = require('./helper');
      test('is a test', ({}) => {
        expect(() => expect(new Promise(() => {})).toMatchSnapshot('foobar')).toThrow(/An unresolved Promise was passed to toMatchSnapshot\\(\\), make sure to resolve it by adding await to it./);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
