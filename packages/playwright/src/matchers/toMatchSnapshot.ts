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

import fs from 'fs';
import path from 'path';

import { compareBuffersOrStrings, getComparator, isString } from 'playwright-core/lib/utils';
import { colors } from 'playwright-core/lib/utils';
import { mime } from 'playwright-core/lib/utilsBundle';

import { addSuffixToFilePath, callLogText, expectTypes } from '../util';
import {  matcherHint } from './matcherHint';
import { currentTestInfo } from '../common/globals';

import type { MatcherResult } from './matcherHint';
import type { ExpectMatcherStateInternal } from './matchers';
import type { FullProjectInternal } from '../common/config';
import type { TestInfoImpl, TestStepInfoImpl } from '../worker/testInfo';
import type { Locator, Page } from 'playwright-core';
import type { ExpectScreenshotOptions, Page as PageEx } from 'playwright-core/lib/client/page';
import type { Comparator, ImageComparatorOptions } from 'playwright-core/lib/utils';

type NameOrSegments = string | string[];

type ImageMatcherResult = MatcherResult<string, string> & { diff?: string };

type ToHaveScreenshotConfigOptions = NonNullable<NonNullable<FullProjectInternal['expect']>['toHaveScreenshot']> & {
  _comparator?: string;
};

type ToHaveScreenshotOptions = ToHaveScreenshotConfigOptions & {
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fullPage?: boolean;
  mask?: Array<Locator>;
  maskColor?: string;
  omitBackground?: boolean;
  timeout?: number;
};

// Keep in sync with above (begin).
const NonConfigProperties: (keyof ToHaveScreenshotOptions)[] = [
  'clip',
  'fullPage',
  'mask',
  'maskColor',
  'omitBackground',
  'timeout',
];
// Keep in sync with above (end).

class SnapshotHelper {
  readonly testInfo: TestInfoImpl;
  readonly name: string;
  readonly attachmentBaseName: string;
  readonly legacyExpectedPath: string;
  readonly previousPath: string;
  readonly expectedPath: string;
  readonly actualPath: string;
  readonly diffPath: string;
  readonly mimeType: string;
  readonly kind: 'Screenshot'|'Snapshot';
  readonly updateSnapshots: 'all' | 'changed' | 'missing' | 'none';
  readonly comparator: Comparator;
  readonly options: Omit<ToHaveScreenshotOptions, '_comparator'> & { comparator?: string };
  readonly matcherName: string;
  readonly locator: Locator | undefined;

  constructor(
    testInfo: TestInfoImpl,
    matcherName: 'toMatchSnapshot' | 'toHaveScreenshot',
    locator: Locator | undefined,
    anonymousSnapshotExtension: string | undefined,
    configOptions: ToHaveScreenshotConfigOptions,
    nameOrOptions: NameOrSegments | { name?: NameOrSegments } & ToHaveScreenshotOptions,
    optOptions: ToHaveScreenshotOptions,
  ) {
    let name: NameOrSegments | undefined;
    if (Array.isArray(nameOrOptions) || typeof nameOrOptions === 'string') {
      name = nameOrOptions;
      this.options = { ...optOptions };
    } else {
      const { name: nameFromOptions, ...options } = nameOrOptions;
      this.options = options;
      name = nameFromOptions;
    }

    this.name = Array.isArray(name) ? name.join(path.sep) : name || '';
    const resolvedPaths = testInfo._resolveSnapshotPaths(matcherName === 'toHaveScreenshot' ? 'screenshot' : 'snapshot', name, 'updateSnapshotIndex', anonymousSnapshotExtension);
    this.expectedPath = resolvedPaths.absoluteSnapshotPath;
    this.attachmentBaseName = resolvedPaths.relativeOutputPath;

    const outputBasePath = testInfo._getOutputPath(resolvedPaths.relativeOutputPath);
    this.legacyExpectedPath = addSuffixToFilePath(outputBasePath, '-expected');
    this.previousPath = addSuffixToFilePath(outputBasePath, '-previous');
    this.actualPath = addSuffixToFilePath(outputBasePath, '-actual');
    this.diffPath = addSuffixToFilePath(outputBasePath, '-diff');

    const filteredConfigOptions = { ...configOptions };
    for (const prop of NonConfigProperties)
      delete (filteredConfigOptions as any)[prop];
    this.options = {
      ...filteredConfigOptions,
      ...this.options,
    };

    // While comparator is not a part of the public API, it is translated here.
    if ((this.options as any)._comparator) {
      this.options.comparator = (this.options as any)._comparator;
      delete (this.options as any)._comparator;
    }

    if (this.options.maxDiffPixels !== undefined && this.options.maxDiffPixels < 0)
      throw new Error('`maxDiffPixels` option value must be non-negative integer');

    if (this.options.maxDiffPixelRatio !== undefined && (this.options.maxDiffPixelRatio < 0 || this.options.maxDiffPixelRatio > 1))
      throw new Error('`maxDiffPixelRatio` option value must be between 0 and 1');

    this.matcherName = matcherName;
    this.locator = locator;

    this.updateSnapshots = testInfo.config.updateSnapshots;
    this.mimeType = mime.getType(path.basename(this.expectedPath)) ?? 'application/octet-stream';
    this.comparator = getComparator(this.mimeType);

    this.testInfo = testInfo;
    this.kind = this.mimeType.startsWith('image/') ? 'Screenshot' : 'Snapshot';
  }

  createMatcherResult(message: string, pass: boolean, log?: string[]): ImageMatcherResult {
    const unfiltered: ImageMatcherResult = {
      name: this.matcherName,
      expected: this.expectedPath,
      actual: this.actualPath,
      diff: this.diffPath,
      pass,
      message: () => message,
      log,
    };
    return Object.fromEntries(Object.entries(unfiltered).filter(([_, v]) => v !== undefined)) as ImageMatcherResult;
  }

  handleMissingNegated(): ImageMatcherResult {
    const isWriteMissingMode = this.updateSnapshots !== 'none';
    const message = `A snapshot doesn't exist at ${this.expectedPath}${isWriteMissingMode ? ', matchers using ".not" won\'t write them automatically.' : '.'}`;
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

  handleMissing(actual: Buffer | string, step: TestStepInfoImpl | undefined): ImageMatcherResult {
    const isWriteMissingMode = this.updateSnapshots !== 'none';
    if (isWriteMissingMode)
      writeFileSync(this.expectedPath, actual);
    step?._attachToStep({ name: addSuffixToFilePath(this.attachmentBaseName, '-expected'), contentType: this.mimeType, path: this.expectedPath });
    writeFileSync(this.actualPath, actual);
    step?._attachToStep({ name: addSuffixToFilePath(this.attachmentBaseName, '-actual'), contentType: this.mimeType, path: this.actualPath });
    const message = `A snapshot doesn't exist at ${this.expectedPath}${isWriteMissingMode ? ', writing actual.' : '.'}`;
    if (this.updateSnapshots === 'all' || this.updateSnapshots === 'changed') {
      /* eslint-disable no-console */
      console.log(message);
      return this.createMatcherResult(message, true);
    }
    if (this.updateSnapshots === 'missing') {
      this.testInfo._hasNonRetriableError = true;
      this.testInfo._failWithError(new Error(message));
      return this.createMatcherResult('', true);
    }
    return this.createMatcherResult(message, false);
  }

  handleDifferent(
    actual: Buffer | string | undefined,
    expected: Buffer | string | undefined,
    previous: Buffer | string | undefined,
    diff: Buffer | string | undefined,
    header: string,
    diffError: string,
    log: string[] | undefined,
    step: TestStepInfoImpl | undefined): ImageMatcherResult {
    const output = [`${header}${indent(diffError, '  ')}`];
    if (this.name) {
      output.push('');
      output.push(`  Snapshot: ${this.name}`);
    }
    if (expected !== undefined) {
      // Copy the expectation inside the `test-results/` folder for backwards compatibility,
      // so that one can upload `test-results/` directory and have all the data inside.
      writeFileSync(this.legacyExpectedPath, expected);
      step?._attachToStep({ name: addSuffixToFilePath(this.attachmentBaseName, '-expected'), contentType: this.mimeType, path: this.expectedPath });
    }
    if (previous !== undefined) {
      writeFileSync(this.previousPath, previous);
      step?._attachToStep({ name: addSuffixToFilePath(this.attachmentBaseName, '-previous'), contentType: this.mimeType, path: this.previousPath });
    }
    if (actual !== undefined) {
      writeFileSync(this.actualPath, actual);
      step?._attachToStep({ name: addSuffixToFilePath(this.attachmentBaseName, '-actual'), contentType: this.mimeType, path: this.actualPath });
    }
    if (diff !== undefined) {
      writeFileSync(this.diffPath, diff);
      step?._attachToStep({ name: addSuffixToFilePath(this.attachmentBaseName, '-diff'), contentType: this.mimeType, path: this.diffPath });
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
  this: ExpectMatcherStateInternal,
  received: Buffer | string,
  nameOrOptions: NameOrSegments | { name?: NameOrSegments } & ImageComparatorOptions = {},
  optOptions: ImageComparatorOptions = {}
): MatcherResult<NameOrSegments | { name?: NameOrSegments }, string> {
  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`toMatchSnapshot() must be called during the test`);
  if (received instanceof Promise)
    throw new Error('An unresolved Promise was passed to toMatchSnapshot(), make sure to resolve it by adding await to it.');

  if (testInfo._projectInternal.ignoreSnapshots)
    return { pass: !this.isNot, message: () => '', name: 'toMatchSnapshot', expected: nameOrOptions };

  const configOptions = testInfo._projectInternal.expect?.toMatchSnapshot || {};
  const helper = new SnapshotHelper(
      testInfo, 'toMatchSnapshot', undefined, '.' + determineFileExtension(received),
      configOptions, nameOrOptions, optOptions);

  if (this.isNot) {
    if (!fs.existsSync(helper.expectedPath))
      return helper.handleMissingNegated();
    const isDifferent = !!helper.comparator(received, fs.readFileSync(helper.expectedPath), helper.options);
    return isDifferent ? helper.handleDifferentNegated() : helper.handleMatchingNegated();
  }

  if (!fs.existsSync(helper.expectedPath))
    return helper.handleMissing(received, this._stepInfo);

  const expected = fs.readFileSync(helper.expectedPath);

  if (helper.updateSnapshots === 'all') {
    if (!compareBuffersOrStrings(received, expected))
      return helper.handleMatching();
    writeFileSync(helper.expectedPath, received);
    /* eslint-disable no-console */
    console.log(helper.expectedPath + ' is not the same, writing actual.');
    return helper.createMatcherResult(helper.expectedPath + ' running with --update-snapshots, writing actual.', true);
  }

  if (helper.updateSnapshots === 'changed') {
    const result = helper.comparator(received, expected, helper.options);
    if (!result)
      return helper.handleMatching();
    writeFileSync(helper.expectedPath, received);
    /* eslint-disable no-console */
    console.log(helper.expectedPath + ' does not match, writing actual.');
    return helper.createMatcherResult(helper.expectedPath + ' running with --update-snapshots, writing actual.', true);
  }

  const result = helper.comparator(received, expected, helper.options);
  if (!result)
    return helper.handleMatching();

  const receiver = isString(received) ? 'string' : 'Buffer';
  const header = matcherHint(this, undefined, 'toMatchSnapshot', receiver, undefined, undefined, undefined);
  return helper.handleDifferent(received, expected, undefined, result.diff, header, result.errorMessage, undefined, this._stepInfo);
}

export function toHaveScreenshotStepTitle(
  nameOrOptions: NameOrSegments | { name?: NameOrSegments } & ToHaveScreenshotOptions = {},
  optOptions: ToHaveScreenshotOptions = {}
): string {
  let name: NameOrSegments | undefined;
  if (typeof nameOrOptions === 'object' && !Array.isArray(nameOrOptions))
    name = nameOrOptions.name;
  else
    name = nameOrOptions;
  return Array.isArray(name) ? name.join(path.sep) : name || '';
}

export async function toHaveScreenshot(
  this: ExpectMatcherStateInternal,
  pageOrLocator: Page | Locator,
  nameOrOptions: NameOrSegments | { name?: NameOrSegments } & ToHaveScreenshotOptions = {},
  optOptions: ToHaveScreenshotOptions = {}
): Promise<MatcherResult<NameOrSegments | { name?: NameOrSegments }, string>> {
  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`toHaveScreenshot() must be called during the test`);

  if (testInfo._projectInternal.ignoreSnapshots)
    return { pass: !this.isNot, message: () => '', name: 'toHaveScreenshot', expected: nameOrOptions };

  expectTypes(pageOrLocator, ['Page', 'Locator'], 'toHaveScreenshot');
  const [page, locator] = pageOrLocator.constructor.name === 'Page' ? [(pageOrLocator as PageEx), undefined] : [(pageOrLocator as Locator).page() as PageEx, pageOrLocator as Locator];
  const configOptions = testInfo._projectInternal.expect?.toHaveScreenshot || {};
  const helper = new SnapshotHelper(testInfo, 'toHaveScreenshot', locator, undefined, configOptions, nameOrOptions, optOptions);
  if (!helper.expectedPath.toLowerCase().endsWith('.png'))
    throw new Error(`Screenshot name "${path.basename(helper.expectedPath)}" must have '.png' extension`);
  expectTypes(pageOrLocator, ['Page', 'Locator'], 'toHaveScreenshot');
  const style = await loadScreenshotStyles(helper.options.stylePath);
  const timeout = helper.options.timeout ?? this.timeout;
  const expectScreenshotOptions: ExpectScreenshotOptions = {
    locator,
    animations: helper.options.animations ?? 'disabled',
    caret: helper.options.caret ?? 'hide',
    clip: helper.options.clip,
    fullPage: helper.options.fullPage,
    mask: helper.options.mask,
    maskColor: helper.options.maskColor,
    omitBackground: helper.options.omitBackground,
    scale: helper.options.scale ?? 'css',
    style,
    isNot: !!this.isNot,
    timeout,
    comparator: helper.options.comparator,
    maxDiffPixels: helper.options.maxDiffPixels,
    maxDiffPixelRatio: helper.options.maxDiffPixelRatio,
    threshold: helper.options.threshold,
  };

  const hasSnapshot = fs.existsSync(helper.expectedPath);
  if (this.isNot) {
    if (!hasSnapshot)
      return helper.handleMissingNegated();

    // Having `errorMessage` means we timed out while waiting
    // for screenshots not to match, so screenshots
    // are actually the same in the end.
    expectScreenshotOptions.expected = await fs.promises.readFile(helper.expectedPath);
    const isDifferent = !(await page._expectScreenshot(expectScreenshotOptions)).errorMessage;
    return isDifferent ? helper.handleDifferentNegated() : helper.handleMatchingNegated();
  }

  // Fast path: there's no screenshot and we don't intend to update it.
  if (helper.updateSnapshots === 'none' && !hasSnapshot)
    return helper.createMatcherResult(`A snapshot doesn't exist at ${helper.expectedPath}.`, false);

  const receiver = locator ? 'locator' : 'page';
  if (!hasSnapshot) {
    // Regenerate a new screenshot by waiting until two screenshots are the same.
    const { actual, previous, diff, errorMessage, log, timedOut } = await page._expectScreenshot(expectScreenshotOptions);
    // We tried re-generating new snapshot but failed.
    // This can be due to e.g. spinning animation, so we want to show it as a diff.
    if (errorMessage) {
      const header = matcherHint(this, locator, 'toHaveScreenshot', receiver, undefined, undefined, timedOut ? timeout : undefined);
      return helper.handleDifferent(actual, undefined, previous, diff, header, errorMessage, log, this._stepInfo);
    }

    // We successfully generated new screenshot.
    return helper.handleMissing(actual!, this._stepInfo);
  }

  // General case:
  // - snapshot exists
  // - regular matcher (i.e. not a `.not`)
  const expected = await fs.promises.readFile(helper.expectedPath);
  expectScreenshotOptions.expected = helper.updateSnapshots === 'all' ? undefined : expected;

  const { actual, previous, diff, errorMessage, log, timedOut } = await page._expectScreenshot(expectScreenshotOptions);
  const writeFiles = () => {
    writeFileSync(helper.expectedPath, actual!);
    writeFileSync(helper.actualPath, actual!);
    /* eslint-disable no-console */
    console.log(helper.expectedPath + ' is re-generated, writing actual.');
    return helper.createMatcherResult(helper.expectedPath + ' running with --update-snapshots, writing actual.', true);
  };

  if (!errorMessage) {
    // Screenshot is matching, but is not necessarily the same as the expected.
    if (helper.updateSnapshots === 'all' && actual && compareBuffersOrStrings(actual, expected)) {
      console.log(helper.expectedPath + ' is re-generated, writing actual.');
      return writeFiles();
    }
    return helper.handleMatching();
  }

  if (helper.updateSnapshots === 'changed' || helper.updateSnapshots === 'all')
    return writeFiles();

  const header = matcherHint(this, undefined, 'toHaveScreenshot', receiver, undefined, undefined, timedOut ? timeout : undefined);
  return helper.handleDifferent(actual, expectScreenshotOptions.expected, previous, diff, header, errorMessage, log, this._stepInfo);
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
  if (compareMagicBytes(file, [0xff, 0xd8, 0xff]))
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
