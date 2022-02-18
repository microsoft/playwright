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

import { mimeTypeToComparator } from 'playwright-core/lib/utils/comparators';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { test, expect, stripAnsi, createImage, paintBlackPixels } from './playwright-test-fixtures';

const pngComparator = mimeTypeToComparator['image/png'];

test.describe.configure({ mode: 'parallel' });

const IMG_WIDTH = 1280;
const IMG_HEIGHT = 720;
const whiteImage = createImage(IMG_WIDTH, IMG_HEIGHT, 255, 255, 255);
const redImage = createImage(IMG_WIDTH, IMG_HEIGHT, 255, 0, 0);
const greenImage = createImage(IMG_WIDTH, IMG_HEIGHT, 0, 255, 0);
const blueImage = createImage(IMG_WIDTH, IMG_HEIGHT, 0, 0, 255);

const files = {
  'helper.ts': `
    export const test = pwt.test.extend({
      auto: [ async ({}, run, testInfo) => {
        testInfo.snapshotSuffix = '';
        await run();
      }, { auto: true } ]
    });
  `
};

test('should fail to screenshot a page with infinite animation', async ({ runInlineTest }, testInfo) => {
  const infiniteAnimationURL = pathToFileURL(path.join(__dirname, '../assets/rotate-z.html'));
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await page.goto('${infiniteAnimationURL}');
        await expect(page).toHaveScreenshot();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).toContain(`Failed to generate new snapshot in 5000ms because page keeps changing`);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-actual.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-expected.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-diff.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', 'is-a-test-1.png'))).toBe(false);
});

test('should fail to screenshot an element with infinite animation', async ({ runInlineTest }, testInfo) => {
  const infiniteAnimationURL = pathToFileURL(path.join(__dirname, '../assets/rotate-z.html'));
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await page.goto('${infiniteAnimationURL}');
        await expect(page.locator('body')).toHaveScreenshot();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).toContain(`Failed to generate new snapshot in 5000ms because element keeps changing`);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-actual.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-expected.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-diff.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', 'is-a-test-1.png'))).toBe(false);
});

test('should fail to screenshot an element that keeps moving', async ({ runInlineTest }, testInfo) => {
  const infiniteAnimationURL = pathToFileURL(path.join(__dirname, '../assets/rotate-z.html'));
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await page.goto('${infiniteAnimationURL}');
        await expect(page.locator('div')).toHaveScreenshot();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).toContain(`Timeout 5000ms exceeded`);
  expect(stripAnsi(result.output)).toContain(`element is not stable - waiting`);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-actual.png'))).toBe(false);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-expected.png'))).toBe(false);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-diff.png'))).toBe(false);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', 'is-a-test-1.png'))).toBe(false);
});

test('should generate default name', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-actual.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', 'is-a-test-1.png'))).toBe(true);
});

test('should compile with different option combinations', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      const { test } = pwt;
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot();
        await expect(page.locator('body')).toHaveScreenshot({ threshold: 0.2 });
        await expect(page).toHaveScreenshot({ pixelRatio: 0.2 });
        await expect(page).toHaveScreenshot({
          threshold: 0.2,
          pixelCount: 10,
          pixelRatio: 0.2,
          disableAnimations: true,
          omitBackground: true,
          timeout: 1000,
        });
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should fail when screenshot is different size', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': createImage(22, 33),
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Sizes differ; expected image 22px X 33px, but got 1280px X 720px.');
});

test('should fail when screenshot is different pixels', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': blueImage,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Snapshot comparison failed');
  expect(result.output).toContain('Expected:');
  expect(result.output).toContain('Received:');
});

// TODO: should expectScreenshot also accept negation to speed-up comparison?
test('doesn\'t create comparison artifacts in an output folder for passed negated snapshot matcher', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': blueImage,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).not.toHaveScreenshot('snapshot.png');
      });
    `
  });

  expect(result.exitCode).toBe(0);
  const outputText = stripAnsi(result.output);
  const expectedSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-expected.png');
  const actualSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-actual.png');
  expect(outputText).not.toContain(`Expected: ${expectedSnapshotArtifactPath}`);
  expect(outputText).not.toContain(`Received: ${actualSnapshotArtifactPath}`);
  expect(fs.existsSync(expectedSnapshotArtifactPath)).toBe(false);
  expect(fs.existsSync(actualSnapshotArtifactPath)).toBe(false);
});

test('should fail on same snapshots with negate matcher', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': whiteImage,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).not.toHaveScreenshot('snapshot.png');
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
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
        await expect(page).toHaveScreenshot('snapshot2.png');
        console.log('Here we are!');
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  const snapshot1OutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.png');
  expect(result.output).toContain(`Error: ${snapshot1OutputPath} is missing in snapshots, writing actual`);
  expect(pngComparator(fs.readFileSync(snapshot1OutputPath), whiteImage)).toBe(null);

  const snapshot2OutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot2.png');
  expect(result.output).toContain(`Error: ${snapshot2OutputPath} is missing in snapshots, writing actual`);
  expect(pngComparator(fs.readFileSync(snapshot2OutputPath), whiteImage)).toBe(null);

  expect(result.output).toContain('Here we are!');

  const stackLines = stripAnsi(result.output).split('\n').filter(line => line.includes('    at ')).filter(line => !line.includes(testInfo.outputPath()));
  expect(result.output).toContain('a.spec.js:8');
  expect(stackLines.length).toBe(0);
});

test('shouldn\'t write missing expectations locally for negated matcher', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).not.toHaveScreenshot('snapshot.png');
      });
    `
  });

  expect(result.exitCode).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.png');
  expect(result.output).toContain(`${snapshotOutputPath} is missing in snapshots, matchers using ".not" won\'t write them automatically.`);
  expect(fs.existsSync(snapshotOutputPath)).toBe(false);
});

test('should update snapshot with the update-snapshots flag', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': blueImage,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.png');
  expect(result.output).toContain(`${snapshotOutputPath} is re-generated, writing actual.`);
  expect(pngComparator(fs.readFileSync(snapshotOutputPath), whiteImage)).toBe(null);
});

test('shouldn\'t update snapshot with the update-snapshots flag for negated matcher', async ({ runInlineTest }, testInfo) => {
  const EXPECTED_SNAPSHOT = blueImage;
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).not.toHaveScreenshot('snapshot.png');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.png');
  expect(fs.readFileSync(snapshotOutputPath).equals(EXPECTED_SNAPSHOT)).toBe(true);
});

test('should silently write missing expectations locally with the update-snapshots flag', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.png');
  expect(result.output).toContain(`${snapshotOutputPath} is missing in snapshots, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(pngComparator(data, whiteImage)).toBe(null);
});

test('should silently write missing expectations locally with the update-snapshots flag for negated matcher', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).not.toHaveScreenshot('snapshot.png');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.png');
  expect(result.output).toContain(`${snapshotOutputPath} is missing in snapshots, matchers using ".not" won\'t write them automatically.`);
  expect(fs.existsSync(snapshotOutputPath)).toBe(false);
});

test('should match multiple snapshots', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/red.png': redImage,
    'a.spec.js-snapshots/green.png': greenImage,
    'a.spec.js-snapshots/blue.png': blueImage,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await page.evaluate(() => document.documentElement.style.setProperty('background', '#f00'));
        await expect(page).toHaveScreenshot('red.png');
        await page.evaluate(() => document.documentElement.style.setProperty('background', '#0f0'));
        await expect(page).toHaveScreenshot('green.png');
        await page.evaluate(() => document.documentElement.style.setProperty('background', '#00f'));
        await expect(page).toHaveScreenshot('blue.png');
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
      const { test } = require('../helper');
      test('is a test', async ({ page }) => {
        await page.evaluate(() => document.documentElement.style.setProperty('background', '#f00'));
        await expect(page).toHaveScreenshot('red.png');
      });
    `,
    'p1/a.spec.js-snapshots/red.png': redImage,
    'p2/a.spec.js': `
      const { test } = require('../helper');
      test('is a test', async ({ page }) => {
        await page.evaluate(() => document.documentElement.style.setProperty('background', '#0f0'));
        await expect(page).toHaveScreenshot('green.png');
      });
    `,
    'p2/a.spec.js-snapshots/green.png': greenImage,
  });
  expect(result.exitCode).toBe(0);
});

test('should use provided name', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/provided.png': whiteImage,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('provided.png');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should use provided name via options', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/provided.png': whiteImage,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot({ name: 'provided.png' });
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should throw for invalid pixelCount values', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/white.png': whiteImage,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot({
          name: 'white.png',
          pixelCount: -1,
        });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('`pixelCount` option value must be non-negative integer');
});

test('should throw for invalid pixelRatio values', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot({
          pixelRatio: 12,
        });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('`pixelRatio` option value must be between 0 and 1');
});

test('should respect pixelCount option', async ({ runInlineTest }) => {
  const BAD_PIXELS = 120;
  const EXPECTED_SNAPSHOT = paintBlackPixels(whiteImage, BAD_PIXELS);

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  })).exitCode, 'make sure default comparison fails').toBe(1);

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', {
          pixelCount: ${BAD_PIXELS}
        });
      });
    `
  })).exitCode, 'make sure pixelCount option is respected').toBe(0);

  expect((await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = { projects: [
        { expect: { toMatchSnapshot: { pixelCount: ${BAD_PIXELS} } } },
      ]};
    `,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  })).exitCode, 'make sure pixelCount option in project config is respected').toBe(0);
});

test('should respect pixelRatio option', async ({ runInlineTest }) => {
  const BAD_RATIO = 0.25;
  const BAD_PIXELS = IMG_WIDTH * IMG_HEIGHT * BAD_RATIO;
  const EXPECTED_SNAPSHOT = paintBlackPixels(whiteImage, BAD_PIXELS);

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  })).exitCode, 'make sure default comparison fails').toBe(1);

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', {
          pixelRatio: ${BAD_RATIO}
        });
      });
    `
  })).exitCode, 'make sure pixelRatio option is respected').toBe(0);

  expect((await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = { projects: [
        { expect: { toMatchSnapshot: { pixelRatio: ${BAD_RATIO} } } },
      ]};
    `,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  })).exitCode, 'make sure pixelCount option in project config is respected').toBe(0);
});

test('should satisfy both pixelRatio and pixelCount', async ({ runInlineTest }) => {
  const BAD_RATIO = 0.25;
  const BAD_PIXELS = IMG_WIDTH * IMG_HEIGHT * BAD_RATIO;
  const EXPECTED_SNAPSHOT = paintBlackPixels(whiteImage, BAD_PIXELS);

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  })).exitCode, 'make sure default comparison fails').toBe(1);

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', {
          pixelCount: ${Math.floor(BAD_PIXELS / 2)},
          pixelRatio: ${BAD_RATIO},
        });
      });
    `
  })).exitCode, 'make sure it fails when pixelCount < actualBadPixels < pixelRatio').toBe(1);

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', {
          pixelCount: ${BAD_PIXELS},
          pixelRatio: ${BAD_RATIO / 2},
        });
      });
    `
  })).exitCode, 'make sure it fails when pixelRatio < actualBadPixels < pixelCount').toBe(1);

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', {
          pixelCount: ${BAD_PIXELS},
          pixelRatio: ${BAD_RATIO},
        });
      });
    `
  })).exitCode, 'make sure it passes when actualBadPixels < pixelRatio && actualBadPixels < pixelCount').toBe(0);
});

test('should yield expected, actual and diff', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': redImage,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  });

  const outputText = stripAnsi(result.output);
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

test('should respect threshold', async ({ runInlineTest }) => {
  const expected = fs.readFileSync(path.join(__dirname, 'assets/screenshot-canvas-expected.png'));
  const actualURL = pathToFileURL(path.join(__dirname, 'assets/screenshot-canvas-actual.png'));
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': expected,
    'a.spec.js-snapshots/snapshot2.png': expected,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await page.goto('${actualURL}');
        await expect(page.locator('img')).toHaveScreenshot('snapshot.png', { threshold: 0.3 });
        await expect(page.locator('img')).not.toHaveScreenshot('snapshot.png', { threshold: 0.2 });
        await expect(page.locator('img')).toHaveScreenshot('snapshot2.png', { threshold: 0.3 });
        await expect(page.locator('img')).toHaveScreenshot({ name: 'snapshot2.png', threshold: 0.3 });
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should respect project threshold', async ({ runInlineTest }) => {
  const expected = fs.readFileSync(path.join(__dirname, 'assets/screenshot-canvas-expected.png'));
  const actualURL = pathToFileURL(path.join(__dirname, 'assets/screenshot-canvas-actual.png'));
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
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await page.goto('${actualURL}');
        await expect(page.locator('img')).toHaveScreenshot('snapshot.png', { threshold: 0.3 });
        await expect(page.locator('img')).not.toHaveScreenshot('snapshot.png');
        await expect(page.locator('img')).toHaveScreenshot('snapshot2.png', { threshold: 0.3 });
        await expect(page.locator('img')).toHaveScreenshot({ name: 'snapshot2.png', threshold: 0.3 });
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should sanitize snapshot name when passed as string', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/-snapshot-.png': whiteImage,
    'a.spec.js': `
      const { test } = require('./helper');;
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('../../snapshot!.png');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should write missing expectations with sanitized snapshot name', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test } = require('./helper');;
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('../../snapshot!.png');
      });
    `
  }, {});

  expect(result.exitCode).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/-snapshot-.png');
  expect(result.output).toContain(`${snapshotOutputPath} is missing in snapshots, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(pngComparator(data, whiteImage)).toBe(null);
});

test('should join array of snapshot path segments without sanitizing', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/test/path/snapshot.png': whiteImage,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot(['test', 'path', 'snapshot.png']);
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
    'snaps/a.spec.js-snapshots/snapshot.png': whiteImage,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
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
    'snaps/tests/a.spec.js-snapshots/test/path/snapshot.png': whiteImage,
    'tests/a.spec.js': `
      const { test } = require('../helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot(['test', 'path', 'snapshot.png']);
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
    'snaps/path/to/tests/a.spec.js-snapshots/path/to/snapshot.png': whiteImage,
    'path/to/tests/a.spec.js': `
      const { test } = require('../../../helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot(['path', 'to', 'snapshot.png']);
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should use project snapshotDir over base snapshotDir', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      export const test = pwt.test.extend({
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
    'project_snaps/a.spec.js-snapshots/test/path/snapshot-foo-suffix.txt': whiteImage,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot(['test', 'path', 'snapshot.txt']);
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should update snapshot with array of path segments', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot(['test', 'path', 'snapshot.png']);
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/test/path/snapshot.png');
  expect(result.output).toContain(`${snapshotOutputPath} is missing in snapshots, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(pngComparator(data, whiteImage)).toBe(null);
});

test('should attach expected/actual/diff with snapshot path', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/test/path/snapshot.png': blueImage,
    'a.spec.js': `
      const { test } = require('./helper');
      test.afterEach(async ({}, testInfo) => {
        console.log('## ' + JSON.stringify(testInfo.attachments));
      });
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot(['test', 'path', 'snapshot.png']);
      });
    `
  });

  const outputText = stripAnsi(result.output);
  const attachments = outputText.split('\n').filter(l => l.startsWith('## ')).map(l => l.substring(3)).map(l => JSON.parse(l))[0];
  for (const attachment of attachments)
    attachment.path = attachment.path.replace(/\\/g, '/').replace(/.*test-results\//, '');
  expect(attachments).toEqual([
    {
      name: 'expected',
      contentType: 'image/png',
      path: 'a-is-a-test/test/path/snapshot-expected.png'
    },
    {
      name: 'actual',
      contentType: 'image/png',
      path: 'a-is-a-test/test/path/snapshot-actual.png'
    },
    {
      name: 'diff',
      contentType: 'image/png',
      path: 'a-is-a-test/test/path/snapshot-diff.png'
    }
  ]);
});

test('should attach expected/actual/diff', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': blueImage,
    'a.spec.js': `
      const { test } = require('./helper');
      test.afterEach(async ({}, testInfo) => {
        console.log('## ' + JSON.stringify(testInfo.attachments));
      });
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  });

  const outputText = stripAnsi(result.output);
  const attachments = outputText.split('\n').filter(l => l.startsWith('## ')).map(l => l.substring(3)).map(l => JSON.parse(l))[0];
  for (const attachment of attachments)
    attachment.path = attachment.path.replace(/\\/g, '/').replace(/.*test-results\//, '');
  expect(attachments).toEqual([
    {
      name: 'expected',
      contentType: 'image/png',
      path: 'a-is-a-test/snapshot-expected.png'
    },
    {
      name: 'actual',
      contentType: 'image/png',
      path: 'a-is-a-test/snapshot-actual.png'
    },
    {
      name: 'diff',
      contentType: 'image/png',
      path: 'a-is-a-test/snapshot-diff.png'
    }
  ]);
});

test('should attach expected/actual and no diff when sizes are different', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': createImage(2, 2),
    'a.spec.js': `
      const { test } = require('./helper');
      test.afterEach(async ({}, testInfo) => {
        console.log('## ' + JSON.stringify(testInfo.attachments));
      });
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  });

  const outputText = stripAnsi(result.output);
  expect(outputText).toContain('Sizes differ; expected image 2px X 2px, but got 1280px X 720px.');
  const attachments = outputText.split('\n').filter(l => l.startsWith('## ')).map(l => l.substring(3)).map(l => JSON.parse(l))[0];
  for (const attachment of attachments)
    attachment.path = attachment.path.replace(/\\/g, '/').replace(/.*test-results\//, '');
  expect(attachments).toEqual([
    {
      name: 'expected',
      contentType: 'image/png',
      path: 'a-is-a-test/snapshot-expected.png'
    },
    {
      name: 'actual',
      contentType: 'image/png',
      path: 'a-is-a-test/snapshot-actual.png'
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
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.png');
  expect(result.output).toContain(`${snapshotOutputPath} is missing in snapshots, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(pngComparator(data, whiteImage)).toBe(null);
});

test('should update expectations with retries', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = { retries: 1 };
    `,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('a.spec.js-snapshots/snapshot.png');
  expect(result.output).toContain(`${snapshotOutputPath} is missing in snapshots, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(pngComparator(data, whiteImage)).toBe(null);
});

