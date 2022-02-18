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

/* eslint-disable no-console */
import type { Expect } from '../types';
import { currentTestInfo } from '../globals';
import { mimeTypeToComparator, ComparatorResult, ImageComparatorOptions } from './comparators';
import { addSuffixToFilePath, serializeError, sanitizeForFilePath, trimLongString } from '../util';
import { UpdateSnapshots } from '../types';
import colors from 'colors/safe';
import fs from 'fs';
import path from 'path';
import { TestInfoImpl } from '../testInfo';

// from expect/build/types
type SyncExpectationResult = {
  pass: boolean;
  message: () => string;
};

const extensionToMimeType: { [key: string]: string } = {
  'dat': 'application/octet-string',
  'jpeg': 'image/jpeg',
  'jpg': 'image/jpeg',
  'png': 'image/png',
  'txt': 'text/plain',
};


type NameOrSegments = string | string[];
const SNAPSHOT_COUNTER = Symbol('noname-snapshot-counter');

type MatchSnapshotOptions = { threshold?: number, pixelCount?: number, pixelRatio?: number };

function parseMatchSnapshotOptions(
  testInfo: TestInfoImpl,
  anonymousSnapshotExtension: string,
  nameOrOptions: NameOrSegments | { name: NameOrSegments } & MatchSnapshotOptions,
  optOptions: MatchSnapshotOptions = {},
) {
  let options: { name: NameOrSegments } & ImageComparatorOptions;
  if (Array.isArray(nameOrOptions) || typeof nameOrOptions === 'string')
    options = { name: nameOrOptions, ...optOptions };
  else
    options = { ...nameOrOptions };
  if (!options.name) {
    (testInfo as any)[SNAPSHOT_COUNTER] = ((testInfo as any)[SNAPSHOT_COUNTER] || 0) + 1;
    const fullTitleWithoutSpec = [
      ...testInfo.titlePath.slice(1),
      (testInfo as any)[SNAPSHOT_COUNTER],
    ].join(' ');
    options.name = sanitizeForFilePath(trimLongString(fullTitleWithoutSpec)) + '.' + anonymousSnapshotExtension;
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
  const pathSegments = Array.isArray(options.name) ? options.name : [addSuffixToFilePath(options.name, '', undefined, true)];
  const snapshotPath = testInfo.snapshotPath(...pathSegments);
  const outputFile = testInfo.outputPath(...pathSegments);
  const expectedPath = addSuffixToFilePath(outputFile, '-expected');
  const actualPath = addSuffixToFilePath(outputFile, '-actual');
  const diffPath = addSuffixToFilePath(outputFile, '-diff');

  let updateSnapshots = testInfo.config.updateSnapshots;
  if (updateSnapshots === 'missing' && testInfo.retry < testInfo.project.retries)
    updateSnapshots = 'none';
  const mimeType = extensionToMimeType[path.extname(snapshotPath).substring(1)] ?? 'application/octet-string';
  const comparator = mimeTypeToComparator[mimeType];
  if (!comparator)
    throw new Error('Failed to find comparator with type ' + mimeType + ': ' + snapshotPath);
  return {
    snapshotPath,
    hasSnapshotFile: fs.existsSync(snapshotPath),
    expectedPath,
    actualPath,
    diffPath,
    comparator,
    mimeType,
    updateSnapshots,
    options,
  };
}

export function toMatchSnapshot(
  this: ReturnType<Expect['getState']>,
  received: Buffer | string,
  nameOrOptions: NameOrSegments | { name: NameOrSegments } & MatchSnapshotOptions,
  optOptions: MatchSnapshotOptions = {}
): SyncExpectationResult {
  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`toMatchSnapshot() must be called during the test`);
  const {
    options,
    updateSnapshots,
    snapshotPath,
    hasSnapshotFile,
    expectedPath,
    actualPath,
    diffPath,
    mimeType,
    comparator,
  } = parseMatchSnapshotOptions(testInfo, determineFileExtension(received), nameOrOptions, optOptions);
  if (!hasSnapshotFile)
    return commitMissingSnapshot(testInfo, received, snapshotPath, actualPath, updateSnapshots, this.isNot);
  const expected = fs.readFileSync(snapshotPath);
  const result = comparator(received, expected, options);
  return commitComparatorResult(
      testInfo,
      expected,
      received,
      result,
      mimeType,
      snapshotPath,
      expectedPath,
      actualPath,
      diffPath,
      updateSnapshots,
      this.isNot,
  );
}

function commitMissingSnapshot(
  testInfo: TestInfoImpl,
  actual: Buffer | string,
  snapshotPath: string,
  actualPath: string,
  updateSnapshots: UpdateSnapshots,
  withNegateComparison: boolean,
) {
  const isWriteMissingMode = updateSnapshots === 'all' || updateSnapshots === 'missing';
  const commonMissingSnapshotMessage = `${snapshotPath} is missing in snapshots`;
  if (withNegateComparison) {
    const message = `${commonMissingSnapshotMessage}${isWriteMissingMode ? ', matchers using ".not" won\'t write them automatically.' : '.'}`;
    return { pass: true , message: () => message };
  }
  if (isWriteMissingMode) {
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
    fs.mkdirSync(path.dirname(actualPath), { recursive: true });
    fs.writeFileSync(snapshotPath, actual);
    fs.writeFileSync(actualPath, actual);
  }
  const message = `${commonMissingSnapshotMessage}${isWriteMissingMode ? ', writing actual.' : '.'}`;
  if (updateSnapshots === 'all') {
    console.log(message);
    return { pass: true, message: () => message };
  }
  if (updateSnapshots === 'missing') {
    testInfo._failWithError(serializeError(new Error(message)), false /* isHardError */);
    return { pass: true, message: () => '' };
  }
  return { pass: false, message: () => message };
}

function commitComparatorResult(
  testInfo: TestInfoImpl,
  expected: Buffer | string,
  actual: Buffer | string,
  result: ComparatorResult,
  mimeType: string,
  snapshotPath: string,
  expectedPath: string,
  actualPath: string,
  diffPath: string,
  updateSnapshots: UpdateSnapshots,
  withNegateComparison: boolean,
) {
  if (!result) {
    if (withNegateComparison) {
      const message = [
        colors.red('Snapshot comparison failed:'),
        '',
        indent('Expected result should be different from the actual one.', '  '),
      ].join('\n');
      return {
        pass: true, message: () => message,
      };
    }
    return { pass: true, message: () => '' };
  }

  if (withNegateComparison)
    return { pass: false, message: () => '' };

  if (updateSnapshots === 'all') {
    fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
    fs.writeFileSync(snapshotPath, actual);
    console.log(snapshotPath + ' does not match, writing actual.');
    return {
      pass: true,
      message: () => snapshotPath + ' running with --update-snapshots, writing actual.'
    };
  }

  fs.mkdirSync(path.dirname(expectedPath), { recursive: true });
  fs.mkdirSync(path.dirname(actualPath), { recursive: true });
  fs.writeFileSync(expectedPath, expected);
  fs.writeFileSync(actualPath, actual);
  if (result.diff)
    fs.writeFileSync(diffPath, result.diff);

  const output = [
    colors.red(`Snapshot comparison failed:`),
  ];
  if (result.errorMessage) {
    output.push('');
    output.push(indent(result.errorMessage, '  '));
  }
  output.push('');
  output.push(`Expected: ${colors.yellow(expectedPath)}`);
  output.push(`Received: ${colors.yellow(actualPath)}`);
  if (result.diff)
    output.push(`    Diff: ${colors.yellow(diffPath)}`);

  testInfo.attachments.push({ name: 'expected', contentType: mimeType, path: expectedPath });
  testInfo.attachments.push({ name: 'actual', contentType: mimeType, path: actualPath });
  if (result.diff)
    testInfo.attachments.push({ name: 'diff', contentType: mimeType, path: diffPath });

  return {
    pass: false,
    message: () => output.join('\n'),
  };
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
