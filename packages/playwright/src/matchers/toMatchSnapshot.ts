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

import type { Locator, Page } from 'playwright-core';
import type { Page as PageEx } from 'playwright-core/lib/client/page';
import type { Locator as LocatorEx } from 'playwright-core/lib/client/locator';
import { currentTestInfo, currentExpectTimeout } from '../common/globals';
import type { ImageComparatorOptions, Comparator } from 'playwright-core/lib/utils';
import { getComparator, sanitizeForFilePath, zones } from 'playwright-core/lib/utils';
import type { PageScreenshotOptions } from 'playwright-core/types/types';
import {
  addSuffixToFilePath,
  trimLongString, callLogText,
  expectTypes  } from '../util';
import { colors } from 'playwright-core/lib/utilsBundle';
import fs from 'fs';
import path from 'path';
import { mime } from 'playwright-core/lib/utilsBundle';
import type { TestInfoImpl } from '../worker/testInfo';
import type { ExpectMatcherContext } from './expect';
import type { MatcherResult } from './matcherHint';

type NameOrSegments = string | string[];
const snapshotNamesSymbol = Symbol('snapshotNames');

type SnapshotNames = {
  anonymousSnapshotIndex: number;
  namedSnapshotIndex: { [key: string]: number };
};

type ImageMatcherResult = MatcherResult<string, string> & { diff?: string };

class SnapshotHelper<T extends ImageComparatorOptions> {
  readonly testInfo: TestInfoImpl;
  readonly snapshotName: string;
  readonly legacyExpectedPath: string;
  readonly previousPath: string;
  readonly snapshotPath: string;
  readonly actualPath: string;
  readonly diffPath: string;
  readonly mimeType: string;
  readonly kind: 'Screenshot'|'Snapshot';
  readonly updateSnapshots: 'all' | 'none' | 'missing';
  readonly comparatorOptions: ImageComparatorOptions;
  readonly comparator: Comparator;
  readonly allOptions: T;
  readonly matcherName: string;
  readonly locator: Locator | undefined;

  constructor(
    testInfo: TestInfoImpl,
    matcherName: string,
    locator: Locator | undefined,
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
    const inputFile = testInfo._getOutputPath(...inputPathSegments);
    const outputFile = testInfo._getOutputPath(...outputPathSegments);
    this.legacyExpectedPath = addSuffixToFilePath(inputFile, '-expected');
    this.previousPath = addSuffixToFilePath(outputFile, '-previous');
    this.actualPath = addSuffixToFilePath(outputFile, '-actual');
    this.diffPath = addSuffixToFilePath(outputFile, '-diff');
    this.matcherName = matcherName;
    this.locator = locator;

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
      _comparator: options._comparator,
    };
    this.kind = this.mimeType.startsWith('image/') ? 'Screenshot' : 'Snapshot';
  }

  createMatcherResult(message: string, pass: boolean, log?: string[]): ImageMatcherResult {
    const unfiltered: ImageMatcherResult = {
      name: this.matcherName,
      expected: this.snapshotPath,
      actual: this.actualPath,
      diff: this.diffPath,
      pass,
      message: () => message,
      log,
    };
    return Object.fromEntries(Object.entries(unfiltered).filter(([_, v]) => v !== undefined)) as ImageMatcherResult;
  }

  handleMissingNegated(): ImageMatcherResult {
    const isWriteMissingMode = this.updateSnapshots === 'all' || this.updateSnapshots === 'missing';
    const message = `A snapshot doesn't exist at ${this.snapshotPath}${isWriteMissingMode ? ', matchers using ".not" won\'t write them automatically.' : '.'}`;
    // NOTE: 'isNot' matcher implies inversed value.
    return this.createMatcherResult(message, true);
  }

  handleDifferentNegated(): ImageMatcherResult {
    // NOTE: 'isNot' matcher implies inversed value.
    return this.createMatcherResult('', false);
  }

  handleMatchingNegated(): ImageMatcherResult {
    const message = [
      colors.red(`${this.kind} comparison failed:`),
      '',
      indent('Expected result should be different from the actual one.', '  '),
    ].join('\n');
    // NOTE: 'isNot' matcher implies inversed value.
    return this.createMatcherResult(message, true);
  }

  handleMissing(actual: Buffer | string): ImageMatcherResult {
    const isWriteMissingMode = this.updateSnapshots === 'all' || this.updateSnapshots === 'missing';
    if (isWriteMissingMode) {
      writeFileSync(this.snapshotPath, actual);
      writeFileSync(this.actualPath, actual);
      this.testInfo.attachments.push({ name: addSuffixToFilePath(this.snapshotName, '-actual'), contentType: this.mimeType, path: this.actualPath });
    }
    const message = `A snapshot doesn't exist at ${this.snapshotPath}${isWriteMissingMode ? ', writing actual.' : '.'}`;
    if (this.updateSnapshots === 'all') {
      /* eslint-disable no-console */
      console.log(message);
      return this.createMatcherResult(message, true);
    }
    if (this.updateSnapshots === 'missing') {
      this.testInfo._failWithError(new Error(message), false /* isHardError */);
      return this.createMatcherResult('', true);
    }
    return this.createMatcherResult(message, false);
  }

  handleDifferent(
    actual: Buffer | string | undefined,
    expected: Buffer | string | undefined,
    previous: Buffer | string | undefined,
    diff: Buffer | string | undefined,
    diffError: string | undefined,
    log: string[] | undefined,
    title = `${this.kind} comparison failed:`): ImageMatcherResult {
    const output = [
      colors.red(title),
      '',
    ];
    if (diffError)
      output.push(indent(diffError, '  '));

    if (expected !== undefined) {
      // Copy the expectation inside the `test-results/` folder for backwards compatibility,
      // so that one can upload `test-results/` directory and have all the data inside.
      writeFileSync(this.legacyExpectedPath, expected);
      this.testInfo.attachments.push({ name: addSuffixToFilePath(this.snapshotName, '-expected'), contentType: this.mimeType, path: this.snapshotPath });
      output.push(`\nExpected: ${colors.yellow(this.snapshotPath)}`);
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

    if (log?.length)
      output.push(callLogText(log));
    else
      output.push('');

    return this.createMatcherResult(output.join('\n'), false, log);
  }

  handleMatching(): ImageMatcherResult {
    return this.createMatcherResult('', true);
  }
}

export function toMatchSnapshot(
  this: ExpectMatcherContext,
  received: Buffer | string,
  nameOrOptions: NameOrSegments | { name?: NameOrSegments } & ImageComparatorOptions = {},
  optOptions: ImageComparatorOptions = {}
): MatcherResult<NameOrSegments | { name?: NameOrSegments }, string> {
  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`toMatchSnapshot() must be called during the test`);
  if (received instanceof Promise)
    throw new Error('An unresolved Promise was passed to toMatchSnapshot(), make sure to resolve it by adding await to it.');

  if (testInfo._configInternal.ignoreSnapshots)
    return { pass: !this.isNot, message: () => '', name: 'toMatchSnapshot', expected: nameOrOptions };

  const helper = new SnapshotHelper(
      testInfo, 'toMatchSnapshot', undefined, testInfo.snapshotPath.bind(testInfo), determineFileExtension(received),
      testInfo._projectInternal.expect?.toMatchSnapshot || {},
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
    return helper.createMatcherResult(helper.snapshotPath + ' running with --update-snapshots, writing actual.', true);
  }

  return helper.handleDifferent(received, expected, undefined, result.diff, result.errorMessage, undefined);
}

type HaveScreenshotOptions = ImageComparatorOptions & Omit<PageScreenshotOptions, 'type' | 'quality' | 'path' | 'style'> & { stylePath?: string | string[] };

export function toHaveScreenshotStepTitle(
  nameOrOptions: NameOrSegments | { name?: NameOrSegments } & HaveScreenshotOptions = {},
  optOptions: HaveScreenshotOptions = {}
): string {
  let name: NameOrSegments | undefined;
  if (typeof nameOrOptions === 'object' && !Array.isArray(nameOrOptions))
    name = nameOrOptions.name;
  else
    name = nameOrOptions;
  return Array.isArray(name) ? name.join(path.sep) : name || '';
}

export async function toHaveScreenshot(
  this: ExpectMatcherContext,
  pageOrLocator: Page | Locator,
  nameOrOptions: NameOrSegments | { name?: NameOrSegments } & HaveScreenshotOptions = {},
  optOptions: HaveScreenshotOptions = {}
): Promise<MatcherResult<NameOrSegments | { name?: NameOrSegments }, string>> {
  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`toHaveScreenshot() must be called during the test`);

  if (testInfo._configInternal.ignoreSnapshots)
    return { pass: !this.isNot, message: () => '', name: 'toHaveScreenshot', expected: nameOrOptions };

  expectTypes(pageOrLocator, ['Page', 'Locator'], 'toHaveScreenshot');
  const [page, locator] = pageOrLocator.constructor.name === 'Page' ? [(pageOrLocator as PageEx), undefined] : [(pageOrLocator as Locator).page() as PageEx, pageOrLocator as LocatorEx];
  const config = (testInfo._projectInternal.expect as any)?.toHaveScreenshot;
  const snapshotPathResolver = testInfo.snapshotPath.bind(testInfo);
  const helper = new SnapshotHelper(
      testInfo, 'toHaveScreenshot', locator, snapshotPathResolver, 'png',
      {
        _comparator: config?._comparator,
        maxDiffPixels: config?.maxDiffPixels,
        maxDiffPixelRatio: config?.maxDiffPixelRatio,
        threshold: config?.threshold,
      },
      nameOrOptions, optOptions);
  if (!helper.snapshotPath.toLowerCase().endsWith('.png'))
    throw new Error(`Screenshot name "${path.basename(helper.snapshotPath)}" must have '.png' extension`);
  expectTypes(pageOrLocator, ['Page', 'Locator'], 'toHaveScreenshot');
  return await zones.preserve(async () => {
    // Loading from filesystem resets zones.
    const style = await loadScreenshotStyles(optOptions.stylePath || config?.stylePath);
    return toHaveScreenshotContinuation.call(this, helper, page, locator, config, style);
  });
}

async function toHaveScreenshotContinuation(
  this: ExpectMatcherContext,
  helper: SnapshotHelper<HaveScreenshotOptions>,
  page: PageEx,
  locator: LocatorEx | undefined,
  config?: HaveScreenshotOptions,
  style?: string) {
  const screenshotOptions: any = {
    animations: config?.animations ?? 'disabled',
    scale: config?.scale ?? 'css',
    caret: config?.caret ?? 'hide',
    style,
    ...helper.allOptions,
    mask: (helper.allOptions.mask || []) as LocatorEx[],
    maskColor: helper.allOptions.maskColor,
    name: undefined,
    threshold: undefined,
    maxDiffPixels: undefined,
    maxDiffPixelRatio: undefined,
  };

  const hasSnapshot = fs.existsSync(helper.snapshotPath);
  if (this.isNot) {
    if (!hasSnapshot)
      return helper.handleMissingNegated();

    // Having `errorMessage` means we timed out while waiting
    // for screenshots not to match, so screenshots
    // are actually the same in the end.
    const isDifferent = !(await page._expectScreenshot({
      expected: await fs.promises.readFile(helper.snapshotPath),
      isNot: true,
      locator,
      comparatorOptions: {
        ...helper.comparatorOptions,
        comparator: helper.comparatorOptions._comparator,
      },
      screenshotOptions,
      timeout: currentExpectTimeout(helper.allOptions),
    })).errorMessage;
    return isDifferent ? helper.handleDifferentNegated() : helper.handleMatchingNegated();
  }

  // Fast path: there's no screenshot and we don't intend to update it.
  if (helper.updateSnapshots === 'none' && !hasSnapshot)
    return helper.createMatcherResult(`A snapshot doesn't exist at ${helper.snapshotPath}.`, false);

  if (!hasSnapshot) {
    // Regenerate a new screenshot by waiting until two screenshots are the same.
    const timeout = currentExpectTimeout(helper.allOptions);
    const { actual, previous, diff, errorMessage, log } = await page._expectScreenshot({
      expected: undefined,
      isNot: false,
      locator,
      comparatorOptions: { ...helper.comparatorOptions, comparator: helper.comparatorOptions._comparator },
      screenshotOptions,
      timeout,
    });
    // We tried re-generating new snapshot but failed.
    // This can be due to e.g. spinning animation, so we want to show it as a diff.
    if (errorMessage)
      return helper.handleDifferent(actual, undefined, previous, diff, undefined, log, errorMessage);

    // We successfully generated new screenshot.
    return helper.handleMissing(actual!);
  }

  // General case:
  // - snapshot exists
  // - regular matcher (i.e. not a `.not`)
  // - perhaps an 'all' flag to update non-matching screenshots
  const expected = await fs.promises.readFile(helper.snapshotPath);
  const { actual, diff, errorMessage, log } = await page._expectScreenshot({
    expected,
    isNot: false,
    locator,
    comparatorOptions: { ...helper.comparatorOptions, comparator: helper.comparatorOptions._comparator },
    screenshotOptions,
    timeout: currentExpectTimeout(helper.allOptions),
  });

  if (!errorMessage)
    return helper.handleMatching();

  if (helper.updateSnapshots === 'all') {
    writeFileSync(helper.snapshotPath, actual!);
    writeFileSync(helper.actualPath, actual!);
    /* eslint-disable no-console */
    console.log(helper.snapshotPath + ' is re-generated, writing actual.');
    return helper.createMatcherResult(helper.snapshotPath + ' running with --update-snapshots, writing actual.', true);
  }

  return helper.handleDifferent(actual, expected, undefined, diff, errorMessage, log);
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

async function loadScreenshotStyles(stylePath?: string | string[]): Promise<string | undefined> {
  if (!stylePath)
    return;

  const stylePaths = Array.isArray(stylePath) ? stylePath : [stylePath];
  const styles = await Promise.all(stylePaths.map(async stylePath => {
    const text = await fs.promises.readFile(stylePath, 'utf8');
    return text.trim();
  }));
  return styles.join('\n').trim() || undefined;
}
