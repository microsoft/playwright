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
import { PNG } from 'pngjs';
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
        await expect(page).toHaveScreenshot({ timeout: 2000 });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).toContain(`Timeout 2000ms exceeded while generating screenshot because page kept changing`);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-actual.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-expected.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-diff.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', 'is-a-test-1.png'))).toBe(false);
});

test('should not fail when racing with navigation', async ({ runInlineTest }, testInfo) => {
  const infiniteAnimationURL = pathToFileURL(path.join(__dirname, '../assets/rotate-z.html'));
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': createImage(10, 10, 255, 0, 0),
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await Promise.all([
          page.goto('${infiniteAnimationURL}'),
          expect(page).toHaveScreenshot({
            name: 'snapshot.png',
            animations: "disabled",
            clip: { x: 0, y: 0, width: 10, height: 10 },
          }),
        ]);
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should successfully screenshot a page with infinite animation with disableAnimation: true', async ({ runInlineTest }, testInfo) => {
  const infiniteAnimationURL = pathToFileURL(path.join(__dirname, '../assets/rotate-z.html'));
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await page.goto('${infiniteAnimationURL}');
        await expect(page).toHaveScreenshot({
          animations: "disabled",
        });
      });
    `
  }, { 'update-snapshots': true });
  expect(result.exitCode).toBe(0);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', 'is-a-test-1.png'))).toBe(true);
});

test('should support clip option for page', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': createImage(50, 50, 255, 255, 255),
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot({
          name: 'snapshot.png',
          clip: { x: 0, y: 0, width: 50, height: 50, },
        });
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should support omitBackground option for locator', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await page.evaluate(() => {
          document.body.style.setProperty('width', '100px');
          document.body.style.setProperty('height', '100px');
        });
        await expect(page.locator('body')).toHaveScreenshot({
          name: 'snapshot.png',
          omitBackground: true,
        });
      });
    `
  }, { 'update-snapshots': true });
  expect(result.exitCode).toBe(0);
  const snapshotPath = testInfo.outputPath('a.spec.js-snapshots', 'snapshot.png');
  expect(fs.existsSync(snapshotPath)).toBe(true);
  const png = PNG.sync.read(fs.readFileSync(snapshotPath));
  expect.soft(png.width, 'image width must be 100').toBe(100);
  expect.soft(png.height, 'image height must be 100').toBe(100);
  expect.soft(png.data[0], 'image R must be 0').toBe(0);
  expect.soft(png.data[1], 'image G must be 0').toBe(0);
  expect.soft(png.data[2], 'image B must be 0').toBe(0);
  expect.soft(png.data[3], 'image A must be 0').toBe(0);
});

test('should fail to screenshot an element with infinite animation', async ({ runInlineTest }, testInfo) => {
  const infiniteAnimationURL = pathToFileURL(path.join(__dirname, '../assets/rotate-z.html'));
  const result = await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await page.goto('${infiniteAnimationURL}');
        await expect(page.locator('body')).toHaveScreenshot({ timeout: 2000 });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).toContain(`Timeout 2000ms exceeded while generating screenshot because element kept changing`);
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
        await expect(page.locator('div')).toHaveScreenshot({ timeout: 2000 });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).toContain(`Timeout 2000ms exceeded`);
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
        await expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.2 });
        await expect(page).toHaveScreenshot({
          threshold: 0.2,
          maxDiffPixels: 10,
          maxDiffPixelRatio: 0.2,
          animations: "disabled",
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
        await expect(page).toHaveScreenshot('snapshot.png', { timeout: 2000 });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Expected an image 22px by 33px, received 1280px by 720px.');
});

test('should fail when screenshot is different pixels', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': paintBlackPixels(whiteImage, 12345),
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', { timeout: 2000 });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Screenshot comparison failed');
  expect(result.output).toContain('12345 pixels');
  expect(result.output).not.toContain('Call log');
  expect(result.output).toContain('ratio 0.02');
  expect(result.output).toContain('Expected:');
  expect(result.output).toContain('Received:');
});

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
        await expect(page).not.toHaveScreenshot('snapshot.png', { timeout: 2000 });
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Screenshot comparison failed:');
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

test('should not write missing expectations locally with the update-snapshots flag for negated matcher', async ({ runInlineTest }, testInfo) => {
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
        await Promise.all([
          page.evaluate(() => document.documentElement.style.setProperty('background', '#f00')),
          expect(page).toHaveScreenshot('red.png'),
        ]);
        await Promise.all([
          page.evaluate(() => document.documentElement.style.setProperty('background', '#0f0')),
          expect(page).toHaveScreenshot('green.png'),
        ]);
        await Promise.all([
          page.evaluate(() => document.documentElement.style.setProperty('background', '#00f')),
          expect(page).toHaveScreenshot('blue.png'),
        ]);
      });
    `
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

test('should respect maxDiffPixels option', async ({ runInlineTest }) => {
  const BAD_PIXELS = 120;
  const EXPECTED_SNAPSHOT = paintBlackPixels(whiteImage, BAD_PIXELS);

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', { timeout: 2000 });
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
          maxDiffPixels: ${BAD_PIXELS}
        });
      });
    `
  })).exitCode, 'make sure maxDiffPixels option is respected').toBe(0);

  expect((await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = { projects: [
        { expect: { toHaveScreenshot: { maxDiffPixels: ${BAD_PIXELS} } } },
      ]};
    `,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  })).exitCode, 'make sure maxDiffPixels option in project config is respected').toBe(0);
});

test('should satisfy both maxDiffPixelRatio and maxDiffPixels', async ({ runInlineTest }) => {
  const BAD_RATIO = 0.25;
  const BAD_COUNT = Math.floor(IMG_WIDTH * IMG_HEIGHT * BAD_RATIO);
  const EXPECTED_SNAPSHOT = paintBlackPixels(whiteImage, BAD_COUNT);

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', { timeout: 2000 });
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
          maxDiffPixels: ${Math.floor(BAD_COUNT / 2)},
          maxDiffPixelRatio: ${BAD_RATIO},
          timeout: 2000,
        });
      });
    `
  })).exitCode, 'make sure it fails when maxDiffPixels < actualBadPixels < maxDiffPixelRatio').toBe(1);

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', {
          maxDiffPixels: ${BAD_COUNT},
          maxDiffPixelRatio: ${BAD_RATIO / 2},
          timeout: 2000,
        });
      });
    `
  })).exitCode, 'make sure it fails when maxDiffPixelRatio < actualBadPixels < maxDiffPixels').toBe(1);

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', {
          maxDiffPixels: ${BAD_COUNT},
          maxDiffPixelRatio: ${BAD_RATIO},
        });
      });
    `
  })).exitCode, 'make sure it passes when actualBadPixels < maxDiffPixelRatio && actualBadPixels < maxDiffPixels').toBe(0);
});

test('should respect maxDiffPixelRatio option', async ({ runInlineTest }) => {
  const BAD_RATIO = 0.25;
  const BAD_PIXELS = IMG_WIDTH * IMG_HEIGHT * BAD_RATIO;
  const EXPECTED_SNAPSHOT = paintBlackPixels(whiteImage, BAD_PIXELS);

  expect((await runInlineTest({
    ...files,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', { timeout: 2000 });
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
          maxDiffPixelRatio: ${BAD_RATIO}
        });
      });
    `
  })).exitCode, 'make sure maxDiffPixelRatio option is respected').toBe(0);

  expect((await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = { projects: [
        { expect: { toHaveScreenshot: { maxDiffPixelRatio: ${BAD_RATIO} } } },
      ]};
    `,
    'a.spec.js-snapshots/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  })).exitCode, 'make sure maxDiffPixels option in project config is respected').toBe(0);
});

test('should throw for invalid maxDiffPixels values', async ({ runInlineTest }) => {
  expect((await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot({
          maxDiffPixels: -1,
        });
      });
    `
  })).exitCode).toBe(1);
});

test('should throw for invalid maxDiffPixelRatio values', async ({ runInlineTest }) => {
  expect((await runInlineTest({
    ...files,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot({
          maxDiffPixelRatio: 12,
        });
      });
    `
  })).exitCode).toBe(1);
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
        await expect(page).toHaveScreenshot('snapshot.png', { timeout: 2000 });
      });
    `
  });

  expect(result.exitCode).toBe(1);
  const outputText = stripAnsi(result.output);
  expect(outputText).toContain('Expected an image 2px by 2px, received 1280px by 720px.');
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

