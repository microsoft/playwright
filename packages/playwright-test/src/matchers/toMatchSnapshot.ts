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

import type { Expect } from '../types';
import { currentTestInfo } from '../globals';
import { mimeTypeToComparator, ImageComparatorOptions, Comparator } from 'playwright-core/lib/utils/comparators';
import { addSuffixToFilePath, serializeError, sanitizeForFilePath, trimLongString, callLogText } from '../util';
import { UpdateSnapshots } from '../types';
import colors from 'colors/safe';
import fs from 'fs';
import path from 'path';
import * as mime from 'mime';
import { TestInfoImpl } from '../testInfo';

// from expect/build/types
type SyncExpectationResult = {
  pass: boolean;
  message: () => string;
};

type NameOrSegments = string | string[];
const SNAPSHOT_COUNTER = Symbol('noname-snapshot-counter');

class SnapshotHelper<T extends ImageComparatorOptions> {
  readonly testInfo: TestInfoImpl;
  readonly expectedPath: string;
  readonly snapshotPath: string;
  readonly actualPath: string;
  readonly diffPath: string;
  readonly mimeType: string;
  readonly updateSnapshots: UpdateSnapshots;
  readonly comparatorOptions: T;

  constructor(
    testInfo: TestInfoImpl,
    anonymousSnapshotExtension: string,
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
    if (!name) {
      (testInfo as any)[SNAPSHOT_COUNTER] = ((testInfo as any)[SNAPSHOT_COUNTER] || 0) + 1;
      const fullTitleWithoutSpec = [
        ...testInfo.titlePath.slice(1),
        (testInfo as any)[SNAPSHOT_COUNTER],
      ].join(' ');
      name = sanitizeForFilePath(trimLongString(fullTitleWithoutSpec)) + '.' + anonymousSnapshotExtension;
    }

    options = {
      ...(testInfo.project.expect?.toMatchSnapshot || {}),
      ...options,
    };

    if (options.pixelCount !== undefined && options.pixelCount < 0)
      throw new Error('`pixelCount` option value must be non-negative integer');

    if (options.pixelRatio !== undefined && (options.pixelRatio < 0 || options.pixelRatio > 1))
      throw new Error('`pixelRatio` option value must be between 0 and 1');

    // sanitizes path if string
    const pathSegments = Array.isArray(name) ? name : [addSuffixToFilePath(name, '', undefined, true)];
    const snapshotPath = testInfo.snapshotPath(...pathSegments);
    const outputFile = testInfo.outputPath(...pathSegments);
    const expectedPath = addSuffixToFilePath(outputFile, '-expected');
    const actualPath = addSuffixToFilePath(outputFile, '-actual');
    const diffPath = addSuffixToFilePath(outputFile, '-diff');

    let updateSnapshots = testInfo.config.updateSnapshots;
    if (updateSnapshots === 'missing' && testInfo.retry < testInfo.project.retries)
      updateSnapshots = 'none';
    const mimeType = mime.getType(path.basename(snapshotPath)) ?? 'application/octet-string';
    const comparator: Comparator = mimeTypeToComparator[mimeType];
    if (!comparator)
      throw new Error('Failed to find comparator with type ' + mimeType + ': ' + snapshotPath);

    this.testInfo = testInfo;
    this.mimeType = mimeType;
    this.actualPath = actualPath;
    this.expectedPath = expectedPath;
    this.diffPath = diffPath;
    this.snapshotPath = snapshotPath;
    this.updateSnapshots = updateSnapshots;
    this.comparatorOptions = options;
  }

  handleMissingNegated() {
    const isWriteMissingMode = this.updateSnapshots === 'all' || this.updateSnapshots === 'missing';
    const message = `${this.snapshotPath} is missing in snapshots${isWriteMissingMode ? ', matchers using ".not" won\'t write them automatically.' : '.'}`;
    return {
      // NOTE: 'isNot' matcher implies inversed value.
      pass: true,
      message: () => message,
    };
  }

  handleDifferentNegated() {
    // NOTE: 'isNot' matcher implies inversed value.
    return { pass: false, message: () => '' };
  }

  handleMatchingNegated() {
    const message = [
      colors.red('Snapshot comparison failed:'),
      '',
      indent('Expected result should be different from the actual one.', '  '),
    ].join('\n');
    // NOTE: 'isNot' matcher implies inversed value.
    return { pass: true, message: () => message };
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
      return { pass: true, message: () => message };
    }
    if (this.updateSnapshots === 'missing') {
      this.testInfo._failWithError(serializeError(new Error(message)), false /* isHardError */);
      return { pass: true, message: () => '' };
    }
    return { pass: false, message: () => message };
  }

  handleDifferent(
    actual: Buffer | string | undefined,
    expected: Buffer | string | undefined,
    diff: Buffer | string | undefined,
    diffError: string | undefined,
    log: string[] | undefined,
    title = `Snapshot comparison failed:`) {
    const output = [
      colors.red(title),
      '',
    ];
    if (diffError) {
      output.push(...[
        indent(diffError, '  '),
        '',
      ]);
    }
    if (log)
      output.push(callLogText(log));

    if (expected !== undefined) {
      writeFileSync(this.expectedPath, expected);
      this.testInfo.attachments.push({ name: 'expected', contentType: this.mimeType, path: this.expectedPath });
      output.push(`Expected: ${colors.yellow(this.expectedPath)}`);
    }
    if (actual !== undefined) {
      writeFileSync(this.actualPath, actual);
      this.testInfo.attachments.push({ name: 'actual', contentType: this.mimeType, path: this.actualPath });
      output.push(`Received: ${colors.yellow(this.actualPath)}`);
    }
    if (diff !== undefined) {
      writeFileSync(this.diffPath, diff);
      this.testInfo.attachments.push({ name: 'diff', contentType: this.mimeType, path: this.diffPath });
      output.push(`    Diff: ${colors.yellow(this.diffPath)}`);
    }
    return { pass: false, message: () => output.join('\n'), };
  }

  handleMatching() {
    return { pass: true, message: () => '' };
  }
}

export function toMatchSnapshot(
  this: ReturnType<Expect['getState']>,
  received: Buffer | string,
  nameOrOptions: NameOrSegments | { name?: NameOrSegments } & ImageComparatorOptions = {},
  optOptions: ImageComparatorOptions = {}
): SyncExpectationResult {
  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`toMatchSnapshot() must be called during the test`);
  const helper = new SnapshotHelper(testInfo, determineFileExtension(received), nameOrOptions, optOptions);
  const comparator: Comparator = mimeTypeToComparator[helper.mimeType];
  if (!comparator)
    throw new Error('Failed to find comparator with type ' + helper.mimeType + ': ' + helper.snapshotPath);

  if (this.isNot) {
    if (!fs.existsSync(helper.snapshotPath))
      return helper.handleMissingNegated();
    const isDifferent = !!comparator(received, fs.readFileSync(helper.snapshotPath), helper.comparatorOptions);
    return isDifferent ? helper.handleDifferentNegated() : helper.handleMatchingNegated();
  }

  if (!fs.existsSync(helper.snapshotPath))
    return helper.handleMissing(received);

  const expected = fs.readFileSync(helper.snapshotPath);
  const result = comparator(received, expected, helper.comparatorOptions);
  if (!result)
    return helper.handleMatching();

  if (helper.updateSnapshots === 'all') {
    writeFileSync(helper.snapshotPath, received);
    /* eslint-disable no-console */
    console.log(helper.snapshotPath + ' does not match, writing actual.');
    return { pass: true, message: () => helper.snapshotPath + ' running with --update-snapshots, writing actual.' };
  }

  return helper.handleDifferent(received, expected, result.diff, result.errorMessage, undefined);
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
