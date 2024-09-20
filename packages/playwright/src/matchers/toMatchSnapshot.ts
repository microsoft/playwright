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
import type { ExpectScreenshotOptions, Page as PageEx } from 'playwright-core/lib/client/page';
import { currentTestInfo } from '../common/globals';
import type { ImageComparatorOptions, Comparator } from 'playwright-core/lib/utils';
import { getComparator, sanitizeForFilePath } from 'playwright-core/lib/utils';
import {
  addSuffixToFilePath,
  trimLongString, callLogText,
  expectTypes,
  sanitizeFilePathBeforeExtension,
  windowsFilesystemFriendlyLength } from '../util';
import { colors } from 'playwright-core/lib/utilsBundle';
import fs from 'fs';
import path from 'path';
import { mime } from 'playwright-core/lib/utilsBundle';
import type { TestInfoImpl } from '../worker/testInfo';
import type { ExpectMatcherState } from '../../types/test';
import type { MatcherResult } from './matcherHint';
import type { FullProjectInternal } from '../common/config';

type NameOrSegments = string | string[];
const snapshotNamesSymbol = Symbol('snapshotNames');

type SnapshotNames = {
  anonymousSnapshotIndex: number;
  namedSnapshotIndex: { [key: string]: number };
};

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
  readonly attachmentBaseName: string;
  readonly legacyExpectedPath: string;
  readonly previousPath: string;
  readonly expectedPath: string;
  readonly actualPath: string;
  readonly diffPath: string;
  readonly mimeType: string;
  readonly kind: 'Screenshot'|'Snapshot';
  readonly updateSnapshots: 'all' | 'none' | 'missing';
  readonly comparator: Comparator;
  readonly options: Omit<ToHaveScreenshotOptions, '_comparator'> & { comparator?: string };
  readonly matcherName: string;
  readonly locator: Locator | undefined;

  constructor(
    testInfo: TestInfoImpl,
    matcherName: string,
    locator: Locator | undefined,
    anonymousSnapshotExtension: string,
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

    let snapshotNames = (testInfo as any)[snapshotNamesSymbol] as SnapshotNames;
    if (!(testInfo as any)[snapshotNamesSymbol]) {
      snapshotNames = {
        anonymousSnapshotIndex: 0,
        namedSnapshotIndex: {},
      };
      (testInfo as any)[snapshotNamesSymbol] = snapshotNames;
    }

    let expectedPathSegments: string[];
    let outputBasePath: string;
    if (!name) {
      // Consider the use case below. We should save actual to different paths.
      // Therefore we auto-increment |anonymousSnapshotIndex|.
      //
      //   expect.toMatchSnapshot('a.png')
      //   // noop
      //   expect.toMatchSnapshot('a.png')
      const fullTitleWithoutSpec = [
        ...testInfo.titlePath.slice(1),
        ++snapshotNames.anonymousSnapshotIndex,
      ].join(' ');
      // Note: expected path must not ever change for backwards compatibility.
      expectedPathSegments = [sanitizeForFilePath(trimLongString(fullTitleWithoutSpec)) + '.' + anonymousSnapshotExtension];
      // Trim the output file paths more aggressively to avoid hitting Windows filesystem limits.
      const sanitizedName = sanitizeForFilePath(trimLongString(fullTitleWithoutSpec, windowsFilesystemFriendlyLength)) + '.' + anonymousSnapshotExtension;
      outputBasePath = testInfo._getOutputPath(sanitizedName);
      this.attachmentBaseName = sanitizedName;
    } else {
      // We intentionally do not sanitize user-provided array of segments, assuming
      // it is a file system path. See https://github.com/microsoft/playwright/pull/9156.
      // Note: expected path must not ever change for backwards compatibility.
      expectedPathSegments = Array.isArray(name) ? name : [sanitizeFilePathBeforeExtension(name)];
      const joinedName = Array.isArray(name) ? name.join(path.sep) : sanitizeFilePathBeforeExtension(trimLongString(name, windowsFilesystemFriendlyLength));
      snapshotNames.namedSnapshotIndex[joinedName] = (snapshotNames.namedSnapshotIndex[joinedName] || 0) + 1;
      const index = snapshotNames.namedSnapshotIndex[joinedName];
      const sanitizedName = index > 1 ? addSuffixToFilePath(joinedName, `-${index - 1}`) : joinedName;
      outputBasePath = testInfo._getOutputPath(sanitizedName);
      this.attachmentBaseName = sanitizedName;
    }
    this.expectedPath = testInfo.snapshotPath(...expectedPathSegments);
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
    this.mimeType = mime.getType(path.basename(this.expectedPath)) ?? 'application/octet-string';
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
    const isWriteMissingMode = this.updateSnapshots === 'all' || this.updateSnapshots === 'missing';
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

  handleMissing(actual: Buffer | string): ImageMatcherResult {
    const isWriteMissingMode = this.updateSnapshots === 'all' || this.updateSnapshots === 'missing';
    if (isWriteMissingMode)
      writeFileSync(this.expectedPath, actual);
    this.testInfo.attachments.push({ name: addSuffixToFilePath(this.attachmentBaseName, '-expected'), contentType: this.mimeType, path: this.expectedPath });
    writeFileSync(this.actualPath, actual);
    this.testInfo.attachments.push({ name: addSuffixToFilePath(this.attachmentBaseName, '-actual'), contentType: this.mimeType, path: this.actualPath });
    const message = `A snapshot doesn't exist at ${this.expectedPath}${isWriteMissingMode ? ', writing actual.' : '.'}`;
    if (this.updateSnapshots === 'all') {
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
      this.testInfo.attachments.push({ name: addSuffixToFilePath(this.attachmentBaseName, '-expected'), contentType: this.mimeType, path: this.expectedPath });
      output.push(`\nExpected: ${colors.yellow(this.expectedPath)}`);
    }
    if (previous !== undefined) {
      writeFileSync(this.previousPath, previous);
      this.testInfo.attachments.push({ name: addSuffixToFilePath(this.attachmentBaseName, '-previous'), contentType: this.mimeType, path: this.previousPath });
      output.push(`Previous: ${colors.yellow(this.previousPath)}`);
    }
    if (actual !== undefined) {
      writeFileSync(this.actualPath, actual);
      this.testInfo.attachments.push({ name: addSuffixToFilePath(this.attachmentBaseName, '-actual'), contentType: this.mimeType, path: this.actualPath });
      output.push(`Received: ${colors.yellow(this.actualPath)}`);
    }
    if (diff !== undefined) {
      writeFileSync(this.diffPath, diff);
      this.testInfo.attachments.push({ name: addSuffixToFilePath(this.attachmentBaseName, '-diff'), contentType: this.mimeType, path: this.diffPath });
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
  this: ExpectMatcherState,
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
      testInfo, 'toMatchSnapshot', undefined, determineFileExtension(received),
      configOptions, nameOrOptions, optOptions);

  if (this.isNot) {
    if (!fs.existsSync(helper.expectedPath))
      return helper.handleMissingNegated();
    const isDifferent = !!helper.comparator(received, fs.readFileSync(helper.expectedPath), helper.options);
    return isDifferent ? helper.handleDifferentNegated() : helper.handleMatchingNegated();
  }

  if (!fs.existsSync(helper.expectedPath))
    return helper.handleMissing(received);

  const expected = fs.readFileSync(helper.expectedPath);
  const result = helper.comparator(received, expected, helper.options);
  if (!result)
    return helper.handleMatching();

  if (helper.updateSnapshots === 'all') {
    writeFileSync(helper.expectedPath, received);
    /* eslint-disable no-console */
    console.log(helper.expectedPath + ' does not match, writing actual.');
    return helper.createMatcherResult(helper.expectedPath + ' running with --update-snapshots, writing actual.', true);
  }

  return helper.handleDifferent(received, expected, undefined, result.diff, result.errorMessage, undefined);
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
  this: ExpectMatcherState,
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
  const helper = new SnapshotHelper(testInfo, 'toHaveScreenshot', locator, 'png', configOptions, nameOrOptions, optOptions);
  if (!helper.expectedPath.toLowerCase().endsWith('.png'))
    throw new Error(`Screenshot name "${path.basename(helper.expectedPath)}" must have '.png' extension`);
  expectTypes(pageOrLocator, ['Page', 'Locator'], 'toHaveScreenshot');
  const style = await loadScreenshotStyles(helper.options.stylePath);
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
    timeout: helper.options.timeout ?? this.timeout,
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

  if (!hasSnapshot) {
    // Regenerate a new screenshot by waiting until two screenshots are the same.
    const { actual, previous, diff, errorMessage, log } = await page._expectScreenshot(expectScreenshotOptions);
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
  expectScreenshotOptions.expected = await fs.promises.readFile(helper.expectedPath);
  const { actual, diff, errorMessage, log } = await page._expectScreenshot(expectScreenshotOptions);

  if (!errorMessage)
    return helper.handleMatching();

  if (helper.updateSnapshots === 'all') {
    writeFileSync(helper.expectedPath, actual!);
    writeFileSync(helper.actualPath, actual!);
    /* eslint-disable no-console */
    console.log(helper.expectedPath + ' is re-generated, writing actual.');
    return helper.createMatcherResult(helper.expectedPath + ' running with --update-snapshots, writing actual.', true);
  }

  return helper.handleDifferent(actual, expectScreenshotOptions.expected, undefined, diff, errorMessage, log);
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
