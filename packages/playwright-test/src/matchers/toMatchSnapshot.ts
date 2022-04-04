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

import { Locator, Page } from 'playwright-core';
import type { Page as PageEx } from 'playwright-core/lib/client/page';
import type { Locator as LocatorEx } from 'playwright-core/lib/client/locator';
import type { Expect } from '../types';
import { currentTestInfo } from '../globals';
import { getComparator, ImageComparatorOptions, Comparator } from 'playwright-core/lib/utils/comparators';
import type { PageScreenshotOptions } from 'playwright-core/types/types';
import {
  addSuffixToFilePath, serializeError, sanitizeForFilePath,
  trimLongString, callLogText, currentExpectTimeout,
  expectTypes, captureStackTrace  } from '../util';
import { UpdateSnapshots } from '../types';
import colors from 'colors/safe';
import fs from 'fs';
import path from 'path';
import * as mime from 'mime';
import { TestInfoImpl } from '../testInfo';
import { SyncExpectationResult } from '../expect';

type NameOrSegments = string | string[];
const snapshotNamesSymbol = Symbol('snapshotNames');

type SnapshotNames = {
  anonymousSnapshotIndex: number;
  namedSnapshotIndex: { [key: string]: number };
};

class SnapshotHelper<T extends ImageComparatorOptions> {
  readonly testInfo: TestInfoImpl;
  readonly snapshotName: string;
  readonly expectedPath: string;
  readonly previousPath: string;
  readonly snapshotPath: string;
  readonly actualPath: string;
  readonly diffPath: string;
  readonly mimeType: string;
  readonly kind: 'Screenshot'|'Snapshot';
  readonly updateSnapshots: UpdateSnapshots;
  readonly comparatorOptions: ImageComparatorOptions;
  readonly comparator: Comparator;
  readonly allOptions: T;

  constructor(
    testInfo: TestInfoImpl,
    snapshotPathResolver: (...pathSegments: string[]) => string,
    anonymousSnapshotExtension: string,
    configOptions: ImageComparatorOptions,
    nameOrOptions: NameOrSegments | { name?: NameOrSegments } & T,
    optOptions: T,
  ) {
    let options: T;
    let name: NameOrSegments | undefined;
    if (Array.isArray(nameOrOptions) || typeof nameOrOptions === 'string') {
      name = nameOrOptions;
      options = optOptions;
    } else {
      name = nameOrOptions.name;
      options = { ...nameOrOptions };
      delete (options as any).name;
    }

    let snapshotNames = (testInfo as any)[snapshotNamesSymbol] as SnapshotNames;
    if (!(testInfo as any)[snapshotNamesSymbol]) {
      snapshotNames = {
        anonymousSnapshotIndex: 0,
        namedSnapshotIndex: {},
      };
      (testInfo as any)[snapshotNamesSymbol] = snapshotNames;
    }

    // Consider the use case below. We should save actual to different paths.
    //
    //   expect.toMatchSnapshot('a.png')
    //   // noop
    //   expect.toMatchSnapshot('a.png')

    let actualModifier = '';
    if (!name) {
      const fullTitleWithoutSpec = [
        ...testInfo.titlePath.slice(1),
        ++snapshotNames.anonymousSnapshotIndex,
      ].join(' ');
      name = sanitizeForFilePath(trimLongString(fullTitleWithoutSpec)) + '.' + anonymousSnapshotExtension;
      this.snapshotName = name;
    } else {
      const joinedName = Array.isArray(name) ? name.join(path.sep) : name;
      snapshotNames.namedSnapshotIndex[joinedName] = (snapshotNames.namedSnapshotIndex[joinedName] || 0) + 1;
      const index = snapshotNames.namedSnapshotIndex[joinedName];
      if (index > 1) {
        actualModifier = `-${index - 1}`;
        this.snapshotName = `${joinedName}-${index - 1}`;
      } else {
        this.snapshotName = joinedName;
      }
    }

    options = {
      ...configOptions,
      ...options,
    };

    if (options.maxDiffPixels !== undefined && options.maxDiffPixels < 0)
      throw new Error('`maxDiffPixels` option value must be non-negative integer');

    if (options.maxDiffPixelRatio !== undefined && (options.maxDiffPixelRatio < 0 || options.maxDiffPixelRatio > 1))
      throw new Error('`maxDiffPixelRatio` option value must be between 0 and 1');

    // sanitizes path if string
    const inputPathSegments = Array.isArray(name) ? name : [addSuffixToFilePath(name, '', undefined, true)];
    const outputPathSegments = Array.isArray(name) ? name : [addSuffixToFilePath(name, actualModifier, undefined, true)];
    this.snapshotPath = snapshotPathResolver(...inputPathSegments);
    const inputFile = testInfo.outputPath(...inputPathSegments);
    const outputFile = testInfo.outputPath(...outputPathSegments);
    this.expectedPath = addSuffixToFilePath(inputFile, '-expected');
    this.previousPath = addSuffixToFilePath(outputFile, '-previous');
    this.actualPath = addSuffixToFilePath(outputFile, '-actual');
    this.diffPath = addSuffixToFilePath(outputFile, '-diff');

    this.updateSnapshots = testInfo.config.updateSnapshots;
    if (this.updateSnapshots === 'missing' && testInfo.retry < testInfo.project.retries)
      this.updateSnapshots = 'none';
    this.mimeType = mime.getType(path.basename(this.snapshotPath)) ?? 'application/octet-string';
    this.comparator = getComparator(this.mimeType);

    this.testInfo = testInfo;
    this.allOptions = options;
    this.comparatorOptions = {
      maxDiffPixels: options.maxDiffPixels,
      maxDiffPixelRatio: options.maxDiffPixelRatio,
      threshold: options.threshold,
    };
    this.kind = this.mimeType.startsWith('image/') ? 'Screenshot' : 'Snapshot';
  }

  decorateTitle(result: SyncExpectationResult): SyncExpectationResult & { titleSuffix: string } {
    return { ...result, titleSuffix: `(${path.basename(this.snapshotName)})` };
  }

  handleMissingNegated() {
    const isWriteMissingMode = this.updateSnapshots === 'all' || this.updateSnapshots === 'missing';
    const message = `${this.snapshotPath} is missing in snapshots${isWriteMissingMode ? ', matchers using ".not" won\'t write them automatically.' : '.'}`;
    return this.decorateTitle({
      // NOTE: 'isNot' matcher implies inversed value.
      pass: true,
      message: () => message,
    });
  }

  handleDifferentNegated() {
    // NOTE: 'isNot' matcher implies inversed value.
    return this.decorateTitle({ pass: false, message: () => '' });
  }

  handleMatchingNegated() {
    const message = [
      colors.red(`${this.kind} comparison failed:`),
      '',
      indent('Expected result should be different from the actual one.', '  '),
    ].join('\n');
    // NOTE: 'isNot' matcher implies inversed value.
    return this.decorateTitle({ pass: true, message: () => message });
  }

  handleMissing(actual: Buffer | string) {
    const isWriteMissingMode = this.updateSnapshots === 'all' || this.updateSnapshots === 'missing';
    if (isWriteMissingMode) {
      writeFileSync(this.snapshotPath, actual);
      writeFileSync(this.actualPath, actual);
    }
    const message = `${this.snapshotPath} is missing in snapshots${isWriteMissingMode ? ', writing actual.' : '.'}`;
    if (this.updateSnapshots === 'all') {
      /* eslint-disable no-console */
      console.log(message);
      return this.decorateTitle({ pass: true, message: () => message });
    }
    if (this.updateSnapshots === 'missing') {
      this.testInfo._failWithError(serializeError(new Error(message)), false /* isHardError */);
      return this.decorateTitle({ pass: true, message: () => '' });
    }
    return this.decorateTitle({ pass: false, message: () => message });
  }

  handleDifferent(
    actual: Buffer | string | undefined,
    expected: Buffer | string | undefined,
    previous: Buffer | string | undefined,
    diff: Buffer | string | undefined,
    diffError: string | undefined,
    log: string[] | undefined,
    title = `${this.kind} comparison failed:`) {
    const output = [
      colors.red(title),
      '',
    ];
    if (diffError)
      output.push(indent(diffError, '  '));
    if (log?.length)
      output.push(callLogText(log));
    else
      output.push('');

    if (expected !== undefined) {
      writeFileSync(this.expectedPath, expected);
      this.testInfo.attachments.push({ name: addSuffixToFilePath(this.snapshotName, '-expected'), contentType: this.mimeType, path: this.expectedPath });
      output.push(`Expected: ${colors.yellow(this.expectedPath)}`);
    }
    if (previous !== undefined) {
      writeFileSync(this.previousPath, previous);
      this.testInfo.attachments.push({ name: addSuffixToFilePath(this.snapshotName, '-previous'), contentType: this.mimeType, path: this.previousPath });
      output.push(`Previous: ${colors.yellow(this.previousPath)}`);
    }
    if (actual !== undefined) {
      writeFileSync(this.actualPath, actual);
      this.testInfo.attachments.push({ name: addSuffixToFilePath(this.snapshotName, '-actual'), contentType: this.mimeType, path: this.actualPath });
      output.push(`Received: ${colors.yellow(this.actualPath)}`);
    }
    if (diff !== undefined) {
      writeFileSync(this.diffPath, diff);
      this.testInfo.attachments.push({ name: addSuffixToFilePath(this.snapshotName, '-diff'), contentType: this.mimeType, path: this.diffPath });
      output.push(`    Diff: ${colors.yellow(this.diffPath)}`);
    }
    return this.decorateTitle({ pass: false, message: () => output.join('\n'), });
  }

  handleMatching() {
    return this.decorateTitle({ pass: true, message: () => '' });
  }
}

export function toMatchSnapshot(
  this: ReturnType<Expect['getState']>,
  received: Buffer | string,
  nameOrOptions: NameOrSegments | { name?: NameOrSegments } & ImageComparatorOptions = {},
  optOptions: ImageComparatorOptions = {}
): SyncExpectationResult & { titleSuffix: string } {
  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`toMatchSnapshot() must be called during the test`);
  if (received instanceof Promise)
    throw new Error('An unresolved Promise was passed to toMatchSnapshot(), make sure to resolve it by adding await to it.');
  const helper = new SnapshotHelper(
      testInfo, testInfo.snapshotPath.bind(testInfo), determineFileExtension(received),
      testInfo.project.expect?.toMatchSnapshot || {},
      nameOrOptions, optOptions);

  if (this.isNot) {
    if (!fs.existsSync(helper.snapshotPath))
      return helper.handleMissingNegated();
    const isDifferent = !!helper.comparator(received, fs.readFileSync(helper.snapshotPath), helper.comparatorOptions);
    return isDifferent ? helper.handleDifferentNegated() : helper.handleMatchingNegated();
  }

  if (!fs.existsSync(helper.snapshotPath))
    return helper.handleMissing(received);

  const expected = fs.readFileSync(helper.snapshotPath);
  const result = helper.comparator(received, expected, helper.comparatorOptions);
  if (!result)
    return helper.handleMatching();

  if (helper.updateSnapshots === 'all') {
    writeFileSync(helper.snapshotPath, received);
    /* eslint-disable no-console */
    console.log(helper.snapshotPath + ' does not match, writing actual.');
    return helper.decorateTitle({ pass: true, message: () => helper.snapshotPath + ' running with --update-snapshots, writing actual.' });
  }

  return helper.handleDifferent(received, expected, undefined, result.diff, result.errorMessage, undefined);
}

type HaveScreenshotOptions = ImageComparatorOptions & Omit<PageScreenshotOptions, 'type' | 'quality' | 'path'>;

export async function toHaveScreenshot(
  this: ReturnType<Expect['getState']>,
  pageOrLocator: Page | Locator,
  nameOrOptions: NameOrSegments | { name?: NameOrSegments } & HaveScreenshotOptions = {},
  optOptions: HaveScreenshotOptions = {}
): Promise<SyncExpectationResult> {
  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`toHaveScreenshot() must be called during the test`);
  const config = testInfo.project.expect?.toHaveScreenshot;
  const helper = new SnapshotHelper(
      testInfo, testInfo._screenshotPath.bind(testInfo), 'png',
      {
        maxDiffPixels: config?.maxDiffPixels,
        maxDiffPixelRatio: config?.maxDiffPixelRatio,
        threshold: config?.threshold,
      },
      nameOrOptions, optOptions);
  if (!helper.snapshotPath.toLowerCase().endsWith('.png'))
    throw new Error(`Screenshot name "${path.basename(helper.snapshotPath)}" must have '.png' extension`);
  expectTypes(pageOrLocator, ['Page', 'Locator'], 'toHaveScreenshot');
  const [page, locator] = pageOrLocator.constructor.name === 'Page' ? [(pageOrLocator as PageEx), undefined] : [(pageOrLocator as Locator).page() as PageEx, pageOrLocator as LocatorEx];
  const screenshotOptions = {
    animations: config?.animations ?? 'disabled',
    fonts: config?.fonts ?? 'ready',
    scale: config?.scale ?? 'css',
    caret: config?.caret ?? 'hide',
    ...helper.allOptions,
    mask: (helper.allOptions.mask || []) as LocatorEx[],
    name: undefined,
    threshold: undefined,
    maxDiffPixels: undefined,
    maxDiffPixelRatio: undefined,
  };

  const customStackTrace = captureStackTrace(`expect.toHaveScreenshot`);
  const hasSnapshot = fs.existsSync(helper.snapshotPath);
  if (this.isNot) {
    if (!hasSnapshot)
      return helper.handleMissingNegated();

    // Having `errorMessage` means we timed out while waiting
    // for screenshots not to match, so screenshots
    // are actually the same in the end.
    const isDifferent = !(await page._expectScreenshot(customStackTrace, {
      expected: await fs.promises.readFile(helper.snapshotPath),
      isNot: true,
      locator,
      comparatorOptions: helper.comparatorOptions,
      screenshotOptions,
      timeout: currentExpectTimeout(helper.allOptions),
    })).errorMessage;
    return isDifferent ? helper.handleDifferentNegated() : helper.handleMatchingNegated();
  }

  // Fast path: there's no screenshot and we don't intend to update it.
  if (helper.updateSnapshots === 'none' && !hasSnapshot)
    return { pass: false, message: () => `${helper.snapshotPath} is missing in snapshots.` };

  if (helper.updateSnapshots === 'all' || !hasSnapshot) {
    // Regenerate a new screenshot by waiting until two screenshots are the same.
    const timeout = currentExpectTimeout(helper.allOptions);
    const { actual, previous, diff, errorMessage, log } = await page._expectScreenshot(customStackTrace, {
      expected: undefined,
      isNot: false,
      locator,
      comparatorOptions: helper.comparatorOptions,
      screenshotOptions,
      timeout,
    });
    // We tried re-generating new snapshot but failed.
    // This can be due to e.g. spinning animation, so we want to show it as a diff.
    if (errorMessage) {
      const title = actual && previous ?
        `Timeout ${timeout}ms exceeded while generating screenshot because ${locator ? 'element' : 'page'} kept changing` :
        `Timeout ${timeout}ms exceeded while generating screenshot`;
      return helper.handleDifferent(actual, undefined, previous, diff, undefined, log, title);
    }

    // We successfully (re-)generated new screenshot.
    if (!hasSnapshot)
      return helper.handleMissing(actual!);

    writeFileSync(helper.snapshotPath, actual!);
    /* eslint-disable no-console */
    console.log(helper.snapshotPath + ' is re-generated, writing actual.');
    return {
      pass: true,
      message: () => helper.snapshotPath + ' running with --update-snapshots, writing actual.'
    };
  }

  // General case:
  // - snapshot exists
  // - regular matcher (i.e. not a `.not`)
  // - no flags to update screenshots
  const expected = await fs.promises.readFile(helper.snapshotPath);
  const { actual, diff, errorMessage, log } = await page._expectScreenshot(customStackTrace, {
    expected,
    isNot: false,
    locator,
    comparatorOptions: helper.comparatorOptions,
    screenshotOptions,
    timeout: currentExpectTimeout(helper.allOptions),
  });

  return errorMessage ?
    helper.handleDifferent(actual, expected, undefined, diff, errorMessage, log) :
    helper.handleMatching();
}

function writeFileSync(aPath: string, content: Buffer | string) {
  fs.mkdirSync(path.dirname(aPath), { recursive: true });
  fs.writeFileSync(aPath, content);
}

function indent(lines: string, tab: string) {
  return lines.replace(/^(?=.+$)/gm, tab);
}

function determineFileExtension(file: string | Buffer): string {
  if (typeof file === 'string')
    return 'txt';
  if (compareMagicBytes(file, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return 'png';
  if (compareMagicBytes(file, [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01]))
    return 'jpg';
  return 'dat';
}

function compareMagicBytes(file: Buffer, magicBytes: number[]): boolean {
  return Buffer.compare(Buffer.from(magicBytes), file.slice(0, magicBytes.length)) === 0;
}
