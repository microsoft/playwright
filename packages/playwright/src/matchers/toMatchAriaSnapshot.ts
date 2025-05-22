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

import { escapeTemplateString, isString } from 'playwright-core/lib/utils';

import {  kNoElementsFoundError, matcherHint } from './matcherHint';
import { EXPECTED_COLOR } from '../common/expectBundle';
import { callLogText, fileExistsAsync } from '../util';
import { printReceivedStringContainExpectedSubstring } from './expect';
import { currentTestInfo } from '../common/globals';

import type { MatcherResult } from './matcherHint';
import type { LocatorEx } from './matchers';
import type { ExpectMatcherState } from '../../types/test';
import type { MatcherReceived } from '@injected/ariaSnapshot';

type ToMatchAriaSnapshotExpected = {
  name?: string;
  path?: string;
  timeout?: number;
} | string;

type AriaProperty = {
  key: string;
  value?: string;
};

const ARIA_PROPERTY_REGEX = /\[(\w+)(=(\w+))?\]/g;

export async function toMatchAriaSnapshot(
  this: ExpectMatcherState,
  receiver: LocatorEx,
  expectedParam?: ToMatchAriaSnapshotExpected,
  options: { timeout?: number } = {},
): Promise<MatcherResult<string | RegExp, string>> {
  const matcherName = 'toMatchAriaSnapshot';

  const testInfo = currentTestInfo();
  if (!testInfo)
    throw new Error(`toMatchAriaSnapshot() must be called during the test`);

  if (testInfo._projectInternal.ignoreSnapshots)
    return { pass: !this.isNot, message: () => '', name: 'toMatchAriaSnapshot', expected: '' };

  const updateSnapshots = testInfo.config.updateSnapshots;

  const matcherOptions = {
    isNot: this.isNot,
    promise: this.promise,
  };

  let expected: string;
  let timeout: number;
  let expectedPath: string | undefined;
  if (isString(expectedParam)) {
    expected = expectedParam;
    timeout = options.timeout ?? this.timeout;
  } else {
    const legacyPath = testInfo._resolveSnapshotPaths('aria', expectedParam?.name, 'dontUpdateSnapshotIndex', '.yml').absoluteSnapshotPath;
    expectedPath = testInfo._resolveSnapshotPaths('aria', expectedParam?.name, 'updateSnapshotIndex').absoluteSnapshotPath;
    // in 1.51, we changed the default template to use .aria.yml extension
    // for backwards compatibility, we check for the legacy .yml extension
    if (!(await fileExistsAsync(expectedPath)) && await fileExistsAsync(legacyPath))
      expectedPath = legacyPath;
    expected = await fs.promises.readFile(expectedPath, 'utf8').catch(() => '');
    timeout = expectedParam?.timeout ?? this.timeout;
  }

  const generateMissingBaseline = updateSnapshots === 'missing' && !expected;
  if (generateMissingBaseline) {
    if (this.isNot) {
      const message = `Matchers using ".not" can't generate new baselines`;
      return { pass: this.isNot, message: () => message, name: 'toMatchAriaSnapshot' };
    } else {
      // When generating new baseline, run entire pipeline against impossible match.
      expected = `- none "Generating new baseline"`;
    }
  }

  expected = unshift(expected);
  const { matches: pass, received, log, timedOut } = await receiver._expect('to.match.aria', { expectedValue: expected, isNot: this.isNot, timeout });
  const typedReceived = received as MatcherReceived | typeof kNoElementsFoundError;

  console.log(typedReceived);

  const messagePrefix = matcherHint(this, receiver, matcherName, 'locator', undefined, matcherOptions, timedOut ? timeout : undefined);
  const notFound = typedReceived === kNoElementsFoundError;
  if (notFound) {
    return {
      pass: this.isNot,
      message: () => messagePrefix + `Expected: ${this.utils.printExpected(expected)}\nReceived: ${EXPECTED_COLOR('<element not found>')}` + callLogText(log),
      name: 'toMatchAriaSnapshot',
      expected,
    };
  }

  const expectedLines = expected.split('\n');
  const actualLines = typedReceived.raw.split('\n');

  // const length = Math.min(actualLines.length, expectedLines.length);

  // for (let i = 0; i < length; i++) {
  //   const expectedLine = expectedLines[i];
  //   const actualLine = actualLines[i];

  //   const expectedMatch = expectedLine.match(/\/(.*)\//);
  //   if (expectedMatch && expectedMatch.index !== undefined) {
  //     try {
  //       const regex = new RegExp(expectedMatch[1]);

  //       const actualMatch = actualLine.match(regex);
  //       if (actualMatch)
  //         expectedLines[i] = expectedLine.slice(0, expectedMatch.index) + actualMatch[0] + expectedLine.slice(expectedMatch.index + expectedMatch[0].length);
  //     } catch (e) {
  //       // Skip invalid regex
  //     }
  //   }

  //   const expectedProps = extractProperties(expectedLine);
  //   const actualProps = extractProperties(actualLine);
  //   const actualPropsMap = new Map(actualProps.map(({ key, value }) => [key, value]));

  //   let propsMatch = true;

  //   for (const { key, value } of expectedProps) {
  //     const actualValue = actualPropsMap.get(key);
  //     if (!actualValue || actualValue !== value) {
  //       propsMatch = false;
  //       break;
  //     }
  //   }

  //   if (propsMatch) {
  //     actualLines[i] = actualLines[i].split(ARIA_PROPERTY_REGEX)[0].trimEnd();
  //     if (expectedProps.length > 0) {
  //       const actualPropsString = expectedProps.map(({ key, value }) => `[${key}${value ? '=' + value : ''}]`).join(' ');
  //       actualLines[i] += ` ${actualPropsString}`;
  //     }
  //   }
  // }
  for (const entry of typedReceived.matchEntries) {
    if (entry.templateLineNumber === undefined) {
      console.log(`No template line number for ${entry.ariaNodeDFSIndex}`);
      continue;
    }
    console.log(`Copying "${actualLines[entry.ariaNodeDFSIndex - 1]}" to ${expectedLines[entry.templateLineNumber - 1]}`);
    expectedLines[entry.templateLineNumber - 1] = actualLines[entry.ariaNodeDFSIndex - 1];
  }

  const receivedText = actualLines.join('\n');
  expected = expectedLines.join('\n');
  const message = () => {
    if (pass) {
      if (notFound)
        return messagePrefix + `Expected: not ${this.utils.printExpected(expected)}\nReceived: ${receivedText}` + callLogText(log);
      const printedReceived = printReceivedStringContainExpectedSubstring(receivedText, receivedText.indexOf(expected), expected.length);
      return messagePrefix + `Expected: not ${this.utils.printExpected(expected)}\nReceived: ${printedReceived}` + callLogText(log);
    } else {
      const labelExpected = `Expected`;
      if (notFound)
        return messagePrefix + `${labelExpected}: ${this.utils.printExpected(expected)}\nReceived: ${receivedText}` + callLogText(log);
      return messagePrefix + this.utils.printDiffOrStringify(expected, receivedText, labelExpected, 'Received', false) + callLogText(log);
    }
  };

  if (!this.isNot) {
    if ((updateSnapshots === 'all') ||
        (updateSnapshots === 'changed' && pass === this.isNot) ||
        generateMissingBaseline) {
      if (expectedPath) {
        await fs.promises.mkdir(path.dirname(expectedPath), { recursive: true });
        await fs.promises.writeFile(expectedPath, typedReceived.regex, 'utf8');
        const relativePath = path.relative(process.cwd(), expectedPath);
        if (updateSnapshots === 'missing') {
          const message = `A snapshot doesn't exist at ${relativePath}, writing actual.`;
          testInfo._hasNonRetriableError = true;
          testInfo._failWithError(new Error(message));
        } else {
          const message = `A snapshot is generated at ${relativePath}.`;
          /* eslint-disable no-console */
          console.log(message);
        }
        return { pass: true, message: () => '', name: 'toMatchAriaSnapshot' };
      } else {
        const suggestedRebaseline = `\`\n${escapeTemplateString(indent(typedReceived.regex, '{indent}  '))}\n{indent}\``;
        if (updateSnapshots === 'missing') {
          const message = 'A snapshot is not provided, generating new baseline.';
          testInfo._hasNonRetriableError = true;
          testInfo._failWithError(new Error(message));
        }
        // TODO: ideally, we should return "pass: true" here because this matcher passes
        // when regenerating baselines. However, we can only access suggestedRebaseline in case
        // of an error, so we fail here and workaround it in the expect implementation.
        return { pass: false, message: () => '', name: 'toMatchAriaSnapshot', suggestedRebaseline };
      }
    }
  }

  return {
    name: matcherName,
    expected,
    message,
    pass,
    actual: received,
    log,
    timeout: timedOut ? timeout : undefined,
  };
}

function unshift(snapshot: string): string {
  const lines = snapshot.split('\n');
  let whitespacePrefixLength = 100;
  for (const line of lines) {
    if (!line.trim())
      continue;
    const match = line.match(/^(\s*)/);
    if (match && match[1].length < whitespacePrefixLength)
      whitespacePrefixLength = match[1].length;
  }
  return lines.filter(t => t.trim()).map(line => line.substring(whitespacePrefixLength)).join('\n');
}

function indent(snapshot: string, indent: string): string {
  return snapshot.split('\n').map(line => indent + line).join('\n');
}

function extractProperties(line: string): AriaProperty[] {
  const props: AriaProperty[] = [];

  for (const match of line.matchAll(ARIA_PROPERTY_REGEX)) {
    const key = match[1];
    const value = match[3];
    props.push({ key, value });
  }

  return props;
}
