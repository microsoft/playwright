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

import * as fs from 'fs';
import { PNG } from 'playwright-core/lib/utilsBundle';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { test, expect, createImage, paintBlackPixels } from './playwright-test-fixtures';
import { comparePNGs } from '../config/comparator';

test.describe.configure({ mode: 'parallel' });

const IMG_WIDTH = 1280;
const IMG_HEIGHT = 720;
const whiteImage = createImage(IMG_WIDTH, IMG_HEIGHT, 255, 255, 255);
const redImage = createImage(IMG_WIDTH, IMG_HEIGHT, 255, 0, 0);
const greenImage = createImage(IMG_WIDTH, IMG_HEIGHT, 0, 255, 0);
const blueImage = createImage(IMG_WIDTH, IMG_HEIGHT, 0, 0, 255);

test('should fail to screenshot a page with infinite animation', async ({ runInlineTest }, testInfo) => {
  const infiniteAnimationURL = pathToFileURL(path.join(__dirname, '../assets/rotate-z.html'));
  const result = await runInlineTest({
    ...playwrightConfig({
      expect: {
        toHaveScreenshot: {
          animations: 'allow',
        },
      },
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await page.goto('${infiniteAnimationURL}');
        await expect(page).toHaveScreenshot({ timeout: 2000 });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Timeout 2000ms exceeded`);
  expect(result.output).toContain(`expect.toHaveScreenshot with timeout 2000ms`);
  expect(result.output).toContain(`generating new stable screenshot expectation`);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-actual.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-expected.png'))).toBe(false);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-previous.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-diff.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', 'is-a-test-1.png'))).toBe(false);
});

test('should disable animations by default', async ({ runInlineTest }, testInfo) => {
  const cssTransitionURL = pathToFileURL(path.join(__dirname, '../assets/css-transition.html'));
  const result = await runInlineTest({
    ...playwrightConfig({}),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await page.goto('${cssTransitionURL}');
        await expect(page).toHaveScreenshot({ timeout: 2000 });
      });
    `
  }, { 'update-snapshots': true });
  expect(result.exitCode).toBe(0);
});

test('should not retry missing expectation errors', async ({ runInlineTest }, testInfo) => {
  const cssTransitionURL = pathToFileURL(path.join(__dirname, '../assets/css-transition.html'));
  const result = await runInlineTest({
    ...playwrightConfig({
      retries: 2,
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await page.goto('${cssTransitionURL}');
        await expect(page).toHaveScreenshot('foo.png', { timeout: 1000 });
        await expect(page).toHaveScreenshot('bar.png', { timeout: 1000 });
      });
    `
  });
  expect(result.output).not.toContain(`retry #`);
  expect(result.output).toMatch(/A snapshot doesn't exist.*foo.*, writing actual./);
  expect(result.output).toMatch(/A snapshot doesn't exist.*bar.*, writing actual./);
  expect(result.exitCode).toBe(1);
});

test('should not retry serial mode suites with missing expectation errors', async ({ runInlineTest }, testInfo) => {
  const cssTransitionURL = pathToFileURL(path.join(__dirname, '../assets/css-transition.html'));
  const result = await runInlineTest({
    ...playwrightConfig({
      retries: 2,
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test.describe.serial('outer', () => {
        test('last', async ({ page }) => {
        });
        test.describe('nested', () => {
          test('is a test', async ({ page }) => {
            await page.goto('${cssTransitionURL}');
            await expect(page).toHaveScreenshot({ timeout: 1000 });
            await expect(page).toHaveScreenshot({ timeout: 1000 });
          });
          test('last', async ({ page }) => {
          });
        });
      });
    `
  });
  expect(result.output).not.toContain(`retry #`);
  expect(result.output).toMatch(/A snapshot doesn't exist.*1.*, writing actual./);
  expect(result.output).toMatch(/A snapshot doesn't exist.*2.*, writing actual./);
  expect(result.exitCode).toBe(1);
});

test.describe('expect config animations option', () => {
  test('disabled', async ({ runInlineTest }, testInfo) => {
    const cssTransitionURL = pathToFileURL(path.join(__dirname, '../assets/css-transition.html'));
    const result = await runInlineTest({
      ...playwrightConfig({
        expect: { toHaveScreenshot: { animations: 'disabled' } },
      }),
      'a.spec.js': `
        const { test, expect } = require('@playwright/test');
        test('is a test', async ({ page }) => {
          await page.goto('${cssTransitionURL}');
          await expect(page).toHaveScreenshot({ timeout: 2000 });
        });
      `
    }, { 'update-snapshots': true });
    expect(result.exitCode).toBe(0);
  });

  test('allow', async ({ runInlineTest }, testInfo) => {
    const cssTransitionURL = pathToFileURL(path.join(__dirname, '../assets/css-transition.html'));
    const result = await runInlineTest({
      ...playwrightConfig({
        expect: { toHaveScreenshot: { animations: 'allow' } },
      }),
      'a.spec.js': `
        const { test, expect } = require('@playwright/test');
        test('is a test', async ({ page }) => {
          await page.goto('${cssTransitionURL}');
          await expect(page).toHaveScreenshot({ timeout: 2000 });
        });
      `
    }, { 'update-snapshots': true });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('is-a-test-1-diff.png');
  });
});


test('should fail with proper error when unsupported argument is given', async ({ runInlineTest }, testInfo) => {
  const cssTransitionURL = pathToFileURL(path.join(__dirname, '../assets/css-transition.html'));
  const result = await runInlineTest({
    ...playwrightConfig({}),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await page.goto('${cssTransitionURL}');
        await expect(page).toHaveScreenshot({
          clip: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
          },
          timeout: 2000,
        });
      });
    `
  }, { 'update-snapshots': true });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Expected options.clip.width not to be 0`);
});

test('should have scale:css by default', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: ${IMG_WIDTH}, height: ${IMG_HEIGHT} },
          deviceScaleFactor: 2,
        });
        const page = await context.newPage();
        await expect(page).toHaveScreenshot('snapshot.png');
        await context.close();
      });
    `
  }, { 'update-snapshots': true });
  expect(result.exitCode).toBe(0);

  const snapshotOutputPath = testInfo.outputPath('__screenshots__', 'a.spec.js', 'snapshot.png');
  expect(comparePNGs(fs.readFileSync(snapshotOutputPath), whiteImage)).toBe(null);
});

test('should ignore non-documented options in toHaveScreenshot config', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
      expect: {
        toHaveScreenshot: {
          clip: { x: 0, y: 0, width: 10, height: 10 },
        },
      },
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  }, { 'update-snapshots': true });
  expect(result.exitCode).toBe(0);

  const snapshotOutputPath = testInfo.outputPath('__screenshots__', 'a.spec.js', 'snapshot.png');
  expect(comparePNGs(fs.readFileSync(snapshotOutputPath), whiteImage)).toBe(null);
});

test('should report toHaveScreenshot step with expectation name in title', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        onStepEnd(test, result, step) {
          console.log('%% end ' + step.title);
        }
      }
      module.exports = Reporter;
    `,
    ...playwrightConfig({ reporter: './reporter' }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        // Named expectation.
        await expect(page).toHaveScreenshot('foo.png', { timeout: 2000 });
        await expect(page).toHaveScreenshot({ name: 'is-a-test-1.png', timeout: 2000 });
      });
    `
  }, { 'reporter': '', 'workers': 1, 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    `end browserType.launch`,
    `end fixture: browser`,
    `end browser.newContext`,
    `end fixture: context`,
    `end browserContext.newPage`,
    `end fixture: page`,
    `end Before Hooks`,
    `end attach "foo-expected.png"`,
    `end attach "foo-actual.png"`,
    `end expect.toHaveScreenshot(foo.png)`,
    `end attach "is-a-test-1-expected.png"`,
    `end attach "is-a-test-1-actual.png"`,
    `end expect.toHaveScreenshot(is-a-test-1.png)`,
    `end fixture: page`,
    `end fixture: context`,
    `end After Hooks`,
  ]);
});

test('should not fail when racing with navigation', async ({ runInlineTest }, testInfo) => {
  const infiniteAnimationURL = pathToFileURL(path.join(__dirname, '../assets/rotate-z.html'));
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': createImage(10, 10, 255, 0, 0),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
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
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await page.goto('${infiniteAnimationURL}');
        await expect(page).toHaveScreenshot({
          animations: "disabled",
        });
      });
    `
  }, { 'update-snapshots': true });
  expect(result.exitCode).toBe(0);
  expect(fs.existsSync(testInfo.outputPath('__screenshots__', 'a.spec.js', 'is-a-test-1.png'))).toBe(true);
});

test('should support clip option for page', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': createImage(50, 50, 255, 255, 255),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot({
          name: 'snapshot.png',
          clip: { x: 0, y: 0, width: 50, height: 50, },
        });
      });
    `
  });
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test'))).toBe(false);
  expect(result.exitCode).toBe(0);
});

test('should support omitBackground option for locator', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
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
  const snapshotPath = testInfo.outputPath('__screenshots__', 'a.spec.js', 'snapshot.png');
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
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
      projects: [{
        expect: {
          toHaveScreenshot: {
            animations: 'allow',
          },
        },
      }],
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await page.goto('${infiniteAnimationURL}');
        await expect(page.locator('body')).toHaveScreenshot({ timeout: 2000 });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Timeout 2000ms exceeded`);
  expect(result.output).toContain(`expect.toHaveScreenshot with timeout 2000ms`);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-previous.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-actual.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-expected.png'))).toBe(false);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-diff.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('__screenshots__', 'a.spec.js', 'is-a-test-1.png'))).toBe(false);
});

test('should fail to screenshot an element that keeps moving', async ({ runInlineTest }, testInfo) => {
  const infiniteAnimationURL = pathToFileURL(path.join(__dirname, '../assets/rotate-z.html'));
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
      expect: {
        toHaveScreenshot: {
          animations: 'allow',
        },
      },
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await page.goto('${infiniteAnimationURL}');
        await expect(page.locator('div')).toHaveScreenshot({ timeout: 2000 });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Timeout 2000ms exceeded`);
  expect(result.output).toContain(`element is not stable`);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-actual.png'))).toBe(false);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-expected.png'))).toBe(false);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-diff.png'))).toBe(false);
  expect(fs.existsSync(testInfo.outputPath('__screenshots__', 'a.spec.js', 'is-a-test-1.png'))).toBe(false);
});

test('should generate default name', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-actual.png'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('__screenshots__', 'a.spec.js', 'is-a-test-1.png'))).toBe(true);
});

test('should compile with different option combinations', async ({ runTSC }) => {
  const result = await runTSC({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        expect: {
          timeout: 10000,
          toHaveScreenshot: {
            threshold: 0.2,
            maxDiffPixels: 10,
            maxDiffPixelRatio: 0.2,
            animations: "allow",
            caret: "hide",
            scale: "css",
          },
        },
      });
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot();
        await expect(page).toHaveScreenshot('img.png');
        await expect(page).toHaveScreenshot('img.png', { threshold: 0.2, caret: 'initial' });
        await expect(page.locator('body')).toHaveScreenshot({ threshold: 0.2 });
        await expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.2 });
        await expect(page).toHaveScreenshot({
          threshold: 0.2,
          maxDiffPixels: 10,
          maxDiffPixelRatio: 0.2,
          animations: "disabled",
          omitBackground: true,
          caret: "initial",
          scale: "device",
          timeout: 1000,
        });
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should fail when screenshot is different size', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': createImage(22, 33),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', { timeout: 2000 });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`verifying given screenshot expectation`);
  expect(result.output).toContain(`captured a stable screenshot`);
  expect(result.output).toContain('Expected an image 22px by 33px, received 1280px by 720px.');
});

test('should fail when given non-png snapshot name', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.jpeg');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Screenshot name "snapshot.jpeg" must have '.png' extension`);
});

test('should fail when given buffer', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...playwrightConfig({}),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(Buffer.from([1])).toHaveScreenshot();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`toHaveScreenshot can be only used with Page or Locator objects`);
});

test('should fail when screenshot is different pixels', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': paintBlackPixels(whiteImage, 12345),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', { timeout: 2000 });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Screenshot comparison failed');
  expect(result.output).toContain('12345 pixels');
  expect(result.output).toContain('Call log');
  expect(result.output).toContain('ratio 0.02');
  expect(result.output).toContain('Expected:');
  expect(result.output).toContain('Received:');
});

test('doesn\'t create comparison artifacts in an output folder for passed negated snapshot matcher', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': blueImage,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).not.toHaveScreenshot('snapshot.png');
      });
    `
  });

  expect(result.exitCode).toBe(0);
  const outputText = result.output;
  const expectedSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-expected.png');
  const actualSnapshotArtifactPath = testInfo.outputPath('test-results', 'a-is-a-test', 'snapshot-actual.png');
  expect(outputText).not.toContain(`Expected: ${expectedSnapshotArtifactPath}`);
  expect(outputText).not.toContain(`Received: ${actualSnapshotArtifactPath}`);
  expect(fs.existsSync(expectedSnapshotArtifactPath)).toBe(false);
  expect(fs.existsSync(actualSnapshotArtifactPath)).toBe(false);
});

test('should fail on same snapshots with negate matcher', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': whiteImage,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).not.toHaveScreenshot('snapshot.png', { timeout: 2000 });
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Screenshot comparison failed:');
  expect(result.output).toContain('Expected result should be different from the actual one.');
});

test('should not fail if --ignore-snapshots is passed', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': redImage,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', { timeout: 2000 });
      });
    `
  }, { 'ignore-snapshots': true });

  expect(result.exitCode).toBe(0);
});

test('should write missing expectations locally twice and attach them', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
        await expect(page).toHaveScreenshot('snapshot2.png');
        console.log('Here we are!');
      });
      test.afterEach(async ({}, testInfo) => {
        console.log('\\n%%' + JSON.stringify(testInfo.attachments));
      });
    `,
  });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  const snapshot1OutputPath = testInfo.outputPath('__screenshots__', 'a.spec.js', 'snapshot.png');
  expect(result.output).toContain(`Error: A snapshot doesn't exist at ${snapshot1OutputPath}, writing actual`);
  expect(comparePNGs(fs.readFileSync(snapshot1OutputPath), whiteImage)).toBe(null);

  const snapshot2OutputPath = testInfo.outputPath('__screenshots__', 'a.spec.js', 'snapshot2.png');
  expect(result.output).toContain(`Error: A snapshot doesn't exist at ${snapshot2OutputPath}, writing actual`);
  expect(comparePNGs(fs.readFileSync(snapshot2OutputPath), whiteImage)).toBe(null);

  expect(result.output).toContain('Here we are!');

  const stackLines = result.output.split('\n').filter(line => line.includes('    at ')).filter(line => !line.includes('a.spec.js'));
  expect(result.output).toContain('a.spec.js:5');
  expect(stackLines.length).toBe(0);

  const attachments = result.outputLines.map(l => JSON.parse(l))[0];
  for (const attachment of attachments)
    attachment.path = attachment.path.replace(/\\/g, '/').replace(/.*test-results\//, '').replace(/.*__screenshots__/, '__screenshots__');
  expect(attachments).toEqual([
    {
      name: 'snapshot-expected.png',
      contentType: 'image/png',
      path: '__screenshots__/a.spec.js/snapshot.png'
    },
    {
      name: 'snapshot-actual.png',
      contentType: 'image/png',
      path: 'a-is-a-test/snapshot-actual.png'
    },
    {
      name: 'snapshot2-expected.png',
      contentType: 'image/png',
      path: '__screenshots__/a.spec.js/snapshot2.png'
    },
    {
      name: 'snapshot2-actual.png',
      contentType: 'image/png',
      path: 'a-is-a-test/snapshot2-actual.png'
    },
  ]);
});

test('shouldn\'t write missing expectations locally for negated matcher', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).not.toHaveScreenshot('snapshot.png');
      });
    `
  });

  expect(result.exitCode).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('__screenshots__/a.spec.js/snapshot.png');
  expect(result.output).toContain(`A snapshot doesn't exist at ${snapshotOutputPath}, matchers using ".not" won\'t write them automatically.`);
  expect(fs.existsSync(snapshotOutputPath)).toBe(false);
});

test('should update snapshot with the update-snapshots flag', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': blueImage,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  const snapshotOutputPath = testInfo.outputPath('__screenshots__/a.spec.js/snapshot.png');
  expect(result.output).toContain(`${snapshotOutputPath} is re-generated, writing actual.`);
  expect(comparePNGs(fs.readFileSync(snapshotOutputPath), whiteImage)).toBe(null);
});

test('shouldn\'t update snapshot with the update-snapshots flag for negated matcher', async ({ runInlineTest }, testInfo) => {
  const EXPECTED_SNAPSHOT = blueImage;
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).not.toHaveScreenshot('snapshot.png');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  const snapshotOutputPath = testInfo.outputPath('__screenshots__/a.spec.js/snapshot.png');
  expect(fs.readFileSync(snapshotOutputPath).equals(EXPECTED_SNAPSHOT)).toBe(true);
});

test('should silently write missing expectations locally with the update-snapshots flag', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  const snapshotOutputPath = testInfo.outputPath('__screenshots__/a.spec.js/snapshot.png');
  expect(result.output).toContain(`A snapshot doesn't exist at ${snapshotOutputPath}, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(comparePNGs(data, whiteImage)).toBe(null);
});

test('should not write missing expectations locally with the update-snapshots flag for negated matcher', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).not.toHaveScreenshot('snapshot.png');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('__screenshots__/a.spec.js/snapshot.png');
  expect(result.output).toContain(`A snapshot doesn't exist at ${snapshotOutputPath}, matchers using ".not" won\'t write them automatically.`);
  expect(fs.existsSync(snapshotOutputPath)).toBe(false);
});

test('should match multiple snapshots', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/red.png': redImage,
    '__screenshots__/a.spec.js/green.png': greenImage,
    '__screenshots__/a.spec.js/blue.png': blueImage,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
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
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/provided.png': whiteImage,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('provided.png');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should use provided name via options', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/provided.png': whiteImage,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
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
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', { timeout: 2000 });
      });
    `
  })).exitCode, 'make sure default comparison fails').toBe(1);

  expect((await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', {
          maxDiffPixels: ${BAD_PIXELS}
        });
      });
    `
  })).exitCode, 'make sure maxDiffPixels option is respected').toBe(0);

  expect((await runInlineTest({
    ...playwrightConfig({
      expect: {
        toHaveScreenshot: {
          maxDiffPixels: BAD_PIXELS
        }
      },
      projects: [
        {
          snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
        },
      ],
    }),
    '__screenshots__/a.spec.js/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  })).exitCode, 'make sure maxDiffPixels option in project config is respected').toBe(0);
});

test('should not update screenshot that matches with maxDiffPixels option when -u is passed', async ({ runInlineTest }, testInfo) => {
  const BAD_PIXELS = 120;
  const EXPECTED_SNAPSHOT = paintBlackPixels(whiteImage, BAD_PIXELS);

  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', { maxDiffPixels: ${BAD_PIXELS} });
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  expect(result.output).not.toContain(`is re-generated, writing actual`);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-actual.png'))).toBe(false);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-expected.png'))).toBe(false);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-previous.png'))).toBe(false);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-is-a-test', 'is-a-test-1-diff.png'))).toBe(false);

  const data = fs.readFileSync(testInfo.outputPath('__screenshots__/a.spec.js/snapshot.png'));
  expect(comparePNGs(data, EXPECTED_SNAPSHOT)).toBe(null);
});

test('should satisfy both maxDiffPixelRatio and maxDiffPixels', async ({ runInlineTest }) => {
  const BAD_RATIO = 0.25;
  const BAD_COUNT = Math.floor(IMG_WIDTH * IMG_HEIGHT * BAD_RATIO);
  const EXPECTED_SNAPSHOT = paintBlackPixels(whiteImage, BAD_COUNT);

  expect((await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', { timeout: 2000 });
      });
    `
  })).exitCode, 'make sure default comparison fails').toBe(1);

  expect((await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
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
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
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
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
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
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', { timeout: 2000 });
      });
    `
  })).exitCode, 'make sure default comparison fails').toBe(1);

  expect((await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', {
          maxDiffPixelRatio: ${BAD_RATIO}
        });
      });
    `
  })).exitCode, 'make sure maxDiffPixelRatio option is respected').toBe(0);

  expect((await runInlineTest({
    ...playwrightConfig({
      expect: {
        toHaveScreenshot: {
          maxDiffPixelRatio: BAD_RATIO,
        },
      },
      projects: [{
        snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
      }],
    }),
    '__screenshots__/a.spec.js/snapshot.png': EXPECTED_SNAPSHOT,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  })).exitCode, 'make sure maxDiffPixels option in project config is respected').toBe(0);
});

test('should throw for invalid maxDiffPixels values', async ({ runInlineTest }) => {
  expect((await runInlineTest({
    ...playwrightConfig({}),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
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
    ...playwrightConfig({}),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot({
          maxDiffPixelRatio: 12,
        });
      });
    `
  })).exitCode).toBe(1);
});


test('should attach expected/actual/diff when sizes are different', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': createImage(2, 2),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test.afterEach(async ({}, testInfo) => {
        console.log('## ' + JSON.stringify(testInfo.attachments));
      });
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png', { timeout: 2000 });
      });
    `
  });

  expect(result.exitCode).toBe(1);
  const outputText = result.output;
  expect(outputText).toContain('Expected an image 2px by 2px, received 1280px by 720px.');
  expect(outputText).toContain('4 pixels (ratio 0.01 of all image pixels) are different.');
  const attachments = outputText.split('\n').filter(l => l.startsWith('## ')).map(l => l.substring(3)).map(l => JSON.parse(l))[0];
  for (const attachment of attachments)
    attachment.path = attachment.path.replace(testInfo.outputDir, '').substring(1).replace(/\\/g, '/');
  expect(attachments).toEqual([
    {
      name: 'snapshot-expected.png',
      contentType: 'image/png',
      path: '__screenshots__/a.spec.js/snapshot.png',
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
    ...playwrightConfig({
      retries: 1,
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('__screenshots__/a.spec.js/snapshot.png');
  expect(result.output).toContain(`A snapshot doesn't exist at ${snapshotOutputPath}, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(comparePNGs(data, whiteImage)).toBe(null);
});

test('should update expectations with retries', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      retries: 1,
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `
  }, { 'update-snapshots': true });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const snapshotOutputPath = testInfo.outputPath('__screenshots__/a.spec.js/snapshot.png');
  expect(result.output).toContain(`A snapshot doesn't exist at ${snapshotOutputPath}, writing actual`);
  const data = fs.readFileSync(snapshotOutputPath);
  expect(comparePNGs(data, whiteImage)).toBe(null);
});

test('should respect comparator name', async ({ runInlineTest }) => {
  const expected = fs.readFileSync(path.join(__dirname, '../image_tools/fixtures/should-match/tiny-antialiasing-sample/tiny-expected.png'));
  const actualURL = pathToFileURL(path.join(__dirname, '../image_tools/fixtures/should-match/tiny-antialiasing-sample/tiny-actual.png'));
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': expected,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('should pass', async ({ page }) => {
        await page.goto('${actualURL}');
        await expect(page.locator('img')).toHaveScreenshot('snapshot.png', {
          threshold: 0,
          _comparator: 'ssim-cie94',
        });
      });
      test('should fail', async ({ page }) => {
        await page.goto('${actualURL}');
        await expect(page.locator('img')).toHaveScreenshot('snapshot.png', {
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
  const actualURL = pathToFileURL(path.join(__dirname, '../image_tools/fixtures/should-match/tiny-antialiasing-sample/tiny-actual.png'));
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
      projects: [
        {
          name: 'should-pass',
          expect: {
            toHaveScreenshot: {
              _comparator: 'ssim-cie94',
            }
          },
        },
        {
          name: 'should-fail',
          expect: {
            toHaveScreenshot: {
              _comparator: 'pixelmatch',
            }
          },
        },
      ],
    }),
    '__screenshots__/a.spec.js/snapshot.png': expected,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('test', async ({ page }) => {
        await page.goto('${actualURL}');
        await expect(page.locator('img')).toHaveScreenshot('snapshot.png', { threshold: 0, });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].projectName).toBe('should-pass');
  expect(result.report.suites[0].specs[0].tests[0].status).toBe('expected');
  expect(result.report.suites[0].specs[0].tests[1].projectName).toBe('should-fail');
  expect(result.report.suites[0].specs[0].tests[1].status).toBe('unexpected');
});

test('should throw pretty error if expected PNG file is not a PNG', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': 'not a png',
    '__screenshots__/a.spec.js/snapshot.jpg': 'not a jpg',
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('png', async ({ page }) => {
        await expect(page).toHaveScreenshot('snapshot.png');
      });
      test('jpg', async ({ page }) => {
        expect(await page.screenshot({ type: 'jpeg' })).toMatchSnapshot('snapshot.jpg')
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('could not decode image as PNG.');
  expect(result.output).toContain('could not decode image as JPEG.');
});

test('should support maskColor option', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/a.spec.js/snapshot.png': createImage(IMG_WIDTH, IMG_HEIGHT, 0, 255, 0),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('png', async ({ page }) => {
        await page.setContent('<style> html,body { padding: 0; margin: 0; }</style>');
        await expect(page).toHaveScreenshot('snapshot.png', {
          mask: [page.locator('body')],
          maskColor: '#00FF00',
        });
      });
    `,
  });
  expect(result.exitCode).toBe(0);
});

test('should support stylePath option', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    '__screenshots__/tests/a.spec.js/snapshot.png': createImage(IMG_WIDTH, IMG_HEIGHT, 0, 255, 0),
    '__screenshots__/tests/a.spec.js/png-1.png': createImage(IMG_WIDTH, IMG_HEIGHT, 0, 255, 0),
    'screenshot.css': 'body { background: #00FF00; }',
    'tests/a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('png', async ({ page }) => {
        await page.setContent('<style> html,body { padding: 0; margin: 0; }</style>');
        await expect(page).toHaveScreenshot('snapshot.png', {
          stylePath: './screenshot.css',
        });
        await expect(page).toHaveScreenshot({
          stylePath: './screenshot.css',
        });
      });
    `,
  });
  expect(result.exitCode).toBe(0);
});

test('should support stylePath option in config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
      expect: {
        toHaveScreenshot: {
          stylePath: './screenshot.css',
        },
      },
    }),
    'screenshot.css': 'body { background: #00FF00; }',
    '__screenshots__/a.spec.js/snapshot.png': createImage(IMG_WIDTH, IMG_HEIGHT, 0, 255, 0),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('png', async ({ page }) => {
        await page.setContent('<style> html,body { padding: 0; margin: 0; }</style>');
        await expect(page).toHaveScreenshot('snapshot.png');
      });
    `,
  });
  expect(result.exitCode).toBe(0);
});

function playwrightConfig(obj: any) {
  return {
    'playwright.config.js': `
      module.exports = ${JSON.stringify(obj, null, 2)}
    `,
  };
}

test('should trim+sanitize attachment names and paths', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...playwrightConfig({
      snapshotPathTemplate: '__screenshots__/{testFilePath}/{arg}{ext}',
    }),
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test.afterEach(async ({}, testInfo) => {
        console.log('## ' + JSON.stringify(testInfo.attachments));
      });
      const title = 'long '.repeat(30) + 'title';
      test(title, async ({ page }) => {
        await expect.soft(page).toHaveScreenshot();
        const name = 'long '.repeat(30) + 'name.png';
        await expect.soft(page).toHaveScreenshot(name);
        await expect.soft(page).toHaveScreenshot(['dir', name]);
      });
    `
  });

  expect(result.exitCode).toBe(1);
  const attachments = result.output.split('\n').filter(l => l.startsWith('## ')).map(l => l.substring(3)).map(l => JSON.parse(l))[0];
  for (const attachment of attachments) {
    attachment.path = attachment.path.replace(testInfo.outputDir, '').substring(1).replace(/\\/g, '/');
    attachment.name = attachment.name.replace(/\\/g, '/');
  }
  expect(attachments).toEqual([
    {
      name: 'long-long-long-long-long-l-852e1-long-long-long-long-title-1-expected.png',
      contentType: 'image/png',
      path: '__screenshots__/a.spec.js/long-long-long-long-long-long-long-long-long-l-852e1-long-long-long-long-long-long-long-long-title-1.png',
    },
    {
      name: 'long-long-long-long-long-l-852e1-long-long-long-long-title-1-actual.png',
      contentType: 'image/png',
      path: 'test-results/a-long-long-long-long-long-abd51-g-long-long-long-long-title/long-long-long-long-long-l-852e1-long-long-long-long-title-1-actual.png',
    },
    {
      name: 'long-long-long-long-long-l-6bf1e-ong-long-long-long-name-expected.png',
      contentType: 'image/png',
      path: '__screenshots__/a.spec.js/long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-long-name.png',
    },
    {
      name: 'long-long-long-long-long-l-6bf1e-ong-long-long-long-name-actual.png',
      contentType: 'image/png',
      path: 'test-results/a-long-long-long-long-long-abd51-g-long-long-long-long-title/long-long-long-long-long-l-6bf1e-ong-long-long-long-name-actual.png',
    },
    {
      name: 'dir/long long long long long long long long long long long long long long long long long long long long long long long long long long long long long long name-expected.png',
      contentType: 'image/png',
      path: '__screenshots__/a.spec.js/dir/long long long long long long long long long long long long long long long long long long long long long long long long long long long long long long name.png',
    },
    {
      name: 'dir/long long long long long long long long long long long long long long long long long long long long long long long long long long long long long long name-actual.png',
      contentType: 'image/png',
      path: 'test-results/a-long-long-long-long-long-abd51-g-long-long-long-long-title/dir/long long long long long long long long long long long long long long long long long long long long long long long long long long long long long long name-actual.png',
    },
  ]);
});

