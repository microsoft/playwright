/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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
import colors from 'colors/safe';
import fs from 'fs';
import path from 'path';
import jpeg from 'jpeg-js';
import pixelmatch from 'pixelmatch';
import { diff_match_patch, DIFF_INSERT, DIFF_DELETE, DIFF_EQUAL } from '../third_party/diff_match_patch';
import { UpdateSnapshots } from './types';

// Note: we require the pngjs version of pixelmatch to avoid version mismatches.
const { PNG } = require(require.resolve('pngjs', { paths: [require.resolve('pixelmatch')] }));

const extensionToMimeType: { [key: string]: string } = {
  'dat': 'application/octet-string',
  'jpeg': 'image/jpeg',
  'jpg': 'image/jpeg',
  'png': 'image/png',
  'txt': 'text/plain',
};

const GoldenComparators: { [key: string]: any } = {
  'application/octet-string': compareBuffers,
  'image/png': compareImages,
  'image/jpeg': compareImages,
  'text/plain': compareText,
};

function compareBuffers(actualBuffer: Buffer | string, expectedBuffer: Buffer, mimeType: string): { diff?: object; errorMessage?: string; } | null {
  if (!actualBuffer || !(actualBuffer instanceof Buffer))
    return { errorMessage: 'Actual result should be Buffer.' };
  if (Buffer.compare(actualBuffer, expectedBuffer))
    return { errorMessage: 'Buffers differ' };
  return null;
}

function compareImages(actualBuffer: Buffer | string, expectedBuffer: Buffer, mimeType: string, options = {}): { diff?: object; errorMessage?: string; } | null {
  if (!actualBuffer || !(actualBuffer instanceof Buffer))
    return { errorMessage: 'Actual result should be Buffer.' };

  const actual = mimeType === 'image/png' ? PNG.sync.read(actualBuffer) : jpeg.decode(actualBuffer);
  const expected = mimeType === 'image/png' ? PNG.sync.read(expectedBuffer) : jpeg.decode(expectedBuffer);
  if (expected.width !== actual.width || expected.height !== actual.height) {
    return {
      errorMessage: `Sizes differ; expected image ${expected.width}px X ${expected.height}px, but got ${actual.width}px X ${actual.height}px. `
    };
  }
  const diff = new PNG({ width: expected.width, height: expected.height });
  const count = pixelmatch(expected.data, actual.data, diff.data, expected.width, expected.height, { threshold: 0.2, ...options });
  return count > 0 ? { diff: PNG.sync.write(diff) } : null;
}

function compareText(actual: Buffer | string, expectedBuffer: Buffer): { diff?: object; errorMessage?: string; diffExtension?: string; } | null {
  if (typeof actual !== 'string')
    return { errorMessage: 'Actual result should be string' };
  const expected = expectedBuffer.toString('utf-8');
  if (expected === actual)
    return null;
  const dmp = new diff_match_patch();
  const d = dmp.diff_main(expected, actual);
  dmp.diff_cleanupSemantic(d);
  return {
    errorMessage: diff_prettyTerminal(d)
  };
}

export function compare(
  actual: Buffer | string,
  name: string,
  snapshotPath: (name: string) => string,
  outputPath: (name: string) => string,
  updateSnapshots: UpdateSnapshots,
  withNegateComparison: boolean,
  options?: { threshold?: number }
): { pass: boolean; message?: string; expectedPath?: string, actualPath?: string, diffPath?: string, mimeType?: string } {
  const snapshotFile = snapshotPath(name);

  if (!fs.existsSync(snapshotFile)) {
    const isWriteMissingMode = updateSnapshots === 'all' || updateSnapshots === 'missing';
    const commonMissingSnapshotMessage = `${snapshotFile} is missing in snapshots`;
    if (withNegateComparison) {
      const message = `${commonMissingSnapshotMessage}${isWriteMissingMode ? ', matchers using ".not" won\'t write them automatically.' : '.'}`;
      return { pass: true , message };
    }
    if (isWriteMissingMode) {
      fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
      fs.writeFileSync(snapshotFile, actual);
    }
    const message = `${commonMissingSnapshotMessage}${isWriteMissingMode ? ', writing actual.' : '.'}`;
    if (updateSnapshots === 'all') {
      console.log(message);
      return { pass: true, message };
    }
    return { pass: false, message };
  }

  const expected = fs.readFileSync(snapshotFile);
  const extension = path.extname(snapshotFile).substring(1);
  const mimeType = extensionToMimeType[extension] || 'application/octet-string';
  const comparator = GoldenComparators[mimeType];
  if (!comparator) {
    return {
      pass: false,
      message: 'Failed to find comparator with type ' + mimeType + ': ' + snapshotFile,
    };
  }

  const result = comparator(actual, expected, mimeType, options);
  if (!result) {
    if (withNegateComparison) {
      const message = [
        colors.red('Snapshot comparison failed:'),
        '',
        indent('Expected result should be different from the actual one.', '  '),
      ].join('\n');
      return {
        pass: true,
        message,
      };
    }

    return { pass: true };
  }

  if (withNegateComparison) {
    return {
      pass: false,
    };
  }

  if (updateSnapshots === 'all') {
    fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
    fs.writeFileSync(snapshotFile, actual);
    console.log(snapshotFile + ' does not match, writing actual.');
    return {
      pass: true,
      message: snapshotFile + ' running with --update-snapshots, writing actual.'
    };
  }

  const outputFile = outputPath(name);
  const expectedPath = addSuffix(outputFile, '-expected');
  const actualPath = addSuffix(outputFile, '-actual');
  const diffPath = addSuffix(outputFile, '-diff');
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

  return {
    pass: false,
    message: output.join('\n'),
    expectedPath,
    actualPath,
    diffPath,
    mimeType
  };
}

function indent(lines: string, tab: string) {
  return lines.replace(/^(?=.+$)/gm, tab);
}

function addSuffix(filePath: string, suffix: string, customExtension?: string): string {
  const dirname = path.dirname(filePath);
  const ext = path.extname(filePath);
  const name = path.basename(filePath, ext);
  return path.join(dirname, name + suffix + (customExtension || ext));
}

function diff_prettyTerminal(diffs: diff_match_patch.Diff[]) {
  const html = [];
  for (let x = 0; x < diffs.length; x++) {
    const op = diffs[x][0];    // Operation (insert, delete, equal)
    const data = diffs[x][1];  // Text of change.
    const text = data;
    switch (op) {
      case DIFF_INSERT:
        html[x] = colors.green(text);
        break;
      case DIFF_DELETE:
        html[x] = colors.strikethrough(colors.red(text));
        break;
      case DIFF_EQUAL:
        html[x] = text;
        break;
    }
  }
  return html.join('');
}
