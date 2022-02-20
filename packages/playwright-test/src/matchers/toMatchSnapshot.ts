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
import {
  mimeTypeToComparator,
  ComparatorResult,
  ImageComparatorOptions,
} from 'playwright-core/lib/utils/comparators';
import { addSuffixToFilePath, serializeError, sanitizeForFilePath, trimLongString } from '../util';
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

function parseMatchSnapshotOptions(
  testInfo: TestInfoImpl,
  anonymousSnapshotExtension: string,
  nameOrOptions: NameOrSegments | ({ name?: NameOrSegments } & ImageComparatorOptions),
  optOptions: ImageComparatorOptions,
) {
  let options: ImageComparatorOptions;
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
    name =
      sanitizeForFilePath(trimLongString(fullTitleWithoutSpec)) + '.' + anonymousSnapshotExtension;
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
  const pathSegments = Array.isArray(name)
    ? name
    : [addSuffixToFilePath(name, '', undefined, true)];
  const snapshotPath = testInfo.snapshotPath(...pathSegments);
  const outputFile = testInfo.outputPath(...pathSegments);
  const expectedPath = addSuffixToFilePath(outputFile, '-expected');
  const actualPath = addSuffixToFilePath(outputFile, '-actual');
  const diffPath = addSuffixToFilePath(outputFile, '-diff');

  let updateSnapshots = testInfo.config.updateSnapshots;
  if (updateSnapshots === 'missing' && testInfo.retry < testInfo.project.retries)
    updateSnapshots = 'none';
  const mimeType = mime.getType(path.basename(snapshotPath)) ?? 'application/octet-string';
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
  nameOrOptions: NameOrSegments | ({ name?: NameOrSegments } & ImageComparatorOptions) = {},
  optOptions: ImageComparatorOptions = {},
): SyncExpectationResult {
  const testInfo = currentTestInfo();
  if (!testInfo) throw new Error(`toMatchSnapshot() must be called during the test`);
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
  } = parseMatchSnapshotOptions(
    testInfo,
    determineFileExtension(received),
    nameOrOptions,
    optOptions,
  );
  if (!hasSnapshotFile)
    return commitMissingSnapshot(
      testInfo,
      received,
      snapshotPath,
      actualPath,
      updateSnapshots,
      this.isNot,
    );
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
    const message = `${commonMissingSnapshotMessage}${
      isWriteMissingMode ? ', matchers using ".not" won\'t write them automatically.' : '.'
    }`;
    return { pass: true, message: () => message };
  }
  if (isWriteMissingMode) {
    writeFileSync(snapshotPath, actual);
    writeFileSync(actualPath, actual);
  }
  const message = `${commonMissingSnapshotMessage}${
    isWriteMissingMode ? ', writing actual.' : '.'
  }`;
  if (updateSnapshots === 'all') {
    /* eslint-disable no-console */
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
    const message = withNegateComparison
      ? [
          colors.red('Snapshot comparison failed:'),
          '',
          indent('Expected result should be different from the actual one.', '  '),
        ].join('\n')
      : '';
    return { pass: true, message: () => message };
  }

  if (withNegateComparison) return { pass: false, message: () => '' };

  if (updateSnapshots === 'all') {
    writeFileSync(snapshotPath, actual);
    /* eslint-disable no-console */
    console.log(snapshotPath + ' does not match, writing actual.');
    return {
      pass: true,
      message: () => snapshotPath + ' running with --update-snapshots, writing actual.',
    };
  }

  writeAttachment(testInfo, 'expected', mimeType, expectedPath, expected);
  writeAttachment(testInfo, 'actual', mimeType, actualPath, actual);
  if (result.diff) writeAttachment(testInfo, 'diff', mimeType, diffPath, result.diff);

  const output = [colors.red(`Snapshot comparison failed:`)];
  if (result.errorMessage) {
    output.push('');
    output.push(indent(result.errorMessage, '  '));
  }
  output.push('');
  output.push(`Expected: ${colors.yellow(expectedPath)}`);
  output.push(`Received: ${colors.yellow(actualPath)}`);
  if (result.diff) output.push(`    Diff: ${colors.yellow(diffPath)}`);

  return {
    pass: false,
    message: () => output.join('\n'),
  };
}

function writeFileSync(aPath: string, content: Buffer | string) {
  fs.mkdirSync(path.dirname(aPath), { recursive: true });
  fs.writeFileSync(aPath, content);
}

function writeAttachment(
  testInfo: TestInfoImpl,
  name: string,
  contentType: string,
  aPath: string,
  body: Buffer | string,
) {
  writeFileSync(aPath, body);
  testInfo.attachments.push({ name, contentType, path: aPath });
}

function indent(lines: string, tab: string) {
  return lines.replace(/^(?=.+$)/gm, tab);
}

function determineFileExtension(file: string | Buffer): string {
  if (typeof file === 'string') return 'txt';
  if (compareMagicBytes(file, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (
    compareMagicBytes(
      file,
      [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01],
    )
  )
    return 'jpg';
  return 'dat';
}

function compareMagicBytes(file: Buffer, magicBytes: number[]): boolean {
  return Buffer.compare(Buffer.from(magicBytes), file.slice(0, magicBytes.length)) === 0;
}
