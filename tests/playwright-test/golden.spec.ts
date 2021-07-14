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
import { test, expect, stripAscii } from './playwright-test-fixtures';

test('should support golden', async ({runInlineTest}) => {
  const result = await runInlineTest({
    'a.spec.js-snapshots/snapshot.txt': `Hello world`,
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('snapshot.txt');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should fail on wrong golden', async ({runInlineTest}) => {
  const result = await runInlineTest({
    'a.spec.js-snapshots/snapshot.txt': `Line1
Line2
Line3
Hello world line1
Line5
Line6
Line7`,
    'a.spec.js': `
      const { test } = pwt;
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
  expect(result.output).toContain('Line2' + colors.green('2'));
  expect(result.output).toContain('line' + colors.strikethrough(colors.red('1')) + colors.green('2'));
  expect(result.output).toContain('Line3');
  expect(result.output).toContain('Line5');
  expect(result.output).toContain('Line7');
});

test('should write detailed failure result to an output folder', async ({runInlineTest}, testInfo) => {
  const result = await runInlineTest({
    'a.spec.js-snapshots/snapshot.txt': `Hello world`,
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Hello world updated').toMatchSnapshot('snapshot.txt');
      });
    `
  });

  expect(result.exitCode).toBe(1);
  const outputText = stripAscii(result.output);
  expect(outputText).toContain('Snapshot comparison failed:');
  const expectedSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-expected.txt');
  const actualSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-actual.txt');
  expect(outputText).toContain(`Expected: ${expectedSnapshotArtifactPath}`);
  expect(outputText).toContain(`Received: ${actualSnapshotArtifactPath}`);
  expect(fs.existsSync(expectedSnapshotArtifactPath)).toBe(true);
  expect(fs.existsSync(actualSnapshotArtifactPath)).toBe(true);
});

test("doesn\'t create comparison artifacts in an output folder for passed negated snapshot matcher", async ({runInlineTest}, testInfo) => {
  const result = await runInlineTest({
    'a.spec.js-snapshots/snapshot.txt': `Hello world`,
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Hello world updated').not.toMatchSnapshot('snapshot.txt');
      });
    `
  });

  expect(result.exitCode).toBe(0);
  const outputText = stripAscii(result.output);
  const expectedSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-expected.txt');
  const actualSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-actual.txt');
  expect(outputText).not.toContain(`Expected: ${expectedSnapshotArtifactPath}`);
  expect(outputText).not.toContain(`Received: ${actualSnapshotArtifactPath}`);
  expect(fs.existsSync(expectedSnapshotArtifactPath)).toBe(false);
  expect(fs.existsSync(actualSnapshotArtifactPath)).toBe(false);
});

test('should pass on different snapshots with negate matcher', async ({runInlineTest}) => {
  const result = await runInlineTest({
    'a.spec.js-snapshots/snapshot.txt': `Hello world`,
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Hello world updated').not.toMatchSnapshot('snapshot.txt');
      });
    `
  });

  expect(result.exitCode).toBe(0);
});

test('should fail on same snapshots with negate matcher', async ({runInlineTest}) => {
  const result = await runInlineTest({
    'a.spec.js-snapshots/snapshot.txt': `Hello world`,
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Hello world').not.toMatchSnapshot('snapshot.txt');
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Snapshot comparison failed:');
  expect(result.output).toContain('Expected result should be different from the actual one.');
});

test('should write missing expectations locally', async ({runInlineTest}, testInfo) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('snapshot.txt');
      });
    `
  }, {}, { CI: '' });

  expect(result.exitCode).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.txt');
  expect(result.output).toContain(`${snapshotOutputPath} is missing in snapshots, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(data.toString()).toBe('Hello world');
});

test('shouldn\'t write missing expectations locally for negated matcher', async ({runInlineTest}, testInfo) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Hello world').not.toMatchSnapshot('snapshot.txt');
      });
    `
  }, {}, { CI: '' });

  expect(result.exitCode).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.txt');
  expect(result.output).toContain(`${snapshotOutputPath} is missing in snapshots, matchers using ".not" won\'t write them automatically.`);
  expect(fs.existsSync(snapshotOutputPath)).toBe(false);
});

test('should update snapshot with the update-snapshots flag', async ({runInlineTest}, testInfo) => {
  const EXPECTED_SNAPSHOT = 'Hello world';
  const ACTUAL_SNAPSHOT = 'Hello world updated';
  const result = await runInlineTest({
    'a.spec.js-snapshots/snapshot.txt': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = pwt;
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

test('shouldn\'t update snapshot with the update-snapshots flag for negated matcher', async ({runInlineTest}, testInfo) => {
  const EXPECTED_SNAPSHOT = 'Hello world';
  const ACTUAL_SNAPSHOT = 'Hello world updated';
  const result = await runInlineTest({
    'a.spec.js-snapshots/snapshot.txt': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = pwt;
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

test('should silently write missing expectations locally with the update-snapshots flag', async ({runInlineTest}, testInfo) => {
  const ACTUAL_SNAPSHOT = 'Hello world new';
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('${ACTUAL_SNAPSHOT}').toMatchSnapshot('snapshot.txt');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.txt');
  expect(result.output).toContain(`${snapshotOutputPath} is missing in snapshots, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(data.toString()).toBe(ACTUAL_SNAPSHOT);
});

test('should silently write missing expectations locally with the update-snapshots flag for negated matcher', async ({runInlineTest}, testInfo) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Hello world').not.toMatchSnapshot('snapshot.txt');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.txt');
  expect(result.output).toContain(`${snapshotOutputPath} is missing in snapshots, matchers using ".not" won\'t write them automatically.`);
  expect(fs.existsSync(snapshotOutputPath)).toBe(false);
});

test('should match multiple snapshots', async ({runInlineTest}) => {
  const result = await runInlineTest({
    'a.spec.js-snapshots/snapshot1.txt': `Snapshot1`,
    'a.spec.js-snapshots/snapshot2.txt': `Snapshot2`,
    'a.spec.js-snapshots/snapshot3.txt': `Snapshot3`,
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Snapshot1').toMatchSnapshot('snapshot1.txt');
        expect('Snapshot2').toMatchSnapshot('snapshot2.txt');
        expect('Snapshot3').toMatchSnapshot('snapshot3.txt');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should match snapshots from multiple projects', async ({runInlineTest}) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = { projects: [
        { testDir: path.join(__dirname, 'p1') },
        { testDir: path.join(__dirname, 'p2') },
      ]};
    `,
    'p1/a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Snapshot1').toMatchSnapshot('snapshot.txt');
      });
    `,
    'p1/a.spec.js-snapshots/snapshot.txt': `Snapshot1`,
    'p2/a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Snapshot2').toMatchSnapshot('snapshot.txt');
      });
    `,
    'p2/a.spec.js-snapshots/snapshot.txt': `Snapshot2`,
  });
  expect(result.exitCode).toBe(0);
});

test('should use provided name', async ({runInlineTest}) => {
  const result = await runInlineTest({
    'a.spec.js-snapshots/provided.txt': `Hello world`,
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('provided.txt');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should throw without a name', async ({runInlineTest}) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('toMatchSnapshot() requires a "name" parameter');
});

test('should use provided name via options', async ({runInlineTest}) => {
  const result = await runInlineTest({
    'a.spec.js-snapshots/provided.txt': `Hello world`,
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot({ name: 'provided.txt' });
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should compare binary', async ({runInlineTest}) => {
  const result = await runInlineTest({
    'a.spec.js-snapshots/snapshot.dat': Buffer.from([1,2,3,4]),
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect(Buffer.from([1,2,3,4])).toMatchSnapshot('snapshot.dat');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should compare PNG images', async ({runInlineTest}) => {
  const result = await runInlineTest({
    'a.spec.js-snapshots/snapshot.png':
        Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==', 'base64'),
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==', 'base64')).toMatchSnapshot('snapshot.png');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should compare different PNG images', async ({runInlineTest}, testInfo) => {
  const result = await runInlineTest({
    'a.spec.js-snapshots/snapshot.png':
        Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==', 'base64'),
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII==', 'base64')).toMatchSnapshot('snapshot.png');
      });
    `
  });

  const outputText = stripAscii(result.output);
  expect(result.exitCode).toBe(1);
  expect(outputText).toContain('Snapshot comparison failed:');
  const expectedSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-expected.png');
  const actualSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-actual.png');
  const diffSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-diff.png');
  expect(outputText).toContain(`Expected: ${expectedSnapshotArtifactPath}`);
  expect(outputText).toContain(`Received: ${actualSnapshotArtifactPath}`);
  expect(outputText).toContain(`Diff: ${diffSnapshotArtifactPath}`);
  expect(fs.existsSync(expectedSnapshotArtifactPath)).toBe(true);
  expect(fs.existsSync(actualSnapshotArtifactPath)).toBe(true);
  expect(fs.existsSync(diffSnapshotArtifactPath)).toBe(true);
});

test('should respect threshold', async ({runInlineTest}) => {
  const expected = fs.readFileSync(path.join(__dirname, 'assets/screenshot-canvas-expected.png'));
  const actual = fs.readFileSync(path.join(__dirname, 'assets/screenshot-canvas-actual.png'));
  const result = await runInlineTest({
    'a.spec.js-snapshots/snapshot.png': expected,
    'a.spec.js-snapshots/snapshot2.png': expected,
    'a.spec.js': `
      const { test } = pwt;
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

test('should respect project threshold', async ({runInlineTest}) => {
  const expected = fs.readFileSync(path.join(__dirname, 'assets/screenshot-canvas-expected.png'));
  const actual = fs.readFileSync(path.join(__dirname, 'assets/screenshot-canvas-actual.png'));
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { expect: { toMatchSnapshot: { threshold: 0.2 } } },
      ]};
    `,
    'a.spec.js-snapshots/snapshot.png': expected,
    'a.spec.js-snapshots/snapshot2.png': expected,
    'a.spec.js': `
      const { test } = pwt;
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

test('should sanitize snapshot name', async ({runInlineTest}) => {
  const result = await runInlineTest({
    'a.spec.js-snapshots/-snapshot-.txt': `Hello world`,
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('../../snapshot!.txt');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should write missing expectations with sanitized snapshot name', async ({runInlineTest}, testInfo) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('../../snapshot!.txt');
      });
    `
  }, {}, { CI: '' });

  expect(result.exitCode).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/-snapshot-.txt');
  expect(result.output).toContain(`${snapshotOutputPath} is missing in snapshots, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(data.toString()).toBe('Hello world');
});
